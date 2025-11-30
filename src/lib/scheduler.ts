import { getDb } from "./db"
import type { UptimeKumaSource } from "./types"

let syncInterval: NodeJS.Timeout | null = null
let isSyncing = false
let lastSyncTime: Date | null = null
let currentIntervalSeconds = 300

// Initialize lastSyncTime from DB
try {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("last_sync_time") as { value: string } | undefined
  if (row) {
    lastSyncTime = new Date(row.value)
  }
} catch (error) {
  console.error("Failed to load last sync time from DB:", error)
}

export function getSyncStatus() {
  return {
    isSyncing,
    lastSyncTime: lastSyncTime?.toISOString() || null,
    interval: currentIntervalSeconds,
  }
}

export async function syncSource(source: UptimeKumaSource) {
  const baseUrl = source.url.replace(/\/$/, "")

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  // Fetch monitor metadata
  const monitorsResponse = await fetch(`${baseUrl}/api/status-page/${source.slug}`, {
    headers,
  })

  if (!monitorsResponse.ok) {
    throw new Error(`Failed to fetch monitors: ${monitorsResponse.statusText}. Make sure the status page slug "${source.slug}" is correct.`)
  }

  const data = await monitorsResponse.json()
  const db = getDb()

  let monitorsUpdated = 0

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

  // Fetch and cache heartbeat data (ping history)
  try {
    const heartbeatResponse = await fetch(`${baseUrl}/api/status-page/heartbeat/${source.slug}`)
    if (heartbeatResponse.ok) {
      const heartbeatData = await heartbeatResponse.json()
      const { setCachedHeartbeats } = await import("./heartbeat-cache")
      setCachedHeartbeats(source.id, heartbeatData.heartbeatList || {})
    }
  } catch (error) {
    console.error(`Failed to fetch heartbeats for source ${source.id}:`, error)
  }

  return { monitorsUpdated }
}

export async function syncAllSources() {
  if (isSyncing) {
    console.log("Sync already in progress, skipping...")
    return []
  }

  isSyncing = true

  const db = getDb()
  const sources = db.prepare("SELECT * FROM uptime_kuma_sources").all() as UptimeKumaSource[]

  const results = []

  for (const source of sources) {
    try {
      // syncSource now fetches monitors AND heartbeat data, updating cache
      const result = await syncSource(source)
      results.push({ source_id: source.id, success: true, ...result })
      console.log(`Synced source ${source.name}: ${result.monitorsUpdated} monitors`)
    } catch (error: any) {
      console.error(`Error syncing source ${source.id}:`, error)
      results.push({ source_id: source.id, success: false, error: error.message })
    }
  }

  isSyncing = false
  lastSyncTime = new Date()

  try {
    const db = getDb()
    db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
      .run("last_sync_time", lastSyncTime.toISOString())
  } catch (error) {
    console.error("Failed to save last sync time to DB:", error)
  }

  return results
}

export function startScheduler(intervalSeconds: number = 300) {
  if (syncInterval) {
    console.log("Scheduler already running, stopping old one first")
    stopScheduler()
  }

  // Enforce minimum interval of 30 seconds
  if (intervalSeconds < 30) {
    console.log(`Interval ${intervalSeconds}s is below minimum, setting to 30s`)
    intervalSeconds = 30
  }

  currentIntervalSeconds = intervalSeconds
  console.log(`Starting scheduler with ${intervalSeconds} second interval`)

  // Run first sync immediately, then schedule subsequent syncs
  const runSync = async () => {
    console.log("Running scheduled sync...")
    try {
      await syncAllSources()
    } catch (error) {
      console.error("Scheduled sync failed:", error)
    }
  }

  // Run first sync after 10 seconds
  setTimeout(async () => {
    await runSync()

    // After first sync completes, start the regular interval
    syncInterval = setInterval(runSync, intervalSeconds * 1000)
  }, 10000)
}

export function stopScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    console.log("Scheduler stopped")
  }
}
