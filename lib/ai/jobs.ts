// AI-MCP (§15): vòng đời "việc AI" — một tài liệu GV nạp bằng chế độ AI.
//
// App giữ toàn bộ trạng thái; worker (Muse) chỉ nhận việc, xử lý và
// nộp kết quả qua các hàm này (cổng MCP là lớp vận chuyển mỏng ở trên).
// Đa luồng: nhiều worker nhận các việc khác nhau song song; nhận việc là
// một UPDATE nguyên tử theo (id, status='pending').

import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { db, ensureSchema } from "@/lib/db"
import { aiJobs, aiTeacherAssignments, aiUsageLogs, knowledgePoints, lessons } from "@/lib/db/schema"
import type { UnderlinedTerm } from "@/types"
import { extractAndParse } from "@/lib/extract-file"
import {
  attachBodyHtml,
  attachOptionBodyHtml,
  parseTextContent,
  validateDocument,
} from "@/lib/worksheet-parser"
import { renderAiResult } from "./render"
import { verifyAiResult } from "./verify"
import type { AiResult, AiResultMeta } from "./types"
import type { SessionUser } from "@/lib/auth-helpers"

export const MAX_REPAIR_ROUNDS = 3

export async function logAi(entry: {
  teacherId?: string | null
  jobId?: string | null
  workerId?: string | null
  action: string
  detail?: unknown
}): Promise<void> {
  try {
    await db.insert(aiUsageLogs).values({
      teacherId: entry.teacherId ?? null,
      jobId: entry.jobId ?? null,
      workerId: entry.workerId ?? null,
      action: entry.action,
      detail: entry.detail ?? null,
    })
  } catch {
    // Log là phụ trợ — không bao giờ làm hỏng luồng chính.
  }
}

export async function createAiJob(
  user: SessionUser,
  buffer: Buffer,
  filename: string,
): Promise<{ jobId: string }> {
  await ensureSchema()
  const { sourceText, images, tables } = await extractAndParse(buffer, filename)
  const [row] = await db
    .insert(aiJobs)
    .values({
      teacherId: user.id,
      filename,
      sourceText,
      images: images.length > 0 ? images : null,
      tables: tables.length > 0 ? tables : null,
      status: "pending",
    })
    .returning({ id: aiJobs.id })
  await logAi({ teacherId: user.id, jobId: row.id, action: "job_created", detail: { filename } })
  return { jobId: row.id }
}

export async function getAiJobForTeacher(teacherId: string, jobId: string) {
  await ensureSchema()
  const [job] = await db
    .select()
    .from(aiJobs)
    .where(and(eq(aiJobs.id, jobId), eq(aiJobs.teacherId, teacherId)))
    .limit(1)
  return job ?? null
}

/**
 * §17: danh sách việc AI gần đây của GV cho trang nạp bài — để GV mở
 * lại bản xem trước của việc đã xử lý xong nhưng chưa lưu (đóng tab
 * không còn làm mất kết quả). Chỉ lấy cột nhẹ, không kèm sourceText/
 * resultText; bản dựng đầy đủ lấy qua getAiJobForTeacher khi mở lại.
 */
export async function listAiJobsForTeacher(teacherId: string, limit = 15) {
  await ensureSchema()
  return db
    .select({
      id: aiJobs.id,
      filename: aiJobs.filename,
      status: aiJobs.status,
      progress: aiJobs.progress,
      stage: aiJobs.stage,
      error: aiJobs.error,
      consumedAt: aiJobs.consumedAt,
      createdAt: aiJobs.createdAt,
    })
    .from(aiJobs)
    .where(eq(aiJobs.teacherId, teacherId))
    .orderBy(desc(aiJobs.createdAt))
    .limit(limit)
}

/**
 * §17: đánh dấu GV đã xong việc với một job — đã lưu bản xem trước
 * vào hệ thống, hoặc chủ động ẩn job khỏi danh sách chờ. Idempotent:
 * gọi lại trên job đã đánh dấu vẫn trả true.
 */
export async function markAiJobConsumed(teacherId: string, jobId: string): Promise<boolean> {
  const job = await getAiJobForTeacher(teacherId, jobId)
  if (!job) return false
  if (!job.consumedAt) {
    await db
      .update(aiJobs)
      .set({ consumedAt: new Date(), updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId))
    await logAi({ teacherId, jobId, action: "job_consumed" })
  }
  return true
}

/** GV trả lời popup "có muốn AI giải chi tiết không". */
export async function answerSolutionChoice(
  teacherId: string,
  jobId: string,
  wantSolutions: boolean,
): Promise<boolean> {
  const job = await getAiJobForTeacher(teacherId, jobId)
  if (!job || job.status !== "needs_solution_choice") return false
  await db
    .update(aiJobs)
    .set({ wantSolutions, status: "pending", workerId: null, updatedAt: new Date() })
    .where(eq(aiJobs.id, jobId))
  await logAi({ teacherId, jobId, action: "solution_choice", detail: { wantSolutions } })
  return true
}

// --- Phía worker -----------------------------------------------------------

/** Việc đang chờ: tôn trọng bảng phân công GV -> worker (farm) nếu có. */
export async function listPendingJobs(workerId: string, limit = 20) {
  await ensureSchema()
  const rows = await db
    .select({
      id: aiJobs.id,
      teacherId: aiJobs.teacherId,
      filename: aiJobs.filename,
      createdAt: aiJobs.createdAt,
      assignedWorker: aiTeacherAssignments.workerId,
    })
    .from(aiJobs)
    .leftJoin(aiTeacherAssignments, eq(aiTeacherAssignments.teacherId, aiJobs.teacherId))
    .where(eq(aiJobs.status, "pending"))
    .orderBy(asc(aiJobs.createdAt))
    .limit(100)
  return rows
    .filter((r) => r.assignedWorker == null || r.assignedWorker === workerId)
    .slice(0, limit)
    .map((r) => ({ id: r.id, teacherId: r.teacherId, filename: r.filename, createdAt: r.createdAt }))
}

/** Nhận việc nguyên tử. Việc đã rõ hasSolutions+wantSolutions thì vào
 * thẳng 'processing'; chưa rõ thì 'detecting' để worker quét trước. */
export async function claimJob(jobId: string, workerId: string) {
  await ensureSchema()
  const [existing] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1)
  if (!existing || existing.status !== "pending") return null
  const detectionDone = existing.hasSolutions !== null && existing.wantSolutions !== null
  const nextStatus = detectionDone || existing.hasSolutions === true ? "processing" : "detecting"
  const updated = await db
    .update(aiJobs)
    .set({ status: nextStatus, workerId, updatedAt: new Date() })
    .where(and(eq(aiJobs.id, jobId), eq(aiJobs.status, "pending")))
    .returning({ id: aiJobs.id })
  if (updated.length === 0) return null
  await logAi({ teacherId: existing.teacherId, jobId, workerId, action: "job_claimed" })
  const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1)
  return job ?? null
}

async function loadClaimedJob(jobId: string, workerId: string) {
  const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1)
  if (!job) return null
  if (job.workerId !== workerId) return null
  return job
}

/** Worker báo kết quả quét: tài liệu có sẵn phần giải chi tiết không. */
export async function reportDetection(jobId: string, workerId: string, hasSolutions: boolean) {
  const job = await loadClaimedJob(jobId, workerId)
  if (!job || job.status !== "detecting") return { ok: false as const, error: "Việc không ở trạng thái detecting" }
  if (hasSolutions) {
    await db
      .update(aiJobs)
      .set({ hasSolutions: true, status: "processing", stage: "Đang xử lý tài liệu", updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId))
  } else if (job.wantSolutions === null) {
    // Chưa biết ý GV -> nhả việc về chờ câu trả lời ở popup.
    await db
      .update(aiJobs)
      .set({ hasSolutions: false, status: "needs_solution_choice", updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId))
  } else {
    await db
      .update(aiJobs)
      .set({ hasSolutions: false, status: "processing", stage: "Đang xử lý tài liệu", updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId))
  }
  await logAi({ teacherId: job.teacherId, jobId, workerId, action: "detection", detail: { hasSolutions } })
  return { ok: true as const }
}

export async function setJobProgress(jobId: string, workerId: string, progress: number, stage?: string) {
  const job = await loadClaimedJob(jobId, workerId)
  if (!job) return { ok: false as const }
  const clamped = Math.max(0, Math.min(100, Math.round(progress)))
  await db
    .update(aiJobs)
    .set({ progress: clamped, stage: stage ?? job.stage, updatedAt: new Date() })
    .where(eq(aiJobs.id, jobId))
  return { ok: true as const }
}

export async function failJob(jobId: string, workerId: string, reason: string) {
  const job = await loadClaimedJob(jobId, workerId)
  if (!job) return { ok: false as const }
  await db
    .update(aiJobs)
    .set({ status: "failed", error: reason, updatedAt: new Date() })
    .where(eq(aiJobs.id, jobId))
  await logAi({ teacherId: job.teacherId, jobId, workerId, action: "job_failed", detail: { reason } })
  return { ok: true as const }
}

export interface SubmitOutcome {
  ok: boolean
  failed?: boolean
  repairErrors?: string[]
  repairRound?: number
}

/** Worker nộp JSON cấu trúc: app dựng form -> parse -> validate -> đối
 * chiếu giữ nguyên. Sai ở đâu trả lỗi về đó (vòng sửa tối đa
 * MAX_REPAIR_ROUNDS); đạt thì việc sang 'ready' kèm bản dựng. */
export async function submitJobResult(
  jobId: string,
  workerId: string,
  result: AiResult,
): Promise<SubmitOutcome> {
  const job = await loadClaimedJob(jobId, workerId)
  if (!job || job.status !== "processing") {
    return { ok: false, failed: true, repairErrors: ["Việc không ở trạng thái processing"] }
  }

  const problems: string[] = []
  const rendered = renderAiResult(result)
  if (!rendered.text) problems.push(...rendered.problems)

  let resultText = rendered.text ?? ""
  let parsed = resultText ? parseTextContent(resultText) : null
  if (parsed) {
    const images = (job.images as string[] | null) ?? []
    const tables = (job.tables as string[] | null) ?? []
    if (images.length > 0 || tables.length > 0) {
      attachBodyHtml(parsed, images, tables)
      attachOptionBodyHtml(parsed, images, tables)
    }
    const validation = validateDocument(parsed)
    for (const e of validation.errors) problems.push(`Dòng ${e.line ?? "?"}: ${e.message}`)
    problems.push(...verifyAiResult(job.sourceText, result, parsed))
  }

  if (problems.length > 0) {
    const round = job.repairRound + 1
    if (round > MAX_REPAIR_ROUNDS) {
      await db
        .update(aiJobs)
        .set({
          status: "failed",
          repairRound: round,
          lastErrors: problems,
          error: `Bản AI vẫn còn ${problems.length} vấn đề sau ${MAX_REPAIR_ROUNDS} vòng sửa`,
          updatedAt: new Date(),
        })
        .where(eq(aiJobs.id, jobId))
      await logAi({ teacherId: job.teacherId, jobId, workerId, action: "job_failed_repairs", detail: { problems } })
      return { ok: false, failed: true, repairErrors: problems, repairRound: round }
    }
    await db
      .update(aiJobs)
      .set({ repairRound: round, lastErrors: problems, updatedAt: new Date() })
      .where(eq(aiJobs.id, jobId))
    await logAi({ teacherId: job.teacherId, jobId, workerId, action: "repair_requested", detail: { round, problems } })
    return { ok: false, repairErrors: problems, repairRound: round }
  }

  // Đạt: tính siêu dữ liệu cho bản xem trước (dòng KP AI sinh, dòng câu
  // AI điền đáp án) theo thứ tự xuất hiện song song giữa JSON và parse.
  const meta: AiResultMeta = {
    generatedKpLines: [],
    filledAnswerLines: [],
    unmatchedSolutions: result.unmatchedSolutions ?? [],
    workerId,
    repairRounds: job.repairRound,
  }
  if (parsed) {
    const parsedKps: { line: number; questions: { line: number }[] }[] = []
    for (const c of parsed.chapters)
      for (const l of c.lessons) for (const kp of l.knowledgePoints) parsedKps.push(kp)
    const jsonKps = result.chapters.flatMap((c) =>
      c.lessons.flatMap((l) => l.knowledgePoints.map((kp) => kp)),
    )
    jsonKps.forEach((jkp, i) => {
      if (jkp.generatedByAi && parsedKps[i]) meta.generatedKpLines.push(parsedKps[i].line)
    })
    const flatLines: number[] = []
    // §25: thứ tự phẳng hoá = thứ tự dựng (câu trong KP theo từng KP,
    // rồi câu cấp bài học cuối bài) — khớp filledAnswers đánh số toàn
    // cục và khớp thứ tự persist tạo bài.
    for (const c of parsed.chapters)
      for (const l of c.lessons) {
        for (const kp of l.knowledgePoints) for (const q of kp.questions) flatLines.push(q.line)
        for (const q of l.questions ?? []) flatLines.push(q.line)
      }
    for (const idx of result.filledAnswers ?? []) {
      const line = flatLines[idx - 1]
      if (line != null) meta.filledAnswerLines.push(line)
    }
  }
  // §18: bài nào có tên do AI đặt -> ghi chỉ số phẳng vào meta để
  // importer ép trạng thái nháp khi lưu (GV duyệt tên rồi mới sẵn sàng).
  {
    const draftIdx: number[] = []
    let li = 0
    for (const c of result.chapters)
      for (const l of c.lessons) {
        if (l.titleGeneratedByAi) draftIdx.push(li)
        li++
      }
    if (draftIdx.length > 0) meta.draftLessonIndexes = draftIdx
  }
  // §16: bản đồ từ nhiễu theo vị trí bài/KP (thứ tự phẳng hoá giống
  // thứ tự persistParseResult tạo bài) để gắn vào KP sau khi GV lưu.
  meta.distractors = []
  {
    let lessonIdx = 0
    for (const c of result.chapters)
      for (const l of c.lessons) {
        l.knowledgePoints.forEach((kp, kpIdx) => {
          for (const u of kp.underlines) {
            if (u.distractors && u.distractors.length > 0) {
              meta.distractors!.push({
                lessonIdx,
                kpIdx,
                term: u.text,
                distractors: u.distractors,
              })
            }
          }
        })
        lessonIdx++
      }
  }

  await db
    .update(aiJobs)
    .set({
      status: "ready",
      progress: 100,
      stage: "Hoàn thành",
      resultText,
      resultMeta: meta,
      lastErrors: null,
      updatedAt: new Date(),
    })
    .where(eq(aiJobs.id, jobId))
  await logAi({ teacherId: job.teacherId, jobId, workerId, action: "job_ready", detail: { repairRounds: job.repairRound } })
  return { ok: true }
}

export async function getJobForWorker(jobId: string) {
  await ensureSchema()
  const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1)
  return job ?? null
}

/** §16: gắn từ nhiễu kéo thả của một job AI vào các KP của những bài
 * VỪA được lưu từ kết quả của job đó. Gọi từ client ngay sau khi lưu
 * thành công (giống chuỗi assignLessons): bài được tạo theo đúng thứ
 * tự phẳng hoá trong meta.distractors; KP khớp theo thứ tự trong bài,
 * cụm khớp theo text nguyên văn — GV đã sửa chữ trong bản xem trước
 * thì mục không khớp bị bỏ qua lặng lẽ. */
export async function applyDistractorsToLessons(
  jobId: string,
  teacherId: string,
  lessonIds: string[],
): Promise<{ updatedTerms: number }> {
  await ensureSchema()
  const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId)).limit(1)
  if (!job || job.teacherId !== teacherId) throw new Error("Không tìm thấy việc AI")
  const meta = (job.resultMeta ?? null) as AiResultMeta | null
  const entries = meta?.distractors ?? []
  if (entries.length === 0 || lessonIds.length === 0) return { updatedTerms: 0 }

  const owned = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(inArray(lessons.id, lessonIds), eq(lessons.teacherId, teacherId)))
  const ownedIds = new Set(owned.map((l) => l.id))

  let updatedTerms = 0
  const normText = (s: string) => s.normalize("NFC").trim()
  for (const entry of entries) {
    const lessonId = lessonIds[entry.lessonIdx]
    if (!lessonId || !ownedIds.has(lessonId)) continue
    const kps = await db
      .select()
      .from(knowledgePoints)
      .where(eq(knowledgePoints.lessonId, lessonId))
      .orderBy(asc(knowledgePoints.order))
    const kp = kps[entry.kpIdx]
    if (!kp) continue
    const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []
    const wanted = normText(entry.term)
    const idx = terms.findIndex(
      (t) => normText(t.text) === wanted && (!t.distractors || t.distractors.length === 0),
    )
    if (idx < 0) continue
    const clean: string[] = []
    const seen = new Set<string>()
    for (const d of entry.distractors) {
      const nd = normText(d)
      if (!nd || seen.has(nd.toLowerCase()) || nd === terms[idx].text) continue
      seen.add(nd.toLowerCase())
      clean.push(nd)
    }
    if (clean.length === 0) continue
    const next = terms.map((t, i) => (i === idx ? { ...t, distractors: clean } : t))
    await db
      .update(knowledgePoints)
      .set({ underlinedTerms: next })
      .where(eq(knowledgePoints.id, kp.id))
    updatedTerms += 1
  }
  if (updatedTerms > 0) {
    await logAi({
      teacherId,
      jobId,
      action: "distractors_applied",
      detail: { updatedTerms, lessonIds },
    })
  }
  return { updatedTerms }
}
