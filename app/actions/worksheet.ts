"use server"

import { db } from "@/lib/db"
import { chapters, lessons, knowledgePoints, questions, questionOptions } from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { extractAndParse } from "@/lib/extract-file"
import { validateDocument, summarize, type ParseResult, type ValidationError } from "@/lib/worksheet-parser"

export interface WorksheetPreview {
  parseResult: ParseResult
  errors: ValidationError[]
  isValid: boolean
  summary: { chapters: number; lessons: number; kps: number; questions: number }
}

async function formDataToBuffer(formData: FormData): Promise<{ buffer: Buffer; filename: string }> {
  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Không tìm thấy file tải lên")
  const buffer = Buffer.from(await file.arrayBuffer())
  return { buffer, filename: file.name }
}

/** BƯỚC 2: Kiểm tra tài liệu — parse + validate, trả preview. Không lưu DB. */
export async function validateWorksheet(formData: FormData): Promise<WorksheetPreview> {
  await requireRole("teacher")
  const { buffer, filename } = await formDataToBuffer(formData)
  const parseResult = await extractAndParse(buffer, filename)
  const validation = validateDocument(parseResult)
  return {
    parseResult,
    errors: validation.errors,
    isValid: validation.isValid,
    summary: summarize(parseResult),
  }
}

export interface SaveResult {
  createdChapters: number
  createdLessons: number
  createdKps: number
  createdQuestions: number
  lessonIds: string[]
}

/** BƯỚC 3: Lưu tài liệu — parse lại, ghi DB, đặt status='ready'. */
export async function saveWorksheet(formData: FormData): Promise<SaveResult> {
  const user = await requireRole("teacher")
  const { buffer, filename } = await formDataToBuffer(formData)
  const parseResult = await extractAndParse(buffer, filename)
  const validation = validateDocument(parseResult)
  if (!validation.isValid) {
    throw new Error("Tài liệu chưa hợp lệ, không thể lưu. Vui lòng kiểm tra lại.")
  }

  const result: SaveResult = {
    createdChapters: 0,
    createdLessons: 0,
    createdKps: 0,
    createdQuestions: 0,
    lessonIds: [],
  }

  for (const pChapter of parseResult.chapters) {
    // tìm chương cùng tên hoặc tạo mới
    const [existingChapter] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.teacherId, user.id), eq(chapters.title, pChapter.title)))
      .limit(1)

    let chapterId: string
    if (existingChapter) {
      chapterId = existingChapter.id
    } else {
      const [countRow] = await db
        .select({ c: sql<number>`count(*)` })
        .from(chapters)
        .where(eq(chapters.teacherId, user.id))
      const [row] = await db
        .insert(chapters)
        .values({ title: pChapter.title, teacherId: user.id, order: Number(countRow?.c ?? 0) })
        .returning({ id: chapters.id })
      chapterId = row.id
      result.createdChapters += 1
    }

    for (const pLesson of pChapter.lessons) {
      // xử lý trùng tên bài trong cùng chương
      const existing = await db
        .select({ title: lessons.title })
        .from(lessons)
        .where(and(eq(lessons.chapterId, chapterId), eq(lessons.teacherId, user.id)))
      const titles = new Set(existing.map((e) => e.title))
      let title = pLesson.title
      let n = 2
      while (titles.has(title)) {
        title = `${pLesson.title} (${n})`
        n += 1
      }

      const [lessonCount] = await db
        .select({ c: sql<number>`count(*)` })
        .from(lessons)
        .where(eq(lessons.chapterId, chapterId))
      const [lessonRow] = await db
        .insert(lessons)
        .values({
          title,
          chapterId,
          teacherId: user.id,
          order: Number(lessonCount?.c ?? 0),
          status: "ready",
          originalFileKey: filename,
        })
        .returning({ id: lessons.id })
      const lessonId = lessonRow.id
      result.createdLessons += 1
      result.lessonIds.push(lessonId)

      let kpOrder = 0
      for (const pKp of pLesson.knowledgePoints) {
        const [kpRow] = await db
          .insert(knowledgePoints)
          .values({
            lessonId,
            content: pKp.content,
            underlinedTerms: pKp.underlinedTerms,
            order: kpOrder++,
          })
          .returning({ id: knowledgePoints.id })
        result.createdKps += 1

        for (const pQ of pKp.questions) {
          const [qRow] = await db
            .insert(questions)
            .values({ knowledgePointId: kpRow.id, type: pQ.type, content: pQ.content, difficulty: 1 })
            .returning({ id: questions.id })
          result.createdQuestions += 1

          if (pQ.type === "SA") {
            await db.insert(questionOptions).values({
              questionId: qRow.id,
              content: pQ.correctAnswer ?? "",
              isCorrect: true,
              order: 0,
            })
          } else if (pQ.options.length > 0) {
            await db.insert(questionOptions).values(
              pQ.options.map((o, i) => ({
                questionId: qRow.id,
                content: o.content,
                isCorrect: o.isCorrect,
                order: i,
              })),
            )
          }
        }
      }
    }
  }

  revalidatePath("/teacher/lessons")
  revalidatePath("/teacher/questions")
  return result
}
