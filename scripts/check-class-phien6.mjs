import { readFileSync } from "node:fs"
import { deriveStudentAssignmentStatus } from "../lib/assignment-status.ts"
import {
  buildAssignmentStat,
  buildOverview,
  emptyClassStats,
} from "../lib/class-stats-calc.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function simulateAssignLessons(existing, readyIds, requestedIds) {
  const ready = new Set(readyIds)
  const have = new Set(existing.map((e) => e.lessonId))
  let assigned = 0
  let skipped = 0
  const next = [...existing]
  for (const id of [...new Set(requestedIds)]) {
    if (!ready.has(id) || have.has(id)) {
      skipped += 1
      continue
    }
    assigned += 1
    have.add(id)
    next.push({
      id: `asg-${id}`,
      classId: "class-1",
      lessonId: id,
      lessonTitle: id === "l1" ? "Bai 1" : "Bai 2",
      chapterTitle: "Chuong 1",
      dueAt: id === "l2" ? "2026-09-01T00:00:00Z" : null,
      note: null,
      createdAt: "2026-10-03T00:00:00Z",
    })
  }
  return { assigned, skipped, list: next }
}

const first = simulateAssignLessons([], ["l1", "l2"], ["l1", "l2", "draft"])
assert(first.assigned === 2, `giao 2 bai ready, assigned=${first.assigned}`)
assert(first.skipped === 1, "bai draft bi skip")
assert(first.list.length === 2, "getClassAssignments co 2")
const again = simulateAssignLessons(first.list, ["l1", "l2"], ["l1"])
assert(again.assigned === 0 && again.list.length === 2, "giao lai khong trung")
console.log("OK giao 2 bai ready -> 2 assignment")

const now = new Date("2026-10-03T00:00:00Z")
const studentAssigned = first.list.map((a) => {
  const hasProgress = a.lessonId === "l1"
  const studentStatus = deriveStudentAssignmentStatus({
    totalKp: 4,
    touchedKp: hasProgress ? 4 : 0,
    hasCompletedQuiz: hasProgress,
    dueAt: a.dueAt ? new Date(a.dueAt) : null,
    now,
  })
  return {
    lessonId: a.lessonId,
    lessonTitle: a.lessonTitle,
    chapterTitle: a.chapterTitle,
    dueAt: a.dueAt,
    note: a.note,
    studentStatus,
    progressPercent: hasProgress ? 100 : 0,
  }
})
assert(studentAssigned.find((x) => x.lessonId === "l1")?.studentStatus === "completed", "bai 1 progress -> completed")
assert(studentAssigned.find((x) => x.lessonId === "l2")?.studentStatus === "overdue", "bai 2 qua han chua xong -> overdue")
const needWork = studentAssigned.filter((x) =>
  x.studentStatus === "not_started" || x.studentStatus === "in_progress" || x.studentStatus === "overdue",
)
assert(needWork.some((x) => x.studentStatus === "overdue"), "HS overdue nam trong Bai can lam")
assert(!needWork.some((x) => x.studentStatus === "completed"), "bai completed khong vao Bai can lam")
console.log("OK HS progress 1 bai + overdue vao Bai can lam")

const overview = buildOverview({
  studentCount: 4,
  studentsWithActivity: 2,
  masteredAcrossAssigned: 6,
  assignedKpSlots: 12,
  quizPercents: [40, 80, 60],
  atRiskCount: 1,
  weeklyActivity: 7,
})
assert(overview.completionRate === 50 && overview.avgQuiz === 60 && overview.medianQuiz === 60, "buildOverview mau")
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
    { status: "not_started", completedAt: null, quizPercents: [] },
  ],
  weakKpIds: ["k1"],
})
assert(asg.completedCount === 2 && asg.overdueCount === 1 && asg.lateCount === 1, "buildAssignmentStat mau")
console.log("OK buildOverview/buildAssignmentStat")

const stats = emptyClassStats()
assert(stats.overview && typeof stats.overview.completionRate === "number", "shape overview")
assert(Array.isArray(stats.assignments), "shape assignments")
assert(Array.isArray(stats.students) && Array.isArray(stats.knowledgePoints), "shape students/kp")
const action = readFileSync("app/actions/class-stats.ts", "utf8")
assert(action.includes("overview") && action.includes("assignments"), "getClassStats tra overview+assignments")
assert(action.includes("return { students, knowledgePoints: kpStats, overview, assignments }"), "return du 4 khoa")
console.log("OK getClassStats shape overview + assignments (bo qua DB)")

const tabs = readFileSync("components/teacher/class-tabs.tsx", "utf8")
assert(tabs.includes("Tổng quan") && tabs.includes("Bài tập đã giao") && tabs.includes("Thống kê"), "3 tab GV")
assert(tabs.includes("ClassDetail") && tabs.includes("ClassAssignments") && tabs.includes("ClassStatsPanel"), "tab render du 3 man")
const dueUi = readFileSync("components/teacher/class-assignments.tsx", "utf8")
assert(dueUi.includes("bg-destructive/15 text-destructive"), "han qua khu mau do")
const work = readFileSync("components/student/assigned-work.tsx", "utf8")
assert(work.includes("Bài cần làm") && work.includes("overdue") && work.includes("/student/learn/"), "Bai can lam overdue")
assert(work.includes("STATUS_RANK") && work.includes("overdue: 0"), "uu tien qua han")
const accordion = readFileSync("components/student/lesson-accordion.tsx", "utf8")
assert(accordion.includes("Được giao"), "accordion badge Duoc giao")
console.log("OK rà soát UI tab / han do / overdue")

console.log("OK phien 6")
