"use server"

import { db } from "@/lib/db"
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
  normalizeAnswer,
  seededRng,
  seededShuffle,
  type FillDragStatus,
} from "@/lib/grading"
import type { KnowledgePointDto, QuestionDto, UnderlinedTerm, QuizResultDto } from "@/types"

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

export async function getLessonForStudy(lessonId: string): Promise<{
  lesson: { id: string; title: string; chapterTitle: string }
  knowledgePoints: KnowledgePointDto[]
  tab1Locked: boolean
  savedAssessments: Record<string, "known" | "unknown">
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

  return {
    lesson: { id: lesson.id, title: lesson.title, chapterTitle: lesson.chapterTitle },
    knowledgePoints: kps.map((k) => ({
      id: k.id,
      lessonId: k.lessonId,
      content: k.content,
      underlinedTerms: (k.underlinedTerms as UnderlinedTerm[]) ?? [],
      order: k.order,
    })),
    tab1Locked: Boolean(submission?.isLocked),
    savedAssessments,
  }
}

/** [SIM-04] Lưu tự đánh giá NGAY khi HS click Biết/Chưa biết. */
export async function saveTab1Progress(kpId: string, assessment: "known" | "unknown") {
  const student = await requireRole("student")

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

  await db
    .delete(studentTab1Submissions)
    .where(
      and(
        eq(studentTab1Submissions.studentId, student.id),
        eq(studentTab1Submissions.lessonId, lessonId),
      ),
    )

  revalidatePath(`/student/learn/${lessonId}`)
  return { success: true }
}

// ============ Tab 2 — Điền khuyết ============

/** Câu FILL cho các KP mà HS đã đánh giá "Biết". */
export async function getTab2Questions(lessonId: string): Promise<{
  questions: (QuestionDto & { knowledgePointId: string; terms: UnderlinedTerm[] })[]
  empty: boolean
}> {
  const student = await requireRole("student")
  await assertLessonAccess(student.id, lessonId)
  const kpIds = await getKpIdsOfLesson(lessonId)
  if (kpIds.length === 0) return { questions: [], empty: true }

  const knownRows = await db
    .select({ kpId: studentProgress.knowledgePointId })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.studentId, student.id),
        inArray(studentProgress.knowledgePointId, kpIds),
        eq(studentProgress.selfAssessment, "known"),
      ),
    )
  const knownKpIds = knownRows.map((r) => r.kpId)
  if (knownKpIds.length === 0) return { questions: [], empty: true }

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
        type: "FILL" as const,
        content: kp.content,
        terms,
      }
    })
    .filter((q) => q.terms.length > 0)

  return { questions: built, empty: built.length === 0 }
}

/** Chấm 1 câu điền khuyết + persist fillStatus. */
export async function submitTab2Question(
  kpId: string,
  answers: Record<number, string>,
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
}> {
  const student = await requireRole("student")
  await assertLessonAccess(student.id, lessonId)
  const kpIds = await getKpIdsOfLesson(lessonId)
  if (kpIds.length === 0) return { questions: [], empty: true }

  const rows = await db
    .select({
      kpId: studentProgress.knowledgePointId,
      sa: studentProgress.selfAssessment,
      fill: studentProgress.fillStatus,
    })
    .from(studentProgress)
    .where(
      and(
        eq(studentProgress.studentId, student.id),
        inArray(studentProgress.knowledgePointId, kpIds),
      ),
    )
  const targetKpIds = rows
    .filter((r) => r.sa === "unknown" || r.fill === "incorrect")
    .map((r) => r.kpId)
  if (targetKpIds.length === 0) return { questions: [], empty: true }

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

  return { questions: built, empty: built.length === 0 }
}

/** Chấm 1 câu kéo thả + persist dragStatus. */
export async function submitTab3Question(kpId: string, answers: Record<number, string>) {
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
  knowledgePointId: string
  options: { id: string; content: string }[] // MC/TF (không lộ isCorrect)
}

export async function startQuiz(lessonId: string): Promise<{
  quizId: string
  questions: QuizQuestionForClient[]
  totalSlots: number
  pointPerSlot: number
}> {
  const student = await requireRole("student")
  await assertLessonAccess(student.id, lessonId)

  const kpIds = await getKpIdsOfLesson(lessonId)
  if (kpIds.length === 0) throw new Error("Bài học chưa có câu hỏi")

  const qRows = await db
    .select()
    .from(questions)
    .where(inArray(questions.knowledgePointId, kpIds))
  if (qRows.length === 0) throw new Error("Bài học chưa có câu hỏi")

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

  // phân nhóm & giới hạn (scale nếu thiếu): MC≤18, TF≤4, SA≤6
  const byType = (t: string) => qRows.filter((q) => q.type === t)
  const mc = seededShuffle(byType("MC"), rng).slice(0, 18)
  const tf = seededShuffle(byType("TF"), rng).slice(0, 4)
  const sa = seededShuffle(byType("SA"), rng).slice(0, 6)
  const chosen = seededShuffle([...mc, ...tf, ...sa], rng)

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
        options: seededShuffle(opts, rng).map((o) => ({ id: o.id, content: o.content })),
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
        options: opts.map((o) => ({ id: o.id, content: o.content })),
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

  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.id, quizId), eq(quizAttempts.studentId, student.id)))
    .limit(1)
  if (!attempt) throw new Error("Không tìm thấy bài kiểm tra")
  if (attempt.completedAt) throw new Error("Bài kiểm tra đã nộp")

  const questionIds = Object.keys(answers)
  const qRows = await db.select().from(questions).where(inArray(questions.id, questionIds))
  const optRows = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, questionIds))

  const totalSlots = attempt.totalSlots ?? 1
  const pointPerSlot = 10 / totalSlots

  let correctSlots = 0
  const answerRows: { attemptId: string; questionId: string; studentAnswer: string; isCorrect: boolean }[] = []
  const details: QuizResultDto["details"] = []

  for (const q of qRows) {
    const opts = optRows.filter((o) => o.questionId === q.id)
    if (q.type === "MC") {
      const chosenId = answers[q.id] as string
      const correctOpt = opts.find((o) => o.isCorrect)
      const isCorrect = Boolean(correctOpt && chosenId === correctOpt.id)
      if (isCorrect) correctSlots += 1
      answerRows.push({ attemptId: quizId, questionId: q.id, studentAnswer: chosenId ?? "", isCorrect })
      details.push({
        questionId: q.id,
        questionType: "MC",
        studentAnswer: opts.find((o) => o.id === chosenId)?.content ?? "",
        isCorrect,
        correctAnswer: correctOpt?.content ?? "",
      })
    } else if (q.type === "SA") {
      const val = (answers[q.id] as string) ?? ""
      const correctOpt = opts.find((o) => o.isCorrect)
      const accepted = correctOpt ? normalizeAnswer(val) === normalizeAnswer(correctOpt.content) : false
      if (accepted) correctSlots += 1
      answerRows.push({ attemptId: quizId, questionId: q.id, studentAnswer: val, isCorrect: accepted })
      details.push({
        questionId: q.id,
        questionType: "SA",
        studentAnswer: val,
        isCorrect: accepted,
        correctAnswer: correctOpt?.content ?? "",
      })
    } else if (q.type === "TF") {
      const map = (answers[q.id] as Record<string, "D" | "S">) ?? {}
      const perYy: { optionId: string; value: string; isCorrect: boolean; content: string; correct: boolean }[] = []
      for (const o of opts) {
        const studentValue = map[o.id] ?? "S"
        const isCorrectY = (studentValue === "D") === o.isCorrect
        if (isCorrectY) correctSlots += 1
        answerRows.push({
          attemptId: quizId,
          questionId: q.id,
          studentAnswer: JSON.stringify({ optionId: o.id, value: studentValue }),
          isCorrect: isCorrectY,
        })
        perYy.push({
          optionId: o.id,
          value: studentValue,
          isCorrect: isCorrectY,
          content: o.content,
          correct: o.isCorrect,
        })
      }
      details.push({
        questionId: q.id,
        questionType: "TF",
        studentAnswer: JSON.stringify(perYy.map((p) => ({ content: p.content, value: p.value, isCorrect: p.isCorrect, correct: p.correct }))),
        isCorrect: perYy.every((p) => p.isCorrect),
        correctAnswer: "",
      })
    }
  }

  const score = Number((correctSlots * pointPerSlot).toFixed(2))

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
  const kpIds = [...new Set(qRows.map((q) => q.knowledgePointId))]
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
    percentage: Math.round((correctSlots / totalSlots) * 100),
    details,
  }
}

/** Lấy kết quả quiz gần nhất (để re-fetch khi HS quay lại Tab 4). */
export async function getLatestQuizResult(lessonId: string): Promise<QuizResultDto | null> {
  const student = await requireRole("student")
  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(
      and(
        eq(quizAttempts.studentId, student.id),
        eq(quizAttempts.lessonId, lessonId),
        sql`${quizAttempts.completedAt} is not null`,
      ),
    )
    .orderBy(sql`${quizAttempts.completedAt} desc`)
    .limit(1)
  if (!attempt) return null

  const ansRows = await db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.attemptId, attempt.id))

  const correctSlots = ansRows.filter((a) => a.isCorrect).length
  const totalSlots = (attempt.totalSlots ?? ansRows.length) || 1

  return {
    attemptId: attempt.id,
    score: attempt.score ?? 0,
    maxScore: 10,
    totalSlots,
    percentage: Math.round((correctSlots / totalSlots) * 100),
    details: [],
  }
}
