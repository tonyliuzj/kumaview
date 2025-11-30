import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { UptimeKumaSource } from "@/lib/types"
import { requireAuth } from "@/lib/middleware"

export async function GET() {
  try {
    const db = getDb()
    const sources = db.prepare("SELECT * FROM uptime_kuma_sources ORDER BY created_at DESC").all() as UptimeKumaSource[]
    return NextResponse.json(sources)
  } catch (error) {
    console.error("Error fetching sources:", error)
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { name, url, slug } = body

    if (!name || !url || !slug) {
      return NextResponse.json({ error: "Name, URL, and Status Page Slug are required" }, { status: 400 })
    }

    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO uptime_kuma_sources (name, url, slug, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)

    const result = stmt.run(name, url, slug)

    const newSource = db.prepare("SELECT * FROM uptime_kuma_sources WHERE id = ?").get(result.lastInsertRowid) as UptimeKumaSource

    return NextResponse.json(newSource, { status: 201 })
  } catch (error: any) {
    console.error("Error creating source:", error)
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "A source with this URL and slug combination already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create source" }, { status: 500 })
  }
}
