import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { MonitorWithStatus } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sourceId = searchParams.get("source_id")

    const db = getDb()

    let query = `
      SELECT
        m.*,
        (
          SELECT status
          FROM monitor_heartbeats
          WHERE monitor_id = m.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) as status,
        (
          SELECT timestamp
          FROM monitor_heartbeats
          WHERE monitor_id = m.id
          ORDER BY timestamp DESC
          LIMIT 1
        ) as last_heartbeat,
        (
          SELECT AVG(ping)
          FROM monitor_heartbeats
          WHERE monitor_id = m.id
          AND timestamp > datetime('now', '-24 hours')
        ) as avg_ping,
        (
          SELECT CAST(SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100
          FROM monitor_heartbeats
          WHERE monitor_id = m.id
          AND timestamp > datetime('now', '-24 hours')
        ) as uptime_24h,
        (
          SELECT CAST(SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100
          FROM monitor_heartbeats
          WHERE monitor_id = m.id
          AND timestamp > datetime('now', '-30 days')
        ) as uptime_30d
      FROM monitors m
    `

    if (sourceId) {
      query += ` WHERE m.source_id = ?`
      const monitors = db.prepare(query).all(sourceId) as MonitorWithStatus[]
      return NextResponse.json(monitors)
    } else {
      const monitors = db.prepare(query).all() as MonitorWithStatus[]
      return NextResponse.json(monitors)
    }
  } catch (error) {
    console.error("Error fetching monitors:", error)
    return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 })
  }
}
