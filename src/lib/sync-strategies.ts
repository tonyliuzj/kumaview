import { getDb } from "./db"
import type { UptimeKumaSource, Monitor, UptimeKumaMonitor } from "./types"

export interface SyncStrategy {
  name: string
  description: string
  shouldSync(source: UptimeKumaSource, lastSyncTime?: Date): Promise<boolean>
  getSyncOptions(): Partial<any>
}

export interface DeltaSyncResult {
  hasChanges: boolean
  addedMonitors: number
  updatedMonitors: number
  removedMonitors: number
  changedMonitorIds: number[]
}

export class FullSyncStrategy implements SyncStrategy {
  name = "full"
  description = "Always perform full sync of all monitors and heartbeats"

  async shouldSync(source: UptimeKumaSource, lastSyncTime?: Date): Promise<boolean> {
    // Always sync with full strategy
    return true
  }

  getSyncOptions(): Partial<any> {
    return {
      incremental: false,
      includeHeartbeats: true
    }
  }
}

export class IncrementalSyncStrategy implements SyncStrategy {
  name = "incremental"
  description = "Only sync if changes are detected since last sync"

  async shouldSync(source: UptimeKumaSource, lastSyncTime?: Date): Promise<boolean> {
    if (!lastSyncTime) {
      return true // No previous sync, do full sync
    }

    // Check if there are any monitors updated since last sync
    const db = getDb()
    const row = db.prepare(`
      SELECT COUNT(*) as count 
      FROM monitors 
      WHERE source_id = ? AND updated_at > ?
    `).get(source.id, lastSyncTime.toISOString()) as { count: number }

    return row.count > 0
  }

  getSyncOptions(): Partial<any> {
    return {
      incremental: true,
      includeHeartbeats: true
    }
  }
}

export class SmartSyncStrategy implements SyncStrategy {
  name = "smart"
  description = "Use heuristics to determine optimal sync strategy"

  async shouldSync(source: UptimeKumaSource, lastSyncTime?: Date): Promise<boolean> {
    if (!lastSyncTime) {
      return true // First sync
    }

    const timeSinceLastSync = Date.now() - lastSyncTime.getTime()
    const fiveMinutes = 5 * 60 * 1000

    // If it's been more than 5 minutes, sync anyway
    if (timeSinceLastSync > fiveMinutes) {
      return true
    }

    // Check for recent changes
    const db = getDb()
    const row = db.prepare(`
      SELECT COUNT(*) as count 
      FROM monitors 
      WHERE source_id = ? AND updated_at > ?
    `).get(source.id, lastSyncTime.toISOString()) as { count: number }

    return row.count > 0
  }

  getSyncOptions(): Partial<any> {
    return {
      incremental: true,
      includeHeartbeats: true
    }
  }
}

export class HeartbeatOnlySyncStrategy implements SyncStrategy {
  name = "heartbeat-only"
  description = "Only sync heartbeat data, skip monitor metadata"

  async shouldSync(source: UptimeKumaSource, lastSyncTime?: Date): Promise<boolean> {
    // Always sync heartbeats as they change frequently
    return true
  }

  getSyncOptions(): Partial<any> {
    return {
      incremental: true,
      includeHeartbeats: true
    }
  }
}

export class DeltaSyncStrategy implements SyncStrategy {
  name = "delta"
  description = "Detect and sync only changed monitors"

  async shouldSync(source: UptimeKumaSource, lastSyncTime?: Date): Promise<boolean> {
    if (!lastSyncTime) {
      return true // First sync, need full data
    }

    // Check for any changes since last sync
    const delta = await this.detectChanges(source, lastSyncTime)
    return delta.hasChanges
  }

  async detectChanges(source: UptimeKumaSource, since: Date): Promise<DeltaSyncResult> {
    const db = getDb()
    
    // Get current monitors from database
    const currentMonitors = db.prepare(`
      SELECT id, name, url, type, interval, updated_at
      FROM monitors 
      WHERE source_id = ?
    `).all(source.id) as Monitor[]

    // Fetch fresh monitor data from source
    const baseUrl = source.url.replace(/\/$/, "")
    const response = await fetch(`${baseUrl}/api/status-page/${source.slug}`, {
      headers: { "Content-Type": "application/json" }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch monitors for delta detection: ${response.statusText}`)
    }

    const data = await response.json()
    const remoteMonitors: UptimeKumaMonitor[] = []

    if (data.config && data.config.published) {
      const publicGroupList = data.publicGroupList || []
      for (const group of publicGroupList) {
        const monitorList = group.monitorList || []
        for (const monitor of monitorList) {
          remoteMonitors.push({
            id: monitor.id,
            name: monitor.name,
            url: monitor.url,
            type: monitor.type,
            interval: monitor.interval,
            active: monitor.active !== false
          })
        }
      }
    }

    // Compare monitors
    const currentMonitorMap = new Map(currentMonitors.map(m => [m.id, m]))
    const remoteMonitorMap = new Map(remoteMonitors.map(m => [m.id, m]))

    const addedMonitors = remoteMonitors.filter(rm => !currentMonitorMap.has(rm.id))
    const removedMonitors = currentMonitors.filter(cm => !remoteMonitorMap.has(cm.id))
    
    const updatedMonitors = remoteMonitors.filter(rm => {
      const current = currentMonitorMap.get(rm.id)
      if (!current) return false
      
      return current.name !== rm.name ||
             current.url !== rm.url ||
             current.type !== rm.type ||
             current.interval !== rm.interval
    })

    const changedMonitorIds = [
      ...addedMonitors.map(m => m.id),
      ...updatedMonitors.map(m => m.id),
      ...removedMonitors.map(m => m.id)
    ]

    return {
      hasChanges: addedMonitors.length > 0 || updatedMonitors.length > 0 || removedMonitors.length > 0,
      addedMonitors: addedMonitors.length,
      updatedMonitors: updatedMonitors.length,
      removedMonitors: removedMonitors.length,
      changedMonitorIds
    }
  }

  getSyncOptions(): Partial<any> {
    return {
      incremental: true,
      includeHeartbeats: true
    }
  }
}

// Strategy registry
export class SyncStrategyRegistry {
  private strategies = new Map<string, SyncStrategy>()

  constructor() {
    this.registerStrategy(new FullSyncStrategy())
    this.registerStrategy(new IncrementalSyncStrategy())
    this.registerStrategy(new SmartSyncStrategy())
    this.registerStrategy(new HeartbeatOnlySyncStrategy())
    this.registerStrategy(new DeltaSyncStrategy())
  }

  registerStrategy(strategy: SyncStrategy) {
    this.strategies.set(strategy.name, strategy)
  }

  getStrategy(name: string): SyncStrategy | undefined {
    return this.strategies.get(name)
  }

  listStrategies(): SyncStrategy[] {
    return Array.from(this.strategies.values())
  }

  getDefaultStrategy(): SyncStrategy {
    return this.getStrategy("smart")!
  }
}

// Export singleton instance
export const syncStrategyRegistry = new SyncStrategyRegistry()
