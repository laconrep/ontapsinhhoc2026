"use server"

import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getUserId } from "@/lib/auth-helpers"
import type { UserRole } from "@/types"

/** Hoàn tất onboarding: cập nhật vai trò (nếu cần) + đánh dấu đã onboard. */
export async function completeOnboarding(role: UserRole) {
  const userId = await getUserId()
  await db
    .update(userTable)
    .set({ role, isOnboarded: true, updatedAt: new Date() })
    .where(eq(userTable.id, userId))
  return { success: true as const }
}
