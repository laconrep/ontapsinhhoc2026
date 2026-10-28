"use server"

import { db, ensureSchema } from "@/lib/db"
import {
  classes,
  classStudents,
  classAssignments,
  lessons,
  knowledgePoints,
  questions,
  questionOptions,
  studentProgress,
  studentTab1Submissions,
  quizAttempts,
  quizAnswers,
  quizAttemptQuestions,
  user,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm"
import {
  buildStudentRow,
  buildKpStats,
  buildMatrix,
  buildProgressTable,
  buildLessonChart,
  computeStreak,
  DEFAULT_THRESHOLDS,
  type KpStat,
  type MatrixCell,
  type ProgressTableRow,
  type LessonChartPoint,
  type RawAttempt,
  type RawKp,
  type RawStudentLesson,
  type StatsThresholds,
  type StudentRow,
} from "@/lib/lesson-stats"

export interface LessonStatsDto {
  classId: string
  lessonId: string | null
  lessonTitle: string | null
  thresholds: StatsThresholds
  lessons: { id: string; title: string }[]
  coverage: { total: number; attached: number; unattached: number }
  overview: {
    submittedCount: number
    classSize: number
    avgFirst10: number | null
    avgLatest10: number | null
    needsHelpCount: number
    weakestKp: { content: string; weakRate: number } | null
    conclusion: string
  }
  stageDistribution: { stage: string; label: string; count: number }[]
  students: StudentRow[]
  kpStats: KpStat[]
  matrixOrderedKps: RawKp[]
  matrixCells: Record<string, Record<string, MatrixCell>>
  progressTable: ProgressTableRow[]
  chart: LessonChartPoint[]
  mostImproved: { kpNo: number; delta: number }[]
  leastImproved: { kpNo: number; delta: number }[]
  persistentWeak: { kpNo: number; studentCount: number }[]
  attendance: { studentId: string; name: string; streak: number; longAbsent: boolean; lastActivityAt: string | null }[]
  qualityFlags: { studentName: string; text: string }[]
  rawStudents: RawStudentLesson[]
  generatedAt: string
}

const STAGE_LABEL: Record<string, string> = {
  tab1: "Chưa tự đánh giá",
  tab2: "Đang điền khuyết",
  tab3: "Đang kéo thả",
  tab4: "Chưa kiểm tra",
  done: "Đã xong",
}

const QUIZ_TYPES = ["MC", "TF", "SA"] as const

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

function dayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

async function assertTeacherClass(classId: string, teacherId: string) {
  const [cls] = await db
    .select({
      id: classes.id,
    })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacherId)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")
  return cls
}

/**
 * §38 (full) — Thống kê theo BÀI đã chọn (không tính toàn lớp, không tính
 * lúc mở trang lớp; chỉ gọi khi giáo viên mở tab Thống kê).
 * Dữ liệu lượt hiện tại lấy từ studentProgress + submission hiện tại;
 * lịch sử lượt đã đóng nằm ở lesson_runs/kp_run_results nhưng tầng hiện
 * tại không cần chúng (Màn 4 so sánh lượt kiểm tra qua quiz_attempts).
 */
export async function getLessonStats(classId: string, lessonId?: string): Promise<LessonStatsDto> {
  const teacher = await requireRole("teacher")
  await ensureSchema()
  await assertTeacherClass(classId, teacher.id)
  // §41: ngưỡng CỐ ĐỊNH 75/50 cho mọi lớp, không đọc giá trị đã lưu theo
  // lớp nữa (lớp cũ đã lưu 80 cũng dùng 75; cột statsMastery/statsOk giữ
  // lại trong DB nhưng không còn dùng). Giáo viên không tự điều chỉnh
  // ngưỡng vì không đủ hiểu để điều chỉnh đúng.
  const thresholds: StatsThresholds = { ...DEFAULT_THRESHOLDS }
  const now = new Date()

  const studentRows = await db
    .select({ id: user.id, name: user.name })
    .from(classStudents)
    .innerJoin(user, eq(user.id, classStudents.studentId))
    .where(eq(classStudents.classId, classId))
    .orderBy(asc(user.name))
  const studentIds = studentRows.map((s) => s.id)

  // Bài chọn: bài đã giao (mới giao trước) + bài lưu tại lớp.
  const assignedRows = await db
    .select({
      lessonId: classAssignments.lessonId,
      title: lessons.title,
      createdAt: classAssignments.createdAt,
    })
    .from(classAssignments)
    .innerJoin(lessons, eq(lessons.id, classAssignments.lessonId))
    .where(eq(classAssignments.classId, classId))
    .orderBy(desc(classAssignments.createdAt))
  const classOnlyRows = await db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .where(eq(lessons.classId, classId))
    .orderBy(desc(lessons.createdAt))
  const picker: { id: string; title: string }[] = []
  const seenPicker = new Set<string>()
  for (const r of assignedRows) {
    if (!seenPicker.has(r.lessonId)) {
      seenPicker.add(r.lessonId)
      picker.push({ id: r.lessonId, title: r.title })
    }
  }
  for (const r of classOnlyRows) {
    if (!seenPicker.has(r.id)) {
      seenPicker.add(r.id)
      picker.push({ id: r.id, title: r.title })
    }
  }

  const empty: LessonStatsDto = {
    classId,
    lessonId: null,
    lessonTitle: null,
    thresholds,
    lessons: picker,
    coverage: { total: 0, attached: 0, unattached: 0 },
    overview: {
      submittedCount: 0,
      classSize: studentIds.length,
      avgFirst10: null,
      avgLatest10: null,
      needsHelpCount: 0,
      weakestKp: null,
      conclusion: "Lớp chưa có bài nào để thống kê.",
    },
    stageDistribution: [],
    students: [],
    kpStats: [],
    matrixOrderedKps: [],
    matrixCells: {},
    progressTable: [],
    chart: [],
    mostImproved: [],
    leastImproved: [],
    persistentWeak: [],
    attendance: studentRows.map((s) => ({ studentId: s.id, name: s.name, streak: 0, longAbsent: false, lastActivityAt: null })),
    qualityFlags: [],
    rawStudents: [],
    generatedAt: now.toISOString(),
  }
  const selectedId = lessonId && picker.some((p) => p.id === lessonId) ? lessonId : picker[0]?.id
  if (!selectedId) return empty

  const [lesson] = await db
    .select({ id: lessons.id, title: lessons.title })
    .from(lessons)
    .where(eq(lessons.id, selectedId))
    .limit(1)
  if (!lesson) return empty

  const [assignRow] = await db
    .select({ dueAt: classAssignments.dueAt })
    .from(classAssignments)
    .where(and(eq(classAssignments.classId, classId), eq(classAssignments.lessonId, selectedId)))
    .limit(1)
  const dueAt = assignRow?.dueAt ?? null

  const kpRows = await db
    .select({
      id: knowledgePoints.id,
      content: knowledgePoints.content,
      order: knowledgePoints.order,
      underlinedTerms: knowledgePoints.underlinedTerms,
    })
    .from(knowledgePoints)
    .where(eq(knowledgePoints.lessonId, selectedId))
    .orderBy(asc(knowledgePoints.order))
  const kpIds = kpRows.map((k) => k.id)

  const questionRows = await db
    .select({
      id: questions.id,
      knowledgePointId: questions.knowledgePointId,
      type: questions.type,
      order: questions.order,
    })
    .from(questions)
    .where(
      and(eq(questions.lessonId, selectedId), inArray(questions.type, [...QUIZ_TYPES])),
    )
    .orderBy(asc(questions.order))
  const questionIds = questionRows.map((q) => q.id)
  const questionNoById = new Map(questionRows.map((q, idx) => [q.id, idx + 1]))
  const questionTypeById = new Map(questionRows.map((q) => [q.id, q.type]))
  const questionKpById = new Map(questionRows.map((q) => [q.id, q.knowledgePointId]))

  const optionRows =
    questionIds.length === 0
      ? []
      : await db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, content: questionOptions.content })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, questionIds))
  const optionContentById = new Map(optionRows.map((o) => [o.id, o.content]))
  const optionCountByQuestion = new Map<string, number>()
  for (const o of optionRows) {
    optionCountByQuestion.set(o.questionId, (optionCountByQuestion.get(o.questionId) ?? 0) + 1)
  }
  const slotsOfQuestion = (q: { id: string; type: string }): number =>
    q.type === "TF" ? (optionCountByQuestion.get(q.id) ?? 0) : 1

  const rawKps: RawKp[] = kpRows.map((k) => {
    const qs = questionRows.filter((q) => q.knowledgePointId === k.id)
    return {
      id: k.id,
      content: k.content,
      order: k.order,
      slotCount: ((k.underlinedTerms as unknown[]) ?? []).length,
      questionIds: qs.map((q) => q.id),
      quizSlotCount: qs.reduce((sum, q) => sum + slotsOfQuestion(q), 0),
    }
  })
  const lessonTotalSlots = questionRows.reduce((sum, q) => sum + slotsOfQuestion(q), 0)
  const attachedCount = questionRows.filter((q) => q.knowledgePointId != null).length
  const coverage = {
    total: questionRows.length,
    attached: attachedCount,
    unattached: questionRows.length - attachedCount,
  }

  const submissionRows =
    studentIds.length === 0
      ? []
      : await db
          .select({
            studentId: studentTab1Submissions.studentId,
            assessments: studentTab1Submissions.assessments,
            submittedAt: studentTab1Submissions.submittedAt,
          })
          .from(studentTab1Submissions)
          .where(
            and(
              eq(studentTab1Submissions.lessonId, selectedId),
              inArray(studentTab1Submissions.studentId, studentIds),
            ),
          )
  const submissionByStudent = new Map(
    submissionRows.map((r) => [
      r.studentId,
      {
        assessments: (r.assessments as Record<string, "known" | "unknown">) ?? {},
        submittedAt: r.submittedAt,
      },
    ]),
  )

  const progressRows =
    studentIds.length === 0 || kpIds.length === 0
      ? []
      : await db
          .select()
          .from(studentProgress)
          .where(
            and(
              inArray(studentProgress.studentId, studentIds),
              inArray(studentProgress.knowledgePointId, kpIds),
            ),
          )
  const progressByStudentKp = new Map<string, (typeof progressRows)[number]>()
  for (const r of progressRows) {
    progressByStudentKp.set(`${r.studentId}:${r.knowledgePointId}`, r)
  }

  const attemptRows =
    studentIds.length === 0
      ? []
      : await db
          .select()
          .from(quizAttempts)
          .where(
            and(
              inArray(quizAttempts.studentId, studentIds),
              eq(quizAttempts.lessonId, selectedId),
            ),
          )
          .orderBy(asc(quizAttempts.startedAt))
  const attemptIds = attemptRows.map((a) => a.id)

  const rosterRows =
    attemptIds.length === 0
      ? []
      : await db
          .select({ attemptId: quizAttemptQuestions.attemptId, questionId: quizAttemptQuestions.questionId })
          .from(quizAttemptQuestions)
          .where(inArray(quizAttemptQuestions.attemptId, attemptIds))
  const rosterByAttempt = new Map<string, string[]>()
  for (const r of rosterRows) {
    const arr = rosterByAttempt.get(r.attemptId) ?? []
    arr.push(r.questionId)
    rosterByAttempt.set(r.attemptId, arr)
  }

  const answerRows =
    attemptIds.length === 0
      ? []
      : await db
          .select({
            attemptId: quizAnswers.attemptId,
            questionId: quizAnswers.questionId,
            optionId: quizAnswers.optionId,
            studentAnswer: quizAnswers.studentAnswer,
            isCorrect: quizAnswers.isCorrect,
            answeredAt: quizAnswers.answeredAt,
          })
          .from(quizAnswers)
          .where(inArray(quizAnswers.attemptId, attemptIds))
  const answersByAttempt = new Map<string, typeof answerRows>()
  for (const r of answerRows) {
    const arr = answersByAttempt.get(r.attemptId) ?? []
    arr.push(r)
    answersByAttempt.set(r.attemptId, arr)
  }

  const attemptsByStudent = new Map<string, typeof attemptRows>()
  for (const a of attemptRows) {
    const arr = attemptsByStudent.get(a.studentId) ?? []
    arr.push(a)
    attemptsByStudent.set(a.studentId, arr)
  }

  // Hoạt động: updatedAt tiến độ + nộp Tab 1 + lượt kiểm tra.
  const activityDaysByStudent = new Map<string, Set<string>>()
  const lastActivityByStudent = new Map<string, Date>()
  const touch = (studentId: string, d: Date | null | undefined) => {
    if (!d) return
    let set = activityDaysByStudent.get(studentId)
    if (!set) {
      set = new Set()
      activityDaysByStudent.set(studentId, set)
    }
    set.add(dayString(d))
    const prev = lastActivityByStudent.get(studentId)
    if (!prev || d.getTime() > prev.getTime()) lastActivityByStudent.set(studentId, d)
  }
  for (const r of progressRows) touch(r.studentId, r.updatedAt)
  for (const r of submissionRows) touch(r.studentId, r.submittedAt)
  for (const a of attemptRows) {
    touch(a.studentId, a.startedAt)
    touch(a.studentId, a.completedAt)
  }

  const wrongTextFor = (row: {
    questionId: string
    optionId: string | null
    studentAnswer: string | null
  }): string => {
    const type = questionTypeById.get(row.questionId)
    if (type === "MC") {
      const chosen = row.studentAnswer ? optionContentById.get(row.studentAnswer) : undefined
      return chosen ? truncate(chosen, 40) : (row.studentAnswer ?? "—")
    }
    if (type === "TF") {
      const statement = row.optionId ? optionContentById.get(row.optionId) : undefined
      return statement
        ? `Chọn ${row.studentAnswer ?? "—"} cho ý "${truncate(statement, 30)}"`
        : `Chọn ${row.studentAnswer ?? "—"}`
    }
    return truncate(row.studentAnswer ?? "—", 40)
  }

  const rawStudents: RawStudentLesson[] = studentRows.map((s) => {
    const submission = submissionByStudent.get(s.id)
    const attempts = attemptsByStudent.get(s.id) ?? []
    const submitted = attempts.filter((a) => a.completedAt != null)
    // Lượt đang làm chỉ tính khi bắt đầu sau submission Tab 1 hiện tại:
    // sau resetLessonProgress, submission bị xóa nhưng lượt mở cũ vẫn còn
    // trong quiz_attempts — lượt đó thuộc lượt học cũ, không được tính là
    // "Đang làm" của lượt hiện tại (ngược lại hàng thống kê mâu thuẫn:
    // kiểm tra "done" nhưng huy hiệu "Đang làm"). Không có submission thì
    // không có lượt mở. Lịch sử lượt đã nộp giữ nguyên, không lọc.
    const open = submission
      ? attempts
          .filter((a) => a.completedAt == null && a.startedAt.getTime() > submission.submittedAt.getTime())
          .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]
      : undefined
    const latestSubmittedId = submitted[submitted.length - 1]?.id

    const toRawAttempt = (a: (typeof attemptRows)[number]): RawAttempt => {
      const rows = answersByAttempt.get(a.id) ?? []
      const isLatest = a.id === latestSubmittedId
      const slotsByKp: Record<string, { correct: number; total: number }> = {}
      let correctSlots = 0
      for (const r of rows) {
        const kpId = questionKpById.get(r.questionId)
        if (r.isCorrect) correctSlots += 1
        if (kpId && kpIds.includes(kpId)) {
          const entry = slotsByKp[kpId] ?? { correct: 0, total: 0 }
          entry.total += 1
          if (r.isCorrect) entry.correct += 1
          slotsByKp[kpId] = entry
        }
      }
      const totalSlots = a.totalSlots ?? rows.length
      const score10 =
        a.score != null
          ? a.score
          : totalSlots > 0
            ? Math.min(10, Number(((correctSlots * 10) / totalSlots).toFixed(2)))
            : null
      // Số câu trả lời nhanh: khoảng cách 0 < gap < 5s giữa hai lần nộp liên tiếp.
      // Gap = 0 là hàng loạt lúc nộp bài cuối (submitQuiz ghi cùng timestamp),
      // không tính là "trả lời nhanh".
      const times = rows
        .map((r) => r.answeredAt?.getTime())
        .filter((v): v is number => v != null)
        .sort((x, y) => x - y)
      let quickAnswers = 0
      for (let i = 1; i < times.length; i++) {
        const gap = times[i]! - times[i - 1]!
        if (gap > 0 && gap < 5000) quickAnswers += 1
      }
      return {
        id: a.id,
        score10,
        completedAt: iso(a.completedAt),
        slotsByKp,
        questionIds: isLatest ? (rosterByAttempt.get(a.id) ?? []) : [],
        wrongAnswers: isLatest
          ? rows
              .filter((r) => r.isCorrect === false && questionKpById.get(r.questionId) != null)
              .map((r) => ({
                questionId: r.questionId,
                questionNo: questionNoById.get(r.questionId) ?? 0,
                questionType: (questionTypeById.get(r.questionId) ?? "MC") as "MC" | "TF" | "SA",
                optionId: r.optionId,
                studentAnswer: r.studentAnswer,
                optionContent: wrongTextFor(r),
              }))
          : [],
        totalSlots,
        correctSlots,
        durationMs:
          a.completedAt != null ? a.completedAt.getTime() - a.startedAt.getTime() : null,
        quickAnswers: isLatest ? quickAnswers : 0,
      }
    }

    const progressByKp: RawStudentLesson["progressByKp"] = {}
    for (const kp of kpRows) {
      const r = progressByStudentKp.get(`${s.id}:${kp.id}`)
      progressByKp[kp.id] = {
        self: (r?.selfAssessment ?? null) as "known" | "unknown" | null,
        fill: {
          status: (r?.fillStatus ?? null) as "correct" | "incorrect" | null,
          firstTry: (r?.fillFirstTry ?? null) as "correct" | "incorrect" | null,
          attempts: r?.fillAttempts ?? 0,
          revealed: r?.fillRevealed ?? false,
        },
        drag: {
          status: (r?.dragStatus ?? null) as "correct" | "incorrect" | null,
          firstTry: (r?.dragFirstTry ?? null) as "correct" | "incorrect" | null,
          attempts: r?.dragAttempts ?? 0,
          revealed: r?.dragRevealed ?? false,
        },
      }
    }

    const submittedRaw = submitted.map(toRawAttempt)
    const openRaw = open
      ? {
          attemptNo: submittedRaw.length + 1,
          answeredSlots: (answersByAttempt.get(open.id) ?? []).length,
          answeredCorrect: (answersByAttempt.get(open.id) ?? []).filter((r) => r.isCorrect).length,
          totalSlots: open.totalSlots ?? (rosterByAttempt.get(open.id) ?? []).length,
        }
      : null
    return {
      studentId: s.id,
      name: s.name,
      selfByKp: submission?.assessments ?? {},
      hasSubmission: submission != null,
      progressByKp,
      submittedAttempts: submittedRaw,
      openAttempt: openRaw,
      lastActivityAt: iso(lastActivityByStudent.get(s.id)),
      dueAt: iso(dueAt),
      activityDays: [...(activityDaysByStudent.get(s.id) ?? [])].sort(),
    }
  })

  const rows = rawStudents.map((rs) => buildStudentRow(rs, rawKps, thresholds, lessonTotalSlots, now))
  const kpStats = buildKpStats(rawStudents, rows, rawKps, thresholds)
  const matrix = buildMatrix(rows, rawKps)
  const progressTable = buildProgressTable(rows, rawStudents)

  // Biểu đồ Màn 4: điểm TB từng bài đã giao (lượt đầu -> gần nhất).
  const chartAttemptRows =
    studentIds.length === 0 || picker.length === 0
      ? []
      : await db
          .select({
            lessonId: quizAttempts.lessonId,
            studentId: quizAttempts.studentId,
            score: quizAttempts.score,
            startedAt: quizAttempts.startedAt,
          })
          .from(quizAttempts)
          .where(
            and(
              inArray(quizAttempts.studentId, studentIds),
              inArray(
                quizAttempts.lessonId,
                picker.map((p) => p.id),
              ),
              isNotNull(quizAttempts.completedAt),
            ),
          )
          .orderBy(asc(quizAttempts.startedAt))
  const chartByLesson = new Map<string, Map<string, { first10: number | null; latest10: number | null }>>()
  for (const r of chartAttemptRows) {
    let byStudent = chartByLesson.get(r.lessonId)
    if (!byStudent) {
      byStudent = new Map()
      chartByLesson.set(r.lessonId, byStudent)
    }
    const entry = byStudent.get(r.studentId) ?? { first10: null, latest10: null }
    if (entry.first10 == null) entry.first10 = r.score
    entry.latest10 = r.score
    byStudent.set(r.studentId, entry)
  }
  const chart = buildLessonChart(
    picker.map((p) => ({
      lessonId: p.id,
      title: p.title,
      scores: studentIds.map((id) => chartByLesson.get(p.id)?.get(id) ?? { first10: null, latest10: null }),
    })),
  )

  // Tổng quan Màn 1.
  const submittedStudents = rawStudents.filter((rs) => rs.submittedAttempts.length > 0)
  const firstScores = submittedStudents
    .map((rs) => rs.submittedAttempts[0]?.score10)
    .filter((v): v is number => v != null)
  const latestScores = submittedStudents
    .map((rs) => rs.submittedAttempts[rs.submittedAttempts.length - 1]?.score10)
    .filter((v): v is number => v != null)
  const avg = (arr: number[]) =>
    arr.length === 0 ? null : Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2))
  const avgFirst10 = avg(firstScores)
  const avgLatest10 = avg(latestScores)
  const needsHelpCount = rows.filter((r) => r.needsHelp).length
  let weakestKp: { content: string; weakRate: number } | null = null
  for (const k of kpStats) {
    if (!weakestKp || k.weakRate > weakestKp.weakRate) {
      weakestKp = { content: k.content, weakRate: k.weakRate }
    }
  }
  const conclusionParts: string[] = []
  conclusionParts.push(`Đã nộp kiểm tra ${submittedStudents.length}/${studentIds.length} em.`)
  if (avgFirst10 != null && avgLatest10 != null) {
    conclusionParts.push(`Điểm TB ${avgFirst10} → ${avgLatest10} (thang 10).`)
  }
  if (needsHelpCount > 0) conclusionParts.push(`Cần hỗ trợ ${needsHelpCount} em.`)
  if (weakestKp && weakestKp.weakRate > 0) {
    conclusionParts.push(
      `Điểm yếu nhất: ${truncate(weakestKp.content, 60)} (${Math.round(weakestKp.weakRate * 100)}% Chưa tốt).`,
    )
  }
  const conclusion = conclusionParts.join(" ")

  // Phân bố "dừng ở bước nào" (bản bulk của resolveStudyStage).
  const stageCounts = new Map<string, number>()
  for (const rs of rawStudents) {
    const submission = submissionByStudent.get(rs.studentId)
    let stage: string
    if (!submission) {
      stage = "tab1"
    } else {
      const attempts = attemptsByStudent.get(rs.studentId) ?? []
      const after = attempts.filter((a) => a.startedAt.getTime() > submission.submittedAt.getTime())
      if (after.some((a) => a.completedAt != null)) {
        stage = "done"
      } else if (after.some((a) => a.completedAt == null)) {
        stage = "tab4"
      } else {
        const knownCount = Object.values(submission.assessments).filter((v) => v === "known").length
        const skippedTab2 = knownCount === 0
        const fillLeft =
          !skippedTab2 &&
          kpRows.some((kp) => {
            const p = progressByStudentKp.get(`${rs.studentId}:${kp.id}`)
            const terms = ((kp.underlinedTerms as unknown[]) ?? []).length
            return p?.selfAssessment === "known" && p.fillStatus !== "correct" && terms > 0
          })
        if (fillLeft) {
          stage = "tab2"
        } else {
          const dragLeft = kpRows.some((kp) => {
            const p = progressByStudentKp.get(`${rs.studentId}:${kp.id}`)
            const terms = ((kp.underlinedTerms as unknown[]) ?? []).length
            return p?.selfAssessment === "unknown" && p.dragStatus !== "correct" && terms > 0
          })
          stage = dragLeft ? "tab3" : "tab4"
        }
      }
    }
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
  }
  const stageDistribution = ["tab1", "tab2", "tab3", "tab4", "done"].map((stage) => ({
    stage,
    label: STAGE_LABEL[stage] ?? stage,
    count: stageCounts.get(stage) ?? 0,
  }))

  // Màn 4: điểm tiến bộ / thụt lùi nhất + điểm yếu kéo dài + chuyên cần + cờ chất lượng.
  const deltas = kpStats
    .map((k) => ({ kpNo: k.kpNo, delta: k.latestMastered - k.firstMastered }))
    .filter((d) => d.delta !== 0)
  const mostImproved = [...deltas]
    .filter((d) => d.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)
  const leastImproved = [...deltas]
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 3)
  const persistentMap = new Map<number, number>()
  for (const r of rows) {
    for (const kpNo of r.persistentWeakKpNos) {
      persistentMap.set(kpNo, (persistentMap.get(kpNo) ?? 0) + 1)
    }
  }
  const persistentWeak = [...persistentMap.entries()]
    .map(([kpNo, studentCount]) => ({ kpNo, studentCount }))
    .sort((a, b) => b.studentCount - a.studentCount)

  const attendance = rawStudents.map((rs) => {
    const last = rs.lastActivityAt ? new Date(rs.lastActivityAt) : null
    return {
      studentId: rs.studentId,
      name: rs.name,
      streak: computeStreak(rs.activityDays, now),
      longAbsent: last != null && now.getTime() - last.getTime() > 7 * 24 * 60 * 60 * 1000,
      lastActivityAt: rs.lastActivityAt,
    }
  })

  const qualityFlags: { studentName: string; text: string }[] = []
  for (const rs of rawStudents) {
    const latest = rs.submittedAttempts[rs.submittedAttempts.length - 1]
    if (!latest) continue
    if (latest.durationMs != null && latest.totalSlots > 0) {
      const avgSec = latest.durationMs / 1000 / latest.totalSlots
      if (avgSec < 10) {
        qualityFlags.push({
          studentName: rs.name,
          text: `Làm rất nhanh: trung bình ${avgSec.toFixed(1)} giây/câu ở lượt gần nhất.`,
        })
      }
    }
    if (latest.quickAnswers >= 3) {
      qualityFlags.push({
        studentName: rs.name,
        text: `Có ${latest.quickAnswers} câu trả lời dưới 5 giây ở lượt gần nhất.`,
      })
    }
  }

  return {
    classId,
    lessonId: selectedId,
    lessonTitle: lesson.title,
    thresholds,
    lessons: picker,
    coverage,
    overview: {
      submittedCount: submittedStudents.length,
      classSize: studentIds.length,
      avgFirst10,
      avgLatest10,
      needsHelpCount,
      weakestKp,
      conclusion,
    },
    stageDistribution,
    students: rows,
    kpStats,
    matrixOrderedKps: matrix.orderedKps,
    matrixCells: matrix.cells,
    progressTable,
    chart,
    mostImproved,
    leastImproved,
    persistentWeak,
    attendance,
    qualityFlags,
    rawStudents,
    generatedAt: now.toISOString(),
  }
}
