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
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { revalidatePath } from "next/cache"
import { and, asc, eq, inArray, sql } from "drizzle-orm"
import {
  computeOverallStatus,
  gradeSlots,
  seededRng,
  seededShuffle,
  type FillDragStatus,
  type SlotAnswer,
} from "@/lib/grading"
import { gradeMC, gradeSA, gradeTF, scoreLinear } from "@/lib/scoring"
import { selectQuizQuestions } from "@/lib/quiz-selection"
import type { KnowledgePointDto, QuestionDto, UnderlinedTerm, QuizResultDto } from "@/types"

export type StudyStage = "tab1" | "tab2" | "tab3" | "tab4" | "done"

const TAB1_LOCKED_MSG = "Bạn đã nộp bước Tự đánh giá"

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

  const after = attempts.filter((a) => a.startedAt.getTime() > submittedAt.getTime())
  const completed = after.find(
    (a) => a.completedAt != null && a.completedAt.getTime() > submittedAt.getTime(),
  )
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
    (r) =>
      (r.sa === "unknown" || r.fill === "incorrect") && r.drag !== "correct" && hasTerms.has(r.kpId),
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
  await assertLessonAccess(student.id, lessonId)

  const [existingSub] = await db
    .select({ id: studentTab1Submissions.id })
    .from(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        eq(studentTab1Submissions.lessonId, lessonId),
      ),
    )
    .limit(1)
  if (existingSub) throw new Error(TAB1_LOCKED_MSG)

  const kpIds = Object.keys(assessments)
  for (const kpId of kpIds) {
    const [existing] = await db
      .select()
      .from(studentProgress)
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )
      .limit(1)
    const sa = assessments[kpId]
    const overallStatus = computeOverallStatus({
      selfAssessment: sa,
      fillStatus: existing?.fillStatus ?? null,
      dragStatus: existing?.dragStatus ?? null,
    })
    if (existing) {
      await db
        .update(studentProgress)
        .set({ selfAssessment: sa, overallStatus, updatedAt: new Date() })
        .where(
          and(
            eq(studentProgress.studentId, student.id),
            eq(studentProgress.knowledgePointId, kpId),
          ),
        )
    } else {
      await db.insert(studentProgress).values({
        studentId: student.id,
        knowledgePointId: kpId,
        selfAssessment: sa,
        overallStatus,
      })
    }
  }

  // lưu submission (lock)
  await db
    .insert(studentTab1Submissions)
    .values({ studentId: student.id, lessonId, assessments, isLocked: true })

  const knownCount = Object.values(assessments).filter((v) => v === "known").length
  return { knownCount, total: kpIds.length }
}

/**
 * Mở khoá để HS làm lại toàn bộ bài học từ đầu.
 * Xoá dấu khoá Tab 1 (studentTab1Submissions) để mở lại tab Nội dung.
 * GIỮ LẠI lịch sử điểm (quizAttempts) để thống kê tiến bộ — mỗi lần làm vẫn được lưu.
 */
export async function resetLessonProgress(lessonId: string): Promise<{ success: true }> {
  const student = await requireRole("student")
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
  if (stage !== "done") throw new Error("Hãy hoàn thành bài kiểm tra trước")

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
        overallStatus: "not_started",
        updatedAt: new Date(),
      })
      .where(
        and(eq(studentProgress.studentId, student.id), inArray(studentProgress.knowledgePointId, kpIds)),
      )
  }

  revalidatePath(`/student/learn/${lessonId}`)
  return { success: true }
}

// ============ Tab 2 — Điền khuyết ============

/** Câu FILL cho các KP mà HS đã đánh giá "Biết". */
export async function getTab2Questions(lessonId: string): Promise<{
  questions: (QuestionDto & { knowledgePointId: string; terms: UnderlinedTerm[] })[]
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
        lessonId,
        knowledgePointId: kp.id,
        type: "FILL" as const,
        content: kp.content,
        terms,
      }
    })
    .filter((q) => q.terms.length > 0)

  return { questions: built, empty: built.length === 0, skipped: false }
}

/** Chấm 1 câu điền khuyết + persist fillStatus. */
export async function submitTab2Question(
  kpId: string,
  answers: SlotAnswer[] | Record<string, string>,
) {
  const student = await requireRole("student")

  const [kp] = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.id, kpId))
    .limit(1)
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []

  const { results, allCorrect } = gradeSlots(terms, answers)

  const [existing] = await db
    .select()
    .from(studentProgress)
    .where(
      and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
    )
    .limit(1)
  const currentFillStatus = existing?.fillStatus ?? null
  const currentDragStatus = existing?.dragStatus ?? null
  const currentSelfAssessment = existing?.selfAssessment ?? null

  const newFillStatus: FillDragStatus = allCorrect
    ? "correct"
    : currentFillStatus === "correct"
      ? "correct"
      : "incorrect"

  const overallStatus = computeOverallStatus({
    selfAssessment: currentSelfAssessment,
    fillStatus: newFillStatus,
    dragStatus: currentDragStatus,
  })

  if (existing) {
    await db
      .update(studentProgress)
      .set({
        fillStatus: newFillStatus,
        fillAttempts: sql`${studentProgress.fillAttempts} + 1`,
        overallStatus,
        updatedAt: new Date(),
      })
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )
  } else {
    await db.insert(studentProgress).values({
      studentId: student.id,
      knowledgePointId: kpId,
      fillStatus: newFillStatus,
      fillAttempts: 1,
      overallStatus,
    })
  }

  return { results, allCorrect, kpStatus: overallStatus }
}

// ============ Tab 3 — Kéo thả ============

/** Câu DRAG cho KP: "Chưa biết" HOẶC "Biết nhưng fill sai". Kèm chip nhiễu. */
export async function getTab3Questions(lessonId: string): Promise<{
  questions: {
    id: string
    knowledgePointId: string
    content: string
    terms: UnderlinedTerm[]
    chips: string[]
  }[]
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
      fill: studentProgress.fillStatus,
      drag: studentProgress.dragStatus,
    })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.studentId, student.id),
        inArray(studentProgress.knowledgePointId, kpIds),
      ),
    )
  const eligible = rows.filter((r) => r.sa === "unknown" || r.fill === "incorrect")
  const targetKpIds = eligible.filter((r) => r.drag !== "correct").map((r) => r.kpId)
  if (targetKpIds.length === 0) return { questions: [], empty: true, skipped: eligible.length === 0 }

  const kps = await db
    .select()
    .from(knowledgePoints)
    .where(inArray(knowledgePoints.id, targetKpIds))
    .orderBy(asc(knowledgePoints.order))

  // pool từ nhiễu: các term của KP khác trong cùng bài
  const allKps = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, lessonId))
  const distractorPool = new Set<string>()
  for (const k of allKps) {
    for (const t of (k.underlinedTerms as UnderlinedTerm[]) ?? []) distractorPool.add(t.text)
  }

  const built = kps
    .map((kp) => {
      const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []
      const correctTexts = new Set(terms.map((t) => t.text))
      const distractors = [...distractorPool].filter((d) => !correctTexts.has(d))
      const rng = seededRng(`${student.id}:${kp.id}:drag`)
      const picked = seededShuffle(distractors, rng).slice(0, 3)
      const chips = seededShuffle([...terms.map((t) => t.text), ...picked], rng)
      return { id: `drag-${kp.id}`, knowledgePointId: kp.id, content: kp.content, terms, chips }
    })
    .filter((q) => q.terms.length > 0)

  return { questions: built, empty: built.length === 0, skipped: false }
}

/** Chấm 1 câu kéo thả + persist dragStatus. */
export async function submitTab3Question(
  kpId: string,
  answers: SlotAnswer[] | Record<string, string>,
) {
  const student = await requireRole("student")

  const [kp] = await db
    .select()
    .from(knowledgePoints)
    .where(eq(knowledgePoints.id, kpId))
    .limit(1)
  if (!kp) throw new Error("Không tìm thấy điểm kiến thức")
  const terms = (kp.underlinedTerms as UnderlinedTerm[]) ?? []

  const { results, allCorrect } = gradeSlots(terms, answers)

  const [existing] = await db
    .select()
    .from(studentProgress)
    .where(
      and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
    )
    .limit(1)
  const currentFillStatus = existing?.fillStatus ?? null
  const currentDragStatus = existing?.dragStatus ?? null
  const currentSelfAssessment = existing?.selfAssessment ?? null

  const newDragStatus: FillDragStatus = allCorrect
    ? "correct"
    : currentDragStatus === "correct"
      ? "correct"
      : "incorrect"

  const overallStatus = computeOverallStatus({
    selfAssessment: currentSelfAssessment,
    fillStatus: currentFillStatus,
    dragStatus: newDragStatus,
  })

  if (existing) {
    await db
      .update(studentProgress)
      .set({
        dragStatus: newDragStatus,
        dragAttempts: sql`${studentProgress.dragAttempts} + 1`,
        overallStatus,
        updatedAt: new Date(),
      })
      .where(
        and(eq(studentProgress.studentId, student.id), eq(studentProgress.knowledgePointId, kpId)),
      )
  } else {
    await db.insert(studentProgress).values({
      studentId: student.id,
      knowledgePointId: kpId,
      dragStatus: newDragStatus,
      dragAttempts: 1,
      overallStatus,
    })
  }

  return { results, allCorrect, kpStatus: overallStatus }
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

export async function startQuiz(lessonId: string): Promise<{
  quizId: string
  questions: QuizQuestionForClient[]
  totalSlots: number
  pointPerSlot: number
}> {
  const student = await requireRole("student")
  await ensureSchema()
  await assertLessonAccess(student.id, lessonId)

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

  // attemptNumber cho seed
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

  // tính totalSlots: MC=1, SA=1, TF=số ý
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
    // SA
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
export async function submitQuiz(
  quizId: string,
  answers: Record<string, string | Record<string, "D" | "S">>,
): Promise<QuizResultDto> {
  const student = await requireRole("student")
  await ensureSchema()

  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, quizId), eq(quizAttempts.studentId, student.id)))
    .limit(1)
  if (!attempt) throw new Error("Không tìm thấy bài kiểm tra")
  if (attempt.completedAt) throw new Error("Bài kiểm tra đã nộp")

  const paper = await db
    .select()
    .from(quizAttemptQuestions)
    .where(eq(quizAttemptQuestions.attemptId, quizId))
    .orderBy(asc(quizAttemptQuestions.position))

  const totalSlots = attempt.totalSlots ?? 1
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
      ? await db
          .select({ id: questions.id, knowledgePointId: questions.knowledgePointId })
          .from(questions)
          .where(inArray(questions.id, paperIds))
      : []
  const kpByQ = new Map(liveQs.map((q) => [q.id, q.knowledgePointId]))

  for (const row of paper) {
    const snap = row.snapshot
    const type = snap?.type ?? "MC"
    const opts = snap?.options ?? []
    qRowsForSr.push({ knowledgePointId: kpByQ.get(row.questionId) ?? null })

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
      })
    } else if (type === "SA") {
      const raw = answers[row.questionId]
      const val = typeof raw === "string" ? raw : ""
      const truncated = val.length > 200 ? val.slice(0, 200) : val
      const accepted = opts.filter((o) => o.isCorrect).map((o) => o.content)
      const isCorrect = truncated.length > 0 ? gradeSA(truncated, accepted) : false
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
      })
    }
  }

  correctSlots = Math.min(correctSlots, totalSlots)
  const { score, percentage } = scoreLinear(correctSlots, totalSlots)

  // 1) update attempt
  await db
    .update(quizAttempts)
    .set({ score, completedAt: new Date() })
    .where(eq(quizAttempts.id, quizId))

  // 2) insert quiz_answers
  if (answerRows.length > 0) {
    await db.insert(quizAnswers).values(answerRows)
  }

  // 3) seed spaced_repetition cho các KP trong bài
  const kpIds = [...new Set(qRowsForSr.map((q) => q.knowledgePointId).filter((id): id is string => Boolean(id)))]
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  for (const kpId of kpIds) {
    const [sr] = await db
      .select({ id: spacedRepetition.id })
      .from(spacedRepetition)
      .where(
        and(
          eq(spacedRepetition.studentId, student.id),
          eq(spacedRepetition.knowledgePointId, kpId),
        ),
      )
      .limit(1)
    if (!sr) {
      await db.insert(spacedRepetition).values({
        studentId: student.id,
        knowledgePointId: kpId,
        interval: 1,
        easinessFactor: 2.5,
        repetitions: 0,
        nextReview: tomorrow,
      })
    }
  }

  return {
    attemptId: quizId,
    score,
    maxScore: 10,
    totalSlots,
    percentage,
    details,
  }
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
