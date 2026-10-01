import { db, ensureSchema } from "@/lib/db"
import { chapters, lessons, knowledgePoints, questions, questionOptions } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { extractAndParse } from "@/lib/extract-file"
import {
  validateDocument,
  summarize,
  parseTextContent,
  attachBodyHtml,
  attachOptionBodyHtml,
  type ParseResult,
  type ValidationError,
} from "@/lib/worksheet-parser"
import type { SessionUser } from "@/lib/auth-helpers"

export type { ParseResult, ValidationError }

export interface WorksheetPreview {
  parseResult: ParseResult
  errors: ValidationError[]
  isValid: boolean
  summary: { chapters: number; lessons: number; kps: number; questions: number }
  sourceText: string
  images: string[]
  tables: string[]
}

export interface SaveResult {
  createdChapters: number
  createdLessons: number
  createdKps: number
  createdQuestions: number
  lessonIds: string[]
}

export function previewParseResult(result: ParseResult): ParseResult {
  return {
    ...result,
    chapters: result.chapters.map((ch) => ({
      ...ch,
      lessons: ch.lessons.map((l) => ({
        ...l,
        knowledgePoints: l.knowledgePoints.map((kp) => ({
          ...kp,
          questions: kp.questions.map((q) => ({
            type: q.type,
            content: q.content,
            options: q.options,
            correctAnswer: q.correctAnswer,
            bodyHtml: q.bodyHtml,
            line: q.line,
          })),
        })),
      })),
    })),
  }
}

export async function bufferFromFormData(formData: FormData): Promise<{ buffer: Buffer; filename: string }> {
  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("Không tìm thấy file tải lên")
  const buffer = Buffer.from(await file.arrayBuffer())
  return { buffer, filename: file.name }
}

export async function validateWorksheetBuffer(buffer: Buffer, filename: string): Promise<WorksheetPreview> {
  const { parseResult, sourceText, images, tables } = await extractAndParse(buffer, filename)
  const validation = validateDocument(parseResult)
  return {
    parseResult: previewParseResult(parseResult),
    errors: validation.errors,
    isValid: validation.isValid,
    summary: summarize(parseResult),
    sourceText,
    images,
    tables,
  }
}

function toTxtFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "") + ".txt"
}

async function persistParseResult(
  user: SessionUser,
  parseResult: ParseResult,
  filename: string,
): Promise<SaveResult> {
  await ensureSchema()
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
            .values({
              knowledgePointId: kpRow.id,
              type: pQ.type,
              content: pQ.content,
              bodyHtml: pQ.bodyHtml ?? null,
              difficulty: 1,
            })
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
                bodyHtml: o.bodyHtml ?? null,
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

export async function saveWorksheetBuffer(
  user: SessionUser,
  buffer: Buffer,
  filename: string,
): Promise<SaveResult> {
  const { parseResult } = await extractAndParse(buffer, filename)
  return persistParseResult(user, parseResult, filename)
}

export function parseMediaArray(raw: FormDataEntryValue | null): string[] | undefined {
  if (typeof raw !== "string" || !raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    return parsed.filter((x): x is string => typeof x === "string")
  } catch {
    return undefined
  }
}

export function parseWorksheetText(
  text: string,
  images?: string[],
  tables?: string[],
): ParseResult {
  const parseResult = parseTextContent(text)
  const imgs = images ?? []
  const tbls = tables ?? []
  if (imgs.length > 0 || tbls.length > 0) {
    attachBodyHtml(parseResult, imgs, tbls)
    attachOptionBodyHtml(parseResult, imgs, tbls)
  }
  return parseResult
}

export async function saveWorksheetFromText(
  user: SessionUser,
  text: string,
  filename: string,
  images?: string[],
  tables?: string[],
): Promise<SaveResult> {
  const parseResult = parseWorksheetText(text, images, tables)
  return persistParseResult(user, parseResult, toTxtFilename(filename))
}
