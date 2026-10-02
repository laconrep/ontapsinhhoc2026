"use server"

import { db, ensureSchema } from "@/lib/db"
import { chapters, lessons, knowledgePoints, questions } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import type { ChapterDto, LessonDto, KnowledgePointDto, UnderlinedTerm } from "@/types"

// ---------- Chapters ----------

export async function getChaptersWithLessons(): Promise<ChapterDto[]> {
  const user = await requireRole("teacher")

  const rows = await db
    .select()
    .from(chapters)
    .where(eq(chapters.teacherId, user.id))
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
    .where(eq(lessons.teacherId, user.id))
    .groupBy(lessons.id)
    .orderBy(asc(lessons.order), asc(lessons.createdAt))

  return rows.map((c) => ({
    id: c.id,
    title: c.title,
    order: c.order,
    lessons: lessonRows
      .filter((l) => l.chapterId === c.id)
      .map((l) => ({
        id: l.id,
        title: l.title,
        chapterId: l.chapterId,
        order: l.order,
        status: l.status,
        knowledgePointCount: Number(l.kpCount),
      })),
  }))
}

export async function createChapter(title: string): Promise<{ id: string }> {
  const user = await requireRole("teacher")
  if (!title.trim()) throw new Error("Tên chương không được để trống")
  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(chapters)
    .where(eq(chapters.teacherId, user.id))
  const order = Number(countRes[0]?.c ?? 0)
  const [row] = await db
    .insert(chapters)
    .values({ title: title.trim(), teacherId: user.id, order })
    .returning({ id: chapters.id })
  revalidatePath("/teacher/lessons")
  return row
}

export async function updateChapter(id: string, title: string): Promise<void> {
  const user = await requireRole("teacher")
  await db
    .update(chapters)
    .set({ title: title.trim() })
    .where(and(eq(chapters.id, id), eq(chapters.teacherId, user.id)))
  revalidatePath("/teacher/lessons")
}

export async function deleteChapter(id: string): Promise<void> {
  const user = await requireRole("teacher")
  await db.delete(chapters).where(and(eq(chapters.id, id), eq(chapters.teacherId, user.id)))
  revalidatePath("/teacher/lessons")
}

// ---------- Lessons ----------

export async function createLesson(chapterId: string, title: string): Promise<{ id: string }> {
  const user = await requireRole("teacher")
  if (!title.trim()) throw new Error("Tên bài giảng không được để trống")
  // verify chapter ownership
  const chap = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(and(eq(chapters.id, chapterId), eq(chapters.teacherId, user.id)))
  if (chap.length === 0) throw new Error("Không tìm thấy chương")

  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(lessons)
    .where(eq(lessons.chapterId, chapterId))
  const order = Number(countRes[0]?.c ?? 0)

  const [row] = await db
    .insert(lessons)
    .values({ title: title.trim(), chapterId, teacherId: user.id, order, status: "draft" })
    .returning({ id: lessons.id })
  revalidatePath("/teacher/lessons")
  return row
}

export async function updateLesson(
  id: string,
  data: { title?: string; status?: LessonDto["status"] },
): Promise<void> {
  const user = await requireRole("teacher")
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (data.title !== undefined) patch.title = data.title.trim()
  if (data.status !== undefined) patch.status = data.status
  await db
    .update(lessons)
    .set(patch)
    .where(and(eq(lessons.id, id), eq(lessons.teacherId, user.id)))
  revalidatePath("/teacher/lessons")
  revalidatePath(`/teacher/lessons/${id}`)
}

export async function deleteLesson(id: string): Promise<void> {
  const user = await requireRole("teacher")
  await db.delete(lessons).where(and(eq(lessons.id, id), eq(lessons.teacherId, user.id)))
  revalidatePath("/teacher/lessons")
}

export async function getLessonDetail(id: string): Promise<{
  lesson: LessonDto & { chapterTitle: string }
  knowledgePoints: (KnowledgePointDto & { questionCount: number })[]
} | null> {
  const user = await requireRole("teacher")
  await ensureSchema()
  const [lesson] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      chapterId: lessons.chapterId,
      order: lessons.order,
      status: lessons.status,
      chapterTitle: chapters.title,
    })
    .from(lessons)
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(and(eq(lessons.id, id), eq(lessons.teacherId, user.id)))
  if (!lesson) return null

  const kps = await db
    .select({
      id: knowledgePoints.id,
      lessonId: knowledgePoints.lessonId,
      content: knowledgePoints.content,
      underlinedTerms: knowledgePoints.underlinedTerms,
      order: knowledgePoints.order,
      questionCount: sql<number>`count(${questions.id})`.as("questionCount"),
    })
    .from(knowledgePoints)
    .leftJoin(questions, eq(questions.knowledgePointId, knowledgePoints.id))
    .where(eq(knowledgePoints.lessonId, id))
    .groupBy(knowledgePoints.id)
    .orderBy(asc(knowledgePoints.order))

  return {
    lesson: { ...lesson, knowledgePointCount: kps.length },
    knowledgePoints: kps.map((k) => ({
      id: k.id,
      lessonId: k.lessonId,
      content: k.content,
      underlinedTerms: (k.underlinedTerms as UnderlinedTerm[]) ?? [],
      order: k.order,
      questionCount: Number(k.questionCount),
    })),
  }
}

// ---------- Knowledge Points ----------

async function assertLessonOwner(lessonId: string, teacherId: string) {
  const rows = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.teacherId, teacherId)))
  if (rows.length === 0) throw new Error("Không tìm thấy bài giảng")
}

export async function createKnowledgePoint(
  lessonId: string,
  content: string,
  underlinedTerms: UnderlinedTerm[],
): Promise<{ id: string }> {
  const user = await requireRole("teacher")
  await assertLessonOwner(lessonId, user.id)
  if (!content.trim()) throw new Error("Nội dung không được để trống")
  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
  const order = Number(countRes[0]?.c ?? 0)
  const [row] = await db
    .insert(knowledgePoints)
    .values({ lessonId, content: content.trim(), underlinedTerms, order })
    .returning({ id: knowledgePoints.id })
  revalidatePath(`/teacher/lessons/${lessonId}`)
  return row
}

export async function updateKnowledgePoint(
  id: string,
  content: string,
  underlinedTerms: UnderlinedTerm[],
): Promise<void> {
  const user = await requireRole("teacher")
  // ownership via lesson join
  const [kp] = await db
    .select({ lessonId: knowledgePoints.lessonId })
    .from(knowledgePoints)
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .where(and(eq(knowledgePoints.id, id), eq(lessons.teacherId, user.id)))
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  await db
    .update(knowledgePoints)
    .set({ content: content.trim(), underlinedTerms })
    .where(eq(knowledgePoints.id, id))
  revalidatePath(`/teacher/lessons/${kp.lessonId}`)
}

export async function deleteKnowledgePoint(id: string): Promise<void> {
  const user = await requireRole("teacher")
  const [kp] = await db
    .select({ lessonId: knowledgePoints.lessonId })
    .from(knowledgePoints)
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .where(and(eq(knowledgePoints.id, id), eq(lessons.teacherId, user.id)))
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  await db.delete(knowledgePoints).where(eq(knowledgePoints.id, id))
  revalidatePath(`/teacher/lessons/${kp.lessonId}`)
}
