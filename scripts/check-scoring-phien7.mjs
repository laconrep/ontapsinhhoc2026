import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

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

const grading = await import("../lib/grading.ts")
const scoring = await import("../lib/scoring.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}

function assertEq(actual, expected, label) {
  if (actual !== expected) fail(`${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
}

function resetOverallStatus(selfAssessment) {
  if (selfAssessment === "known") return "known"
  if (selfAssessment === "unknown") return "unknown"
  return "not_started"
}

{
  assertEq(resetOverallStatus("known"), "known", "reset SA known -> overall known")
  assertEq(resetOverallStatus("unknown"), "unknown", "reset SA unknown -> overall unknown")
  assertEq(resetOverallStatus(null), "not_started", "reset SA null -> not_started")
  assertEq(resetOverallStatus(undefined), "not_started", "reset SA undefined -> not_started")
}

{
  const known = grading.computeOverallStatus({
    selfAssessment: "known",
    fillStatus: null,
    dragStatus: null,
  })
  assertEq(known, "known", "sau reset fill/drag null, SA known khong not_started")

  const unknown = grading.computeOverallStatus({
    selfAssessment: "unknown",
    fillStatus: null,
    dragStatus: null,
  })
  assertEq(unknown, "unknown", "sau reset fill/drag null, SA unknown khong not_started")

  const none = grading.computeOverallStatus({
    selfAssessment: null,
    fillStatus: null,
    dragStatus: null,
  })
  assertEq(none, "not_started", "SA null -> not_started")
}

{
  const full = scoring.scoreLinear(28, 28)
  assertEq(full.score, 10, "scoreLinear 28/28 = 10")
  const capped = scoring.scoreLinear(29, 28)
  assertEq(capped.score, 10, "score cap 10 khi correctSlots > totalSlots")
  assertEq(capped.percentage, 100, "percentage cap 100")
  const minned = scoring.scoreLinear(Math.min(40, 28), 28)
  assertEq(minned.score, 10, "min(correct, total) roi scoreLinear van 10")
}

{
  const learn = readFileSync(resolve(root, "app/actions/student-learn.ts"), "utf8")
  if (learn.includes("const totalSlots = attempt.totalSlots")) {
    fail("submitQuiz dung attempt.totalSlots (bien khong ton tai; phai openAttempt)")
  }
  if (!learn.includes("const totalSlots = openAttempt.totalSlots")) {
    fail("submitQuiz phai dung openAttempt.totalSlots")
  }
  if (!learn.includes(".for(\"update\")")) fail("thieu select for update")
  if (!learn.includes("onConflictDoNothing")) fail("thieu onConflictDoNothing Tab1/2/3")
  if (!learn.includes("onConflictDoUpdate")) fail("thieu onConflictDoUpdate Tab1 progress")
  if (!learn.includes("Bài kiểm tra đã nộp")) fail("thieu khoa nop quiz")
  if (!learn.includes("startedAt} > ${submission.submittedAt}")) fail("thieu reuse attempt sau submittedAt")
  if (!learn.includes("WHEN ${studentProgress.selfAssessment} = 'known' THEN 'known'")) {
    fail("thieu CASE overallStatus khi reset")
  }
}

{
  const schema = readFileSync(resolve(root, "lib/db/schema.ts"), "utf8")
  if (!schema.includes("s1_student_lesson_unique")) fail("thieu unique tab1")
  if (!schema.includes("quiz_answers_mc_sa_uidx")) fail("thieu unique quiz_answers MC/SA")
  if (!schema.includes("quiz_answers_tf_uidx")) fail("thieu unique quiz_answers TF")
}

{
  const ddl = readFileSync(resolve(root, "lib/db/index.ts"), "utf8")
  if (!ddl.includes("s1_student_lesson_unique")) fail("ensureSchema thieu unique tab1")
  if (!ddl.includes("quiz_answers_mc_sa_uidx")) fail("ensureSchema thieu unique MC/SA")
  if (!ddl.includes("quiz_answers_tf_uidx")) fail("ensureSchema thieu unique TF")
}

console.log("phien 7 OK")
