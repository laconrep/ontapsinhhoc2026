"use server"

import { db } from "@/lib/db"
import { classes, classStudents, chapters, lessons, knowledgePoints, user } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { isInviteCodeFormat } from "@/lib/invite-code"
import { hitRateLimit, peekRateLimit, resetRateLimit } from "@/lib/rate-limit"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import type { ChapterDto } from "@/types"

const JOIN_FAIL_LIMIT = 5
const JOIN_FAIL_WINDOW_MS = 10 * 60_000

/** HS tham gia lớp bằng mã mời. */
export async function joinClass(inviteCodeRaw: string) {
  const student = await requireRole("student")
  const inviteCode = inviteCodeRaw.trim().toUpperCase()

  // SEC-05: giới hạn thử sai — tối đa 5 lần sai / 10 phút / tài khoản
  // (bộ đếm lưu DB qua lib/rate-limit.ts).
  const failKey = `join-class-fail:${student.id}`
  if ((await peekRateLimit(failKey, JOIN_FAIL_WINDOW_MS)) >= JOIN_FAIL_LIMIT) {
    throw new Error("Bạn đã nhập sai mã mời quá nhiều lần. Vui lòng thử lại sau ít phút.")
  }

  // SEC-05: chấp nhận cả mã cũ 6 ký tự (chuyển tiếp) và mã mới 8 ký tự.
  if (!isInviteCodeFormat(inviteCode)) {
    await hitRateLimit(failKey, JOIN_FAIL_LIMIT, JOIN_FAIL_WINDOW_MS)
    throw new Error("Mã mời phải gồm 6 hoặc 8 ký tự hợp lệ")
  }

  const [cls] = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(eq(classes.inviteCode, inviteCode))
    .limit(1)
  if (!cls) {
    await hitRateLimit(failKey, JOIN_FAIL_LIMIT, JOIN_FAIL_WINDOW_MS)
    throw new Error("Mã mời không hợp lệ")
  }
  await resetRateLimit(failKey)

  const existing = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .where(and(eq(classStudents.classId, cls.id), eq(classStudents.studentId, student.id)))
    .limit(1)
  if (existing.length > 0) {
    return { alreadyJoined: true, className: cls.name }
  }

  await db.insert(classStudents).values({ classId: cls.id, studentId: student.id })
  revalidatePath("/student")
  revalidatePath("/student/learn")
  return { alreadyJoined: false, className: cls.name }
}

/** Danh sách lớp HS đã tham gia. */
export async function getMyClasses() {
  const student = await requireRole("student")
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      subject: classes.subject,
      schoolYear: classes.schoolYear,
      teacherName: user.name,
    })
    .from(classStudents)
    .innerJoin(classes, eq(classes.id, classStudents.classId))
    .innerJoin(user, eq(user.id, classes.teacherId))
    .where(eq(classStudents.studentId, student.id))
    .orderBy(asc(classes.name))
  return rows
}

/**
 * Danh sách bài học (chapter → lesson) mà HS được học:
 * chỉ các lesson status='ready' thuộc giáo viên dạy lớp HS đang tham gia.
 */
export async function getStudentLessons(): Promise<ChapterDto[]> {
  const student = await requireRole("student")

  // các giáo viên dạy lớp mà HS tham gia
  const teacherRows = await db
    .selectDistinct({ teacherId: classes.teacherId })
    .from(classStudents)
    .innerJoin(classes, eq(classes.id, classStudents.classId))
    .where(eq(classStudents.studentId, student.id))
  const teacherIds = teacherRows.map((t) => t.teacherId)
  if (teacherIds.length === 0) return []

  const chapterRows = await db
    .select()
    .from(chapters)
    .where(inArray(chapters.teacherId, teacherIds))
    .orderBy(asc(chapters.order), asc(chapters.createdAt))

  const lessonRows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      chapterId: lessons.chapterId,
      order: lessons.order,
      status: lessons.status,
      kpCount: sql<number>`count(${knowledgePoints.id})`.as("kpCount"),
    })
    .from(lessons)
    .leftJoin(knowledgePoints, eq(knowledgePoints.lessonId, lessons.id))
    .where(and(inArray(lessons.teacherId, teacherIds), eq(lessons.status, "ready")))
    .groupBy(lessons.id)
    .orderBy(asc(lessons.order), asc(lessons.createdAt))

  const grouped: ChapterDto[] = chapterRows
    .map((c) => ({
      id: c.id,
      title: c.title,
      order: c.order,
      lessons: lessonRows
        .filter((l) => l.chapterId === c.id && Number(l.kpCount) > 0)
        .map((l) => ({
          id: l.id,
          title: l.title,
          chapterId: l.chapterId,
          order: l.order,
          status: l.status,
          knowledgePointCount: Number(l.kpCount),
        })),
    }))
    .filter((c) => c.lessons.length > 0)

  // §18: bài "lưu tại lớp" (chapterId = null, classId = lớp của HS) —
  // gom thành một nhóm riêng theo từng lớp để HS vẫn học được.
  const myClasses = await db
    .select({ id: classes.id, name: classes.name })
    .from(classStudents)
    .innerJoin(classes, eq(classes.id, classStudents.classId))
    .where(eq(classStudents.studentId, student.id))
  if (myClasses.length > 0) {
    const scopedRows = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        chapterId: lessons.chapterId,
        classId: lessons.classId,
        order: lessons.order,
        status: lessons.status,
        kpCount: sql<number>`count(${knowledgePoints.id})`.as("kpCount"),
      })
      .from(lessons)
      .leftJoin(knowledgePoints, eq(knowledgePoints.lessonId, lessons.id))
      .where(
        and(
          inArray(
            lessons.classId,
            myClasses.map((c) => c.id),
          ),
          eq(lessons.status, "ready"),
        ),
      )
      .groupBy(lessons.id)
      .orderBy(asc(lessons.order), asc(lessons.createdAt))
    myClasses.forEach((cls, i) => {
      const ls = scopedRows
        .filter((l) => l.classId === cls.id && Number(l.kpCount) > 0)
        .map((l) => ({
          id: l.id,
          title: l.title,
          chapterId: l.chapterId,
          order: l.order,
          status: l.status,
          knowledgePointCount: Number(l.kpCount),
        }))
      if (ls.length > 0) {
        grouped.push({
          id: `class:${cls.id}`,
          title: `Bài tại lớp ${cls.name}`,
          order: 10000 + i,
          lessons: ls,
        })
      }
    })
  }

  return grouped
}
