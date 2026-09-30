"use server"

import { db } from "@/lib/db"
import { questions, questionOptions, knowledgePoints, lessons } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { chapters } from "@/lib/db/schema"
import type { QuestionDto, QuestionOptionDto } from "@/types"

type QuestionType = "MC" | "TF" | "SA" | "FILL" | "DRAG"

export interface QuestionBankItem {
  id: string
  type: QuestionType
  content: string
  difficulty: number
  chapterTitle: string
  lessonId: string
  lessonTitle: string
  knowledgePointId: string
  knowledgePointContent: string
  optionCount: number
  correctAnswer?: string
}

// Toàn bộ câu hỏi của giáo viên, kèm ngữ cảnh chương/bài/điểm kiến thức để lọc và tra cứu.
export async function getQuestionBank(): Promise<QuestionBankItem[]> {
  const user = await requireRole("teacher")

  const rows = await db
    .select({
      id: questions.id,
      type: questions.type,
      content: questions.content,
      difficulty: questions.difficulty,
      chapterTitle: chapters.title,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
      knowledgePointId: knowledgePoints.id,
      knowledgePointContent: knowledgePoints.content,
    })
    .from(questions)
    .innerJoin(knowledgePoints, eq(knowledgePoints.id, questions.knowledgePointId))
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(eq(lessons.teacherId, user.id))
    .orderBy(asc(chapters.order), asc(lessons.order), asc(knowledgePoints.order))

  const opts = await db.select().from(questionOptions).orderBy(asc(questionOptions.order))

  return rows.map((r) => {
    const qOpts = opts.filter((o) => o.questionId === r.id)
    return {
      id: r.id,
      type: r.type as QuestionType,
      content: r.content,
      difficulty: r.difficulty,
      chapterTitle: r.chapterTitle,
      lessonId: r.lessonId,
      lessonTitle: r.lessonTitle,
      knowledgePointId: r.knowledgePointId,
      knowledgePointContent: r.knowledgePointContent,
      optionCount: qOpts.length,
      correctAnswer: r.type === "SA" ? qOpts.find((o) => o.isCorrect)?.content : undefined,
    }
  })
}

interface OptionInput {
  content: string
  isCorrect: boolean
}

// verify the knowledge point belongs to the teacher; returns lessonId for revalidation
async function assertKpOwner(knowledgePointId: string, teacherId: string): Promise<string> {
  const [kp] = await db
    .select({ lessonId: knowledgePoints.lessonId })
    .from(knowledgePoints)
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .where(and(eq(knowledgePoints.id, knowledgePointId), eq(lessons.teacherId, teacherId)))
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  return kp.lessonId
}

export async function getQuestionsByKp(knowledgePointId: string): Promise<QuestionDto[]> {
  const user = await requireRole("teacher")
  await assertKpOwner(knowledgePointId, user.id)

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.knowledgePointId, knowledgePointId))
    .orderBy(asc(questions.createdAt))

  const opts = await db
    .select()
    .from(questionOptions)
    .orderBy(asc(questionOptions.order))

  return qs.map((q) => {
    const qOpts: QuestionOptionDto[] = opts
      .filter((o) => o.questionId === q.id)
      .map((o) => ({ id: o.id, content: o.content, isCorrect: o.isCorrect, order: o.order }))
    return {
      id: q.id,
      knowledgePointId: q.knowledgePointId,
      type: q.type as QuestionType,
      content: q.content,
      bodyHtml: q.bodyHtml ?? null,
      options: qOpts,
      correctAnswer: q.type === "SA" ? qOpts.find((o) => o.isCorrect)?.content : undefined,
    }
  })
}

function validateOptions(type: QuestionType, options: OptionInput[]) {
  if (type === "MC") {
    if (options.length < 2) throw new Error("Câu trắc nghiệm cần ít nhất 2 lựa chọn")
    if (options.filter((o) => o.isCorrect).length !== 1)
      throw new Error("Câu trắc nghiệm phải có đúng 1 đáp án đúng")
  } else if (type === "TF") {
    if (options.length < 1) throw new Error("Câu Đúng/Sai cần ít nhất 1 ý")
  } else if (type === "SA") {
    if (options.length !== 1 || !options[0].content.trim())
      throw new Error("Câu trả lời ngắn cần đúng 1 đáp án")
  }
}

export async function createQuestion(input: {
  knowledgePointId: string
  type: QuestionType
  content: string
  bodyHtml?: string | null
  difficulty?: number
  options: OptionInput[]
}): Promise<{ id: string }> {
  const user = await requireRole("teacher")
  const lessonId = await assertKpOwner(input.knowledgePointId, user.id)
  if (!input.content.trim()) throw new Error("Nội dung câu hỏi không được để trống")
  validateOptions(input.type, input.options)

  const [q] = await db
    .insert(questions)
    .values({
      knowledgePointId: input.knowledgePointId,
      type: input.type,
      content: input.content.trim(),
      bodyHtml: input.bodyHtml ?? null,
      difficulty: input.difficulty ?? 1,
    })
    .returning({ id: questions.id })

  // SA stores its correct answer in a single option with isCorrect=true
  if (input.options.length > 0) {
    await db.insert(questionOptions).values(
      input.options.map((o, i) => ({
        questionId: q.id,
        content: o.content.trim(),
        isCorrect: o.isCorrect,
        order: i,
      })),
    )
  }
  revalidatePath(`/teacher/lessons/${lessonId}`)
  return q
}

export async function updateQuestion(input: {
  id: string
  content: string
  bodyHtml?: string | null
  difficulty?: number
  options: OptionInput[]
}): Promise<void> {
  const user = await requireRole("teacher")
  const [q] = await db
    .select({ id: questions.id, type: questions.type, kpId: questions.knowledgePointId })
    .from(questions)
    .innerJoin(knowledgePoints, eq(knowledgePoints.id, questions.knowledgePointId))
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .where(and(eq(questions.id, input.id), eq(lessons.teacherId, user.id)))
  if (!q) throw new Error("Không tìm thấy câu hỏi")
  validateOptions(q.type as QuestionType, input.options)

  await db
    .update(questions)
    .set({
      content: input.content.trim(),
      bodyHtml: input.bodyHtml === undefined ? undefined : input.bodyHtml,
      difficulty: input.difficulty ?? 1,
    })
    .where(eq(questions.id, input.id))

  // replace options
  await db.delete(questionOptions).where(eq(questionOptions.questionId, input.id))
  if (input.options.length > 0) {
    await db.insert(questionOptions).values(
      input.options.map((o, i) => ({
        questionId: input.id,
        content: o.content.trim(),
        isCorrect: o.isCorrect,
        order: i,
      })),
    )
  }
  const lessonId = await assertKpOwner(q.kpId, user.id)
  revalidatePath(`/teacher/lessons/${lessonId}`)
}

export async function deleteQuestion(id: string): Promise<void> {
  const user = await requireRole("teacher")
  const [q] = await db
    .select({ kpId: questions.knowledgePointId })
    .from(questions)
    .innerJoin(knowledgePoints, eq(knowledgePoints.id, questions.knowledgePointId))
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .where(and(eq(questions.id, id), eq(lessons.teacherId, user.id)))
  if (!q) throw new Error("Không tìm thấy câu hỏi")
  const lessonId = await assertKpOwner(q.kpId, user.id)
  await db.delete(questions).where(eq(questions.id, id))
  revalidatePath(`/teacher/lessons/${lessonId}`)
}
