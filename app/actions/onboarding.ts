"use server"

import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import type { UserRole } from "@/types"

const ROLE_WHITELIST: readonly string[] = ["student", "teacher"]

/**
 * Hoàn tất onboarding — chỉ chạy MỘT lần (khi isOnboarded = false).
 * - role phải thuộc whitelist {"student","teacher"} (kiểm tra tay tương
 *   đương zod); giá trị khác bị từ chối.
 * - §23 (2026-10-24, GV chốt): chọn "teacher" KHÔNG cần mã mời nữa —
 *   cơ chế SEC-01 (mã mời giáo viên qua env TEACHER_INVITE_CODE) đã
 *   bãi bỏ. "Mã mời" còn lại duy nhất là mã lớp 6 ký tự để học sinh
 *   vào lớp (xem app/actions/student-class.ts) — không liên quan gì
 *   tới đường này.
 * - Đã onboard rồi thì gọi lại bị từ chối: không còn đường tự đổi vai trò.
 */
export async function completeOnboarding(role: UserRole) {
  const current = await getCurrentUser()
  if (!current) throw new Error("Chưa đăng nhập")
  if (current.isOnboarded) {
    throw new Error("Tài khoản đã hoàn tất đăng ký, không thể đổi vai trò tại đây")
  }
  if (!ROLE_WHITELIST.includes(role)) {
    throw new Error("Vai trò không hợp lệ")
  }

  await db
    .update(userTable)
    .set({ role, isOnboarded: true, updatedAt: new Date() })
    .where(eq(userTable.id, current.id))
  redirect(role === "teacher" ? "/teacher" : "/student")
}
