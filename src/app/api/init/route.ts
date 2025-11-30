import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { schedulerService } from "@/lib/scheduler-service"

export async function GET() {
  try {
    const db = getDb()

    // Check if auto-sync is enabled
    const autoSyncEnabled = db.prepare("SELECT value FROM settings WHERE key = ?").get("autoSyncEnabled") as { value: string } | undefined
    const autoSyncInterval = db.prepare("SELECT value FROM settings WHERE key = ?").get("autoSyncInterval") as { value: string } | undefined

    if (autoSyncEnabled?.value === "true") {
      const interval = parseInt(autoSyncInterval?.value || "300")

      // Check if scheduler is already running
      const status = schedulerService.getStatus()
      if (status.isRunning) {
        console.log("Scheduler is already running, skipping initialization")
        return NextResponse.json({ message: "Scheduler already running", interval: status.config.intervalSeconds })
      }

      console.log(`Initializing scheduler with ${interval} second interval`)

      await schedulerService.start({
        enabled: true,
        intervalSeconds: interval
      })

      return NextResponse.json({ message: "Scheduler initialized", interval })
    }

    return NextResponse.json({ message: "Auto-sync is disabled" })
  } catch (error) {
    console.error("Error initializing scheduler:", error)
    return NextResponse.json({ error: "Failed to initialize" }, { status: 500 })
  }
}
