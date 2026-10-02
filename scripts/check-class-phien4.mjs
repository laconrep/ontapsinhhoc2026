import { readFileSync } from "node:fs"
import {
  buildAssignmentStat,
  buildOverview,
  emptyClassStats,
  firstTryPercentForKp,
  isAtRisk,
  isHardKp,
  isWeakKp,
  median,
  quizBand,
  quizPercent,
  summarizeStudentQuiz,
} from "../lib/class-stats-calc.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(quizPercent(8, 10) === 80, "quizPercent 8/10")
assert(quizBand(19) === "0-20", "band 0-20")
assert(quizBand(20) === "20-50", "band 20-50")
assert(quizBand(50) === "50-80", "band 50-80")
assert(quizBand(80) === "80-100", "band 80-100")
assert(median([10, 20, 30]) === 20, "median le")
assert(median([10, 20]) === 15, "median chan")
console.log("OK quiz helpers")

assert(isAtRisk({ unknownCount: 2, overconfidentCount: 1, overdue: false, quizAvg: 80, quizAttempts: 1 }), "unknown+overconfident >= 3")
assert(isAtRisk({ unknownCount: 0, overconfidentCount: 0, overdue: true, quizAvg: 90, quizAttempts: 1 }), "overdue atRisk")
assert(isAtRisk({ unknownCount: 0, overconfidentCount: 0, overdue: false, quizAvg: 40, quizAttempts: 1 }), "quizAvg < 50")
assert(!isAtRisk({ unknownCount: 0, overconfidentCount: 0, overdue: false, quizAvg: 40, quizAttempts: 0 }), "chua lam quiz khong atRisk vi diem")
assert(isWeakKp({ knownPercent: 40, overconfidentPercent: 0 }), "weak known < 50")
assert(isWeakKp({ knownPercent: 80, overconfidentPercent: 30 }), "weak overconfident >= 30")
assert(isHardKp({ knownPercent: 40, overconfidentPercent: 20, firstTryPercent: 80 }), "hard overconfident")
assert(isHardKp({ knownPercent: 40, overconfidentPercent: 0, firstTryPercent: 30 }), "hard firstTry")
assert(!isHardKp({ knownPercent: 60, overconfidentPercent: 20, firstTryPercent: 30 }), "known >= 50 khong hard")
console.log("OK flags")

const quiz = summarizeStudentQuiz([
  { score: 5, maxScore: 10, completedAt: "2026-09-01T00:00:00Z" },
  { score: 8, maxScore: 10, completedAt: "2026-09-10T00:00:00Z" },
])
assert(quiz.quizAvg === 65, `quizAvg ${quiz.quizAvg}`)
assert(quiz.quizBest === 80, `quizBest ${quiz.quizBest}`)
assert(quiz.quizAttempts === 2, "quizAttempts")
assert(quiz.trend === 3, `trend ${quiz.trend}`)
console.log("OK summarizeStudentQuiz")

assert(firstTryPercentForKp([
  { studentId: "a", attemptAt: 1, isCorrect: true },
  { studentId: "a", attemptAt: 2, isCorrect: false },
  { studentId: "b", attemptAt: 1, isCorrect: false },
], 2) === 50, "firstTry chi tinh attempt dau")
console.log("OK firstTryPercentForKp")

const overview = buildOverview({
  studentCount: 4,
  studentsWithActivity: 2,
  masteredAcrossAssigned: 6,
  assignedKpSlots: 12,
  quizPercents: [40, 80, 60],
  atRiskCount: 1,
  weeklyActivity: 7,
})
assert(overview.completionRate === 50, "completionRate")
assert(overview.masteryRate === 50, "masteryRate")
assert(overview.avgQuiz === 60, "avgQuiz")
assert(overview.medianQuiz === 60, "medianQuiz")
assert(overview.atRiskCount === 1, "atRiskCount")
assert(overview.weeklyActivity === 7, "weeklyActivity")
console.log("OK buildOverview")

const asg = buildAssignmentStat({
  assignmentId: "as1",
  lessonId: "l1",
  lessonTitle: "Bai 1",
  chapterTitle: "Chuong 1",
  dueAt: "2026-10-01T00:00:00Z",
  totalStudents: 4,
  studentOutcomes: [
    { status: "completed", completedAt: "2026-09-30T00:00:00Z", quizPercents: [90] },
    { status: "completed", completedAt: "2026-10-02T00:00:00Z", quizPercents: [40] },
    { status: "overdue", completedAt: null, quizPercents: [] },
    { status: "in_progress", completedAt: null, quizPercents: [] },
  ],
  weakKpIds: ["k1"],
})
assert(asg.completedCount === 2, "completedCount")
assert(asg.completionPercent === 50, "completionPercent")
assert(asg.onTimeCount === 1, "onTimeCount")
assert(asg.lateCount === 1, "lateCount")
assert(asg.overdueCount === 1, "overdueCount")
assert(asg.avgScore === 65, `avgScore ${asg.avgScore}`)
assert(asg.bestScore === 90, "bestScore")
assert(asg.distribution.find((d) => d.band === "80-100")?.count === 1, "dist 80-100")
assert(asg.distribution.find((d) => d.band === "20-50")?.count === 1, "dist 20-50")
assert(asg.weakKpIds[0] === "k1", "weakKpIds")
console.log("OK buildAssignmentStat")

const empty = emptyClassStats()
assert(empty.overview.atRiskCount === 0, "empty overview")
assert(Array.isArray(empty.assignments), "empty assignments")
console.log("OK emptyClassStats")

const types = readFileSync("types/index.ts", "utf8")
assert(types.includes("export interface ClassOverviewStats"), "thieu ClassOverviewStats")
assert(types.includes("export interface AssignmentStatRow"), "thieu AssignmentStatRow")
assert(types.includes("quizAvg?:"), "StudentStatRow thieu quizAvg")
assert(types.includes("firstTryPercent?:"), "KPStatRow thieu firstTryPercent")
assert(types.includes("hardFlag?:"), "KPStatRow thieu hardFlag")
assert(types.includes("overview: ClassOverviewStats"), "ClassStatsDto thieu overview")
assert(types.includes("assignments: AssignmentStatRow[]"), "ClassStatsDto thieu assignments")
console.log("OK types")

const action = readFileSync("app/actions/class-stats.ts", "utf8")
assert(action.includes("buildOverview"), "getClassStats khong dung buildOverview")
assert(action.includes("buildAssignmentStat"), "getClassStats khong dung buildAssignmentStat")
assert(action.includes("quizAnswers"), "thieu quizAnswers firstTry")
assert(action.includes("classAssignments"), "thieu classAssignments")
console.log("OK class-stats action")

const page = readFileSync("app/teacher/classes/[id]/page.tsx", "utf8")
assert(page.includes("emptyClassStats"), "page fallback khong dung emptyClassStats")
assert(!page.includes("students: [], knowledgePoints: []"), "page van fallback type cu")
console.log("OK page fallback")

console.log("OK phien 4")
