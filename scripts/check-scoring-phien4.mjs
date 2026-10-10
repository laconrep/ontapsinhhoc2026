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

const scoring = await import("../lib/scoring.ts")

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

{
  const full = scoring.scoreLinear(28, 28)
  assertEq(full.score, 10, "scoreLinear 28/28 = 10")
  assertEq(full.percentage, 100, "scoreLinear 28/28 pct 100")
}

{
  const capped = scoring.scoreLinear(29, 28)
  assertEq(capped.score, 10, "29 slot dung van cap 10")
  assert(capped.percentage <= 100, "percentage khong vuot 100")
  assertEq(capped.percentage, 100, "29/28 pct cap 100")
}

{
  const zero = scoring.scoreLinear(0, 28)
  assertEq(zero.score, 0, "0/28 = 0")
  assertEq(zero.percentage, 0, "0/28 pct 0")
}

{
  const opts = [
    { id: "o1", isCorrect: true },
    { id: "o2", isCorrect: false },
    { id: "o3", isCorrect: false },
  ]
  const missing = scoring.gradeTF({}, opts)
  assertEq(missing.correctCount, 0, "TF bo trong 0 diem")
  assert(missing.perOption.every((p) => p.answered === false), "TF bo trong answered=false")
  assert(missing.perOption.every((p) => p.isCorrect === false), "TF bo trong isCorrect=false")

  const onlySaiDefaultWouldPass = scoring.gradeTF({}, [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: false },
  ])
  assertEq(onlySaiDefaultWouldPass.correctCount, 0, "TF 2 y sai, thieu y khong duoc diem (bo ?? S)")
  assertEq(onlySaiDefaultWouldPass.perOption[0].isCorrect, false, "y 1 thieu = sai")
  assertEq(onlySaiDefaultWouldPass.perOption[1].isCorrect, false, "y 2 thieu = sai")

  const partial = scoring.gradeTF({ a: "S" }, [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: false },
  ])
  assertEq(partial.perOption[0].isCorrect, true, "y da chon S dung")
  assertEq(partial.perOption[1].answered, false, "y thieu answered=false")
  assertEq(partial.perOption[1].isCorrect, false, "y thieu isCorrect=false")
  assertEq(partial.correctCount, 1, "chi y da chon duoc diem")
}

{
  assertEq(scoring.gradeMC("opt-a", "opt-a"), true, "gradeMC dung")
  assertEq(scoring.gradeMC("extra-id", "opt-a"), false, "gradeMC id ngoai de sai")
  assertEq(scoring.gradeMC(null, "opt-a"), false, "gradeMC trong")
  assert(scoring.gradeSA("0,5", ["0.5"]), "gradeSA 0,5")
}

{
  const paperIds = new Set(["q1", "q2"])
  const extra = ["q1", "q-ngoai"]
  const kept = extra.filter((id) => paperIds.has(id))
  assertEq(kept.join(","), "q1", "cau ngoai de bo qua")
}

{
  const correctSlots = Math.min(30, 28)
  const { score } = scoring.scoreLinear(correctSlots, 28)
  assertEq(score, 10, "min(correctSlots,totalSlots) roi scoreLinear cap 10")
}

console.log("phien 4 OK")
