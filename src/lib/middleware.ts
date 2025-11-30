import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "./auth"

export async function requireAuth(request: NextRequest) {
  const user = await getAuthUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
