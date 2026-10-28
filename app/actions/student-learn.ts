"use server"

import { db, ensureSchema } from "@/lib/db"
import {
  chapters,
  lessons,
  knowledgePoints,
  questions,
  questionOptions,
  studentProgress,
  studentTab1Submissions,
  quizAttempts,
  quizAnswers,
  quizAttemptQuestions,
  spacedRepetition,
  classStudents,
  classes,
  lessonRuns,
  kpRunResults,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import {
  computeOverallStatus,
  gradeSlots,
  seededRng,
  seededShuffle,
  type FillDragStatus,
  type SlotAnswer,
} from "@/lib/grading"
import { gradeMC, gradeSA, gradeTF, resolveFirstTry, scoreLinear } from "@/lib/scoring"
import {
  buildDragChips,
  isFillTransfer,
  pickDistractors,
  renderClientSlots,
  slotRenderMismatch,
  stripDragResults,
  stripFillResults,
  type ClientSlotPart,
  type SlotGradeClient,
} from "@/lib/slot-render"
import { selectQuizQuestions } from "@/lib/quiz-selection"
import { hitRateLimit } from "@/lib/rate-limit"
import type {
  KnowledgePointDto,
  UnderlinedTerm,
  QuizAnswerDetail,
  QuizQuestionSubmitResult,
  QuizResultDto,
  StudyStage,
} from "@/types"

const TAB1_LOCKED_MSG = "Bạn đã nộp bước Tự đánh giá"
// SEC-08: giữ nguyên ngưỡng burst cũ (10 lần / 60 giây / học sinh / KP)
// nhưng bộ đếm chuyển từ Map trong bộ nhớ sang DB (lib/rate-limit.ts)
// để còn đúng khi chạy nhiều instance.
const GRADE_BURST_LIMIT = 10
const GRADE_BURST_WINDOW_MS = 60_000

type Tab2Question = {
  id: string
  knowledgePointId: string
  parts: ClientSlotPart[]
}

type Tab3Chip = { id: string; text: string }

type Tab3Question = {
  id: string
  knowledgePointId: string
  parts: ClientSlotPart[]
  chips: Tab3Chip[]
}

type SlotGradeResult = {
  slotIndex: number
  isCorrect: boolean
  hint?: string
  correctAnswer?: string
}

async function assertGradeBurst(studentId: string, kpId: string) {
  const ok = await hitRateLimit(
    `grade-burst:${studentId}:${kpId}`,
    GRADE_BURST_LIMIT,
    GRADE_BURST_WINDOW_MS,
  )
  if (!ok) throw new Error("Thử chấm chậm lại")
}

function alreadyCorrectResults(terms: UnderlinedTerm[]): SlotGradeResult[] {
  return terms.map((t) => ({ slotIndex: t.slotIndex, isCorrect: true }))
}

// ============ Helpers ============

/** Xác thực HS có quyền học bài này (bài ready + thuộc giáo viên dạy lớp HS). */
async function assertLessonAccess(studentId: string, lessonId: string) {
  const [row] = await db
    .select({ id: lessons.id, teacherId: lessons.teacherId, status: lessons.status })
    .from(lessons)
    .where(eq(lessons.id, lessonId))
    .limit(1)
  if (!row || row.status !== "ready") throw new Error("Bài học không khả dụng")

  const access = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .innerJoin(classes, eq(classes.id, classStudents.classId))
    .where(and(eq(classStudents.studentId, studentId), eq(classes.teacherId, row.teacherId)))
    .limit(1)
  if (access.length === 0) throw new Error("Bạn không có quyền học bài này")
  return row
}

async function getKpIdsOfLesson(lessonId: string): Promise<string[]> {
  const rows = await db
    .select({ id: knowledgePoints.id })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
  return rows.map((r) => r.id)
}

async function requireTab1Submission(studentId: string, lessonId: string) {
  const [row] = await db
    .select({ id: studentTab1Submissions.id })
    .from(studentTab1Submissions)
    .where(
      and(eq(studentTab1Submissions.studentId, studentId), eq(studentTab1Submissions.lessonId, lessonId)),
    )
    .limit(1)
  if (!row) throw new Error("Hãy nộp bước Tự đánh giá trước")
}

function assertSlotAnswers(terms: UnderlinedTerm[], answers: SlotAnswer[] | Record<string, string>) {
  const allowed = new Set(terms.map((t) => Number(t.slotIndex)))
  if (Array.isArray(answers)) {
    for (const item of answers) {
      if (!item || typeof item !== "object" || !("slotIndex" in item)) {
        throw new Error("Ô trả lời không hợp lệ")
      }
      const idx = Number((item as { slotIndex: unknown }).slotIndex)
      if (!Number.isFinite(idx) || !allowed.has(idx)) throw new Error("Ô trả lời không hợp lệ")
      if (String((item as { value?: unknown }).value ?? "").length > 200) {
        throw new Error("Câu trả lời quá dài")
      }
    }
    return
  }
  if (answers && typeof answers === "object") {
    for (const [k, v] of Object.entries(answers)) {
      const idx = Number(k)
      if (!Number.isFinite(idx) || !allowed.has(idx)) throw new Error("Ô trả lời không hợp lệ")
      if (String(v ?? "").length > 200) throw new Error("Câu trả lời quá dài")
    }
  }
}

// ============ Tab 1 — Nội dung + tự đánh giá ============

function knownCountOf(assessments: Record<string, "known" | "unknown">) {
  return Object.values(assessments).filter((v) => v === "known").length
}

async function resolveStudyStage(
  studentId: string,
  lessonId: string,
  submittedAt: Date | null,
  skippedTab2: boolean,
): Promise<StudyStage> {
  if (!submittedAt) return "tab1"
  const attempts = await db
    .select({
      startedAt: quizAttempts.startedAt,
      completedAt: quizAttempts.completedAt,
    })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))

  // Cung mot tieu chi voi getLatestQuizResult: attempt da nop va bat dau sau lan nop Tab 1.
  // Khong so `completedAt > submittedAt` vi completedAt (dong ho app) va submittedAt
  // (dong ho DB) co the lech nhau, gay UI hien "done" nhung stage lai != "done".
  const after = attempts.filter((a) => a.startedAt.getTime() > submittedAt.getTime())
  const completed = after.find((a) => a.completedAt != null)
  if (completed) return "done"
  const inProgress = after.find((a) => a.completedAt == null)
  if (inProgress) return "tab4"

  const kpIds = await getKpIdsOfLesson(lessonId)
  if (kpIds.length === 0) return skippedTab2 ? "tab3" : "tab2"

  const [progressRows, kps] = await Promise.all([
    db
      .select({
        kpId: studentProgress.knowledgePointId,
        sa: studentProgress.selfAssessment,
        fill: studentProgress.fillStatus,
        drag: studentProgress.dragStatus,
      })
      .from(studentProgress)
      .where(
        and(eq(studentProgress.studentId, studentId), inArray(studentProgress.knowledgePointId, kpIds)),
      ),
    db
      .select({ id: knowledgePoints.id, underlinedTerms: knowledgePoints.underlinedTerms })
      .from(knowledgePoints)
      .where(inArray(knowledgePoints.id, kpIds)),
  ])

  const hasTerms = new Set(
    kps
      .filter((k) => ((k.underlinedTerms as UnderlinedTerm[]) ?? []).length > 0)
      .map((k) => k.id),
  )

  if (!skippedTab2) {
    const fillLeft = progressRows.some(
      (r) => r.sa === "known" && r.fill !== "correct" && hasTerms.has(r.kpId),
    )
    if (fillLeft) return "tab2"
  }

  const dragLeft = progressRows.some(
    (r) => r.sa === "unknown" && r.drag !== "correct" && hasTerms.has(r.kpId),
  )
  if (dragLeft) return "tab3"
  return "tab4"
}

export async function getLessonForStudy(lessonId: string): Promise<{
  lesson: { id: string; title: string; chapterTitle: string }
  knowledgePoints: KnowledgePointDto[]
  tab1Locked: boolean
  savedAssessments: Record<string, "known" | "unknown">
  stage: StudyStage
  skippedTab2: boolean
  quizQuestionCount: number
}> {
  const student = await requireRole("student")
  await assertLessonAccess(student.id, lessonId)

  const [lesson] = await db
    .select({ id: lessons.id, title: lessons.title, chapterTitle: chapters.title })
    .from(lessons)
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(eq(lessons.id, lessonId))
    .limit(1)

  const kps = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
    .orderBy(asc(knowledgePoints.order))

  // trạng thái nộp Tab 1
  const [submission] = await db
    .select()
    .from(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        eq(studentTab1Submissions.lessonId, lessonId),
      ),
    )
    .limit(1)

  // các self-assessment đã lưu (event-driven từ tab1/progress)
  const kpIds = kps.map((k) => k.id)
  const savedAssessments: Record<string, "known" | "unknown"> = {}
  if (kpIds.length > 0) {
    const progressRows = await db
      .select({ kpId: studentProgress.knowledgePointId, sa: studentProgress.selfAssessment })
      .from(studentProgress)
      .where(
        and(
          eq(studentProgress.studentId, student.id),
          inArray(studentProgress.knowledgePointId, kpIds),
        ),
      )
    for (const r of progressRows) {
      if (r.sa) savedAssessments[r.kpId] = r.sa
    }
  }

  const skippedTab2 = knownCountOf(savedAssessments) === 0
  const stage = await resolveStudyStage(
    student.id,
    lessonId,
    submission?.submittedAt ?? null,
    skippedTab2,
  )

  const [{ questionCount }] = await db
    .select({ questionCount: sql<number>`count(*)::int` })
    .from(questions)
    .where(and(eq(questions.lessonId, lessonId), inArray(questions.type, ["MC", "TF", "SA"])))

  return {
    lesson: { id: lesson.id, title: lesson.title, chapterTitle: lesson.chapterTitle },
    knowledgePoints: kps.map((k) => ({
      id: k.id,
      lessonId: k.lessonId,
      content: k.content,
      underlinedTerms: (k.underlinedTerms as UnderlinedTerm[]) ?? [],
      order: k.order,
    })),
    tab1Locked: Boolean(submission),
    savedAssessments,
    stage,
    skippedTab2,
    quizQuestionCount: Number(questionCount) || 0,
  }
}

/** [SIM-04] Lưu tự đánh giá NGAY khi HS click Biết/Chưa biết. */
export async function saveTab1Progress(kpId: string, assessment: "known" | "unknown") {
  const student = await requireRole("student")

  const [kp] = await db
    .select({ id: knowledgePoints.id, lessonId: knowledgePoints.lessonId })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.id, kpId))
    .limit(1)
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  await assertLessonAccess(student.id, kp.lessonId)

  const [locked] = await db
    .select({ id: studentTab1Submissions.id })
    .from(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        eq(studentTab1Submissions.lessonId, kp.lessonId),
      ),
    )
    .limit(1)
  if (locked) throw new Error(TAB1_LOCKED_MSG)

  const [existing] = await db
    .select()
    .from(studentProgress)
    .where(
      and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
    )
    .limit(1)

  const overallStatus = computeOverallStatus({
    selfAssessment: assessment,
    fillStatus: existing?.fillStatus ?? null,
    dragStatus: existing?.dragStatus ?? null,
  })

  if (existing) {
    await db
      .update(studentProgress)
      .set({ selfAssessment: assessment, overallStatus, updatedAt: new Date() })
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )
  } else {
    await db.insert(studentProgress).values({
      studentId: student.id,
      knowledgePointId: kpId,
      selfAssessment: assessment,
      overallStatus,
    })
  }
  return { success: true }
}

/** Nộp Tab 1: khoá tab + cập nhật toàn bộ selfAssessment/overallStatus. */
export async function submitTab1(lessonId: string, assessments: Record<string, "known" | "unknown">) {
  const student = await requireRole("student")
  await ensureSchema()
  await assertLessonAccess(student.id, lessonId)

  const lessonKpIds = await getKpIdsOfLesson(lessonId)
  const lessonKpSet = new Set(lessonKpIds)
  const extra = Object.keys(assessments).filter((id) => !lessonKpSet.has(id))
  if (extra.length > 0) throw new Error("Điểm kiến thức không thuộc bài học")
  const invalid = Object.entries(assessments).filter(([, v]) => v !== "known" && v !== "unknown")
  if (invalid.length > 0) throw new Error("Giá trị tự đánh giá không hợp lệ")
  const missing = lessonKpIds.filter((id) => assessments[id] !== "known" && assessments[id] !== "unknown")
  if (missing.length > 0) throw new Error(`Thiếu đánh giá: ${missing.join(", ")}`)

  const kpIds = lessonKpIds
  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(studentTab1Submissions)
      .values({ studentId: student.id, lessonId, assessments, isLocked: true })
      .onConflictDoNothing({
        target: [studentTab1Submissions.studentId, studentTab1Submissions.lessonId],
      })
      .returning({ id: studentTab1Submissions.id })
    if (inserted.length === 0) throw new Error(TAB1_LOCKED_MSG)

    const existingRows =
      kpIds.length === 0
        ? []
        : await tx
            .select()
            .from(studentProgress)
            .where(
              and(
                eq(studentProgress.studentId, student.id),
                inArray(studentProgress.knowledgePointId, kpIds),
              ),
            )
    const byKp = new Map(existingRows.map((r) => [r.knowledgePointId, r]))
    const values = kpIds.map((kpId) => {
      const existing = byKp.get(kpId)
      const sa = assessments[kpId]
      return {
        studentId: student.id,
        knowledgePointId: kpId,
        selfAssessment: sa,
        overallStatus: computeOverallStatus({
          selfAssessment: sa,
          fillStatus: existing?.fillStatus ?? null,
          dragStatus: existing?.dragStatus ?? null,
        }),
      }
    })
    if (values.length > 0) {
      await tx
        .insert(studentProgress)
        .values(values)
        .onConflictDoUpdate({
          target: [studentProgress.studentId, studentProgress.knowledgePointId],
          set: {
            selfAssessment: sql`excluded."selfAssessment"`,
            overallStatus: sql`excluded."overallStatus"`,
            updatedAt: new Date(),
          },
        })
    }

    // §38 (full): mở lượt học mới — đóng mọi lượt active cũ còn sót (phòng hờ),
    // tạo lượt mới + snapshot tự đánh giá cho từng điểm của bài.
    await tx
      .update(lessonRuns)
      .set({ status: "closed", closedAt: new Date() })
      .where(
        and(
          eq(lessonRuns.studentId, student.id),
          eq(lessonRuns.lessonId, lessonId),
          eq(lessonRuns.status, "active"),
        ),
      )
    const prevRuns = await tx
      .select({ runNo: lessonRuns.runNo })
      .from(lessonRuns)
      .where(and(eq(lessonRuns.studentId, student.id), eq(lessonRuns.lessonId, lessonId)))
      .orderBy(desc(lessonRuns.runNo))
      .limit(1)
    const [run] = await tx
      .insert(lessonRuns)
      .values({
        studentId: student.id,
        lessonId,
        runNo: (prevRuns[0]?.runNo ?? 0) + 1,
        status: "active",
        tab1At: new Date(),
      })
      .returning({ id: lessonRuns.id })
    if (run && kpIds.length > 0) {
      await tx.insert(kpRunResults).values(
        kpIds.map((kpId) => ({
          runId: run.id,
          knowledgePointId: kpId,
          selfAssessment: assessments[kpId],
        })),
      )
    }
  })

  const knownCount = Object.values(assessments).filter((v) => v === "known").length
  return { knownCount, total: kpIds.length }
}

/**
 * Mở khoá để HS làm lại toàn bộ bài học từ đầu.
 * Xoá dấu khoá Tab 1 (studentTab1Submissions) để mở lại tab Nội dung.
 * GIỮ LẠI lịch sử quiz_attempts — không xoá attempt đã nộp.
 */
export async function resetLessonProgress(
  lessonId: string,
): Promise<{ success: true } | { success: false; reason: string }> {
  const student = await requireRole("student")
  await ensureSchema()
  await assertLessonAccess(student.id, lessonId)

  const [submission] = await db
    .select({ submittedAt: studentTab1Submissions.submittedAt })
    .from(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        eq(studentTab1Submissions.lessonId, lessonId),
      ),
    )
    .limit(1)
  const kpIds = await getKpIdsOfLesson(lessonId)
  let skippedTab2 = true
  if (kpIds.length > 0) {
    const knownRows = await db
      .select({ sa: studentProgress.selfAssessment })
      .from(studentProgress)
      .where(
        and(
          eq(studentProgress.studentId, student.id),
          inArray(studentProgress.knowledgePointId, kpIds),
        ),
      )
    skippedTab2 = knownRows.every((r) => r.sa !== "known")
  }
  const stage = await resolveStudyStage(
    student.id,
    lessonId,
    submission?.submittedAt ?? null,
    skippedTab2,
  )
  if (stage !== "done") return { success: false, reason: "Hãy hoàn thành bài kiểm tra trước" }

  try {
    // §38 (full): snapshot trạng thái Tab 1/2/3 hiện tại vào lượt đang mở rồi
    // đóng lượt, trước khi xoá dấu nộp + reset tiến độ (quiz_attempts giữ nguyên).
    // Số ô đúng lần đầu đã ghi lúc nộp Tab 2/3 nên ở đây không ghi đè chúng.
    const [activeRun] = await db
      .select({ id: lessonRuns.id })
      .from(lessonRuns)
      .where(
        and(
          eq(lessonRuns.studentId, student.id),
          eq(lessonRuns.lessonId, lessonId),
          eq(lessonRuns.status, "active"),
        ),
      )
      .orderBy(desc(lessonRuns.createdAt))
      .limit(1)
    if (activeRun && kpIds.length > 0) {
      const progRows = await db
        .select()
        .from(studentProgress)
        .where(
          and(eq(studentProgress.studentId, student.id), inArray(studentProgress.knowledgePointId, kpIds)),
        )
      for (const r of progRows) {
        await db
          .insert(kpRunResults)
          .values({
            runId: activeRun.id,
            knowledgePointId: r.knowledgePointId,
            selfAssessment: r.selfAssessment,
            fillAttempts: r.fillAttempts ?? 0,
            fillRevealed: r.fillRevealed ?? false,
            fillStatus: r.fillStatus,
            dragAttempts: r.dragAttempts ?? 0,
            dragRevealed: r.dragRevealed ?? false,
            dragStatus: r.dragStatus,
          })
          .onConflictDoUpdate({
            target: [kpRunResults.runId, kpRunResults.knowledgePointId],
            set: {
              selfAssessment: r.selfAssessment,
              fillAttempts: r.fillAttempts ?? 0,
              fillRevealed: r.fillRevealed ?? false,
              fillStatus: r.fillStatus,
              dragAttempts: r.dragAttempts ?? 0,
              dragRevealed: r.dragRevealed ?? false,
              dragStatus: r.dragStatus,
              updatedAt: new Date(),
            },
          })
      }
      await db
        .update(lessonRuns)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(lessonRuns.id, activeRun.id))
    }

    await db
      .delete(studentTab1Submissions)
      .where(
        and(
          eq(studentTab1Submissions.studentId, student.id),
          eq(studentTab1Submissions.lessonId, lessonId),
        ),
      )

    if (kpIds.length > 0) {
      await db
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
        .where(
          and(eq(studentProgress.studentId, student.id), inArray(studentProgress.knowledgePointId, kpIds)),
        )
    }
  } catch (err) {
    console.error("resetLessonProgress failed:", err)
    return { success: false, reason: "Không thể làm lại. Vui lòng thử lại." }
  }

  revalidatePath(`/student/learn/${lessonId}`)
  return { success: true }
}

// ============ Tab 2 — Điền khuyết ============

/** Câu FILL cho các KP mà HS đã đánh giá "Biết". */
export async function getTab2Questions(lessonId: string): Promise<{
  questions: Tab2Question[]
  empty: boolean
  skipped: boolean
}> {
  const student = await requireRole("student")
  await assertLessonAccess(student.id, lessonId)
  const kpIds = await getKpIdsOfLesson(lessonId)
  if (kpIds.length === 0) return { questions: [], empty: true, skipped: true }

  const knownRows = await db
    .select({
      kpId: studentProgress.knowledgePointId,
      fill: studentProgress.fillStatus,
    })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.studentId, student.id),
        inArray(studentProgress.knowledgePointId, kpIds),
        eq(studentProgress.selfAssessment, "known"),
      ),
    )
  const skipped = knownRows.length === 0
  const knownKpIds = knownRows.filter((r) => r.fill !== "correct").map((r) => r.kpId)
  if (knownKpIds.length === 0) return { questions: [], empty: true, skipped }

  const kps = await db
    .select()
    .from(knowledgePoints)
    .where(inArray(knowledgePoints.id, knownKpIds))
    .orderBy(asc(knowledgePoints.order))

  const built = kps
    .map((kp) => {
      const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []
      return {
        id: `fill-${kp.id}`,
        knowledgePointId: kp.id,
        parts: renderClientSlots(kp.content, terms),
        slotCount: terms.length,
        // BUG-01: số ô dựng được khác số term (offset DB lệch) -> KP hỏng.
        mismatch: slotRenderMismatch(kp.content, terms),
      }
    })
    // Loại KP hỏng khỏi danh sách trả cho học sinh (kèm log) thay vì để
    // học sinh điền đúng mọi ô nhìn thấy mà vẫn bị chấm sai và kẹt.
    .filter((q) => {
      if (q.mismatch) {
        console.error("getTab2Questions: loại KP vì số ô hiển thị khác số term", {
          kpId: q.knowledgePointId,
        })
        return false
      }
      return q.slotCount > 0
    })
    .map(({ slotCount: _slotCount, mismatch: _mismatch, ...q }) => q)

  return { questions: built, empty: built.length === 0, skipped: false }
}

/** Chấm 1 câu điền khuyết + persist fillStatus. */
export async function submitTab2Question(
  kpId: string,
  answers: SlotAnswer[] | Record<string, string>,
) {
  const student = await requireRole("student")
  await ensureSchema()

  const [kp] = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.id, kpId))
    .limit(1)
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  await assertLessonAccess(student.id, kp.lessonId)
  await requireTab1Submission(student.id, kp.lessonId)
  const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []
  assertSlotAnswers(terms, answers)

  return db.transaction(async (tx) => {
    await tx
      .insert(studentProgress)
      .values({
        studentId: student.id,
        knowledgePointId: kpId,
        overallStatus: "not_started",
      })
      .onConflictDoNothing({
        target: [studentProgress.studentId, studentProgress.knowledgePointId],
      })

    const [existing] = await tx
      .select()
      .from(studentProgress)
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )
      .limit(1)
      .for("update")

    const currentFillStatus = existing?.fillStatus ?? null
    const currentDragStatus = existing?.dragStatus ?? null
    const currentSelfAssessment = existing?.selfAssessment ?? null

    if (currentSelfAssessment !== "known") {
      throw new Error("Câu này không thuộc bước Điền khuyết")
    }

    if (currentFillStatus === "correct") {
      return {
        results: alreadyCorrectResults(terms),
        allCorrect: true,
        kpStatus: existing?.overallStatus ?? "mastered",
        transferred: false,
      }
    }

    // §42 (legacy): dữ liệu trước §42 có thể đã sai điền 2 lần mà chưa
    // chuyển (self vẫn known). Lần chạm tiếp theo khóa + chuyển luôn,
    // không chấm thêm (không tăng attempts, không lộ đáp án).
    if (currentFillStatus === "incorrect" && (existing?.fillAttempts ?? 0) >= 2) {
      const legacyOverall = computeOverallStatus({
        selfAssessment: "unknown",
        fillStatus: "incorrect",
        dragStatus: currentDragStatus,
      })
      await tx
        .update(studentProgress)
        .set({
          selfAssessment: "unknown",
          overallStatus: legacyOverall,
          updatedAt: new Date(),
        })
        .where(
          and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
        )
      return { results: [], allCorrect: false, kpStatus: legacyOverall, transferred: true }
    }

    await assertGradeBurst(student.id, kpId)
    const { results, allCorrect } = gradeSlots(terms, answers)

    const newFillStatus: FillDragStatus = allCorrect ? "correct" : "incorrect"
    const attemptsAfter = (existing?.fillAttempts ?? 0) + 1
    // §42: sai lần 2 khóa + chuyển sang kéo. Submission Tab 1 giữ nguyên
    // (thống kê §40 nhận diện điểm chuyển qua submission Biết ∧ progress
    // Chưa biết); Tab 2 từ đây không còn đường lộ đáp án.
    const transferred = isFillTransfer(attemptsAfter, allCorrect)
    const newSelfAssessment = transferred ? "unknown" : currentSelfAssessment
    const overallStatus = computeOverallStatus({
      selfAssessment: newSelfAssessment,
      fillStatus: newFillStatus,
      dragStatus: currentDragStatus,
    })
    const { stripped, revealed } = stripFillResults(results, attemptsAfter, allCorrect)
    // Chuyển rồi thì không gửi gợi ý lẫn đáp án về client nữa.
    const strippedSafe: SlotGradeClient[] = transferred
      ? stripped.map((r) => ({ slotIndex: r.slotIndex, isCorrect: r.isCorrect }))
      : stripped
    const fillRevealed = Boolean(existing?.fillRevealed) || revealed
    const fillFirstTry = resolveFirstTry(existing?.fillFirstTry, newFillStatus)

    await tx
      .update(studentProgress)
      .set({
        selfAssessment: newSelfAssessment,
        fillStatus: newFillStatus,
        fillAttempts: sql`${studentProgress.fillAttempts} + 1`,
        fillRevealed,
        fillFirstTry,
        overallStatus,
        updatedAt: new Date(),
      })
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )

    // §38 (full): ghi lịch sử lượt học — số ô đúng lần đầu chỉ ghi ở lần thử đầu.
    const [fillRun] = await tx
      .select({ id: lessonRuns.id })
      .from(lessonRuns)
      .where(
        and(
          eq(lessonRuns.studentId, student.id),
          eq(lessonRuns.lessonId, kp.lessonId),
          eq(lessonRuns.status, "active"),
        ),
      )
      .orderBy(desc(lessonRuns.createdAt))
      .limit(1)
    let fillRunId = fillRun?.id
    if (!fillRunId) {
      const prev = await tx
        .select({ runNo: lessonRuns.runNo })
        .from(lessonRuns)
        .where(and(eq(lessonRuns.studentId, student.id), eq(lessonRuns.lessonId, kp.lessonId)))
        .orderBy(desc(lessonRuns.runNo))
        .limit(1)
      const [created] = await tx
        .insert(lessonRuns)
        .values({
          studentId: student.id,
          lessonId: kp.lessonId,
          runNo: (prev[0]?.runNo ?? 0) + 1,
          status: "active",
        })
        .returning({ id: lessonRuns.id })
      fillRunId = created?.id
    }
    if (fillRunId) {
      const firstFill =
        attemptsAfter === 1
          ? {
              fillFirstSlots: results.filter((r) => r.isCorrect).length,
              fillFirstTotal: results.length,
            }
          : {}
      await tx
        .insert(kpRunResults)
        .values({
          runId: fillRunId,
          knowledgePointId: kpId,
          selfAssessment: currentSelfAssessment,
          fillAttempts: attemptsAfter,
          fillRevealed,
          fillStatus: newFillStatus,
          ...firstFill,
        })
        .onConflictDoUpdate({
          target: [kpRunResults.runId, kpRunResults.knowledgePointId],
          set: {
            fillAttempts: attemptsAfter,
            fillRevealed,
            fillStatus: newFillStatus,
            ...firstFill,
            updatedAt: new Date(),
          },
        })
    }

    return { results: strippedSafe, allCorrect, kpStatus: overallStatus, transferred }
  })
}

// ============ Tab 3 — Kéo thả ============

/** Câu DRAG cho KP selfAssessment === "unknown" (phương án B). Kèm chip nhiễu. */
export async function getTab3Questions(lessonId: string): Promise<{
  questions: Tab3Question[]
  empty: boolean
  skipped: boolean
}> {
  const student = await requireRole("student")
  await assertLessonAccess(student.id, lessonId)
  const kpIds = await getKpIdsOfLesson(lessonId)
  if (kpIds.length === 0) return { questions: [], empty: true, skipped: true }

  const rows = await db
    .select({
      kpId: studentProgress.knowledgePointId,
      sa: studentProgress.selfAssessment,
      drag: studentProgress.dragStatus,
    })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.studentId, student.id),
        inArray(studentProgress.knowledgePointId, kpIds),
      ),
    )
  const eligible = rows.filter((r) => r.sa === "unknown")
  const targetKpIds = eligible.filter((r) => r.drag !== "correct").map((r) => r.kpId)
  if (targetKpIds.length === 0) return { questions: [], empty: true, skipped: eligible.length === 0 }

  const kps = await db
    .select()
    .from(knowledgePoints)
    .where(inArray(knowledgePoints.id, targetKpIds))
    .orderBy(asc(knowledgePoints.order))

  const allKps = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
  const distractorPool: string[] = []
  for (const k of allKps) {
    for (const t of (k.underlinedTerms as UnderlinedTerm[]) ?? []) distractorPool.push(t.text)
  }

  const built = kps
    .map((kp) => {
      const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []
      const rng = seededRng(`${student.id}:${kp.id}:drag`)
      // §16: ưu tiên từ nhiễu AI đã chọn riêng cho TỪNG cụm của KP này
      // (lấy từ phần trắc nghiệm của tài liệu, gần nghĩa với từ đúng);
      // KP không có (nạp không qua AI) thì giữ cách cũ: mượn 3 từ của
      // các KP khác cùng bài. Lọc trùng với đáp án được chấp nhận của
      // KP bằng chính pickDistractors (acceptedNormsOf) để an toàn.
      const curated = terms.flatMap((t) => t.distractors ?? [])
      const picked =
        curated.length > 0
          ? pickDistractors(curated, terms, rng, curated.length)
          : pickDistractors(distractorPool, terms, rng, 3)
      const chips = buildDragChips(kp.id, terms, picked, rng)
      return {
        id: `drag-${kp.id}`,
        knowledgePointId: kp.id,
        parts: renderClientSlots(kp.content, terms),
        chips,
        slotCount: terms.length,
        // BUG-01: như getTab2Questions — loại KP có offset lệch.
        mismatch: slotRenderMismatch(kp.content, terms),
      }
    })
    .filter((q) => {
      if (q.mismatch) {
        console.error("getTab3Questions: loại KP vì số ô hiển thị khác số term", {
          kpId: q.knowledgePointId,
        })
        return false
      }
      return q.slotCount > 0
    })
    .map(({ slotCount: _slotCount, mismatch: _mismatch, ...q }) => q)

  return { questions: built, empty: built.length === 0, skipped: false }
}

/** Chấm 1 câu kéo thả + persist dragStatus. */
export async function submitTab3Question(
  kpId: string,
  answers: SlotAnswer[] | Record<string, string>,
) {
  const student = await requireRole("student")
  await ensureSchema()

  const [kp] = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.id, kpId))
    .limit(1)
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  await assertLessonAccess(student.id, kp.lessonId)
  await requireTab1Submission(student.id, kp.lessonId)
  const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []
  assertSlotAnswers(terms, answers)

  return db.transaction(async (tx) => {
    await tx
      .insert(studentProgress)
      .values({
        studentId: student.id,
        knowledgePointId: kpId,
        overallStatus: "not_started",
      })
      .onConflictDoNothing({
        target: [studentProgress.studentId, studentProgress.knowledgePointId],
      })

    const [existing] = await tx
      .select()
      .from(studentProgress)
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )
      .limit(1)
      .for("update")

    const currentFillStatus = existing?.fillStatus ?? null
    const currentDragStatus = existing?.dragStatus ?? null
    const currentSelfAssessment = existing?.selfAssessment ?? null

    if (currentSelfAssessment !== "unknown") {
      throw new Error("Câu này không thuộc bước Kéo thả")
    }

    if (currentDragStatus === "correct") {
      return {
        results: alreadyCorrectResults(terms),
        allCorrect: true,
        kpStatus: existing?.overallStatus ?? "mastered",
      }
    }

    await assertGradeBurst(student.id, kpId)
    const { results, allCorrect } = gradeSlots(terms, answers)

    const newDragStatus: FillDragStatus = allCorrect ? "correct" : "incorrect"
    const overallStatus = computeOverallStatus({
      selfAssessment: currentSelfAssessment,
      fillStatus: currentFillStatus,
      dragStatus: newDragStatus,
    })
    const attemptsAfter = (existing?.dragAttempts ?? 0) + 1
    const { stripped, revealed } = stripDragResults(results, attemptsAfter, allCorrect)
    const dragRevealed = Boolean(existing?.dragRevealed) || revealed
    const dragFirstTry = resolveFirstTry(existing?.dragFirstTry, newDragStatus)

    await tx
      .update(studentProgress)
      .set({
        dragStatus: newDragStatus,
        dragAttempts: sql`${studentProgress.dragAttempts} + 1`,
        dragRevealed,
        dragFirstTry,
        overallStatus,
        updatedAt: new Date(),
      })
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )

    // §38 (full): ghi lịch sử lượt học — số ô đúng lần đầu chỉ ghi ở lần thử đầu.
    const [dragRun] = await tx
      .select({ id: lessonRuns.id })
      .from(lessonRuns)
      .where(
        and(
          eq(lessonRuns.studentId, student.id),
          eq(lessonRuns.lessonId, kp.lessonId),
          eq(lessonRuns.status, "active"),
        ),
      )
      .orderBy(desc(lessonRuns.createdAt))
      .limit(1)
    let dragRunId = dragRun?.id
    if (!dragRunId) {
      const prev = await tx
        .select({ runNo: lessonRuns.runNo })
        .from(lessonRuns)
        .where(and(eq(lessonRuns.studentId, student.id), eq(lessonRuns.lessonId, kp.lessonId)))
        .orderBy(desc(lessonRuns.runNo))
        .limit(1)
      const [created] = await tx
        .insert(lessonRuns)
        .values({
          studentId: student.id,
          lessonId: kp.lessonId,
          runNo: (prev[0]?.runNo ?? 0) + 1,
          status: "active",
        })
        .returning({ id: lessonRuns.id })
      dragRunId = created?.id
    }
    if (dragRunId) {
      const firstDrag =
        attemptsAfter === 1
          ? {
              dragFirstSlots: results.filter((r) => r.isCorrect).length,
              dragFirstTotal: results.length,
            }
          : {}
      await tx
        .insert(kpRunResults)
        .values({
          runId: dragRunId,
          knowledgePointId: kpId,
          selfAssessment: currentSelfAssessment,
          dragAttempts: attemptsAfter,
          dragRevealed,
          dragStatus: newDragStatus,
          ...firstDrag,
        })
        .onConflictDoUpdate({
          target: [kpRunResults.runId, kpRunResults.knowledgePointId],
          set: {
            dragAttempts: attemptsAfter,
            dragRevealed,
            dragStatus: newDragStatus,
            ...firstDrag,
            updatedAt: new Date(),
          },
        })
    }

    return { results: stripped, allCorrect, kpStatus: overallStatus }
  })
}

// ============ Tab 4 — Kiểm tra tổng hợp ============

type QuizQuestionForClient = {
  id: string
  type: "MC" | "TF" | "SA"
  content: string
  bodyHtml?: string | null
  knowledgePointId: string | null
  options: { id: string; content: string; bodyHtml?: string | null }[] // MC/TF (không lộ isCorrect)
}

function hideQuizOptions(
  opts: { id: string; content: string; bodyHtml?: string | null }[],
): { id: string; content: string; bodyHtml?: string | null }[] {
  return opts.map((o) => ({ id: o.id, content: o.content, bodyHtml: o.bodyHtml ?? null }))
}

export async function startQuiz(lessonId: string): Promise<{
  quizId: string
  questions: QuizQuestionForClient[]
  totalSlots: number
  pointPerSlot: number
}> {
  const student = await requireRole("student")
  await ensureSchema()
  await assertLessonAccess(student.id, lessonId)

  const [submission] = await db
    .select({ submittedAt: studentTab1Submissions.submittedAt })
    .from(studentTab1Submissions)
    .where(
      and(eq(studentTab1Submissions.studentId, student.id), eq(studentTab1Submissions.lessonId, lessonId)),
    )
    .limit(1)

  const openWhere = submission
    ? and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is null`,
        sql`${quizAttempts.startedAt} > ${submission.submittedAt}`,
      )
    : and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is null`,
      )

  const [openAttempt] = await db
    .select()
    .from(quizAttempts)
    .where(openWhere)
    .orderBy(sql`${quizAttempts.startedAt} desc`)
    .limit(1)

  if (openAttempt) {
    const paper = await db
      .select()
      .from(quizAttemptQuestions)
      .where(eq(quizAttemptQuestions.attemptId, openAttempt.id))
      .orderBy(asc(quizAttemptQuestions.position))
    const paperIds = paper.map((p) => p.questionId)
    const liveQs =
      paperIds.length > 0
        ? await db
            .select()
            .from(questions)
            .where(inArray(questions.id, paperIds))
        : []
    const liveById = new Map(liveQs.map((q) => [q.id, q]))
    const liveOpts =
      paperIds.length > 0
        ? await db
            .select()
            .from(questionOptions)
            .where(inArray(questionOptions.questionId, paperIds))
        : []
    const optsByQ = new Map<string, typeof liveOpts>()
    for (const o of liveOpts) {
      const list = optsByQ.get(o.questionId) ?? []
      list.push(o)
      optsByQ.set(o.questionId, list)
    }

    const clientQuestions: QuizQuestionForClient[] = paper.map((row) => {
      const live = liveById.get(row.questionId)
      const snap = row.snapshot
      const type = (snap?.type ?? live?.type ?? "MC") as "MC" | "TF" | "SA"
      const order = row.optionOrder ?? []
      const snapOpts = snap?.options ?? []
      const liveList = optsByQ.get(row.questionId) ?? []
      const byId = new Map(
        (snapOpts.length > 0 ? snapOpts : liveList).map((o) => [o.id, o]),
      )
      const ordered =
        order.length > 0
          ? order.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => Boolean(o))
          : [...byId.values()]
      return {
        id: row.questionId,
        type,
        // BUG-11: ưu tiên stem trong snapshot (đề lúc tạo) — trước đây lấy
        // stem từ DB hiện tại còn options từ snapshot nên GV sửa/xóa câu
        // giữa chừng làm đề hiển thị lệch hoặc rỗng.
        content: snap?.stem ?? live?.content ?? "",
        bodyHtml: snap?.bodyHtml ?? live?.bodyHtml ?? null,
        knowledgePointId: live?.knowledgePointId ?? null,
        options: type === "SA" ? [] : hideQuizOptions(ordered),
      }
    })
    const totalSlots = openAttempt.totalSlots ?? 1
    const pointPerSlot = totalSlots > 0 ? 10 / totalSlots : 0
    return { quizId: openAttempt.id, questions: clientQuestions, totalSlots, pointPerSlot }
  }

  const qRows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.lessonId, lessonId), inArray(questions.type, ["MC", "TF", "SA"])))
  if (qRows.length === 0) throw new Error("Bài học chưa có câu hỏi")

  const kps = await db
    .select({ id: knowledgePoints.id, order: knowledgePoints.order })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
    .orderBy(asc(knowledgePoints.order))

  const optRows = await db
    .select()
    .from(questionOptions)
    .where(
      inArray(
        questionOptions.questionId,
        qRows.map((q) => q.id),
      ),
    )
    .orderBy(asc(questionOptions.order))

  const [{ c: doneCount }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is not null`,
      ),
    )
  const attemptNumber = Number(doneCount) + 1
  const rng = seededRng(`${student.id}:${lessonId}:${attemptNumber}`)

  const selected = selectQuizQuestions(
    qRows,
    kps,
    (q) => q.knowledgePointId != null,
    rng,
  )
  const byId = new Map(qRows.map((q) => [q.id, q]))
  const chosen = selected.chosen.map((id) => byId.get(id)).filter((q): q is (typeof qRows)[number] => Boolean(q))

  let totalSlots = 0
  const clientQuestions: QuizQuestionForClient[] = chosen.map((q) => {
    const opts = optRows.filter((o) => o.questionId === q.id)
    if (q.type === "MC") {
      totalSlots += 1
      return {
        id: q.id,
        type: "MC",
        content: q.content,
        bodyHtml: q.bodyHtml ?? null,
        knowledgePointId: q.knowledgePointId,
        options: seededShuffle(opts, rng).map((o) => ({ id: o.id, content: o.content, bodyHtml: o.bodyHtml ?? null })),
      }
    }
    if (q.type === "TF") {
      totalSlots += opts.length
      return {
        id: q.id,
        type: "TF",
        content: q.content,
        bodyHtml: q.bodyHtml ?? null,
        knowledgePointId: q.knowledgePointId,
        options: opts.map((o) => ({ id: o.id, content: o.content, bodyHtml: o.bodyHtml ?? null })),
      }
    }
    totalSlots += 1
    return {
      id: q.id,
      type: "SA",
      content: q.content,
      bodyHtml: q.bodyHtml ?? null,
      knowledgePointId: q.knowledgePointId,
      options: [],
    }
  })

  const pointPerSlot = totalSlots > 0 ? 10 / totalSlots : 0

  const [attempt] = await db
    .insert(quizAttempts)
    .values({ studentId: student.id, lessonId, totalSlots, maxScore: 10 })
    .returning({ id: quizAttempts.id })

  if (chosen.length > 0) {
    await db.insert(quizAttemptQuestions).values(
      chosen.map((q, position) => {
        const opts = optRows.filter((o) => o.questionId === q.id)
        const clientOpts = clientQuestions[position]?.options ?? []
        return {
          attemptId: attempt.id,
          questionId: q.id,
          position,
          optionOrder: clientOpts.map((o) => o.id),
          snapshot: {
            type: q.type,
            // BUG-11: lưu cả nội dung câu hỏi vào snapshot để mở lại bài
            // làm dở hiển thị đúng đề lúc tạo, kể cả khi GV sửa/xóa câu.
            stem: q.content,
            bodyHtml: q.bodyHtml ?? null,
            options: opts.map((o) => ({ id: o.id, content: o.content, isCorrect: o.isCorrect })),
          },
        }
      }),
    )
  }

  return { quizId: attempt.id, questions: clientQuestions, totalSlots, pointPerSlot }
}

/**
 * Nộp bài Tab 4: chấm theo slot, lưu quiz_answers, seed spaced_repetition.
 * answers: MC/SA → string; TF → Record<optionId, 'D'|'S'>
 */
// --- §16: Tab 4 chấm TỪNG CÂU -------------------------------------------
// Học sinh nộp ("khóa") từng câu bằng nút "Nộp câu hỏi": chấm ngay câu
// đó, ghi quiz_answers ngay, và KHÔNG sửa được nữa (kể cả sau khi xem
// hướng dẫn giải). submitQuiz cuối buổi chỉ chấm nốt các câu chưa nộp
// và hoàn tất lượt làm. Hai helper dưới đây là bản sao trung thực của
// logic chấm trong submitQuiz (kể cả ghi chú BUG-10) để hai đường chấm
// không bao giờ lệch nhau.

type QuizPaperSnapshot = {
  type?: string
  stem?: string
  bodyHtml?: string | null
  options?: { id: string; content: string; bodyHtml?: string | null; isCorrect: boolean }[]
} | null

type StoredAnswerRow = {
  optionId: string | null
  studentAnswer: string | null
  isCorrect: boolean | null
}

function gradeOneFromSnapshot(
  questionId: string,
  snap: QuizPaperSnapshot,
  raw: string | Record<string, "D" | "S"> | undefined,
  solution: string | null,
  solutionBodyHtml: string | null,
): {
  rows: { questionId: string; optionId: string | null; studentAnswer: string | null; isCorrect: boolean }[]
  detail: QuizAnswerDetail
  correctCount: number
  tfChoices?: Record<string, "D" | "S">
} {
  const type = snap?.type ?? "MC"
  const opts = snap?.options ?? []
  if (type === "MC") {
    const chosenId = typeof raw === "string" ? raw : null
    const validChosen = chosenId && opts.some((o) => o.id === chosenId) ? chosenId : null
    const correctOpt = opts.find((o) => o.isCorrect)
    const isCorrect = gradeMC(validChosen, correctOpt?.id ?? "")
    return {
      rows: [{ questionId, optionId: null, studentAnswer: validChosen, isCorrect }],
      detail: {
        questionId,
        questionType: "MC",
        studentAnswer: opts.find((o) => o.id === validChosen)?.content ?? "",
        isCorrect,
        correctAnswer: correctOpt?.content ?? "",
        solution,
        solutionBodyHtml,
      },
      correctCount: isCorrect ? 1 : 0,
    }
  }
  if (type === "SA") {
    const val = typeof raw === "string" ? raw : ""
    // BUG-10: chấm bằng đáp án ĐẦY ĐỦ; chỉ cắt 200 ký tự khi LƯU.
    const truncated = val.length > 200 ? val.slice(0, 200) : val
    const accepted = opts.filter((o) => o.isCorrect).map((o) => o.content)
    const isCorrect = val.length > 0 ? gradeSA(val, accepted) : false
    return {
      rows: [
        {
          questionId,
          optionId: null,
          studentAnswer: truncated.length > 0 ? truncated : null,
          isCorrect,
        },
      ],
      detail: {
        questionId,
        questionType: "SA",
        studentAnswer: truncated,
        isCorrect,
        correctAnswer: accepted[0] ?? "",
        solution,
        solutionBodyHtml,
      },
      correctCount: isCorrect ? 1 : 0,
    }
  }
  const map = (typeof raw === "object" && raw != null ? raw : {}) as Record<
    string,
    "D" | "S" | null | undefined
  >
  const graded = gradeTF(map, opts)
  const rows: { questionId: string; optionId: string | null; studentAnswer: string | null; isCorrect: boolean }[] = []
  const perYy: { content: string; value: string; isCorrect: boolean; correct: boolean }[] = []
  const tfChoices: Record<string, "D" | "S"> = {}
  let correctCount = 0
  for (const p of graded.perOption) {
    const opt = opts.find((o) => o.id === p.optionId)
    if (p.isCorrect) correctCount += 1
    const studentValue = p.answered ? (map[p.optionId] as string) : null
    rows.push({ questionId, optionId: p.optionId, studentAnswer: studentValue, isCorrect: p.isCorrect })
    perYy.push({
      content: opt?.content ?? "",
      value: studentValue ?? "",
      isCorrect: p.isCorrect,
      correct: Boolean(opt?.isCorrect),
    })
    if (studentValue === "D" || studentValue === "S") tfChoices[p.optionId] = studentValue
  }
  return {
    rows,
    detail: {
      questionId,
      questionType: "TF",
      studentAnswer: JSON.stringify(perYy),
      isCorrect: perYy.length > 0 && perYy.every((p) => p.isCorrect),
      correctAnswer: "",
      solution,
      solutionBodyHtml,
    },
    correctCount,
    tfChoices,
  }
}

/** Dựng lại kết quả của một câu ĐÃ nộp từ các dòng quiz_answers đã lưu. */
function detailFromStored(
  questionId: string,
  snap: QuizPaperSnapshot,
  rows: StoredAnswerRow[],
  solution: string | null,
  solutionBodyHtml: string | null,
): { detail: QuizAnswerDetail; correctCount: number; tfChoices?: Record<string, "D" | "S"> } {
  const type = snap?.type ?? "MC"
  const opts = snap?.options ?? []
  if (type === "TF") {
    const perYy: { content: string; value: string; isCorrect: boolean; correct: boolean }[] = []
    const tfChoices: Record<string, "D" | "S"> = {}
    let correctCount = 0
    for (const opt of opts) {
      const stored = rows.find((r) => r.optionId === opt.id)
      const value = stored?.studentAnswer ?? ""
      const isCorrect = stored?.isCorrect ?? false
      if (isCorrect) correctCount += 1
      perYy.push({ content: opt.content, value, isCorrect, correct: Boolean(opt.isCorrect) })
      if (value === "D" || value === "S") tfChoices[opt.id] = value
    }
    return {
      detail: {
        questionId,
        questionType: "TF",
        studentAnswer: JSON.stringify(perYy),
        isCorrect: perYy.length > 0 && perYy.every((p) => p.isCorrect),
        correctAnswer: "",
        solution,
        solutionBodyHtml,
      },
      correctCount,
      tfChoices,
    }
  }
  const row = rows[0]
  const isCorrect = row?.isCorrect ?? false
  if (type === "SA") {
    const accepted = opts.filter((o) => o.isCorrect).map((o) => o.content)
    return {
      detail: {
        questionId,
        questionType: "SA",
        studentAnswer: row?.studentAnswer ?? "",
        isCorrect,
        correctAnswer: accepted[0] ?? "",
        solution,
        solutionBodyHtml,
      },
      correctCount: isCorrect ? 1 : 0,
    }
  }
  const chosenId = row?.studentAnswer ?? null
  const correctOpt = opts.find((o) => o.isCorrect)
  return {
    detail: {
      questionId,
      questionType: "MC",
      studentAnswer: opts.find((o) => o.id === chosenId)?.content ?? "",
      isCorrect,
      correctAnswer: correctOpt?.content ?? "",
      solution,
      solutionBodyHtml,
    },
    correctCount: isCorrect ? 1 : 0,
  }
}

export async function submitQuiz(
  quizId: string,
  answers: Record<string, string | Record<string, "D" | "S">>,
): Promise<QuizResultDto> {
  const student = await requireRole("student")
  await ensureSchema()

  return db.transaction(async (tx) => {
    const [openAttempt] = await tx
      .select({
        id: quizAttempts.id,
        totalSlots: quizAttempts.totalSlots,
        completedAt: quizAttempts.completedAt,
      })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, quizId), eq(quizAttempts.studentId, student.id)))
      .limit(1)
      .for("update")
    if (!openAttempt) throw new Error("Không tìm thấy bài kiểm tra")
    if (openAttempt.completedAt) throw new Error("Bài kiểm tra đã nộp")

    const paper = await tx
      .select()
      .from(quizAttemptQuestions)
      .where(eq(quizAttemptQuestions.attemptId, quizId))
      .orderBy(asc(quizAttemptQuestions.position))

    const totalSlots = openAttempt.totalSlots ?? 1
    let correctSlots = 0
    const answerRows: {
      attemptId: string
      questionId: string
      optionId: string | null
      studentAnswer: string | null
      isCorrect: boolean
    }[] = []
    const details: QuizResultDto["details"] = []
    const qRowsForSr: { knowledgePointId: string | null }[] = []

    const paperIds = paper.map((p) => p.questionId)
    const liveQs =
      paperIds.length > 0
        ? await tx
            .select({
              id: questions.id,
              knowledgePointId: questions.knowledgePointId,
              solution: questions.solution,
              solutionBodyHtml: questions.solutionBodyHtml,
            })
            .from(questions)
            .where(inArray(questions.id, paperIds))
        : []
    const kpByQ = new Map(liveQs.map((q) => [q.id, q.knowledgePointId]))
    // §15.3: lời giải chỉ xuất hiện trong kết quả SAU khi nộp bài.
    const solByQ = new Map(liveQs.map((q) => [q.id, q.solution]))
    const solBodyByQ = new Map(liveQs.map((q) => [q.id, q.solutionBodyHtml]))

    // §16: các câu học sinh ĐÃ nộp riêng lẻ (nút "Nộp câu hỏi") đã có
    // dòng trong quiz_answers — dựng lại kết quả từ đó, KHÔNG chấm lại
    // và KHÔNG ghi trùng (tránh lỗi unique của quiz_answers).
    const storedRows = await tx
      .select()
      .from(quizAnswers)
      .where(eq(quizAnswers.attemptId, quizId))
    const storedByQ = new Map<string, typeof storedRows>()
    for (const r of storedRows) {
      const list = storedByQ.get(r.questionId) ?? []
      list.push(r)
      storedByQ.set(r.questionId, list)
    }

    for (const row of paper) {
      const snap = row.snapshot
      const type = snap?.type ?? "MC"
      const opts = snap?.options ?? []
      qRowsForSr.push({ knowledgePointId: kpByQ.get(row.questionId) ?? null })

      const stored = storedByQ.get(row.questionId)
      if (stored && stored.length > 0) {
        const { detail, correctCount } = detailFromStored(
          row.questionId,
          snap as QuizPaperSnapshot,
          stored,
          solByQ.get(row.questionId) ?? null,
          solBodyByQ.get(row.questionId) ?? null,
        )
        correctSlots += correctCount
        details.push(detail)
        continue
      }

      if (type === "MC") {
        const raw = answers[row.questionId]
        const chosenId = typeof raw === "string" ? raw : null
        const validChosen =
          chosenId && opts.some((o) => o.id === chosenId) ? chosenId : null
        const correctOpt = opts.find((o) => o.isCorrect)
        const isCorrect = gradeMC(validChosen, correctOpt?.id ?? "")
        if (isCorrect) correctSlots += 1
        answerRows.push({
          attemptId: quizId,
          questionId: row.questionId,
          optionId: null,
          studentAnswer: validChosen,
          isCorrect,
        })
        details.push({
          questionId: row.questionId,
          questionType: "MC",
          studentAnswer: opts.find((o) => o.id === validChosen)?.content ?? "",
          isCorrect,
          correctAnswer: correctOpt?.content ?? "",
          solution: solByQ.get(row.questionId) ?? null,
          solutionBodyHtml: solBodyByQ.get(row.questionId) ?? null,
        })
      } else if (type === "SA") {
        const raw = answers[row.questionId]
        const val = typeof raw === "string" ? raw : ""
        // BUG-10: chấm bằng đáp án ĐẦY ĐỦ; chỉ cắt 200 ký tự khi LƯU
        // studentAnswer (trước đây cắt trước khi chấm nên đáp án đúng dài
        // hơn 200 ký tự không bao giờ đúng).
        const truncated = val.length > 200 ? val.slice(0, 200) : val
        const accepted = opts.filter((o) => o.isCorrect).map((o) => o.content)
        const isCorrect = val.length > 0 ? gradeSA(val, accepted) : false
        if (isCorrect) correctSlots += 1
        answerRows.push({
          attemptId: quizId,
          questionId: row.questionId,
          optionId: null,
          studentAnswer: truncated.length > 0 ? truncated : null,
          isCorrect,
        })
        details.push({
          questionId: row.questionId,
          questionType: "SA",
          studentAnswer: truncated,
          isCorrect,
          correctAnswer: accepted[0] ?? "",
          solution: solByQ.get(row.questionId) ?? null,
          solutionBodyHtml: solBodyByQ.get(row.questionId) ?? null,
        })
      } else if (type === "TF") {
        const map = (typeof answers[row.questionId] === "object" && answers[row.questionId] != null
          ? (answers[row.questionId] as Record<string, "D" | "S" | null | undefined>)
          : {}) as Record<string, "D" | "S" | null | undefined>
        const graded = gradeTF(map, opts)
        const perYy: { content: string; value: string; isCorrect: boolean; correct: boolean }[] = []
        for (const p of graded.perOption) {
          const opt = opts.find((o) => o.id === p.optionId)
          if (p.isCorrect) correctSlots += 1
          const studentValue = p.answered ? (map[p.optionId] as string) : null
          answerRows.push({
            attemptId: quizId,
            questionId: row.questionId,
            optionId: p.optionId,
            studentAnswer: studentValue,
            isCorrect: p.isCorrect,
          })
          perYy.push({
            content: opt?.content ?? "",
            value: studentValue ?? "",
            isCorrect: p.isCorrect,
            correct: Boolean(opt?.isCorrect),
          })
        }
        details.push({
          questionId: row.questionId,
          questionType: "TF",
          studentAnswer: JSON.stringify(perYy),
          isCorrect: perYy.length > 0 && perYy.every((p) => p.isCorrect),
          correctAnswer: "",
          solution: solByQ.get(row.questionId) ?? null,
          solutionBodyHtml: solBodyByQ.get(row.questionId) ?? null,
        })
      }
    }

    correctSlots = Math.min(correctSlots, totalSlots)
    const { score, percentage } = scoreLinear(correctSlots, totalSlots)

    const claimed = await tx
      .update(quizAttempts)
      .set({ score, completedAt: sql`now()` })
      .where(
        and(
          eq(quizAttempts.id, quizId),
          eq(quizAttempts.studentId, student.id),
          sql`${quizAttempts.completedAt} is null`,
        ),
      )
      .returning({ id: quizAttempts.id })
    if (claimed.length === 0) throw new Error("Bài kiểm tra đã nộp")

    if (answerRows.length > 0) {
      // §38 (full): thời điểm nộp từng câu — cờ "làm quá nhanh từng câu".
      await tx.insert(quizAnswers).values(answerRows.map((r) => ({ ...r, answeredAt: new Date() })))
    }

    const kpIds = [...new Set(qRowsForSr.map((q) => q.knowledgePointId).filter((id): id is string => Boolean(id)))]
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    if (kpIds.length > 0) {
      await tx
        .insert(spacedRepetition)
        .values(
          kpIds.map((kpId) => ({
            studentId: student.id,
            knowledgePointId: kpId,
            interval: 1,
            easinessFactor: 2.5,
            repetitions: 0,
            nextReview: tomorrow,
          })),
        )
        .onConflictDoNothing({
          target: [spacedRepetition.studentId, spacedRepetition.knowledgePointId],
        })
    }

    return {
      attemptId: quizId,
      score,
      maxScore: 10,
      totalSlots,
      percentage,
      details,
    }
  })
}

/** §16: nộp (khóa) MỘT câu của Tab 4 — chấm ngay, ghi quiz_answers
 * ngay, từ đó không sửa được nữa. Nộp lại cùng câu (double-click, hai
 * thiết bị...) trả kết quả đã lưu, không ghi trùng: khóa dòng attempt
 * FOR UPDATE + kiểm tra dòng đã có trong cùng một transaction. */
export async function submitQuizQuestion(
  quizId: string,
  questionId: string,
  answer: string | Record<string, "D" | "S">,
): Promise<QuizQuestionSubmitResult> {
  const student = await requireRole("student")
  await ensureSchema()

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select({ id: quizAttempts.id, completedAt: quizAttempts.completedAt })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.id, quizId), eq(quizAttempts.studentId, student.id)))
      .limit(1)
      .for("update")
    if (!attempt) throw new Error("Không tìm thấy bài kiểm tra")
    if (attempt.completedAt) throw new Error("Bài kiểm tra đã nộp xong")

    const [paperRow] = await tx
      .select()
      .from(quizAttemptQuestions)
      .where(
        and(eq(quizAttemptQuestions.attemptId, quizId), eq(quizAttemptQuestions.questionId, questionId)),
      )
      .limit(1)
    if (!paperRow) throw new Error("Câu hỏi không thuộc bài kiểm tra này")

    const [liveQ] = await tx
      .select({ solution: questions.solution, solutionBodyHtml: questions.solutionBodyHtml })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1)
    const solution = liveQ?.solution ?? null
    const solutionBodyHtml = liveQ?.solutionBodyHtml ?? null
    const snap = paperRow.snapshot as QuizPaperSnapshot

    const existing = await tx
      .select()
      .from(quizAnswers)
      .where(and(eq(quizAnswers.attemptId, quizId), eq(quizAnswers.questionId, questionId)))
    if (existing.length > 0) {
      const { detail, tfChoices } = detailFromStored(questionId, snap, existing, solution, solutionBodyHtml)
      return { ...detail, tfChoices }
    }

    const { rows, detail, tfChoices } = gradeOneFromSnapshot(questionId, snap, answer, solution, solutionBodyHtml)
    if (rows.length > 0) {
      // §38 (full): thời điểm nộp từng câu — cờ "làm quá nhanh từng câu".
      await tx.insert(quizAnswers).values(rows.map((r) => ({ attemptId: quizId, answeredAt: new Date(), ...r })))
    }
    return { ...detail, tfChoices }
  })
}

/** §16: trạng thái các câu ĐÃ nộp của lượt làm đang mở — để khôi phục
 * khi học sinh mở lại bài (kể cả trên thiết bị khác): câu đã nộp hiện
 * khóa kèm đúng/sai và hướng dẫn giải. */
export async function getOpenQuizState(lessonId: string): Promise<{
  quizId: string
  submitted: QuizQuestionSubmitResult[]
} | null> {
  const student = await requireRole("student")
  await ensureSchema()
  await assertLessonAccess(student.id, lessonId)

  const [submission] = await db
    .select({ submittedAt: studentTab1Submissions.submittedAt })
    .from(studentTab1Submissions)
    .where(
      and(eq(studentTab1Submissions.studentId, student.id), eq(studentTab1Submissions.lessonId, lessonId)),
    )
    .limit(1)

  const openWhere = submission
    ? and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is null`,
        sql`${quizAttempts.startedAt} > ${submission.submittedAt}`,
      )
    : and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is null`,
      )

  const [openAttempt] = await db
    .select()
    .from(quizAttempts)
    .where(openWhere)
    .orderBy(sql`${quizAttempts.startedAt} desc`)
    .limit(1)
  if (!openAttempt) return null

  const stored = await db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, openAttempt.id))
  if (stored.length === 0) return { quizId: openAttempt.id, submitted: [] }

  const paper = await db
    .select()
    .from(quizAttemptQuestions)
    .where(eq(quizAttemptQuestions.attemptId, openAttempt.id))
    .orderBy(asc(quizAttemptQuestions.position))
  const paperIds = paper.map((p) => p.questionId)
  const liveQs =
    paperIds.length > 0
      ? await db
          .select({ id: questions.id, solution: questions.solution, solutionBodyHtml: questions.solutionBodyHtml })
          .from(questions)
          .where(inArray(questions.id, paperIds))
      : []
  const solByQ = new Map(liveQs.map((q) => [q.id, q.solution]))
  const solBodyByQ = new Map(liveQs.map((q) => [q.id, q.solutionBodyHtml]))
  const storedByQ = new Map<string, typeof stored>()
  for (const r of stored) {
    const list = storedByQ.get(r.questionId) ?? []
    list.push(r)
    storedByQ.set(r.questionId, list)
  }

  const submitted: QuizQuestionSubmitResult[] = []
  for (const row of paper) {
    const rows = storedByQ.get(row.questionId)
    if (!rows || rows.length === 0) continue
    const { detail, tfChoices } = detailFromStored(
      row.questionId,
      row.snapshot as QuizPaperSnapshot,
      rows,
      solByQ.get(row.questionId) ?? null,
      solBodyByQ.get(row.questionId) ?? null,
    )
    submitted.push({ ...detail, tfChoices })
  }
  return { quizId: openAttempt.id, submitted }
}

/** Lấy kết quả quiz gần nhất (để re-fetch khi HS quay lại Tab 4). */
export async function getLatestQuizResult(lessonId: string): Promise<QuizResultDto | null> {
  const student = await requireRole("student")
  const [submission] = await db
    .select({ submittedAt: studentTab1Submissions.submittedAt })
    .from(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        eq(studentTab1Submissions.lessonId, lessonId),
      ),
    )
    .limit(1)
  if (!submission) return null

  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is not null`,
        sql`${quizAttempts.startedAt} > ${submission.submittedAt}`,
      ),
    )
    .orderBy(sql`${quizAttempts.completedAt} desc`)
    .limit(1)
  if (!attempt) return null

  const ansRows = await db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attempt.id))

  const correctSlots = Math.min(
    ansRows.filter((a) => a.isCorrect).length,
    (attempt.totalSlots ?? ansRows.length) || 1,
  )
  const totalSlots = (attempt.totalSlots ?? ansRows.length) || 1
  const { percentage } = scoreLinear(correctSlots, totalSlots)

  return {
    attemptId: attempt.id,
    score: attempt.score ?? 0,
    maxScore: 10,
    totalSlots,
    percentage,
    details: [],
  }
}
