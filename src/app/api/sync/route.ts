import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { schedulerService } from "@/lib/scheduler-service"
import type { UptimeKumaSource } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { source_id, include_heartbeats, max_retries, timeout } = body

    let results

    if (source_id) {
      // Sync specific source
      const result = await schedulerService.syncSourceNow(source_id)
      results = [result]
    } else {
      // Sync all sources
      results = await schedulerService.syncAllSourcesNow()
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error("Error syncing:", error)
    return NextResponse.json({ error: error.message || "Failed to sync" }, { status: 500 })
  }
}
