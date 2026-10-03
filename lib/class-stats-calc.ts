import type {
  AssignmentStatRow,
  ClassOverviewStats,
  ClassStatsDto,
  KPStatRow,
  StudentStatRow,
} from "@/types"
import type { StudentAssignmentStatus } from "@/lib/assignment-status"

export const EMPTY_OVERVIEW: ClassOverviewStats = {
  completionRate: 0,
  masteryRate: 0,
  avgQuiz: 0,
  medianQuiz: 0,
  atRiskCount: 0,
  weeklyActivity: 0,
}

export function emptyClassStats(
  students: StudentStatRow[] = [],
  knowledgePoints: KPStatRow[] = [],
): ClassStatsDto {
  return { students, knowledgePoints, overview: { ...EMPTY_OVERVIEW }, assignments: [] }
}

export function quizPercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0
  return Math.round((score / maxScore) * 100)
}

export function quizBand(percent: number): "0-20" | "20-50" | "50-80" | "80-100" {
  if (percent < 20) return "0-20"
  if (percent < 50) return "20-50"
  if (percent < 80) return "50-80"
  return "80-100"
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  return sorted[mid]
}

export function isAtRisk(input: {
  unknownCount: number
  overconfidentCount: number
  overdue: boolean
  quizAvg: number
  quizAttempts: number
}): boolean {
  if (input.unknownCount + input.overconfidentCount >= 3) return true
  if (input.overdue) return true
  if (input.quizAttempts > 0 && input.quizAvg < 50) return true
  return false
}

export function isWeakKp(input: { knownPercent: number; overconfidentPercent: number }): boolean {
  return input.knownPercent < 50 || input.overconfidentPercent >= 30
}

export function isHardKp(input: {
  knownPercent: number
  overconfidentPercent: number
  firstTryPercent: number
}): boolean {
  return input.knownPercent < 50 && (input.overconfidentPercent >= 20 || input.firstTryPercent < 40)
}

export function maxActivityAt(dates: (Date | string | null | undefined)[]): string | null {
  let max = 0
  for (const d of dates) {
    if (!d) continue
    const t = new Date(d).getTime()
    if (!Number.isNaN(t) && t > max) max = t
  }
  return max === 0 ? null : new Date(max).toISOString()
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function computeActivityStreak(dates: Date[], now = new Date()): number {
  if (dates.length === 0) return 0
  const dayKeys = new Set(dates.map((d) => toDayKey(new Date(d))))
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const cursor = new Date(today)
  if (!dayKeys.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!dayKeys.has(toDayKey(cursor))) return 0
  }
  let streak = 0
  let missAllowance = 1
  while (true) {
    if (dayKeys.has(toDayKey(cursor))) {
      streak += 1
      missAllowance = 1
    } else {
      missAllowance -= 1
      if (missAllowance < 0) break
    }
    cursor.setDate(cursor.getDate() - 1)
    if (streak > 366) break
  }
  return streak
}

export function summarizeStudentQuiz(
  attempts: { score: number | null; maxScore: number | null; completedAt: Date | string | null }[],
): { quizAvg: number; quizBest: number; quizAttempts: number; trend: number } {
  const done = attempts
    .filter((a) => a.completedAt && a.score != null && a.maxScore != null && a.maxScore > 0)
    .sort((a, b) => new Date(a.completedAt as Date).getTime() - new Date(b.completedAt as Date).getTime())
  const percents = done.map((a) => quizPercent(a.score as number, a.maxScore as number))
  if (percents.length === 0) return { quizAvg: 0, quizBest: 0, quizAttempts: 0, trend: 0 }
  const quizAvg = Math.round(percents.reduce((sum, n) => sum + n, 0) / percents.length)
  const quizBest = Math.max(...percents)
  const trend = Math.round((percents[percents.length - 1] / 10 - percents[0] / 10) * 10) / 10
  return { quizAvg, quizBest, quizAttempts: percents.length, trend }
}

export function overallStudentStatus(statuses: StudentAssignmentStatus[]): StudentAssignmentStatus {
  if (statuses.length === 0) return "not_started"
  if (statuses.every((s) => s === "completed")) return "completed"
  if (statuses.some((s) => s === "overdue")) return "overdue"
  if (statuses.some((s) => s === "in_progress" || s === "completed")) return "in_progress"
  return "not_started"
}

export function firstTryPercentForKp(
  answers: { studentId: string; attemptAt: number; isCorrect: boolean | null }[],
  studentCount: number,
): number {
  if (studentCount === 0) return 0
  const byStudent = new Map<string, { attemptAt: number; allCorrect: boolean }>()
  for (const a of answers) {
    const cur = byStudent.get(a.studentId)
    if (!cur || a.attemptAt < cur.attemptAt) {
      byStudent.set(a.studentId, { attemptAt: a.attemptAt, allCorrect: a.isCorrect === true })
    } else if (a.attemptAt === cur.attemptAt) {
      cur.allCorrect = cur.allCorrect && a.isCorrect === true
    }
  }
  let ok = 0
  for (const v of byStudent.values()) if (v.allCorrect) ok += 1
  return Math.round((ok / studentCount) * 100)
}

export function buildOverview(input: {
  studentCount: number
  studentsWithActivity: number
  masteredAcrossAssigned: number
  assignedKpSlots: number
  quizPercents: number[]
  atRiskCount: number
  weeklyActivity: number
}): ClassOverviewStats {
  const completionRate =
    input.studentCount === 0 ? 0 : Math.round((input.studentsWithActivity / input.studentCount) * 100)
  const masteryRate =
    input.assignedKpSlots === 0
      ? 0
      : Math.round((input.masteredAcrossAssigned / input.assignedKpSlots) * 100)
  const avgQuiz =
    input.quizPercents.length === 0
      ? 0
      : Math.round(input.quizPercents.reduce((sum, n) => sum + n, 0) / input.quizPercents.length)
  return {
    completionRate,
    masteryRate,
    avgQuiz,
    medianQuiz: median(input.quizPercents),
    atRiskCount: input.atRiskCount,
    weeklyActivity: input.weeklyActivity,
  }
}

export function buildAssignmentStat(input: {
  assignmentId: string
  lessonId: string
  lessonTitle: string
  chapterTitle: string
  dueAt: string | null
  totalStudents: number
  studentOutcomes: Array<{
    status: StudentAssignmentStatus
    completedAt: Date | string | null
    quizPercents: number[]
  }>
  weakKpIds: string[]
}): AssignmentStatRow {
  const due = input.dueAt ? new Date(input.dueAt) : null
  let completedCount = 0
  let onTimeCount = 0
  let lateCount = 0
  let overdueCount = 0
  const allPercents: number[] = []
  const dist = { "0-20": 0, "20-50": 0, "50-80": 0, "80-100": 0 }
  for (const o of input.studentOutcomes) {
    if (o.status === "completed") {
      completedCount += 1
      const doneAt = o.completedAt ? new Date(o.completedAt) : null
      if (due && doneAt && doneAt.getTime() > due.getTime()) lateCount += 1
      else onTimeCount += 1
    } else if (o.status === "overdue") {
      overdueCount += 1
    }
    for (const p of o.quizPercents) {
      allPercents.push(p)
      dist[quizBand(p)] += 1
    }
  }
  const avgScore =
    allPercents.length === 0
      ? 0
      : Math.round(allPercents.reduce((sum, n) => sum + n, 0) / allPercents.length)
  const bestScore = allPercents.length === 0 ? 0 : Math.max(...allPercents)
  const completionPercent =
    input.totalStudents === 0 ? 0 : Math.round((completedCount / input.totalStudents) * 100)
  return {
    assignmentId: input.assignmentId,
    lessonId: input.lessonId,
    lessonTitle: input.lessonTitle,
    chapterTitle: input.chapterTitle,
    dueAt: input.dueAt,
    completedCount,
    totalStudents: input.totalStudents,
    completionPercent,
    avgScore,
    bestScore,
    distribution: [
      { band: "0-20", count: dist["0-20"] },
      { band: "20-50", count: dist["20-50"] },
      { band: "50-80", count: dist["50-80"] },
      { band: "80-100", count: dist["80-100"] },
    ],
    onTimeCount,
    lateCount,
    overdueCount,
    weakKpIds: input.weakKpIds,
  }
}
