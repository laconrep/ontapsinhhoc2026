"use server"

import { db, ensureSchema } from "@/lib/db"
import {
  chapters,
  classes,
  classAssignments,
  lessons,
  knowledgePoints,
  questions,
  questionOptions,
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
      originalFileKey: lessons.originalFileKey,
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
        // §18: thẻ bài hiện "Đã nạp file" khi bài từng được nạp từ file.
        originalFileKey: l.originalFileKey,
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

/**
 * §18: tạo bài "lưu tại lớp" từ tab Lớp học — bài không vào thư viện
 * (chapterId = null, classId = lớp), kèm dòng giao bài cho chính lớp
 * đó để hiện ngay trong danh sách của lớp (HS chỉ học khi bài ready).
 */
export async function createClassLesson(
  classId: string,
  title: string,
): Promise<{ id: string }> {
  const user = await requireRole("teacher")
  await ensureSchema()
  if (!title.trim()) throw new Error("Tên bài giảng không được để trống")
  const [cls] = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, user.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")

  const countRes = await db
    .select({ c: sql<number>`count(*)` })
    .from(lessons)
    .where(eq(lessons.classId, classId))
  const [row] = await db
    .insert(lessons)
    .values({
      title: title.trim(),
      chapterId: null,
      classId,
      teacherId: user.id,
      order: Number(countRes[0]?.c ?? 0),
      status: "draft",
    })
    .returning({ id: lessons.id })
  await db
    .insert(classAssignments)
    .values({ classId, lessonId: row.id, teacherId: user.id })
    .onConflictDoNothing({ target: [classAssignments.classId, classAssignments.lessonId] })
  revalidatePath(`/teacher/classes/${classId}`)
  return row
}

/** §18: thông tin bài đích cho trang nạp bài (nạp cộng thêm vào bài). */
export async function getLessonForImport(lessonId: string): Promise<{
  id: string
  title: string
  chapterTitle: string
  classId: string | null
} | null> {
  const user = await requireRole("teacher")
  await ensureSchema()
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      chapterId: lessons.chapterId,
      classId: lessons.classId,
      chapterTitle: chapters.title,
      className: classes.name,
    })
    .from(lessons)
    .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .where(and(eq(lessons.id, lessonId), eq(lessons.teacherId, user.id)))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    title: row.title,
    chapterTitle:
      row.chapterTitle ??
      (row.classId ? `Bài tại lớp ${row.className ?? ""}`.trim() : "Chưa phân chương"),
    classId: row.classId,
  }
}

/**
 * §18: ảnh chụp nội dung hiện có của bài đích — importer dùng để tính
 * cảnh báo trùng ở bản xem trước khi nạp cộng thêm (server tính lại
 * lúc lưu làm kết quả chính thức).
 */
export async function getLessonDedupeSnapshot(lessonId: string): Promise<{
  kps: { id: string; content: string }[]
  questions: {
    knowledgePointId: string
    type: string
    content: string
    options: string[]
    correctAnswer: string | null
  }[]
}> {
  const user = await requireRole("teacher")
  await ensureSchema()
  const [own] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.id, lessonId), eq(lessons.teacherId, user.id)))
    .limit(1)
  if (!own) throw new Error("Không tìm thấy bài giảng")

  const kps = await db
    .select({ id: knowledgePoints.id, content: knowledgePoints.content })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
    .orderBy(asc(knowledgePoints.order))
  const qs = await db
    .select({
      id: questions.id,
      knowledgePointId: questions.knowledgePointId,
      type: questions.type,
      content: questions.content,
    })
    .from(questions)
    .where(eq(questions.lessonId, lessonId))
    .orderBy(asc(questions.order))
  const opts = qs.length
    ? await db
        .select({
          questionId: questionOptions.questionId,
          content: questionOptions.content,
          isCorrect: questionOptions.isCorrect,
        })
        .from(questionOptions)
        .where(
          sql`${questionOptions.questionId} in (${sql.join(
            qs.map((q) => sql`${q.id}`),
            sql`, `,
          )})`,
        )
        .orderBy(asc(questionOptions.order))
    : []
  const byQ = new Map<string, { content: string; isCorrect: boolean }[]>()
  for (const o of opts) {
    const list = byQ.get(o.questionId) ?? []
    list.push({ content: o.content, isCorrect: o.isCorrect })
    byQ.set(o.questionId, list)
  }
  return {
    kps,
    questions: qs.map((q) => {
      const list = byQ.get(q.id) ?? []
      return {
        knowledgePointId: q.knowledgePointId ?? "",
        type: q.type,
        content: q.content,
        options: q.type === "SA" ? [] : list.map((o) => o.content),
        correctAnswer:
          q.type === "SA"
            ? list
                .filter((o) => o.isCorrect)
                .map((o) => o.content)
                .join(" | ")
            : null,
      }
    }),
  }
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
  const [lessonRow] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      chapterId: lessons.chapterId,
      classId: lessons.classId,
      order: lessons.order,
      status: lessons.status,
      originalFileKey: lessons.originalFileKey,
      chapterTitle: chapters.title,
      className: classes.name,
    })
    .from(lessons)
    .leftJoin(chapters, eq(chapters.id, lessons.chapterId))
    .leftJoin(classes, eq(classes.id, lessons.classId))
    .where(and(eq(lessons.id, id), eq(lessons.teacherId, user.id)))
  if (!lessonRow) return null
  // §18: bài tại lớp không có chương — hiện ngữ cảnh lớp thay thế.
  const { className, ...lessonRest } = lessonRow
  const lesson = {
    ...lessonRest,
    chapterTitle:
      lessonRow.chapterTitle ??
      (lessonRow.classId ? `Bài tại lớp ${className ?? ""}`.trim() : "Chưa phân chương"),
  }

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
