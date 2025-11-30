import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { MonitorHeartbeat } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get("hours") || "24")

    const db = getDb()
    const heartbeats = db.prepare(`
      SELECT * FROM monitor_heartbeats
      WHERE monitor_id = ?
      AND timestamp > datetime('now', '-${hours} hours')
      ORDER BY timestamp DESC
      LIMIT 1000
    `).all(id) as MonitorHeartbeat[]

    return NextResponse.json(heartbeats)
  } catch (error) {
    console.error("Error fetching heartbeats:", error)
    return NextResponse.json({ error: "Failed to fetch heartbeats" }, { status: 500 })
  }
}
