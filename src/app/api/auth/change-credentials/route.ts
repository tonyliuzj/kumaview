import { NextRequest, NextResponse } from "next/server"
import { getAuthUser, updateAdminCredentials, hashPassword, verifyPassword, getAdminUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { currentPassword, newUsername, newPassword } = await request.json()

    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 })
    }

    if (!newUsername && !newPassword) {
      return NextResponse.json({ error: "New username or password is required" }, { status: 400 })
    }

    // Verify current password
    const adminUser = getAdminUser(user.username)
    if (!adminUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const isValid = await verifyPassword(currentPassword, adminUser.password_hash)
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 })
    }

    // Update credentials
    const username = newUsername || user.username
    const passwordHash = newPassword ? await hashPassword(newPassword) : adminUser.password_hash

    updateAdminCredentials(user.id, username, passwordHash)

    return NextResponse.json({ success: true, username })
  } catch (error) {
    console.error("Change credentials error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
