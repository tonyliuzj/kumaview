import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { MonitorWithStatus } from "@/lib/types"
import { getCachedHeartbeats, setCachedHeartbeats } from "@/lib/heartbeat-cache"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceId = searchParams.get("source_id")

    const db = getDb()

    // Get monitors from database
    let query = `SELECT m.*, s.url, s.slug FROM monitors m JOIN uptime_kuma_sources s ON m.source_id = s.id`

    let monitors: any[]
    if (sourceId) {
      query += ` WHERE m.source_id = ?`
      monitors = db.prepare(query).all(sourceId)
    } else {
      monitors = db.prepare(query).all()
    }

    // Fetch heartbeat data for all monitors grouped by source (with caching)
    const sourceMap = new Map<number, any>()

    for (const monitor of monitors) {
      if (!sourceMap.has(monitor.source_id)) {
        // Check cache first
        let heartbeatList = await getCachedHeartbeats(monitor.source_id)

        if (!heartbeatList) {
          // Cache miss - fetch from API
          try {
            const baseUrl = monitor.url.replace(/\/$/, "")
            const response = await fetch(`${baseUrl}/api/status-page/heartbeat/${monitor.slug}`)

            if (response.ok) {
              const data = await response.json()
              heartbeatList = data.heartbeatList || {}
              // Store in cache
              await setCachedHeartbeats(monitor.source_id, heartbeatList)
            } else {
              heartbeatList = {}
            }
          } catch (error) {
            console.error(`Error fetching heartbeats for source ${monitor.source_id}:`, error)
            heartbeatList = {}
          }
        }

        sourceMap.set(monitor.source_id, heartbeatList)
      }
    }

    // Enrich monitors with status and metrics
    const enrichedMonitors = monitors.map(monitor => {
      const heartbeatList = sourceMap.get(monitor.source_id) || {}
      const heartbeats = heartbeatList[monitor.id] || []

      let status = null
      let last_heartbeat = null
      let avg_ping = null
      let uptime_24h = null
      let uptime_30d = null

      if (heartbeats.length > 0) {
        // Get latest status (last item in array since API returns oldest to newest)
        const latestHeartbeat = heartbeats[heartbeats.length - 1]
        status = latestHeartbeat?.status
        last_heartbeat = latestHeartbeat?.time

        // Calculate average ping
        const pings = heartbeats.filter((hb: any) => hb.ping !== null).map((hb: any) => hb.ping)
        if (pings.length > 0) {
          avg_ping = pings.reduce((a: number, b: number) => a + b, 0) / pings.length
        }

        // Calculate uptime (all heartbeats are within 24h from API)
        const upCount = heartbeats.filter((hb: any) => hb.status === 1).length
        uptime_24h = (upCount / heartbeats.length) * 100
        uptime_30d = uptime_24h // API only provides recent data
      }

      // Get recent heartbeats (last 24) for sparkline
      const recent_heartbeats = heartbeats.slice(-24) // Get last 24 heartbeats (already in oldest -> newest order)

      // Remove url and slug from response
      const { url, slug, ...monitorData } = monitor

      return {
        ...monitorData,
        status,
        last_heartbeat,
        avg_ping,
        uptime_24h,
        uptime_30d,
        recent_heartbeats
      }
    })

    return NextResponse.json(enrichedMonitors)
  } catch (error) {
    console.error("Error fetching monitors:", error)
    return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 })
  }
}
