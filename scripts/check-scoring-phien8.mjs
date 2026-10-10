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

const scoring = await import("../lib/scoring.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}

function assertEq(actual, expected, label) {
  if (actual !== expected) fail(`${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
}

function tfAllCorrect(student, options) {
  const graded = scoring.gradeTF(student, options)
  return options.length > 0 && graded.perOption.every((p) => p.isCorrect)
}

{
  const options = [
    { id: "a", isCorrect: true, content: "y1" },
    { id: "b", isCorrect: false, content: "y2" },
    { id: "c", isCorrect: true, content: "y3" },
    { id: "d", isCorrect: false, content: "y4" },
  ]
  const studentOk = { a: "D", b: "S", c: "D", d: "S" }
  const liveOk = options.filter((o) => studentOk[o.id] === "D").map((o) => o.id).join(",")
  assertEq(tfAllCorrect(studentOk, options), true, "tab4 TF du y dung")
  assertEq(scoring.gradeLive({ type: "TF", answer: liveOk, options }), true, "live TF all-correct")
  assertEq(
    scoring.gradeLive({ type: "TF", answer: liveOk, options }),
    tfAllCorrect(studentOk, options),
    "gradeTF live vs tab4 cung input all-correct",
  )

  const studentMiss = { a: "D", b: "S", c: "D" }
  assertEq(tfAllCorrect(studentMiss, options), false, "tab4 TF thieu y = sai")

  const studentWrong = { a: "D", b: "D", c: "D", d: "S" }
  const liveWrong = options.filter((o) => studentWrong[o.id] === "D").map((o) => o.id).join(",")
  assertEq(tfAllCorrect(studentWrong, options), false, "tab4 TF 1 y sai")
  assertEq(
    scoring.gradeLive({ type: "TF", answer: liveWrong, options }),
    tfAllCorrect(studentWrong, options),
    "live vs tab4 1 y sai",
  )
}

{
  const opts = [
    { id: "s1", isCorrect: true, content: "0,5" },
    { id: "s2", isCorrect: false, content: "khac" },
  ]
  assertEq(scoring.gradeSA("0.5", ["0,5"]), true, "tab4 SA 0.5 = 0,5")
  assertEq(scoring.gradeLive({ type: "SA", answer: "0.5", options: opts }), true, "live SA 0.5 = 0,5")
  assertEq(scoring.gradeLive({ type: "SA", answer: "0.5", options: opts }), scoring.gradeSA("0.5", ["0,5"]), "live SA khop tab4")
  assertEq(scoring.gradeLive({ type: "SA", answer: "1/2", options: opts }), false, "live SA 1/2 != 0.5")
  assertEq(scoring.gradeSA("1/2", ["0,5"]), false, "tab4 SA 1/2 != 0.5")
}

{
  const mcOpts = [
    { id: "m1", isCorrect: false, content: "A" },
    { id: "m2", isCorrect: true, content: "B" },
    { id: "m3", isCorrect: false, content: "C" },
    { id: "m4", isCorrect: false, content: "D" },
  ]
  assertEq(scoring.gradeLive({ type: "MC", answer: "m2", options: mcOpts }), true, "live MC dung")
  assertEq(scoring.gradeLive({ type: "MC", answer: "m1", options: mcOpts }), false, "live MC sai")
  assertEq(scoring.gradeLive({ type: "MC", answer: "", options: mcOpts }), false, "live MC trong")
}

{
  assertEq(scoring.resolveFirstTry(null, "correct"), "correct", "firstTry lan dau dung")
  assertEq(scoring.resolveFirstTry(null, "incorrect"), "incorrect", "firstTry lan dau sai")
  assertEq(scoring.resolveFirstTry("incorrect", "correct"), "incorrect", "firstTry khong ghi de")
  assertEq(scoring.resolveFirstTry("correct", "incorrect"), "correct", "firstTry dung giu dung")
  assertEq(scoring.inferFirstTryFromHistory("incorrect", 1), "incorrect", "backfill incorrect")
  assertEq(scoring.inferFirstTryFromHistory("correct", 2), "incorrect", "backfill correct attempts>1")
  assertEq(scoring.inferFirstTryFromHistory("correct", 1), "correct", "backfill correct attempts=1")
  assertEq(scoring.inferFirstTryFromHistory(null, 0), null, "backfill chua cham")
}

{
  assertEq(
    scoring.isOverconfident({ selfAssessment: "known", fillFirstTry: "incorrect" }),
    true,
    "overconfident = known && firstTry incorrect",
  )
  assertEq(
    scoring.isOverconfident({ selfAssessment: "known", fillFirstTry: null, fillAttempts: 2 }),
    true,
    "overconfident fallback fillAttempts>1 khi firstTry null",
  )
  assertEq(
    scoring.isOverconfident({ selfAssessment: "known", fillFirstTry: "correct", fillAttempts: 5 }),
    false,
    "firstTry correct khong overconfident",
  )
  assertEq(
    scoring.isOverconfident({ selfAssessment: "unknown", fillFirstTry: "incorrect" }),
    false,
    "SA unknown khong overconfident",
  )
}

{
  const schema = readFileSync(resolve(root, "lib/db/schema.ts"), "utf8")
  if (!schema.includes('pgTable(\n  "live_answers"') && !schema.includes('pgTable(\n  "live_answers"')) {
    if (!schema.includes('"live_answers"')) fail("thieu bang live_answers trong schema")
  }
  if (!schema.includes("fillFirstTry")) fail("thieu fillFirstTry")
  if (!schema.includes("dragFirstTry")) fail("thieu dragFirstTry")
  if (!schema.includes('uuid("questionId").notNull()')) fail("live_answers.questionId khong FK")
}

{
  const ddl = readFileSync(resolve(root, "lib/db/index.ts"), "utf8")
  if (!ddl.includes("CREATE TABLE IF NOT EXISTS live_answers")) fail("ensureSchema thieu live_answers")
  if (!ddl.includes('"fillFirstTry"')) fail("ensureSchema thieu fillFirstTry")
  if (!ddl.includes('"dragFirstTry"')) fail("ensureSchema thieu dragFirstTry")
  if (!ddl.includes("AND \"fillAttempts\">1")) fail("thieu backfill fillFirstTry incorrect")
  if (!ddl.includes("AND \"dragAttempts\"=1")) fail("thieu backfill dragFirstTry correct")
}

{
  const live = readFileSync(resolve(root, "app/actions/live-quiz.ts"), "utf8")
  if (!live.includes("onConflictDoNothing")) fail("submitLiveAnswer thieu ON CONFLICT DO NOTHING")
  if (!live.includes("Bạn đã trả lời")) fail("thieu thong bao da tra loi")
  if (!live.includes("gradeLive")) fail("live chua cham bang scoring.gradeLive")
  if (!live.includes("nextQuestionRound")) fail("goToQuestion chua tang round")
  if (!live.includes("loadRoundAnswers")) fail("chua restore answers tu live_answers")
  if (live.includes("state.answers.clear()\n\n  const q")) fail("goToQuestion van xoa RAM ma khong load lai")
}

{
  const qs = readFileSync(resolve(root, "app/actions/questions.ts"), "utf8")
  if (!qs.includes("options.length !== 4")) fail("validateOptions chua ep MC/TF dung 4")
  if (!qs.includes("existingIds.has(o.id)")) fail("updateQuestion chua giu option id")
  if (qs.includes("await db.delete(questionOptions).where(eq(questionOptions.questionId, input.id))")) {
    fail("updateQuestion van delete-all insert-all")
  }
}

{
  const learn = readFileSync(resolve(root, "app/actions/student-learn.ts"), "utf8")
  if (!learn.includes("fillFirstTry")) fail("submitTab2 chua ghi fillFirstTry")
  if (!learn.includes("dragFirstTry")) fail("submitTab3 chua ghi dragFirstTry")
  if (!learn.includes("resolveFirstTry")) fail("thieu resolveFirstTry luc cham dau")
}

{
  const stats = readFileSync(resolve(root, "app/actions/class-stats.ts"), "utf8")
  if (!stats.includes("isOverconfident")) fail("class-stats chua dung isOverconfident")
  if (stats.includes('selfAssessment === "known" && r.fillStatus === "incorrect"')) {
    fail("class-stats van dung fillStatus incorrect cho overconfident")
  }
}

console.log("phien 8 OK")
