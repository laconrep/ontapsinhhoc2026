"use server"

import { randomUUID } from "crypto"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { classes, classStudents, sessions, sessionEvents, user } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { publish, type RealtimeEvent } from "@/lib/realtime"

export interface LiveSession {
  id: string
  classId: string
  className: string
  status: "created" | "active" | "paused" | "ended"
  createdAt: string
}

// Ghi sự kiện vào DB (lịch sử) và phát realtime cho subscriber.
async function emit(
  sessionId: string,
  type: string,
  opts: { studentId?: string | null; studentName?: string | null; payload?: Record<string, unknown> | null } = {},
) {
  const id = randomUUID()
  const createdAt = new Date()
  await db.insert(sessionEvents).values({
    id,
    sessionId,
    studentId: opts.studentId ?? null,
    eventType: type,
    payload: opts.payload ?? null,
    createdAt,
  })
  const event: RealtimeEvent = {
    id,
    type,
    studentId: opts.studentId ?? null,
    studentName: opts.studentName ?? null,
    payload: opts.payload ?? null,
    createdAt: createdAt.toISOString(),
  }
  publish(sessionId, event)
  return event
}

/** GV: bắt đầu phiên học cho một lớp (kết thúc phiên active cũ nếu có). */
export async function startSession(classId: string): Promise<LiveSession> {
  const teacher = await requireRole("teacher")
  const cls = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (cls.length === 0) throw new Error("Không tìm thấy lớp học")

  // Kết thúc các phiên đang mở của lớp này
  await db
    .update(sessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(sessions.classId, classId), eq(sessions.status, "active")))

  const id = randomUUID()
  await db.insert(sessions).values({ id, classId, teacherId: teacher.id, status: "active" })
  revalidatePath(`/teacher/classes/${classId}`)
  return {
    id,
    classId,
    className: cls[0].name,
    status: "active",
    createdAt: new Date().toISOString(),
  }
}

/** GV: kết thúc phiên. */
export async function endSession(sessionId: string): Promise<void> {
  const teacher = await requireRole("teacher")
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teacherId, teacher.id)))
    .limit(1)
  if (rows.length === 0) throw new Error("Không tìm thấy phiên")
  await db.update(sessions).set({ status: "ended", endedAt: new Date() }).where(eq(sessions.id, sessionId))
  await emit(sessionId, "session_ended", {})
  revalidatePath(`/teacher/classes/${rows[0].classId}`)
}

/** Lấy phiên (kiểm tra quyền: GV sở hữu hoặc HS thuộc lớp). */
export async function getSession(sessionId: string) {
  const rows = await db
    .select({
      id: sessions.id,
      classId: sessions.classId,
      className: classes.name,
      teacherId: sessions.teacherId,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (rows.length === 0) return null
  return rows[0]
}

/** Phiên đang active của một lớp (nếu có). */
export async function getActiveSessionForClass(classId: string): Promise<LiveSession | null> {
  const rows = await db
    .select({
      id: sessions.id,
      classId: sessions.classId,
      className: classes.name,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(and(eq(sessions.classId, classId), eq(sessions.status, "active")))
    .orderBy(desc(sessions.createdAt))
    .limit(1)
  if (rows.length === 0) return null
  return { ...rows[0], createdAt: rows[0].createdAt.toISOString() }
}

/** HS: các phiên đang active thuộc các lớp mình tham gia. */
export async function getActiveSessionsForStudent(): Promise<LiveSession[]> {
  const student = await requireRole("student")
  const rows = await db
    .select({
      id: sessions.id,
      classId: sessions.classId,
      className: classes.name,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .innerJoin(classStudents, eq(classStudents.classId, sessions.classId))
    .where(and(eq(sessions.status, "active"), eq(classStudents.studentId, student.id)))
    .orderBy(desc(sessions.createdAt))
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

// Kiểm tra HS có thuộc lớp của phiên không.
async function assertStudentInSession(sessionId: string, studentId: string) {
  const rows = await db
    .select({ classId: sessions.classId })
    .from(sessions)
    .innerJoin(classStudents, eq(classStudents.classId, sessions.classId))
    .where(and(eq(sessions.id, sessionId), eq(classStudents.studentId, studentId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Bạn không thuộc lớp của phiên này")
}

/** HS: tham gia phiên. */
export async function joinSession(sessionId: string): Promise<void> {
  const student = await requireRole("student")
  await assertStudentInSession(sessionId, student.id)
  await emit(sessionId, "student_joined", { studentId: student.id, studentName: student.name })
}

/** HS: gửi tín hiệu (hiểu bài / cần trợ giúp / cảm xúc). */
export async function sendSignal(
  sessionId: string,
  signal: "understood" | "need_help" | "reaction",
  payload?: Record<string, unknown>,
): Promise<void> {
  const student = await requireRole("student")
  await assertStudentInSession(sessionId, student.id)
  await emit(sessionId, `signal_${signal}`, {
    studentId: student.id,
    studentName: student.name,
    payload: payload ?? null,
  })
}

/** Lịch sử sự kiện của phiên (để board tải khi mở). */
export async function getSessionEvents(sessionId: string): Promise<RealtimeEvent[]> {
  const rows = await db
    .select({
      id: sessionEvents.id,
      type: sessionEvents.eventType,
      studentId: sessionEvents.studentId,
      studentName: user.name,
      payload: sessionEvents.payload,
      createdAt: sessionEvents.createdAt,
    })
    .from(sessionEvents)
    .leftJoin(user, eq(user.id, sessionEvents.studentId))
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(sessionEvents.createdAt)
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    studentId: r.studentId,
    studentName: r.studentName,
    payload: (r.payload as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}
