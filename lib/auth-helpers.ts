import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { UserRole } from "@/types"

export type SessionUser = {
  id: string
  name: string
  email: string
  image?: string | null
  role: UserRole
  isOnboarded: boolean
}

/** Lấy user hiện tại (null nếu chưa đăng nhập). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const u = session.user as unknown as SessionUser
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    role: (u.role ?? "student") as UserRole,
    isOnboarded: Boolean(u.isOnboarded),
  }
}

/** Bắt buộc đăng nhập, nếu không → /sign-in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")
  return user
}

/** Bắt buộc đúng role, nếu không → điều hướng về dashboard tương ứng. */
export async function requireRole(role: UserRole): Promise<SessionUser> {
  const user = await requireUser()
  if (!user.isOnboarded) redirect("/onboarding")
  if (user.role !== role) {
    redirect(user.role === "teacher" ? "/teacher" : "/student")
  }
  return user
}

/** ID người dùng hiện tại (throw nếu chưa đăng nhập) — dùng trong server actions. */
export async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}
