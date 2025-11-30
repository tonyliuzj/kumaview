import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import type { UptimeKumaSource } from "@/lib/types"
import { requireAuth } from "@/lib/middleware"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()
    const source = db.prepare("SELECT * FROM uptime_kuma_sources WHERE id = ?").get(id) as UptimeKumaSource | undefined

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    return NextResponse.json(source)
  } catch (error) {
    console.error("Error fetching source:", error)
    return NextResponse.json({ error: "Failed to fetch source" }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const { id } = await params
    const body = await request.json()
    const { name, url, slug } = body

    if (!name || !url || !slug) {
      return NextResponse.json({ error: "Name, URL, and Status Page Slug are required" }, { status: 400 })
    }

    const db = getDb()
    const stmt = db.prepare(`
      UPDATE uptime_kuma_sources
      SET name = ?, url = ?, slug = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    const result = stmt.run(name, url, slug, id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    const updatedSource = db.prepare("SELECT * FROM uptime_kuma_sources WHERE id = ?").get(id) as UptimeKumaSource

    return NextResponse.json(updatedSource)
  } catch (error: any) {
    console.error("Error updating source:", error)
    if (error.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "A source with this URL and slug combination already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to update source" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const { id } = await params
    const db = getDb()
    const stmt = db.prepare("DELETE FROM uptime_kuma_sources WHERE id = ?")
    const result = stmt.run(id)

    if (result.changes === 0) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting source:", error)
    return NextResponse.json({ error: "Failed to delete source" }, { status: 500 })
  }
}
