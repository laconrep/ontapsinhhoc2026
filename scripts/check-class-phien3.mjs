import { readFileSync } from "node:fs"
import { deriveStudentAssignmentStatus } from "../lib/assignment-status.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const now = new Date("2026-10-03T00:00:00Z")
assert(
  deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 0, hasCompletedQuiz: false, dueAt: null, now }) ===
    "not_started",
  "progress 0 -> not_started",
)
assert(
  deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 1, hasCompletedQuiz: true, dueAt: null, now }) ===
    "completed",
  "co attempt completed -> completed",
)
assert(
  deriveStudentAssignmentStatus({
    totalKp: 4,
    touchedKp: 1,
    hasCompletedQuiz: false,
    dueAt: new Date("2026-09-01T00:00:00Z"),
    now,
  }) === "overdue",
  "dueAt qua khu + chua xong -> overdue",
)
assert(
  deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 2, hasCompletedQuiz: false, dueAt: null, now }) ===
    "in_progress",
  "cham KP -> in_progress",
)
console.log("OK deriveStudentAssignmentStatus")

const accordion = readFileSync("components/student/lesson-accordion.tsx", "utf8")
assert(accordion.includes("assignmentByLessonId"), "accordion thieu prop assignmentByLessonId")
assert(accordion.includes("Được giao"), "accordion thieu badge Duoc giao")
assert(accordion.includes("assignmentStatusMeta"), "accordion thieu status badge")
assert(accordion.includes("formatDueAt"), "accordion thieu han")
assert(/assigned/.test(accordion) && /rest/.test(accordion), "accordion khong sap bai giao len dau")
console.log("OK lesson-accordion")

const learn = readFileSync("app/student/learn/page.tsx", "utf8")
assert(learn.includes("getAssignedLessonsForStudent"), "learn page khong goi getAssignedLessonsForStudent")
assert(learn.includes("assignmentByLessonId"), "learn page khong build map")
assert(learn.includes("LessonAccordion"), "learn page mat LessonAccordion")
console.log("OK learn page")

const home = readFileSync("app/student/page.tsx", "utf8")
assert(home.includes("getAssignedLessonsForStudent"), "home khong goi getAssignedLessonsForStudent")
assert(home.includes("AssignedWork"), "home thieu AssignedWork")
assert(home.includes("<AssignedWork"), "home khong render AssignedWork")
console.log("OK student home")

const work = readFileSync("components/student/assigned-work.tsx", "utf8")
assert(work.includes("Bài cần làm"), "thieu tieu de Bai can lam")
assert(work.includes("/student/learn/"), "thieu link toi lesson")
assert(work.includes("not_started"), "thieu loc not_started")
assert(work.includes("in_progress"), "thieu loc in_progress")
assert(work.includes("overdue"), "thieu loc overdue")
assert(work.includes("bg-muted"), "thieu badge xam")
assert(work.includes("bg-primary/15"), "thieu badge xanh")
assert(work.includes("bg-amber-500/15"), "thieu badge vang")
assert(work.includes("bg-destructive/15"), "thieu badge do")
assert(work.includes("STATUS_RANK"), "thieu uu tien qua han")
console.log("OK assigned-work")

console.log("OK phien 3")
