import { getDb } from "./db"

export interface SyncMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  averageDuration: number
  lastSyncTime: Date | null
  sourcesCount: number
  monitorsCount: number
  uptime24h: number
  uptime30d: number
}

export interface PerformanceMetrics {
  p50: number
  p90: number
  p95: number
  p99: number
  min: number
  max: number
  average: number
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  issues: string[]
  lastSuccessfulSync: Date | null
  syncSuccessRate: number
}

class SyncMetricsCollector {
  private metricsCache = new Map<string, any>()
  private cacheTTL = 60000 // 1 minute

  constructor() {
    this.initializeDatabase()
  }

  private initializeDatabase() {
    const db = getDb()
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER,
        sync_id TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        monitors_updated INTEGER DEFAULT 0,
        heartbeats_fetched INTEGER DEFAULT 0,
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES uptime_kuma_sources(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sync_metrics_timestamp ON sync_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sync_metrics_source ON sync_metrics(source_id);
      CREATE INDEX IF NOT EXISTS idx_sync_metrics_success ON sync_metrics(success);
    `)
  }

  async recordSyncMetrics(
    sourceId: number,
    syncId: string,
    duration: number,
    success: boolean,
    monitorsUpdated: number,
    heartbeatsFetched: number,
    errorMessage?: string
  ): Promise<void> {
    const db = getDb()
    db.prepare(`
      INSERT INTO sync_metrics 
      (source_id, sync_id, duration_ms, success, monitors_updated, heartbeats_fetched, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sourceId,
      syncId,
      duration,
      success ? 1 : 0,
      monitorsUpdated,
      heartbeatsFetched,
      errorMessage
    )

    // Invalidate cache
    this.metricsCache.clear()
  }

  async getOverallMetrics(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<SyncMetrics> {
    const cacheKey = `overall_${timeRange}`
    const cached = this.metricsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }

    const db = getDb()
    const timeWindow = this.getTimeWindow(timeRange)

    // Get sync statistics
    const syncStats = db.prepare(`
      SELECT 
        COUNT(*) as total_syncs,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_syncs,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_syncs,
        AVG(duration_ms) as avg_duration,
        MAX(timestamp) as last_sync
      FROM sync_metrics
      WHERE timestamp > ?
    `).get(timeWindow) as {
      total_syncs: number
      successful_syncs: number
      failed_syncs: number
      avg_duration: number
      last_sync: string
    }

    // Get source and monitor counts
    const sourceCount = db.prepare("SELECT COUNT(*) as count FROM uptime_kuma_sources").get() as { count: number }
    const monitorCount = db.prepare("SELECT COUNT(*) as count FROM monitors").get() as { count: number }

    // Calculate uptime (simplified - based on successful syncs)
    const uptime24h = syncStats.total_syncs > 0 ? syncStats.successful_syncs / syncStats.total_syncs : 0

    const metrics: SyncMetrics = {
      totalSyncs: syncStats.total_syncs,
      successfulSyncs: syncStats.successful_syncs,
      failedSyncs: syncStats.failed_syncs,
      averageDuration: Math.round(syncStats.avg_duration || 0),
      lastSyncTime: syncStats.last_sync ? new Date(syncStats.last_sync) : null,
      sourcesCount: sourceCount.count,
      monitorsCount: monitorCount.count,
      uptime24h: uptime24h,
      uptime30d: uptime24h // Simplified - same as 24h for now
    }

    this.metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() })
    return metrics
  }

  async getPerformanceMetrics(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<PerformanceMetrics> {
    const cacheKey = `performance_${timeRange}`
    const cached = this.metricsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }

    const db = getDb()
    const timeWindow = this.getTimeWindow(timeRange)

    const durations = db.prepare(`
      SELECT duration_ms 
      FROM sync_metrics 
      WHERE timestamp > ? AND success = 1
      ORDER BY duration_ms
    `).all(timeWindow) as { duration_ms: number }[]

    if (durations.length === 0) {
      const emptyMetrics: PerformanceMetrics = {
        p50: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        average: 0
      }
      this.metricsCache.set(cacheKey, { data: emptyMetrics, timestamp: Date.now() })
      return emptyMetrics
    }

    const durationValues = durations.map(d => d.duration_ms).sort((a, b) => a - b)
    
    const metrics: PerformanceMetrics = {
      p50: this.percentile(durationValues, 0.5),
      p90: this.percentile(durationValues, 0.9),
      p95: this.percentile(durationValues, 0.95),
      p99: this.percentile(durationValues, 0.99),
      min: Math.min(...durationValues),
      max: Math.max(...durationValues),
      average: Math.round(durationValues.reduce((a, b) => a + b, 0) / durationValues.length)
    }

    this.metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() })
    return metrics
  }

  async getSourceMetrics(sourceId: number, timeRange: '24h' | '7d' | '30d' = '24h'): Promise<SyncMetrics> {
    const cacheKey = `source_${sourceId}_${timeRange}`
    const cached = this.metricsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }

    const db = getDb()
    const timeWindow = this.getTimeWindow(timeRange)

    const syncStats = db.prepare(`
      SELECT 
        COUNT(*) as total_syncs,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_syncs,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_syncs,
        AVG(duration_ms) as avg_duration,
        MAX(timestamp) as last_sync,
        SUM(monitors_updated) as total_monitors_updated,
        SUM(heartbeats_fetched) as total_heartbeats_fetched
      FROM sync_metrics
      WHERE source_id = ? AND timestamp > ?
    `).get(sourceId, timeWindow) as {
      total_syncs: number
      successful_syncs: number
      failed_syncs: number
      avg_duration: number
      last_sync: string
      total_monitors_updated: number
      total_heartbeats_fetched: number
    }

    const monitorCount = db.prepare("SELECT COUNT(*) as count FROM monitors WHERE source_id = ?").get(sourceId) as { count: number }

    const uptime = syncStats.total_syncs > 0 ? syncStats.successful_syncs / syncStats.total_syncs : 0

    const metrics: SyncMetrics = {
      totalSyncs: syncStats.total_syncs,
      successfulSyncs: syncStats.successful_syncs,
      failedSyncs: syncStats.failed_syncs,
      averageDuration: Math.round(syncStats.avg_duration || 0),
      lastSyncTime: syncStats.last_sync ? new Date(syncStats.last_sync) : null,
      sourcesCount: 1, // Single source
      monitorsCount: monitorCount.count,
      uptime24h: uptime,
      uptime30d: uptime // Simplified
    }

    this.metricsCache.set(cacheKey, { data: metrics, timestamp: Date.now() })
    return metrics
  }

  async getHealthCheck(): Promise<HealthCheckResult> {
    const metrics = await this.getOverallMetrics('24h')
    const issues: string[] = []

    // Check sync success rate
    const syncSuccessRate = metrics.totalSyncs > 0 ? metrics.successfulSyncs / metrics.totalSyncs : 1
    if (syncSuccessRate < 0.9) {
      issues.push(`Low sync success rate: ${(syncSuccessRate * 100).toFixed(1)}%`)
    }

    // Check last sync time
    if (metrics.lastSyncTime) {
      const timeSinceLastSync = Date.now() - metrics.lastSyncTime.getTime()
      const oneHour = 60 * 60 * 1000
      if (timeSinceLastSync > oneHour) {
        issues.push(`No successful syncs in the last hour`)
      }
    } else {
      issues.push(`No syncs recorded`)
    }

    // Check average duration
    if (metrics.averageDuration > 30000) { // 30 seconds
      issues.push(`High average sync duration: ${metrics.averageDuration}ms`)
    }

    // Determine overall status
    let status: HealthCheckResult['status'] = 'healthy'
    if (issues.length > 0) {
      status = syncSuccessRate < 0.5 ? 'unhealthy' : 'degraded'
    }

    return {
      status,
      issues,
      lastSuccessfulSync: metrics.lastSyncTime,
      syncSuccessRate
    }
  }

  async getErrorBreakdown(timeRange: '24h' | '7d' | '30d' = '24h'): Promise<Map<string, number>> {
    const db = getDb()
    const timeWindow = this.getTimeWindow(timeRange)

    const errors = db.prepare(`
      SELECT error_message, COUNT(*) as count
      FROM sync_metrics
      WHERE success = 0 AND timestamp > ? AND error_message IS NOT NULL
      GROUP BY error_message
      ORDER BY count DESC
    `).all(timeWindow) as { error_message: string; count: number }[]

    const breakdown = new Map<string, number>()
    errors.forEach(error => {
      breakdown.set(error.error_message, error.count)
    })

    return breakdown
  }

  async clearOldMetrics(retentionDays: number = 30): Promise<void> {
    const db = getDb()
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
    
    db.prepare("DELETE FROM sync_metrics WHERE timestamp < ?").run(cutoffDate)
    this.metricsCache.clear()
  }

  private getTimeWindow(timeRange: '24h' | '7d' | '30d'): string {
    const now = Date.now()
    let windowMs: number

    switch (timeRange) {
      case '24h':
        windowMs = 24 * 60 * 60 * 1000
        break
      case '7d':
        windowMs = 7 * 24 * 60 * 60 * 1000
        break
      case '30d':
        windowMs = 30 * 24 * 60 * 60 * 1000
        break
      default:
        windowMs = 24 * 60 * 60 * 1000
    }

    return new Date(now - windowMs).toISOString()
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0
    const index = Math.ceil(arr.length * p) - 1
    return arr[Math.max(0, Math.min(index, arr.length - 1))]
  }
}

export const syncMetricsCollector = new SyncMetricsCollector()
