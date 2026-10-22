import { db, ensureSchema } from "@/lib/db"
import { chapters, lessons, knowledgePoints, questions, questionOptions } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { extractAndParse, MAX_FILE_SIZE } from "@/lib/extract-file"
import { prepareKpTermsForSave } from "@/lib/slot-render"
import {
  validateDocument,
  summarize,
  parseTextContent,
  attachBodyHtml,
  attachOptionBodyHtml,
  splitSaAcceptedAnswers,
  type ParseResult,
  type ValidationError,
} from "@/lib/worksheet-parser"
import type { SessionUser } from "@/lib/auth-helpers"
import { sanitizeBodyHtml } from "@/lib/sanitize"

export type { ParseResult, ValidationError }

export interface WorksheetPreview {
  parseResult: ParseResult
  errors: ValidationError[]
  warnings: ValidationError[]
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
            solution: q.solution,
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
  // SEC-06: giới hạn cứng ngay khi đọc body vào bộ nhớ.
  if (file.size > MAX_FILE_SIZE) throw new Error("File vượt quá 10MB")
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_FILE_SIZE) throw new Error("File vượt quá 10MB")
  return { buffer, filename: file.name }
}

export async function validateWorksheetBuffer(buffer: Buffer, filename: string): Promise<WorksheetPreview> {
  const { parseResult, sourceText, images, tables } = await extractAndParse(buffer, filename)
  const validation = validateDocument(parseResult)
  return {
    parseResult: previewParseResult(parseResult),
    errors: validation.errors,
    warnings: validation.warnings,
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

  // BUG-02: toàn bộ import trong MỘT transaction — lỗi giữa chừng thì
  // không để lại bài dở dang (trước đây insert rời từng dòng).
  await db.transaction(async (tx) => {
  for (const pChapter of parseResult.chapters) {
    const [existingChapter] = await tx
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.teacherId, user.id), eq(chapters.title, pChapter.title)))
      .limit(1)

    let chapterId: string
    if (existingChapter) {
      chapterId = existingChapter.id
    } else {
      const [countRow] = await tx
        .select({ c: sql<number>`count(*)` })
        .from(chapters)
        .where(eq(chapters.teacherId, user.id))
      const [row] = await tx
        .insert(chapters)
        .values({ title: pChapter.title, teacherId: user.id, order: Number(countRow?.c ?? 0) })
        .returning({ id: chapters.id })
      chapterId = row.id
      result.createdChapters += 1
    }

    for (const pLesson of pChapter.lessons) {
      const existing = await tx
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

      const [lessonCount] = await tx
        .select({ c: sql<number>`count(*)` })
        .from(lessons)
        .where(eq(lessons.chapterId, chapterId))
      const [lessonRow] = await tx
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
      let qOrder = 0
      for (const pKp of pLesson.knowledgePoints) {
        // BUG-01: không lưu KP nào mà offset không khớp nội dung.
        const prepared = prepareKpTermsForSave(pKp.content, pKp.underlinedTerms)
        const [kpRow] = await tx
          .insert(knowledgePoints)
          .values({
            lessonId,
            content: prepared.content,
            underlinedTerms: prepared.terms,
            order: kpOrder++,
          })
          .returning({ id: knowledgePoints.id })
        result.createdKps += 1

        for (const pQ of pKp.questions) {
          const [qRow] = await tx
            .insert(questions)
            .values({
              lessonId,
              // BUG-02: câu hỏi thuộc về KP chứa nó (trước đây gán cứng null
              // làm Tab 4 rơi vào chế độ ngẫu nhiên và mất seed spaced repetition).
              knowledgePointId: kpRow.id,
              order: qOrder++,
              type: pQ.type,
              content: pQ.content,
              // §15.3: giải chi tiết đi cùng câu (text thuần, render dạng
              // text phía client nên không qua sanitize HTML).
              solution: pQ.solution?.trim() ? pQ.solution.trim() : null,
              // SEC-02: bodyHtml (kể cả từ images/tables client gửi) phải
              // qua sanitize phía server trước khi lưu.
              bodyHtml: sanitizeBodyHtml(pQ.bodyHtml),
              difficulty: 1,
            })
            .returning({ id: questions.id })
          result.createdQuestions += 1

          if (pQ.type === "SA") {
            // BUG-08: "dap an: x | y" = chấp nhận x HOẶC y — mỗi vế một
            // option isCorrect (gradeSA đã nhận danh sách accepted).
            const acceptedParts = splitSaAcceptedAnswers(pQ.correctAnswer)
            const acceptedList = acceptedParts.length > 0 ? acceptedParts : [pQ.correctAnswer ?? ""]
            await tx.insert(questionOptions).values(
              acceptedList.map((content, i) => ({
                questionId: qRow.id,
                content,
                isCorrect: true,
                order: i,
              })),
            )
          } else if (pQ.options.length > 0) {
            await tx.insert(questionOptions).values(
              pQ.options.map((o, i) => ({
                questionId: qRow.id,
                content: o.content,
                bodyHtml: sanitizeBodyHtml(o.bodyHtml),
                isCorrect: o.isCorrect,
                order: i,
              })),
            )
          }
        }
      }
    }
  }
  })

  revalidatePath("/teacher/lessons")
  revalidatePath("/teacher/questions")
  for (const id of result.lessonIds) revalidatePath(`/teacher/lessons/${id}`)
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

// SEC-02/SEC-06: giới hạn media do client gửi kèm text (images/tables là
// HTML thô) — tối đa 200 phần tử mỗi mảng, mỗi phần tử tối đa 1MB ký tự,
// và từng phần tử phải qua sanitize trước khi attach vào câu hỏi.
export const MAX_MEDIA_ITEMS = 200
export const MAX_MEDIA_ITEM_LENGTH = 1_000_000

export function parseMediaArray(raw: FormDataEntryValue | null): string[] | undefined {
  if (typeof raw !== "string" || !raw) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    const items = parsed
      .filter((x): x is string => typeof x === "string")
      .slice(0, MAX_MEDIA_ITEMS)
    const sanitized: string[] = []
    for (const item of items) {
      if (item.length > MAX_MEDIA_ITEM_LENGTH) continue
      const clean = sanitizeBodyHtml(item)
      if (clean) sanitized.push(clean)
    }
    return sanitized
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
