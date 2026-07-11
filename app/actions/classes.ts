"use server"

import { db } from "@/lib/db/index"
import { classes, classStudents, user } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { createClassSchema, updateClassSchema } from "@/lib/validation"
import { and, desc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

/** Sinh mã mời 6 ký tự (không gồm ký tự dễ nhầm: 0,O,1,I). */
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

async function uniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateInviteCode()
    const existing = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.inviteCode, code))
      .limit(1)
    if (existing.length === 0) return code
  }
  throw new Error("Không thể tạo mã mời, vui lòng thử lại")
}

/** Danh sách lớp của giáo viên hiện tại kèm sĩ số. */
export async function getClasses() {
  const teacher = await requireRole("teacher")
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      subject: classes.subject,
      inviteCode: classes.inviteCode,
      schoolYear: classes.schoolYear,
      createdAt: classes.createdAt,
      studentCount: sql<number>`count(${classStudents.studentId})::int`,
    })
    .from(classes)
    .leftJoin(classStudents, eq(classStudents.classId, classes.id))
    .where(eq(classes.teacherId, teacher.id))
    .groupBy(classes.id)
    .orderBy(desc(classes.createdAt))
  return rows
}

/** Chi tiết một lớp (kèm danh sách học sinh). Chỉ chủ lớp mới xem được. */
export async function getClassDetail(classId: string) {
  const teacher = await requireRole("teacher")
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")

  const students = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      joinedAt: classStudents.joinedAt,
    })
    .from(classStudents)
    .innerJoin(user, eq(user.id, classStudents.studentId))
    .where(eq(classStudents.classId, classId))
    .orderBy(desc(classStudents.joinedAt))

  return { ...cls, students }
}

export async function createClass(input: unknown) {
  const teacher = await requireRole("teacher")
  const data = createClassSchema.parse(input)
  const inviteCode = await uniqueInviteCode()
  const [created] = await db
    .insert(classes)
    .values({
      name: data.name,
      subject: data.subject,
      schoolYear: data.schoolYear,
      teacherId: teacher.id,
      inviteCode,
    })
    .returning()
  revalidatePath("/teacher/classes")
  return created
}

export async function updateClass(classId: string, input: unknown) {
  const teacher = await requireRole("teacher")
  const data = updateClassSchema.parse(input)
  const [updated] = await db
    .update(classes)
    .set(data)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .returning()
  if (!updated) throw new Error("Không tìm thấy lớp học")
  revalidatePath("/teacher/classes")
  revalidatePath(`/teacher/classes/${classId}`)
  return updated
}

export async function deleteClass(classId: string) {
  const teacher = await requireRole("teacher")
  const [deleted] = await db
    .delete(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .returning({ id: classes.id })
  if (!deleted) throw new Error("Không tìm thấy lớp học")
  revalidatePath("/teacher/classes")
  return { success: true }
}

/** Tạo lại mã mời cho lớp. */
export async function regenerateInviteCode(classId: string) {
  const teacher = await requireRole("teacher")
  const inviteCode = await uniqueInviteCode()
  const [updated] = await db
    .update(classes)
    .set({ inviteCode })
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .returning()
  if (!updated) throw new Error("Không tìm thấy lớp học")
  revalidatePath(`/teacher/classes/${classId}`)
  return { inviteCode }
}

/** Xoá học sinh khỏi lớp. */
export async function removeStudent(classId: string, studentId: string) {
  const teacher = await requireRole("teacher")
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")
  await db
    .delete(classStudents)
    .where(
      and(
        eq(classStudents.classId, classId),
        eq(classStudents.studentId, studentId),
      ),
    )
  revalidatePath(`/teacher/classes/${classId}`)
  return { success: true }
}
