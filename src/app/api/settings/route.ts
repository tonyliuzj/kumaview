import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { requireAuth } from "@/lib/middleware"

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const db = getDb()
    const settings = db.prepare("SELECT * FROM settings").all() as Array<{ key: string; value: string }>

    // Convert to key-value object
    const settingsObj: Record<string, string> = {}
    settings.forEach(s => {
      settingsObj[s.key] = s.value
    })

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { key, value } = body

    if (!key) {
      return NextResponse.json({ error: "Key is required" }, { status: 400 })
    }

    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `)

    stmt.run(key, value)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating setting:", error)
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 })
  }
}
