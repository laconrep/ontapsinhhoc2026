import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rootUrl = pathToFileURL(root.endsWith("/") ? root : root + "/").href

const loader = `
export async function resolve(specifier, context, nextResolve) {
  let spec = specifier
  if (spec.startsWith("@/")) spec = ${JSON.stringify(rootUrl)} + spec.slice(2)
  try {
    return await nextResolve(spec, context)
  } catch (err) {
    if (typeof spec === "string" && !spec.endsWith(".ts") && (spec.startsWith(".") || spec.startsWith("file:"))) {
      return nextResolve(spec + ".ts", context)
    }
    throw err
  }
}
`

register("data:text/javascript," + encodeURIComponent(loader), import.meta.url)

const status = await import("../lib/assignment-status.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}

function assertEq(actual, expected, label) {
  if (actual !== expected) fail(`${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
}

function assert(cond, msg) {
  if (!cond) fail(msg)
}

const now = new Date("2026-10-10T12:00:00Z")
const dueFuture = new Date("2026-10-11T12:00:00Z")
const duePast = new Date("2026-10-09T12:00:00Z")

{
  const s = status.deriveStudentAssignmentStatus({
    hasCompletedQuiz: false,
    hasTab1Submission: false,
    dueAt: dueFuture,
    now,
  })
  assertEq(s, "not_started", "chua tab1 -> not_started")
}

{
  const s = status.deriveStudentAssignmentStatus({
    hasCompletedQuiz: false,
    hasTab1Submission: true,
    dueAt: dueFuture,
    now,
  })
  assertEq(s, "in_progress", "chi tab1 -> in_progress")
}

{
  const s = status.deriveStudentAssignmentStatus({
    hasCompletedQuiz: true,
    hasTab1Submission: true,
    dueAt: dueFuture,
    now,
  })
  assertEq(s, "completed", "quiz sau submittedAt -> completed")
}

{
  const s = status.deriveStudentAssignmentStatus({
    hasCompletedQuiz: true,
    hasTab1Submission: true,
    dueAt: duePast,
    now,
  })
  assertEq(s, "completed", "completed uu tien hon overdue")
}

{
  const s = status.deriveStudentAssignmentStatus({
    hasCompletedQuiz: false,
    hasTab1Submission: false,
    dueAt: duePast,
    now,
  })
  assertEq(s, "overdue", "het han chua tab1 -> overdue")
}

{
  const s = status.deriveStudentAssignmentStatus({
    hasCompletedQuiz: false,
    hasTab1Submission: true,
    dueAt: duePast,
    now,
  })
  assertEq(s, "overdue", "het han da tab1 chua quiz -> overdue")
}

{
  assertEq(status.assignmentProgressPercent({ hasTab1Submission: false, hasCompletedQuiz: false }), 0, "progress 0")
  assertEq(status.assignmentProgressPercent({ hasTab1Submission: true, hasCompletedQuiz: false }), 50, "progress tab1 50")
  assertEq(status.assignmentProgressPercent({ hasTab1Submission: true, hasCompletedQuiz: true }), 100, "progress quiz 100")
}

{
  const submittedAt = new Date("2026-10-01T00:00:00Z")
  const quizAfter = new Date("2026-10-02T00:00:00Z")
  const quizBefore = new Date("2026-09-30T00:00:00Z")
  assert(status.quizCompletedAfterTab1(quizAfter, submittedAt), "quiz sau tab1")
  assert(!status.quizCompletedAfterTab1(quizBefore, submittedAt), "quiz truoc tab1 khong tinh")
  assert(!status.quizCompletedAfterTab1(null, submittedAt), "quiz chua nop")
  assert(!status.quizCompletedAfterTab1(quizAfter, null), "chua tab1")
}

console.log("phien 6 OK")
