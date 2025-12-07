import { getDb } from "./db"
import { syncMetricsCollector } from "./sync-metrics"
import type { UptimeKumaSource, Monitor, UptimeKumaMonitor, UptimeKumaHeartbeat } from "./types"

export interface SyncResult {
  sourceId: number
  success: boolean
  monitorsUpdated: number
  heartbeatsFetched: number
  error?: string
  duration: number
  timestamp: Date
}

export interface SyncProgress {
  sourceId: number
  status: 'pending' | 'fetching-monitors' | 'fetching-heartbeats' | 'updating-db' | 'completed' | 'failed'
  progress: number
  currentStep?: string
}

export interface SyncOptions {
  incremental?: boolean
  includeHeartbeats?: boolean
  timeout?: number
  maxRetries?: number
}

class SyncEngine {
  private isSyncing = false
  private currentSyncId: string | null = null
  private progressCallbacks: ((progress: SyncProgress) => void)[] = []

  constructor() {
    this.initializeDatabase()
  }

  private initializeDatabase() {
    const db = getDb()
    // Add sync history table for tracking sync operations
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER,
        sync_id TEXT NOT NULL,
        status TEXT NOT NULL,
        monitors_updated INTEGER DEFAULT 0,
        heartbeats_fetched INTEGER DEFAULT 0,
        error_message TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        duration_ms INTEGER,
        FOREIGN KEY (source_id) REFERENCES uptime_kuma_sources(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sync_history_source ON sync_history(source_id);
      CREATE INDEX IF NOT EXISTS idx_sync_history_sync_id ON sync_history(sync_id);
    `)
  }

  async syncSource(source: UptimeKumaSource, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now()
    const syncId = this.generateSyncId()
    const defaultOptions: SyncOptions = {
      incremental: false,
      includeHeartbeats: true,
      timeout: 30000,
      maxRetries: 3
    }
    const finalOptions = { ...defaultOptions, ...options }

    this.updateProgress(source.id, 'pending', 0, 'Starting sync')

    try {
      this.isSyncing = true
      this.currentSyncId = syncId

      const result = await this.withRetry(
        () => this.performSourceSync(source, finalOptions, syncId),
        finalOptions.maxRetries!
      )

      const duration = Date.now() - startTime
      this.recordSyncHistory(source.id, syncId, 'completed', result, duration)

      // Record metrics
      await syncMetricsCollector.recordSyncMetrics(
        source.id,
        syncId,
        duration,
        true,
        result.monitorsUpdated,
        result.heartbeatsFetched
      )

      return {
        ...result,
        duration,
        timestamp: new Date()
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      this.recordSyncHistory(source.id, syncId, 'failed', {
        monitorsUpdated: 0,
        heartbeatsFetched: 0
      }, duration, error.message)

      // Record metrics
      await syncMetricsCollector.recordSyncMetrics(
        source.id,
        syncId,
        duration,
        false,
        0,
        0,
        error.message
      )

      return {
        sourceId: source.id,
        success: false,
        monitorsUpdated: 0,
        heartbeatsFetched: 0,
        error: error.message,
        duration,
        timestamp: new Date()
      }
    } finally {
      this.isSyncing = false
      this.currentSyncId = null
    }
  }

  private async performSourceSync(
    source: UptimeKumaSource, 
    options: SyncOptions, 
    syncId: string
  ): Promise<Omit<SyncResult, 'timestamp' | 'duration'>> {
    const baseUrl = source.url.replace(/\/$/, "")
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    }

    this.updateProgress(source.id, 'fetching-monitors', 25, 'Fetching monitors')

    // Fetch monitor metadata with timeout
    const monitorsResponse = await this.fetchWithTimeout(
      `${baseUrl}/api/status-page/${source.slug}`,
      { headers },
      options.timeout!
    )

    if (!monitorsResponse.ok) {
      throw new Error(`Failed to fetch monitors: ${monitorsResponse.statusText}. Make sure the status page slug "${source.slug}" is correct.`)
    }

    const data = await monitorsResponse.json()
    const db = getDb()

    let monitorsUpdated = 0
    let heartbeatsFetched = 0

    this.updateProgress(source.id, 'updating-db', 50, 'Updating database')

    // Handle the response structure from Uptime Kuma status page API
    if (data.config && data.config.published) {
      const publicGroupList = data.publicGroupList || []

      for (const group of publicGroupList) {
        const monitorList = group.monitorList || []

        for (const monitor of monitorList) {
          // Insert or update monitor
          const monitorStmt = db.prepare(`
            INSERT INTO monitors (id, source_id, name, url, type, interval, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id, source_id) DO UPDATE SET
              name = excluded.name,
              url = excluded.url,
              type = excluded.type,
              interval = excluded.interval,
              updated_at = CURRENT_TIMESTAMP
          `)

          monitorStmt.run(
            monitor.id,
            source.id,
            monitor.name,
            monitor.url || null,
            monitor.type || null,
            monitor.interval || null
          )
          monitorsUpdated++
        }
      }
    }

    // Fetch and cache heartbeat data if requested
    if (options.includeHeartbeats) {
      this.updateProgress(source.id, 'fetching-heartbeats', 75, 'Fetching heartbeats')
      
      try {
        const heartbeatResponse = await this.fetchWithTimeout(
          `${baseUrl}/api/status-page/heartbeat/${source.slug}`,
          {},
          options.timeout!
        )
        
        if (heartbeatResponse.ok) {
          const heartbeatData = await heartbeatResponse.json()
          const { setCachedHeartbeats } = await import("./heartbeat-cache")
          setCachedHeartbeats(source.id, heartbeatData.heartbeatList || {})
          heartbeatsFetched = Object.keys(heartbeatData.heartbeatList || {}).length
        }
      } catch (error) {
        console.error(`Failed to fetch heartbeats for source ${source.id}:`, error)
        // Don't fail the entire sync if heartbeats fail
      }
    }

    this.updateProgress(source.id, 'completed', 100, 'Sync completed')

    return {
      sourceId: source.id,
      success: true,
      monitorsUpdated,
      heartbeatsFetched
    }
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  private generateSyncId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private updateProgress(
    sourceId: number, 
    status: SyncProgress['status'], 
    progress: number, 
    currentStep?: string
  ) {
    const progressUpdate: SyncProgress = {
      sourceId,
      status,
      progress,
      currentStep
    }

    this.progressCallbacks.forEach(callback => {
      try {
        callback(progressUpdate)
      } catch (error) {
        console.error('Error in progress callback:', error)
      }
    })
  }

  private recordSyncHistory(
    sourceId: number,
    syncId: string,
    status: string,
    result: { monitorsUpdated: number; heartbeatsFetched: number },
    duration: number,
    errorMessage?: string
  ) {
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO sync_history 
      (source_id, sync_id, status, monitors_updated, heartbeats_fetched, error_message, completed_at, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `)

    stmt.run(
      sourceId,
      syncId,
      status,
      result.monitorsUpdated,
      result.heartbeatsFetched,
      errorMessage,
      duration
    )
  }

  // Public methods
  onProgress(callback: (progress: SyncProgress) => void): () => void {
    this.progressCallbacks.push(callback)
    return () => {
      const index = this.progressCallbacks.indexOf(callback)
      if (index > -1) {
        this.progressCallbacks.splice(index, 1)
      }
    }
  }

  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      currentSyncId: this.currentSyncId
    }
  }

  async getSyncHistory(sourceId?: number, limit = 50) {
    const db = getDb()
    let query = `
      SELECT sh.*, uks.name as source_name
      FROM sync_history sh
      LEFT JOIN uptime_kuma_sources uks ON sh.source_id = uks.id
    `
    const params: any[] = []

    if (sourceId) {
      query += " WHERE sh.source_id = ?"
      params.push(sourceId)
    }

    query += " ORDER BY sh.started_at DESC LIMIT ?"
    params.push(limit)

    return db.prepare(query).all(...params)
  }
}

export const syncEngine = new SyncEngine()
