import { db, ensureSchema } from "@/lib/db"
import {
  chapters,
  classes,
  classAssignments,
  lessons,
  knowledgePoints,
  questions,
  questionOptions,
} from "@/lib/db/schema"
import { computeAppendPlan, type ExistingQuestionRef } from "@/lib/append-dedupe"
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
  type ParseOptions,
  type ParseResult,
  type ParsedKnowledgePoint,
  type ParsedQuestion,
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
  /** §26: tổng byte ảnh raster (đường validate thường). Đường AI / bản
   * nháp dựng lại từ text không có số này — để trống thì không hiện
   * cảnh báo (không chặn lưu). */
  totalImageBytes?: number
}

export interface SaveResult {
  createdChapters: number
  createdLessons: number
  createdKps: number
  createdQuestions: number
  lessonIds: string[]
  /** §18: kết quả nạp cộng thêm vào bài có sẵn (chỉ có ở chế độ intoLesson). */
  appended?: { addedKps: number; addedQuestions: number; skippedQuestions: number }
  /** §18: cảnh báo trùng chính thức do server tính lại lúc lưu. */
  duplicateWarnings?: string[]
}

/** §18: tuỳ chọn đích đến cho một lượt lưu từ trang nạp bài. */
export interface PersistOptions {
  /** Ép mọi bài trong file vào đúng chương này (chọn ở giao diện). */
  targetChapterId?: string
  /** Lưu tại lớp: bài không vào thư viện (chapterId = null, classId = lớp). */
  classId?: string
  /** Nạp cộng thêm vào một bài có sẵn thay vì tạo bài mới. */
  intoLessonId?: string
  /** Chỉ số bài (phẳng, theo thứ tự trong file) bị ép trạng thái nháp —
   * dùng cho bản AI khi tên bài do AI đặt (GV phải duyệt tên). */
  draftLessonIndexes?: number[]
}

function fallbackLessonTitle(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? ""
  const stripped = base.replace(/\.(docx|pdf|txt)$/i, "").trim()
  return stripped || "Bài chưa đặt tên"
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
  const { parseResult, sourceText, images, tables, imageBytes } = await extractAndParse(buffer, filename)
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
    totalImageBytes: imageBytes,
  }
}

function toTxtFilename(filename: string) {
  return filename.replace(/\.[^.]+$/, "") + ".txt"
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Chèn 1 câu hỏi đã parse (kèm options) — dùng chung cho tạo bài mới và nạp cộng thêm. */
async function insertParsedQuestion(
  tx: Tx,
  lessonId: string,
  kpId: string | null,
  pQ: ParsedQuestion,
  order: number,
): Promise<void> {
  const [qRow] = await tx
    .insert(questions)
    .values({
      lessonId,
      // BUG-02: câu hỏi thuộc về KP chứa nó (trước đây gán cứng null
      // làm Tab 4 rơi vào chế độ ngẫu nhiên và mất seed spaced repetition).
      // §25: ngoại lệ duy nhất cho null là câu hỏi CẤP BÀI HỌC (trắc
      // nghiệm chung tách riêng / câu AI không map được vào KP nào) —
      // Tab 4 có luật riêng cho chúng (xem lib/quiz-selection.ts).
      knowledgePointId: kpId,
      order,
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

async function persistParseResult(
  user: SessionUser,
  parseResult: ParseResult,
  filename: string,
  options: PersistOptions = {},
): Promise<SaveResult> {
  await ensureSchema()
  const validation = validateDocument(parseResult)
  if (!validation.isValid) {
    throw new Error("Tài liệu chưa hợp lệ, không thể lưu. Vui lòng kiểm tra lại.")
  }

  // §18: kiểm tra quyền sở hữu các đích đến trước khi ghi.
  if (options.targetChapterId) {
    const [ch] = await db
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.id, options.targetChapterId), eq(chapters.teacherId, user.id)))
      .limit(1)
    if (!ch) throw new Error("Không tìm thấy chương đích")
  }
  if (options.classId) {
    const [cl] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, options.classId), eq(classes.teacherId, user.id)))
      .limit(1)
    if (!cl) throw new Error("Không tìm thấy lớp đích")
  }
  if (options.intoLessonId) {
    const [ls] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.id, options.intoLessonId), eq(lessons.teacherId, user.id)))
      .limit(1)
    if (!ls) throw new Error("Không tìm thấy bài đích")
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
    // ---- §18: nạp CỘNG THÊM vào một bài có sẵn ----
    if (options.intoLessonId) {
      const targetId = options.intoLessonId
      const existingKps = await tx
        .select({ id: knowledgePoints.id, content: knowledgePoints.content, order: knowledgePoints.order })
        .from(knowledgePoints)
        .where(eq(knowledgePoints.lessonId, targetId))
        .orderBy(knowledgePoints.order)
      const existingQs = await tx
        .select({
          id: questions.id,
          knowledgePointId: questions.knowledgePointId,
          type: questions.type,
          content: questions.content,
        })
        .from(questions)
        .where(eq(questions.lessonId, targetId))
      const existingOpts = existingQs.length
        ? await tx
            .select({
              questionId: questionOptions.questionId,
              content: questionOptions.content,
              isCorrect: questionOptions.isCorrect,
              order: questionOptions.order,
            })
            .from(questionOptions)
            .where(
              sql`${questionOptions.questionId} in (${sql.join(
                existingQs.map((q) => sql`${q.id}`),
                sql`, `,
              )})`,
            )
            .orderBy(questionOptions.order)
        : []
      const optsByQ = new Map<string, { content: string; isCorrect: boolean }[]>()
      for (const o of existingOpts) {
        const list = optsByQ.get(o.questionId) ?? []
        list.push({ content: o.content, isCorrect: o.isCorrect })
        optsByQ.set(o.questionId, list)
      }
      const existingRefs: ExistingQuestionRef[] = existingQs.map((q) => {
        const opts = optsByQ.get(q.id) ?? []
        return {
          knowledgePointId: q.knowledgePointId ?? "",
          type: q.type,
          content: q.content,
          options: q.type === "SA" ? [] : opts.map((o) => o.content),
          correctAnswer:
            q.type === "SA"
              ? opts
                  .filter((o) => o.isCorrect)
                  .map((o) => o.content)
                  .join(" | ")
              : null,
        }
      })
      const incoming: ParsedKnowledgePoint[] = parseResult.chapters.flatMap((c) =>
        c.lessons.flatMap((l) => l.knowledgePoints),
      )
      const incomingLessonQuestions: ParsedQuestion[] = parseResult.chapters.flatMap((c) =>
        c.lessons.flatMap((l) => l.questions),
      )
      const plan = computeAppendPlan(
        existingKps.map((k) => ({ id: k.id, content: k.content })),
        existingRefs,
        incoming,
        incomingLessonQuestions,
      )
      // Thứ tự câu hỏi là bộ đếm toàn bài (như đường tạo mới) — câu
      // cộng thêm nối tiếp sau câu cuối hiện có.
      let qOrder = existingQs.length
      let kpOrder = existingKps.length
      for (const action of plan.actions) {
        let kpId = action.targetKpId
        if (!kpId) {
          const prepared = prepareKpTermsForSave(action.source.content, action.source.underlinedTerms)
          const [kpRow] = await tx
            .insert(knowledgePoints)
            .values({
              lessonId: targetId,
              content: prepared.content,
              bodyHtml: action.source.bodyHtml ?? null,
              underlinedTerms: prepared.terms,
              order: kpOrder++,
            })
            .returning({ id: knowledgePoints.id })
          kpId = kpRow.id
        }
        for (const pQ of action.addQuestions) {
          await insertParsedQuestion(tx, targetId, kpId, pQ, qOrder++)
        }
      }
      // §25: câu hỏi cấp bài học nạp thêm — lưu với KP null, nối tiếp
      // thứ tự sau câu trong KP (cùng bộ đếm toàn bài).
      for (const pQ of plan.lessonQuestions.addQuestions) {
        await insertParsedQuestion(tx, targetId, null, pQ, qOrder++)
      }
      await tx
        .update(lessons)
        .set({ originalFileKey: filename, updatedAt: new Date() })
        .where(eq(lessons.id, targetId))
      result.lessonIds = [targetId]
      result.createdKps = plan.addedKps
      result.createdQuestions = plan.addedQuestions
      result.appended = {
        addedKps: plan.addedKps,
        addedQuestions: plan.addedQuestions,
        skippedQuestions: plan.skippedQuestions,
      }
      result.duplicateWarnings = plan.warnings
      return
    }

    // ---- Tạo bài mới (thư viện / tại lớp / ép chương đích) ----
    const draftIdx = new Set(options.draftLessonIndexes ?? [])
    let flatIdx = 0

    // Chuẩn hoá thành các nhóm bài theo chương đích.
    const groups: { chapterId: string | null; lessons: typeof parseResult.chapters[number]["lessons"] }[] = []
    if (options.classId || options.targetChapterId) {
      groups.push({
        chapterId: options.classId ? null : (options.targetChapterId as string),
        lessons: parseResult.chapters.flatMap((c) => c.lessons),
      })
    } else {
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
        groups.push({ chapterId, lessons: pChapter.lessons })
      }
    }

    for (const group of groups) {
      const existing = await tx
        .select({ title: lessons.title })
        .from(lessons)
        .where(
          group.chapterId
            ? and(eq(lessons.chapterId, group.chapterId), eq(lessons.teacherId, user.id))
            : and(eq(lessons.classId, options.classId as string), eq(lessons.teacherId, user.id)),
        )
      const titles = new Set(existing.map((e) => e.title))
      const [scopeCount] = await tx
        .select({ c: sql<number>`count(*)` })
        .from(lessons)
        .where(
          group.chapterId
            ? eq(lessons.chapterId, group.chapterId)
            : eq(lessons.classId, options.classId as string),
        )
      let nextOrder = Number(scopeCount?.c ?? 0)

      for (const pLesson of group.lessons) {
        const myIdx = flatIdx++
        // §18: tên do GV ghi trong file -> giữ nguyên; tên bỏ trống/AI
        // đặt -> gán tên thay thế (tên file / tên AI đặt).
        // §21: lưu xong là Sẵn sàng luôn — GV đã thấy tên ở bản xem
        // trước rồi mới bấm Lưu nên không còn "nháp chờ duyệt tên" nữa.
        // draftLessonIndexes giờ chỉ còn quyết định tên thay thế, không
        // ép trạng thái. Nạp cộng thêm không đổi trạng thái bài đích
        // (nhánh intoLesson ở trên return trước khi tới đây).
        const titleMissing = pLesson.titleMissing === true || draftIdx.has(myIdx)
        let title = titleMissing ? fallbackLessonTitle(filename) : pLesson.title
        let n = 2
        while (titles.has(title)) {
          title = `${titleMissing ? fallbackLessonTitle(filename) : pLesson.title} (${n})`
          n += 1
        }
        titles.add(title)

        const [lessonRow] = await tx
          .insert(lessons)
          .values({
            title,
            chapterId: group.chapterId,
            classId: options.classId ?? null,
            teacherId: user.id,
            order: nextOrder++,
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
              bodyHtml: pKp.bodyHtml ?? null,
              underlinedTerms: prepared.terms,
              order: kpOrder++,
            })
            .returning({ id: knowledgePoints.id })
          result.createdKps += 1

          for (const pQ of pKp.questions) {
            await insertParsedQuestion(tx, lessonId, kpRow.id, pQ, qOrder++)
            result.createdQuestions += 1
          }
        }
        // §25: câu hỏi cấp bài học của bài mới — lưu với KP null, nối
        // tiếp thứ tự sau câu hỏi trong KP (thứ tự toàn bài).
        for (const pQ of pLesson.questions) {
          await insertParsedQuestion(tx, lessonId, null, pQ, qOrder++)
          result.createdQuestions += 1
        }
      }
    }

    // §18: bài lưu tại lớp -> ghi luôn dòng giao bài cho chính lớp đó
    // để tab Lớp và phía học sinh thấy bài (HS chỉ thấy khi bài ready).
    if (options.classId && result.lessonIds.length > 0) {
      await tx
        .insert(classAssignments)
        .values(
          result.lessonIds.map((lessonId) => ({
            classId: options.classId as string,
            lessonId,
            teacherId: user.id,
          })),
        )
        .onConflictDoNothing({
          target: [classAssignments.classId, classAssignments.lessonId],
        })
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
  options: PersistOptions = {},
): Promise<SaveResult> {
  const { parseResult } = await extractAndParse(buffer, filename)
  return persistParseResult(user, parseResult, filename, options)
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
  opts?: ParseOptions,
): ParseResult {
  const parseResult = parseTextContent(text, opts)
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
  options: PersistOptions = {},
  parseOpts?: ParseOptions,
): Promise<SaveResult> {
  const parseResult = parseWorksheetText(text, images, tables, parseOpts)
  return persistParseResult(user, parseResult, toTxtFilename(filename), options)
}
