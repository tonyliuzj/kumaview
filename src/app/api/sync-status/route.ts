import { NextResponse } from "next/server"
import { schedulerService } from "@/lib/scheduler-service"
import { syncEngine } from "@/lib/sync-engine"
import { syncMetricsCollector } from "@/lib/sync-metrics"

export async function GET() {
  try {
    const schedulerStatus = schedulerService.getStatus()
    const syncEngineStatus = syncEngine.getSyncStatus()
    const healthCheck = await syncMetricsCollector.getHealthCheck()

    // Convert Date objects to ISO strings for JSON serialization
    const status = {
      scheduler: {
        ...schedulerStatus,
        lastRun: schedulerStatus.lastRun?.toISOString() || null,
        nextRun: schedulerStatus.nextRun?.toISOString() || null,
        currentJobs: schedulerStatus.currentJobs.map(job => ({
          ...job,
          startedAt: job.startedAt.toISOString()
        }))
      },
      syncEngine: syncEngineStatus,
      health: {
        ...healthCheck,
        lastSuccessfulSync: healthCheck.lastSuccessfulSync?.toISOString() || null
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("Error fetching sync status:", error)
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 })
  }
}
