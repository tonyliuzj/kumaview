import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { getCachedHeartbeats, setCachedHeartbeats } from "@/lib/heartbeat-cache"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const monitorId = searchParams.get("monitor_id")
    const sourceId = searchParams.get("source_id")

    if (!monitorId || !sourceId) {
      return NextResponse.json({ error: "monitor_id and source_id are required" }, { status: 400 })
    }

    const db = getDb()

    // Get source info
    const source = db.prepare("SELECT * FROM uptime_kuma_sources WHERE id = ?").get(sourceId) as any

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    // Check cache first
    let heartbeatList = await getCachedHeartbeats(parseInt(sourceId))

    if (!heartbeatList) {
      // Cache miss - fetch from Uptime Kuma API
      const baseUrl = source.url.replace(/\/$/, "")
      const response = await fetch(`${baseUrl}/api/status-page/heartbeat/${source.slug}`)

      if (!response.ok) {
        return NextResponse.json({ error: "Failed to fetch heartbeats from Uptime Kuma" }, { status: 500 })
      }

      const data = await response.json()
      heartbeatList = data.heartbeatList || {}

      // Store in cache
      await setCachedHeartbeats(parseInt(sourceId), heartbeatList)
    }

    const heartbeats = heartbeatList[monitorId] || []

    return NextResponse.json(heartbeats)
  } catch (error) {
    console.error("Error fetching heartbeats:", error)
    return NextResponse.json({ error: "Failed to fetch heartbeats" }, { status: 500 })
  }
}
