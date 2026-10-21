import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { classes, classStudents, sessions } from "@/lib/db/schema"
import type { SessionUser } from "@/lib/auth-helpers"

/**
 * SEC-03: kiểm quyền truy cập PHIÊN dùng chung — cùng quy tắc với
 * app/api/sessions/[id]/stream/route.ts:
 *   - chủ phiên: sessions.teacherId = user.id, HOẶC
 *   - thành viên lớp của phiên: có dòng trong class_students.
 * Mọi hàm đọc dữ liệu phiên/lớp phải đi qua đây (hoặc userCanAccessClass).
 */

export interface SessionAccessInfo {
  sessionId: string
  classId: string
  teacherId: string
  isTeacher: boolean
}

/** Trả thông tin quyền truy cập phiên, hoặc null nếu không có quyền/phiên không tồn tại. */
export async function getSessionAccess(
  sessionId: string,
  user: SessionUser,
): Promise<SessionAccessInfo | null> {
  const [s] = await db
    .select({ id: sessions.id, classId: sessions.classId, teacherId: sessions.teacherId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!s) return null
  if (s.teacherId === user.id) {
    return { sessionId: s.id, classId: s.classId, teacherId: s.teacherId, isTeacher: true }
  }
  const member = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .where(and(eq(classStudents.classId, s.classId), eq(classStudents.studentId, user.id)))
    .limit(1)
  if (member.length === 0) return null
  return { sessionId: s.id, classId: s.classId, teacherId: s.teacherId, isTeacher: false }
}

/** Như getSessionAccess nhưng ném lỗi khi không có quyền (dùng trong server action). */
export async function assertSessionAccess(
  sessionId: string,
  user: SessionUser,
): Promise<SessionAccessInfo> {
  const access = await getSessionAccess(sessionId, user)
  if (!access) throw new Error("Bạn không có quyền truy cập phiên này")
  return access
}

/** Quyền truy cập theo LỚP: giáo viên sở hữu lớp hoặc học sinh thuộc lớp. */
export async function userCanAccessClass(classId: string, user: SessionUser): Promise<boolean> {
  const [cls] = await db
    .select({ id: classes.id, teacherId: classes.teacherId })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1)
  if (!cls) return false
  if (cls.teacherId === user.id) return true
  const member = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .where(and(eq(classStudents.classId, classId), eq(classStudents.studentId, user.id)))
    .limit(1)
  return member.length > 0
}

export async function assertClassAccess(classId: string, user: SessionUser): Promise<void> {
  if (!(await userCanAccessClass(classId, user))) {
    throw new Error("Bạn không có quyền truy cập lớp này")
  }
}
