import { NextRequest, NextResponse } from "next/server"
import { schedulerService } from "@/lib/scheduler-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, interval, enabled, concurrent_syncs } = body

    if (action === "start") {
      const syncInterval = interval || 300

      // Validate minimum interval
      if (syncInterval < 30) {
        return NextResponse.json({
          error: "Sync interval must be at least 30 seconds"
        }, { status: 400 })
      }

      const config: any = { intervalSeconds: syncInterval }
      if (enabled !== undefined) config.enabled = enabled
      if (concurrent_syncs !== undefined) config.concurrentSyncs = concurrent_syncs

      await schedulerService.start(config)
      return NextResponse.json({ success: true, message: "Scheduler started" })
    } else if (action === "stop") {
      schedulerService.stop()
      return NextResponse.json({ success: true, message: "Scheduler stopped" })
    } else if (action === "status") {
      const status = schedulerService.getStatus()
      return NextResponse.json(status)
    } else if (action === "update-config") {
      const config: any = {}
      if (interval !== undefined) config.intervalSeconds = interval
      if (enabled !== undefined) config.enabled = enabled
      if (concurrent_syncs !== undefined) config.concurrentSyncs = concurrent_syncs

      schedulerService.updateConfig(config)
      return NextResponse.json({ success: true, message: "Configuration updated" })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error: any) {
    console.error("Error managing scheduler:", error)
    return NextResponse.json({ error: error.message || "Failed to manage scheduler" }, { status: 500 })
  }
}
