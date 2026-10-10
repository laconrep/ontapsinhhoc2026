"use server"

import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db, ensureSchema } from "@/lib/db"
import {
  chapters,
  classAssignments,
  classStudents,
  classes,
  lessons,
  quizAttempts,
  studentTab1Submissions,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import {
  assignmentProgressPercent,
  deriveStudentAssignmentStatus,
  quizCompletedAfterTab1,
} from "@/lib/assignment-status"
import type { AssignedLessonDto, ClassAssignmentDto } from "@/types"

async function assertTeacherOwnsClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")
  return cls
}

export async function assignLessons(
  classId: string,
  lessonIds: string[],
  dueAt?: string | null,
  note?: string | null,
): Promise<{ assigned: number; skipped: number }> {
  const teacher = await requireRole("teacher")
  await ensureSchema()
  await assertTeacherOwnsClass(classId, teacher.id)

  const uniqueIds = [...new Set(lessonIds.filter(Boolean))]
  if (uniqueIds.length === 0) return { assigned: 0, skipped: 0 }

  const ready = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(
      and(
        eq(lessons.teacherId, teacher.id),
        eq(lessons.status, "ready"),
        inArray(lessons.id, uniqueIds),
      ),
    )
  const readyIds = ready.map((r) => r.id)
  const skippedNotReady = uniqueIds.length - readyIds.length
  if (readyIds.length === 0) return { assigned: 0, skipped: uniqueIds.length }

  const due = dueAt ? new Date(dueAt) : null
  const dueValue = due && !Number.isNaN(due.getTime()) ? due : null
  const noteValue = note?.trim() ? note.trim() : null

  const inserted = await db
    .insert(classAssignments)
    .values(
      readyIds.map((lessonId) => ({
        classId,
        lessonId,
        teacherId: teacher.id,
        dueAt: dueValue,
        note: noteValue,
      })),
    )
    .onConflictDoNothing({ target: [classAssignments.classId, classAssignments.lessonId] })
    .returning({ id: classAssignments.id })

  revalidatePath(`/teacher/classes/${classId}`)
  revalidatePath("/student/learn")
  revalidatePath("/student")
  return {
    assigned: inserted.length,
    skipped: skippedNotReady + (readyIds.length - inserted.length),
  }
}

export async function getClassAssignments(classId: string): Promise<ClassAssignmentDto[]> {
  const teacher = await requireRole("teacher")
  await ensureSchema()
  await assertTeacherOwnsClass(classId, teacher.id)

  const rows = await db
    .select({
      id: classAssignments.id,
      classId: classAssignments.classId,
      lessonId: classAssignments.lessonId,
      lessonTitle: lessons.title,
      chapterTitle: chapters.title,
      dueAt: classAssignments.dueAt,
      note: classAssignments.note,
      createdAt: classAssignments.createdAt,
    })
    .from(classAssignments)
    .innerJoin(lessons, eq(lessons.id, classAssignments.lessonId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(eq(classAssignments.classId, classId))
    .orderBy(desc(classAssignments.createdAt))

  return rows.map((r) => ({
    id: r.id,
    classId: r.classId,
    lessonId: r.lessonId,
    lessonTitle: r.lessonTitle,
    chapterTitle: r.chapterTitle,
    dueAt: r.dueAt ? r.dueAt.toISOString() : null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getAssignableLessons(): Promise<
  { id: string; title: string; chapterTitle: string }[]
> {
  const teacher = await requireRole("teacher")
  await ensureSchema()

  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      chapterTitle: chapters.title,
    })
    .from(lessons)
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(and(eq(lessons.teacherId, teacher.id), eq(lessons.status, "ready")))
    .orderBy(asc(chapters.order), asc(lessons.order))

  return rows
}

export async function updateAssignment(
  classId: string,
  id: string,
  patch: { dueAt?: string | null; note?: string | null },
): Promise<void> {
  const teacher = await requireRole("teacher")
  await ensureSchema()
  await assertTeacherOwnsClass(classId, teacher.id)

  const [row] = await db
    .select({ id: classAssignments.id })
    .from(classAssignments)
    .where(
      and(
        eq(classAssignments.id, id),
        eq(classAssignments.classId, classId),
        eq(classAssignments.teacherId, teacher.id),
      ),
    )
    .limit(1)
  if (!row) throw new Error("Không tìm thấy bài giao")

  const next: { dueAt?: Date | null; note?: string | null } = {}
  if (patch.dueAt !== undefined) {
    if (patch.dueAt == null || patch.dueAt === "") next.dueAt = null
    else {
      const d = new Date(patch.dueAt)
      next.dueAt = Number.isNaN(d.getTime()) ? null : d
    }
  }
  if (patch.note !== undefined) next.note = patch.note?.trim() ? patch.note.trim() : null

  if (Object.keys(next).length > 0) {
    await db.update(classAssignments).set(next).where(eq(classAssignments.id, id))
  }
  revalidatePath(`/teacher/classes/${classId}`)
  revalidatePath("/student/learn")
  revalidatePath("/student")
}

export async function removeAssignment(classId: string, id: string): Promise<void> {
  const teacher = await requireRole("teacher")
  await ensureSchema()
  await assertTeacherOwnsClass(classId, teacher.id)

  await db
    .delete(classAssignments)
    .where(
      and(
        eq(classAssignments.id, id),
        eq(classAssignments.classId, classId),
        eq(classAssignments.teacherId, teacher.id),
      ),
    )
  revalidatePath(`/teacher/classes/${classId}`)
  revalidatePath("/student/learn")
  revalidatePath("/student")
}

export async function getAssignedLessonsForStudent(): Promise<AssignedLessonDto[]> {
  const student = await requireRole("student")
  await ensureSchema()

  const membership = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .where(eq(classStudents.studentId, student.id))
  const classIds = membership.map((m) => m.classId)
  if (classIds.length === 0) return []

  const rows = await db
    .select({
      lessonId: classAssignments.lessonId,
      lessonTitle: lessons.title,
      chapterTitle: chapters.title,
      dueAt: classAssignments.dueAt,
      note: classAssignments.note,
      createdAt: classAssignments.createdAt,
    })
    .from(classAssignments)
    .innerJoin(lessons, eq(lessons.id, classAssignments.lessonId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(inArray(classAssignments.classId, classIds))
    .orderBy(desc(classAssignments.createdAt))

  if (rows.length === 0) return []

  const lessonIds = [...new Set(rows.map((r) => r.lessonId))]

  const tab1Rows = await db
    .select({
      lessonId: studentTab1Submissions.lessonId,
      submittedAt: studentTab1Submissions.submittedAt,
    })
    .from(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        inArray(studentTab1Submissions.lessonId, lessonIds),
      ),
    )
  const tab1ByLesson = new Map(tab1Rows.map((t) => [t.lessonId, t.submittedAt]))

  const quizDone = await db
    .select({ lessonId: quizAttempts.lessonId, completedAt: quizAttempts.completedAt })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, student.id), inArray(quizAttempts.lessonId, lessonIds)))
  const quizCompletedIds = new Set<string>()
  for (const q of quizDone) {
    if (quizCompletedAfterTab1(q.completedAt, tab1ByLesson.get(q.lessonId) ?? null)) {
      quizCompletedIds.add(q.lessonId)
    }
  }

  const now = new Date()
  const seen = new Set<string>()
  const out: AssignedLessonDto[] = []
  for (const r of rows) {
    if (seen.has(r.lessonId)) continue
    seen.add(r.lessonId)
    const hasTab1Submission = tab1ByLesson.has(r.lessonId)
    const hasCompletedQuiz = quizCompletedIds.has(r.lessonId)
    const progressPercent = assignmentProgressPercent({ hasTab1Submission, hasCompletedQuiz })
    const studentStatus = deriveStudentAssignmentStatus({
      hasCompletedQuiz,
      hasTab1Submission,
      dueAt: r.dueAt,
      now,
    })
    out.push({
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      chapterTitle: r.chapterTitle,
      dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      note: r.note,
      studentStatus,
      progressPercent,
    })
  }
  return out
}
