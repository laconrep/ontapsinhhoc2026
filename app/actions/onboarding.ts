"use server"

import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { verifyTeacherInviteCode } from "@/lib/teacher-invite"
import type { UserRole } from "@/types"

const ROLE_WHITELIST: readonly string[] = ["student", "teacher"]

/**
 * SEC-01: hoàn tất onboarding — chỉ chạy MỘT lần (khi isOnboarded = false).
 * - role phải thuộc whitelist {"student","teacher"} (kiểm tra tay tương
 *   đương zod); giá trị khác bị từ chối.
 * - role "teacher" chỉ được chấp nhận khi inviteCode khớp env
 *   TEACHER_INVITE_CODE (cơ chế TẠM THỜI — xem lib/teacher-invite.ts).
 * - Đã onboard rồi thì gọi lại bị từ chối: không còn đường tự đổi vai trò.
 */
export async function completeOnboarding(role: UserRole, inviteCode?: string) {
  const current = await getCurrentUser()
  if (!current) throw new Error("Chưa đăng nhập")
  if (current.isOnboarded) {
    throw new Error("Tài khoản đã hoàn tất đăng ký, không thể đổi vai trò tại đây")
  }
  if (!ROLE_WHITELIST.includes(role)) {
    throw new Error("Vai trò không hợp lệ")
  }
  if (role === "teacher" && !verifyTeacherInviteCode(inviteCode)) {
    throw new Error(
      "Mã mời giáo viên không đúng. Nếu chưa có mã mời, hãy liên hệ quản trị viên hoặc đăng ký với vai trò học sinh.",
    )
  }

  await db
    .update(userTable)
    .set({ role, isOnboarded: true, updatedAt: new Date() })
    .where(eq(userTable.id, current.id))
  redirect(role === "teacher" ? "/teacher" : "/student")
}
