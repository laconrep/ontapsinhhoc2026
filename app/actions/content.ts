"use server"

import { db, ensureSchema } from "@/lib/db"
import {
  chapters,
  lessons,
  knowledgePoints,
  questions,
  spacedRepetition,
  studentProgress,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { prepareKpTermsForSave } from "@/lib/slot-render"
import { kpGradingSignature } from "@/lib/scoring"
import { and, asc, eq, sql } from "drizzle-orm"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
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

/** Danh sách chương (id + tên) cho các form chọn chương (vd tạo bài từ tab Lớp học). */
export async function getChapterOptions(): Promise<{ id: string; title: string }[]> {
  const user = await requireRole("teacher")
  const rows = await db
    .select({ id: chapters.id, title: chapters.title })
    .from(chapters)
    .where(eq(chapters.teacherId, user.id))
    .orderBy(asc(chapters.order), asc(chapters.createdAt))
  return rows
}

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
  noStore()
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
  // BUG-01/BUG-12: server tự chuẩn hóa NFC và kiểm tra offset, không tin
  // hoàn toàn underlinedTerms do client gửi — lệch thì từ chối lưu.
  const prepared = prepareKpTermsForSave(content, underlinedTerms)
  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
  const order = Number(countRes[0]?.c ?? 0)
  const [row] = await db
    .insert(knowledgePoints)
    .values({ lessonId, content: prepared.content, underlinedTerms: prepared.terms, order })
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
    .select({
      lessonId: knowledgePoints.lessonId,
      underlinedTerms: knowledgePoints.underlinedTerms,
    })
    .from(knowledgePoints)
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .where(and(eq(knowledgePoints.id, id), eq(lessons.teacherId, user.id)))
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  // BUG-01/BUG-12: như createKnowledgePoint — chuẩn hóa NFC + kiểm tra
  // offset phía server trước khi lưu.
  const prepared = prepareKpTermsForSave(content, underlinedTerms)
  // BUG-12 (chính sách ĐÃ CHỐT 21/10/2026 — sualogic.md mục 13): nếu lần
  // sửa này làm thay đổi nội dung chấm (chữ ký gồm term + đáp án chấp
  // nhận của từng ô + phân hoạch nhóm hoán đổi, xem kpGradingSignature)
  // thì reset tiến độ của MỌI học sinh đối với KP này để các em làm lại
  // phần đã đổi. Cách reset bám theo tiền lệ resetLessonProgress: GIỮ
  // selfAssessment (đánh giá Tab 1 ở cấp bài, đã khoá), chỉ xoá kết quả
  // điền/kéo-thả và tính lại overallStatus; hàng spaced_repetition của
  // KP bị xoá để lần nộp quiz sau seed lại từ đầu. Chữ ký không đổi
  // (sửa thân bài ngoài ô trống, sửa định dạng...) thì giữ nguyên tiến độ.
  const beforeTerms = (kp.underlinedTerms as UnderlinedTerm[] | null) ?? []
  const gradingChanged = kpGradingSignature(beforeTerms) !== kpGradingSignature(prepared.terms)
  await db.transaction(async (tx) => {
    await tx
      .update(knowledgePoints)
      .set({ content: prepared.content, underlinedTerms: prepared.terms })
      .where(eq(knowledgePoints.id, id))
    if (gradingChanged) {
      const resetRows = await tx
        .update(studentProgress)
        .set({
          fillStatus: null,
          dragStatus: null,
          fillAttempts: 0,
          dragAttempts: 0,
          fillRevealed: false,
          dragRevealed: false,
          fillFirstTry: null,
          dragFirstTry: null,
          overallStatus: sql`CASE
            WHEN ${studentProgress.selfAssessment} = 'known' THEN 'known'
            WHEN ${studentProgress.selfAssessment} = 'unknown' THEN 'unknown'
            ELSE 'not_started'
          END`,
          updatedAt: new Date(),
        })
        .where(eq(studentProgress.knowledgePointId, id))
        .returning({ studentId: studentProgress.studentId })
      const srRows = await tx
        .delete(spacedRepetition)
        .where(eq(spacedRepetition.knowledgePointId, id))
        .returning({ id: spacedRepetition.id })
      console.info("updateKnowledgePoint: reset tiến độ do nội dung chấm thay đổi", {
        kpId: id,
        progressRowsReset: resetRows.length,
        spacedRepetitionRowsDeleted: srRows.length,
      })
    }
  })
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
