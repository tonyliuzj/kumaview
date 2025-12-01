import { NextRequest, NextResponse } from "next/server"
import { getAdminUser, verifyPassword, createToken, setAuthCookie } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    console.log(`Login attempt for username: ${username}`)

    if (!username || !password) {
      console.log("Missing username or password")
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 })
    }

    const user = getAdminUser(username)

    if (!user) {
      console.log(`User not found: ${username}`)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    console.log(`User found: ${username}, verifying password...`)
    const isValid = await verifyPassword(password, user.password_hash)

    if (!isValid) {
      console.log(`Invalid password for user: ${username}`)
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    console.log(`Password valid for user: ${username}, creating token...`)
    const token = await createToken({ id: user.id, username: user.username })
    await setAuthCookie(token)

    console.log(`Login successful for user: ${username}`)
    return NextResponse.json({ success: true, username: user.username })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
