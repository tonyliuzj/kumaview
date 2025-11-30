import { getDb } from "./db"
import type { UptimeKumaSource } from "./types"

let syncInterval: NodeJS.Timeout | null = null

export async function syncSource(source: UptimeKumaSource) {
  const baseUrl = source.url.replace(/\/$/, "")

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  const monitorsResponse = await fetch(`${baseUrl}/api/status-page/${source.slug}`, {
    headers,
  })

  if (!monitorsResponse.ok) {
    throw new Error(`Failed to fetch monitors: ${monitorsResponse.statusText}. Make sure the status page slug "${source.slug}" is correct.`)
  }

  const data = await monitorsResponse.json()
  const db = getDb()

  let monitorsUpdated = 0
  let heartbeatsAdded = 0

  // Handle the response structure from Uptime Kuma status page API
  if (data.config && data.config.statusPagePublished) {
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

        // Get heartbeats for this monitor
        const heartbeats = data.heartbeatList?.[monitor.id] || []

        if (Array.isArray(heartbeats) && heartbeats.length > 0) {
          const heartbeatStmt = db.prepare(`
            INSERT OR IGNORE INTO monitor_heartbeats
            (monitor_id, source_id, status, ping, msg, important, duration, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)

          for (const hb of heartbeats) {
            heartbeatStmt.run(
              monitor.id,
              source.id,
              hb.status,
              hb.ping || null,
              hb.msg || null,
              hb.important ? 1 : 0,
              hb.duration || null,
              hb.time
            )
            heartbeatsAdded++
          }
        }
      }
    }
  }

  return { monitorsUpdated, heartbeatsAdded }
}

export async function syncAllSources() {
  const db = getDb()
  const sources = db.prepare("SELECT * FROM uptime_kuma_sources").all() as UptimeKumaSource[]

  const results = []

  for (const source of sources) {
    try {
      const result = await syncSource(source)
      results.push({ source_id: source.id, success: true, ...result })
      console.log(`Synced source ${source.name}: ${result.monitorsUpdated} monitors, ${result.heartbeatsAdded} heartbeats`)
    } catch (error: any) {
      console.error(`Error syncing source ${source.id}:`, error)
      results.push({ source_id: source.id, success: false, error: error.message })
    }
  }

  return results
}

export function startScheduler(intervalMinutes: number = 5) {
  if (syncInterval) {
    console.log("Scheduler already running")
    return
  }

  console.log(`Starting scheduler with ${intervalMinutes} minute interval`)

  syncInterval = setInterval(async () => {
    console.log("Running scheduled sync...")
    try {
      await syncAllSources()
    } catch (error) {
      console.error("Scheduled sync failed:", error)
    }
  }, intervalMinutes * 60 * 1000)

  syncAllSources().catch(console.error)
}

export function stopScheduler() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    console.log("Scheduler stopped")
  }
}
