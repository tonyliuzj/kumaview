import { getDb } from "./db"
import { syncEngine, SyncResult, SyncOptions } from "./sync-engine"
import type { UptimeKumaSource } from "./types"

export interface SchedulerConfig {
  intervalSeconds: number
  enabled: boolean
  concurrentSyncs: number
  syncOptions: SyncOptions
}

export interface SchedulerStatus {
  isRunning: boolean
  lastRun: Date | null
  nextRun: Date | null
  currentJobs: Array<{
    sourceId: number
    sourceName: string
    startedAt: Date
  }>
  config: SchedulerConfig
}

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private lastRun: Date | null = null
  private currentJobs: Map<number, { source: UptimeKumaSource; startedAt: Date }> = new Map()
  private config: SchedulerConfig = {
    intervalSeconds: 300,
    enabled: false,
    concurrentSyncs: 3,
    syncOptions: {
      incremental: false,
      includeHeartbeats: true,
      timeout: 30000,
      maxRetries: 3
    }
  }
  private timeoutId: NodeJS.Timeout | null = null

  constructor() {
    this.loadConfig()
  }

  private loadConfig() {
    const db = getDb()
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("scheduler_config") as { value: string } | undefined
      if (row) {
        this.config = { ...this.config, ...JSON.parse(row.value) }
      }
    } catch (error) {
      console.error("Failed to load scheduler config from DB:", error)
    }
  }

  private saveConfig() {
    const db = getDb()
    try {
      db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .run("scheduler_config", JSON.stringify(this.config))
    } catch (error) {
      console.error("Failed to save scheduler config to DB:", error)
    }
  }

  async start(config?: Partial<SchedulerConfig>) {
    // Stop any existing scheduler first to prevent duplicates
    if (this.isRunning || this.intervalId || this.timeoutId) {
      this.stop()
    }

    if (config) {
      this.config = { ...this.config, ...config }
      this.saveConfig()
    }

    // Enforce minimum interval of 30 seconds
    if (this.config.intervalSeconds < 30) {
      this.config.intervalSeconds = 30
      this.saveConfig()
    }

    this.isRunning = true

    // Run first sync immediately, then schedule subsequent syncs
    const runSync = async () => {
      if (!this.config.enabled) {
        return
      }

      this.lastRun = new Date()
      try {
        await this.syncAllSources()
      } catch (error) {
        console.error("Scheduled sync failed:", error)
      }
    }

    // Run first sync after 10 seconds
    this.timeoutId = setTimeout(async () => {
      this.timeoutId = null
      await runSync()

      // After first sync completes, start the regular interval
      this.intervalId = setInterval(runSync, this.config.intervalSeconds * 1000)
    }, 10000)
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
  }

  async syncAllSources(): Promise<SyncResult[]> {
    const db = getDb()
    const sources = db.prepare("SELECT * FROM uptime_kuma_sources").all() as UptimeKumaSource[]

    const results: SyncResult[] = []

    // Process sources in batches based on concurrentSyncs setting
    const batchSize = this.config.concurrentSyncs
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize)
      const batchPromises = batch.map(source => this.syncSourceWithJobTracking(source))
      
      const batchResults = await Promise.allSettled(batchPromises)
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value)
        } else {
          const source = batch[index]
          results.push({
            sourceId: source.id,
            success: false,
            monitorsUpdated: 0,
            heartbeatsFetched: 0,
            error: result.reason.message,
            duration: 0,
            timestamp: new Date()
          })
        }
      })

      // If there are more batches, wait a bit before starting the next one
      if (i + batchSize < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  private async syncSourceWithJobTracking(source: UptimeKumaSource): Promise<SyncResult> {
    // Track the job
    this.currentJobs.set(source.id, {
      source,
      startedAt: new Date()
    })

    try {
      const result = await syncEngine.syncSource(source, this.config.syncOptions)
      return result
    } finally {
      // Remove the job tracking
      this.currentJobs.delete(source.id)
    }
  }

  updateConfig(newConfig: Partial<SchedulerConfig>) {
    const oldInterval = this.config.intervalSeconds
    this.config = { ...this.config, ...newConfig }
    this.saveConfig()

    // Restart scheduler if interval changed and scheduler is running
    if (this.isRunning && newConfig.intervalSeconds && newConfig.intervalSeconds !== oldInterval) {
      this.stop()
      this.start()
    }
  }

  getStatus(): SchedulerStatus {
    const currentJobs = Array.from(this.currentJobs.values()).map(job => ({
      sourceId: job.source.id,
      sourceName: job.source.name,
      startedAt: job.startedAt
    }))

    const nextRun = this.lastRun && this.config.intervalSeconds 
      ? new Date(this.lastRun.getTime() + this.config.intervalSeconds * 1000)
      : null

    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun,
      currentJobs,
      config: this.config
    }
  }

  // Manual sync methods
  async syncSourceNow(sourceId: number): Promise<SyncResult> {
    const db = getDb()
    const source = db.prepare("SELECT * FROM uptime_kuma_sources WHERE id = ?").get(sourceId) as UptimeKumaSource | undefined

    if (!source) {
      throw new Error(`Source with ID ${sourceId} not found`)
    }

    // Update lastRun for manual syncs too
    this.lastRun = new Date()
    return this.syncSourceWithJobTracking(source)
  }

  async syncAllSourcesNow(): Promise<SyncResult[]> {
    // Update lastRun for manual syncs too
    this.lastRun = new Date()
    return this.syncAllSources()
  }
}

// Use global to persist scheduler across hot reloads in development
const globalForScheduler = globalThis as unknown as {
  schedulerService: SchedulerService | undefined
}

export const schedulerService = globalForScheduler.schedulerService ?? new SchedulerService()

if (process.env.NODE_ENV !== 'production') {
  globalForScheduler.schedulerService = schedulerService
}
