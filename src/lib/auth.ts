import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import bcrypt from "bcryptjs"
import { getDb } from "./db"

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-this-in-production"
)

// Log JWT_SECRET status on module load
if (!process.env.JWT_SECRET) {
  console.warn("⚠️  WARNING: JWT_SECRET not set in environment variables, using default (insecure)")
} else {
  console.log("✓ JWT_SECRET loaded from environment")
}

export interface AdminUser {
  id: number
  username: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(user: AdminUser): Promise<string> {
  const token = await new SignJWT({ userId: user.id, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET)

  return token
}

export async function verifyToken(token: string): Promise<AdminUser | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET)
    const payload = verified.payload as { userId: number; username: string }
    return { id: payload.userId, username: payload.username }
  } catch (error) {
    return null
  }
}

export async function getAuthUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value

  if (!token) {
    return null
  }

  return verifyToken(token)
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set("auth_token", token, {
    httpOnly: true,
    secure: false, // Set to false to allow HTTP in production (use true only if behind HTTPS/reverse proxy)
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete("auth_token")
}

export function getAdminUser(username: string) {
  const db = getDb()
  return db.prepare("SELECT id, username, password_hash FROM admin_users WHERE username = ?").get(username) as
    { id: number; username: string; password_hash: string } | undefined
}

export function updateAdminCredentials(userId: number, username: string, passwordHash: string) {
  const db = getDb()
  db.prepare("UPDATE admin_users SET username = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(username, passwordHash, userId)
}
