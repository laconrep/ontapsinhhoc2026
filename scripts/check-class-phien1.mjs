import { readFileSync } from "node:fs"
import { deriveStudentAssignmentStatus } from "../lib/assignment-status.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const schema = readFileSync("lib/db/schema.ts", "utf8")
assert(/export const classAssignments = pgTable\(/.test(schema), "thieu classAssignments")
assert(schema.includes("ca_class_idx"), "thieu index ca_class_idx")
assert(schema.includes("ca_class_lesson_unique"), "thieu unique ca_class_lesson_unique")
console.log("OK schema classAssignments")

const dbIndex = readFileSync("lib/db/index.ts", "utf8")
assert(/CREATE TABLE IF NOT EXISTS "class_assignments"/.test(dbIndex), "thieu CREATE TABLE class_assignments")
assert(/CONSTRAINT "ca_class_lesson_unique" UNIQUE \("classId", "lessonId"\)/.test(dbIndex), "thieu unique DDL")
assert(/CREATE INDEX IF NOT EXISTS "ca_class_idx"/.test(dbIndex), "thieu index DDL")
assert(/ALTER TABLE questions ADD COLUMN IF NOT EXISTS "bodyHtml"/.test(dbIndex), "mat ALTER bodyHtml questions")
assert(/ALTER TABLE question_options ADD COLUMN IF NOT EXISTS "bodyHtml"/.test(dbIndex), "mat ALTER bodyHtml options")
console.log("OK ensureSchema DDL")

const types = readFileSync("types/index.ts", "utf8")
assert(/export interface ClassAssignmentDto/.test(types), "thieu ClassAssignmentDto")
assert(/export interface AssignedLessonDto/.test(types), "thieu AssignedLessonDto")
assert(/studentStatus: "not_started" \| "in_progress" \| "completed" \| "overdue"/.test(types), "thieu studentStatus")
console.log("OK types")

const actions = readFileSync("app/actions/assignments.ts", "utf8")
for (const name of [
  "assignLessons",
  "getClassAssignments",
  "updateAssignment",
  "removeAssignment",
  "getAssignedLessonsForStudent",
]) {
  assert(actions.includes(`export async function ${name}`), `thieu ${name}`)
}
assert(actions.includes("onConflictDoNothing"), "thieu onConflictDoNothing")
assert(actions.includes("deriveStudentAssignmentStatus"), "action khong dung helper status")
console.log("OK action exports")

const now = new Date("2026-10-02T00:00:00Z")
assert(deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 4, hasCompletedQuiz: false, dueAt: null, now }) === "completed", "4/4 phai completed")
assert(deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 1, hasCompletedQuiz: true, dueAt: null, now }) === "completed", "quiz xong phai completed")
assert(
  deriveStudentAssignmentStatus({
    totalKp: 4,
    touchedKp: 1,
    hasCompletedQuiz: false,
    dueAt: new Date("2026-09-01T00:00:00Z"),
    now,
  }) === "overdue",
  "qua han phai overdue",
)
assert(deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 1, hasCompletedQuiz: false, dueAt: null, now }) === "in_progress", "cham KP phai in_progress")
assert(deriveStudentAssignmentStatus({ totalKp: 4, touchedKp: 0, hasCompletedQuiz: false, dueAt: null, now }) === "not_started", "0 KP phai not_started")
console.log("OK deriveStudentAssignmentStatus")

console.log("OK phien 1")
