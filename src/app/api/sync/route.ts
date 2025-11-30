import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { UptimeKumaSource } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source_id } = body

    const db = getDb()

    let sources: UptimeKumaSource[]
    if (source_id) {
      const source = db.prepare("SELECT * FROM uptime_kuma_sources WHERE id = ?").get(source_id) as UptimeKumaSource | undefined
      if (!source) {
        return NextResponse.json({ error: "Source not found" }, { status: 404 })
      }
      sources = [source]
    } else {
      sources = db.prepare("SELECT * FROM uptime_kuma_sources").all() as UptimeKumaSource[]
    }

    const results = []

    for (const source of sources) {
      try {
        const result = await syncSource(source)
        results.push({ source_id: source.id, success: true, ...result })
      } catch (error: any) {
        console.error(`Error syncing source ${source.id}:`, error)
        results.push({ source_id: source.id, success: false, error: error.message })
      }
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Error syncing:", error)
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 })
  }
}

async function syncSource(source: UptimeKumaSource) {
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
