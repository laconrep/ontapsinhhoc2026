"use server"

import { db, ensureSchema } from "@/lib/db"
import {
  classes,
  classStudents,
  classAssignments,
  chapters,
  lessons,
  knowledgePoints,
  questions,
  studentProgress,
  studentTab1Submissions,
  quizAttempts,
  quizAnswers,
  user,
} from "@/lib/db/schema"
import { requireRole } from "@/lib/auth-helpers"
import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { deriveStudentAssignmentStatus } from "@/lib/assignment-status"
import {
  buildAssignmentStat,
  buildOverview,
  computeActivityStreak,
  emptyClassStats,
  firstTryPercentForKp,
  isAtRisk,
  isHardKp,
  isWeakKp,
  maxActivityAt,
  overallStudentStatus,
  quizPercent,
  summarizeStudentQuiz,
} from "@/lib/class-stats-calc"
import type { AssignmentStatRow, ClassStatsDto, KPStatRow, StudentStatRow } from "@/types"

async function assignmentLessonIds(classId: string): Promise<string[]> {
  const rows = await db
    .select({ lessonId: classAssignments.lessonId })
    .from(classAssignments)
    .where(eq(classAssignments.classId, classId))
  return [...new Set(rows.map((r) => r.lessonId))]
}

export async function getClassStats(classId: string): Promise<ClassStatsDto> {
  const teacher = await requireRole("teacher")
  await ensureSchema()

  const [cls] = await db
    .select({ id: classes.id, teacherId: classes.teacherId })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")

  const studentRows = await db
    .select({ id: user.id, name: user.name })
    .from(classStudents)
    .innerJoin(user, eq(user.id, classStudents.studentId))
    .where(eq(classStudents.classId, classId))
    .orderBy(asc(user.name))
  const studentIds = studentRows.map((s) => s.id)

  const kpRows = await db
    .select({
      id: knowledgePoints.id,
      content: knowledgePoints.content,
      lessonId: knowledgePoints.lessonId,
    })
    .from(knowledgePoints)
    .innerJoin(lessons, eq(lessons.id, knowledgePoints.lessonId))
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .where(and(eq(chapters.teacherId, teacher.id), eq(lessons.status, "ready")))
    .orderBy(asc(knowledgePoints.order))
  const totalKp = kpRows.length
  const kpIdSet = new Set(kpRows.map((k) => k.id))

  const assignedLessonIdList = await assignmentLessonIds(classId)
  const assignedLessonSet = new Set(assignedLessonIdList)
  const assignedKpIds = kpRows.filter((k) => assignedLessonSet.has(k.lessonId)).map((k) => k.id)
  const assignedKpSet = new Set(assignedKpIds)
  const assignedKpByLesson = new Map<string, string[]>()
  for (const k of kpRows) {
    if (!assignedLessonSet.has(k.lessonId)) continue
    const list = assignedKpByLesson.get(k.lessonId) ?? []
    list.push(k.id)
    assignedKpByLesson.set(k.lessonId, list)
  }

  if (studentIds.length === 0 || totalKp === 0) {
    return emptyClassStats(
      studentRows.map((s) => ({
        studentId: s.id,
        name: s.name,
        knownCount: 0,
        unknownCount: 0,
        overconfidentCount: 0,
        masteredCount: 0,
        progress: 0,
        quizAvg: 0,
        quizBest: 0,
        quizAttempts: 0,
        trend: 0,
        lastActivityAt: null,
        weakKpCount: 0,
        atRisk: false,
        status: "not_started",
        streak: 0,
      })),
      kpRows.map((k) => ({
        kpId: k.id,
        content: k.content,
        knownPercent: 0,
        overconfidentPercent: 0,
        reinforcedPercent: 0,
        firstTryPercent: 0,
        hardFlag: false,
      })),
    )
  }

  const progressRows = await db
    .select({
      studentId: studentProgress.studentId,
      knowledgePointId: studentProgress.knowledgePointId,
      selfAssessment: studentProgress.selfAssessment,
      fillStatus: studentProgress.fillStatus,
      dragStatus: studentProgress.dragStatus,
      overallStatus: studentProgress.overallStatus,
      updatedAt: studentProgress.updatedAt,
    })
    .from(studentProgress)
    .where(inArray(studentProgress.studentId, studentIds))

  const quizLessonIds = assignedLessonIdList.length > 0 ? assignedLessonIdList : [...new Set(kpRows.map((k) => k.lessonId))]
  const quizRows =
    quizLessonIds.length === 0
      ? []
      : await db
          .select({
            id: quizAttempts.id,
            studentId: quizAttempts.studentId,
            lessonId: quizAttempts.lessonId,
            score: quizAttempts.score,
            maxScore: quizAttempts.maxScore,
            completedAt: quizAttempts.completedAt,
          })
          .from(quizAttempts)
          .where(and(inArray(quizAttempts.studentId, studentIds), inArray(quizAttempts.lessonId, quizLessonIds)))
          .orderBy(asc(quizAttempts.completedAt))

  const tab1Rows =
    quizLessonIds.length === 0
      ? []
      : await db
          .select({
            studentId: studentTab1Submissions.studentId,
            lessonId: studentTab1Submissions.lessonId,
            submittedAt: studentTab1Submissions.submittedAt,
          })
          .from(studentTab1Submissions)
          .where(
            and(
              inArray(studentTab1Submissions.studentId, studentIds),
              inArray(studentTab1Submissions.lessonId, quizLessonIds),
            ),
          )

  const assignmentRows =
    assignedLessonIdList.length === 0
      ? []
      : await db
          .select({
            id: classAssignments.id,
            lessonId: classAssignments.lessonId,
            dueAt: classAssignments.dueAt,
            createdAt: classAssignments.createdAt,
            lessonTitle: lessons.title,
            chapterTitle: chapters.title,
          })
          .from(classAssignments)
          .innerJoin(lessons, eq(lessons.id, classAssignments.lessonId))
          .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
          .where(eq(classAssignments.classId, classId))
          .orderBy(desc(classAssignments.createdAt))

  const questionRows =
    assignedKpIds.length === 0
      ? []
      : await db
          .select({ id: questions.id, knowledgePointId: questions.knowledgePointId })
          .from(questions)
          .where(inArray(questions.knowledgePointId, assignedKpIds))
  const questionToKp = new Map(questionRows.map((q) => [q.id, q.knowledgePointId]))
  const attemptIds = quizRows.filter((q) => q.completedAt).map((q) => q.id)
  const answerRows =
    attemptIds.length === 0
      ? []
      : await db
          .select({
            attemptId: quizAnswers.attemptId,
            questionId: quizAnswers.questionId,
            isCorrect: quizAnswers.isCorrect,
          })
          .from(quizAnswers)
          .where(inArray(quizAnswers.attemptId, attemptIds))

  const quizByStudent = new Map<string, typeof quizRows>()
  for (const q of quizRows) {
    const list = quizByStudent.get(q.studentId) ?? []
    list.push(q)
    quizByStudent.set(q.studentId, list)
  }
  const tab1ByStudent = new Map<string, typeof tab1Rows>()
  for (const t of tab1Rows) {
    const list = tab1ByStudent.get(t.studentId) ?? []
    list.push(t)
    tab1ByStudent.set(t.studentId, list)
  }

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  let weeklyActivity = 0
  const allQuizPercents: number[] = []
  let studentsWithActivity = 0
  let masteredAcrossAssigned = 0

  const students: StudentStatRow[] = studentRows.map((s) => {
    const rows = progressRows.filter((p) => p.studentId === s.id && kpIdSet.has(p.knowledgePointId))
    const assignedRows = rows.filter((p) => assignedKpSet.has(p.knowledgePointId))
    const knownCount = rows.filter(
      (r) => r.overallStatus === "known" || r.overallStatus === "mastered",
    ).length
    const unknownCount = rows.filter((r) => r.overallStatus === "unknown").length
    const masteredCount = rows.filter((r) => r.overallStatus === "mastered").length
    const overconfidentCount = rows.filter(
      (r) => r.selfAssessment === "known" && r.fillStatus === "incorrect",
    ).length
    const progressBase = assignedKpIds.length > 0 ? assignedRows : rows
    const progressDenom = assignedKpIds.length > 0 ? assignedKpIds.length : totalKp
    const touched = progressBase.filter((r) => r.overallStatus !== "not_started").length
    const weakKpCount = assignedRows.filter(
      (r) =>
        r.overallStatus === "unknown" ||
        (r.selfAssessment === "known" && r.fillStatus === "incorrect"),
    ).length
    masteredAcrossAssigned += assignedRows.filter((r) => r.overallStatus === "mastered").length

    const studentQuiz = quizByStudent.get(s.id) ?? []
    const quizSummary = summarizeStudentQuiz(studentQuiz)
    allQuizPercents.push(
      ...studentQuiz
        .filter((q) => q.completedAt && q.score != null && q.maxScore != null && q.maxScore > 0)
        .map((q) => quizPercent(q.score as number, q.maxScore as number)),
    )

    const studentTab1 = tab1ByStudent.get(s.id) ?? []
    const lastActivityAt = maxActivityAt([
      ...assignedRows.map((r) => r.updatedAt),
      ...studentQuiz.map((q) => q.completedAt),
      ...studentTab1.map((t) => t.submittedAt),
    ])
    const activityDates = [
      ...assignedRows.map((r) => r.updatedAt),
      ...studentQuiz.map((q) => q.completedAt),
      ...studentTab1.map((t) => t.submittedAt),
    ].filter((d): d is Date => !!d)
    for (const d of activityDates) {
      if (new Date(d).getTime() >= weekAgo.getTime()) weeklyActivity += 1
    }
    if (touched > 0 || quizSummary.quizAttempts > 0) studentsWithActivity += 1

    const assignmentStatuses = assignmentRows.map((a) => {
      const kps = assignedKpByLesson.get(a.lessonId) ?? []
      const touchedKp = kps.filter((id) =>
        assignedRows.some((r) => r.knowledgePointId === id && r.overallStatus !== "not_started"),
      ).length
      const hasCompletedQuiz = studentQuiz.some((q) => q.lessonId === a.lessonId && q.completedAt)
      return deriveStudentAssignmentStatus({
        totalKp: kps.length,
        touchedKp,
        hasCompletedQuiz,
        dueAt: a.dueAt,
        now,
      })
    })
    const status = overallStudentStatus(assignmentStatuses)
    const atRisk = isAtRisk({
      unknownCount,
      overconfidentCount,
      overdue: status === "overdue",
      quizAvg: quizSummary.quizAvg,
      quizAttempts: quizSummary.quizAttempts,
    })

    return {
      studentId: s.id,
      name: s.name,
      knownCount,
      unknownCount,
      overconfidentCount,
      masteredCount,
      progress: progressDenom === 0 ? 0 : Math.round((touched / progressDenom) * 100),
      quizAvg: quizSummary.quizAvg,
      quizBest: quizSummary.quizBest,
      quizAttempts: quizSummary.quizAttempts,
      trend: quizSummary.trend,
      lastActivityAt,
      weakKpCount,
      atRisk,
      status,
      streak: computeActivityStreak(activityDates, now),
    }
  })

  const numStudents = studentIds.length
  const attemptById = new Map(quizRows.map((q) => [q.id, q]))
  const firstTryByKp = new Map<string, { studentId: string; attemptAt: number; isCorrect: boolean | null }[]>()
  for (const ans of answerRows) {
    const kpId = questionToKp.get(ans.questionId)
    const attempt = attemptById.get(ans.attemptId)
    if (!kpId || !attempt?.completedAt) continue
    const list = firstTryByKp.get(kpId) ?? []
    list.push({
      studentId: attempt.studentId,
      attemptAt: new Date(attempt.completedAt).getTime(),
      isCorrect: ans.isCorrect,
    })
    firstTryByKp.set(kpId, list)
  }

  const kpStats: KPStatRow[] = kpRows.map((k) => {
    const rows = progressRows.filter((p) => p.knowledgePointId === k.id)
    const knownCount = rows.filter(
      (r) => r.selfAssessment === "known" || r.overallStatus === "known" || r.overallStatus === "mastered",
    ).length
    const overconfidentCount = rows.filter(
      (r) => r.selfAssessment === "known" && r.fillStatus === "incorrect",
    ).length
    const reinforcedCount = rows.filter(
      (r) =>
        r.overallStatus === "mastered" &&
        (r.fillStatus === "incorrect" || r.dragStatus === "incorrect"),
    ).length
    const knownPercent = Math.round((knownCount / numStudents) * 100)
    const overconfidentPercent = Math.round((overconfidentCount / numStudents) * 100)
    const firstTry = firstTryPercentForKp(firstTryByKp.get(k.id) ?? [], numStudents)
    return {
      kpId: k.id,
      content: k.content,
      knownPercent,
      overconfidentPercent,
      reinforcedPercent: Math.round((reinforcedCount / numStudents) * 100),
      firstTryPercent: firstTry,
      hardFlag: isHardKp({
        knownPercent,
        overconfidentPercent,
        firstTryPercent: firstTry,
      }),
    }
  })

  const assignments: AssignmentStatRow[] = assignmentRows.map((a) => {
    const kps = assignedKpByLesson.get(a.lessonId) ?? []
    const weakKpIds = kpStats
      .filter((k) => kps.includes(k.kpId) && isWeakKp(k))
      .map((k) => k.kpId)
    const studentOutcomes = studentRows.map((s) => {
      const sProgress = progressRows.filter(
        (p) => p.studentId === s.id && kps.includes(p.knowledgePointId),
      )
      const touchedKp = sProgress.filter((r) => r.overallStatus !== "not_started").length
      const sQuiz = (quizByStudent.get(s.id) ?? []).filter((q) => q.lessonId === a.lessonId)
      const hasCompletedQuiz = sQuiz.some((q) => q.completedAt)
      const status = deriveStudentAssignmentStatus({
        totalKp: kps.length,
        touchedKp,
        hasCompletedQuiz,
        dueAt: a.dueAt,
        now,
      })
      const completedQuiz = sQuiz.filter((q) => q.completedAt)
      const lastDone = completedQuiz
        .map((q) => q.completedAt)
        .filter((d): d is Date => !!d)
        .sort((x, y) => y.getTime() - x.getTime())[0]
      const quizPercents = completedQuiz
        .filter((q) => q.score != null && q.maxScore != null && q.maxScore > 0)
        .map((q) => quizPercent(q.score as number, q.maxScore as number))
      return { status, completedAt: lastDone ?? null, quizPercents }
    })
    return buildAssignmentStat({
      assignmentId: a.id,
      lessonId: a.lessonId,
      lessonTitle: a.lessonTitle,
      chapterTitle: a.chapterTitle,
      dueAt: a.dueAt ? a.dueAt.toISOString() : null,
      totalStudents: numStudents,
      studentOutcomes,
      weakKpIds,
    })
  })

  const assignedKpSlots = assignedKpIds.length * numStudents
  const overview = buildOverview({
    studentCount: numStudents,
    studentsWithActivity,
    masteredAcrossAssigned,
    assignedKpSlots,
    quizPercents: allQuizPercents,
    atRiskCount: students.filter((s) => s.atRisk).length,
    weeklyActivity,
  })

  return { students, knowledgePoints: kpStats, overview, assignments }
}
