import { NextRequest, NextResponse } from "next/server"
import { startScheduler, stopScheduler } from "@/lib/scheduler"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, interval } = body

    if (action === "start") {
      startScheduler(interval || 5)
      return NextResponse.json({ success: true, message: "Scheduler started" })
    } else if (action === "stop") {
      stopScheduler()
      return NextResponse.json({ success: true, message: "Scheduler stopped" })
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error managing scheduler:", error)
    return NextResponse.json({ error: "Failed to manage scheduler" }, { status: 500 })
  }
}
