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
const grading = await import("../lib/grading.ts")

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

function term(text, slotIndex, extra = {}) {
  return {
    text,
    slotIndex,
    allowSwap: extra.allowSwap ?? true,
    swapGroupId: extra.swapGroupId ?? "g1",
    extraAccepted: extra.extraAccepted ?? [],
    synonyms: extra.synonyms,
  }
}

{
  assert(scoring.normalizeAnswer === grading.normalizeAnswer, "grading re-export normalizeAnswer")
  assert(scoring.gradeSlots === grading.gradeSlots, "grading re-export gradeSlots")
  assert(typeof grading.computeOverallStatus === "function", "computeOverallStatus stays in grading")
  assert(typeof grading.seededRng === "function", "seededRng stays in grading")
  assert(typeof grading.seededShuffle === "function", "seededShuffle stays in grading")
  assert(typeof grading.toAnswerMap === "function", "toAnswerMap stays in grading")
}

{
  const n = scoring.normalizeAnswer
  assertEq(n("5\u2019"), n("5'"), "5 RIGHT SINGLE QUOTE = 5'")
  assertEq(n("5\u2032"), n("5'"), "5 PRIME = 5'")
  assertEq(n("5\u02B9"), n("5'"), "5 MODIFIER LETTER PRIME = 5'")
  assertEq(n("5\u2018"), n("5'"), "5 LEFT SINGLE QUOTE = 5'")
  assertEq(n("5\u00B4"), n("5'"), "5 ACUTE = 5'")
  assertEq(n("5`"), n("5'"), "5 GRAVE = 5'")
  assertEq(n("tế  bào"), n("tế bào"), "double space")
  assertEq(n("tế\u00a0bào"), n("tế bào"), "NBSP")
  assertEq(n("ADN."), n("ADN"), "trailing punct")
  assert(n("nuclêôtit") !== n("nucleotit"), "khong bo dau TV")
  assert(n("0,5") !== n("0.5"), "normalize khong doi so")
  assertEq(n("A\u2013T"), n("a-t"), "en-dash -> hyphen")
}

{
  const a = term("đơn phân", 0, { synonyms: ["nucleotit"] })
  const b = term("nucleotit", 1)
  const terms = [a, b]
  const r1 = scoring.gradeSlots(terms, ["đơn phân", "nucleotit"])
  assert(r1.allCorrect, "synonyms thu tu 1 allCorrect")
  assert(r1.results.every((x) => x.isCorrect), "synonyms thu tu 1 moi o dung")
  const r2 = scoring.gradeSlots(terms, ["nucleotit", "đơn phân"])
  assert(r2.allCorrect, "synonyms thu tu 2 allCorrect")
  assert(r2.results.every((x) => x.isCorrect), "synonyms thu tu 2 moi o dung")
}

{
  const terms = [term("A", 0), term("T", 1)]
  const r = scoring.gradeSlots(terms, ["A", "A"])
  assert(!r.allCorrect, "dien trung 1 dap an 2 lan: allCorrect false")
  const okCount = r.results.filter((x) => x.isCorrect).length
  assertEq(okCount, 1, "dien trung: chi 1 o dung")
}

{
  const terms = [term("A", 0), term("T", 1), term("G", 2), term("X", 3)]
  const r = scoring.gradeSlots(terms, ["A", "T", "G", "sai"])
  assert(!r.allCorrect, "3 dung 1 sai: allCorrect false")
  assertEq(r.results[0].isCorrect, true, "slot 0 dung")
  assertEq(r.results[1].isCorrect, true, "slot 1 dung")
  assertEq(r.results[2].isCorrect, true, "slot 2 dung")
  assertEq(r.results[3].isCorrect, false, "chi o sai do")
  assertEq(r.results[3].correctAnswer, "X", "correctAnswer o sai = term chua ghep")
}

{
  const terms = [
    term("timin", 0, { swapGroupId: "g1" }),
    term("xitozin", 1, { swapGroupId: "g2" }),
  ]
  const r = scoring.gradeSlots(terms, ["xitozin", "timin"])
  assert(!r.allCorrect, "hai nhom rieng dao vi tri sai")
  assertEq(r.results[0].isCorrect, false, "timin slot sai")
  assertEq(r.results[1].isCorrect, false, "xitozin slot sai")
}

{
  assert(scoring.gradeSA("0,5", ["0.5"]), "0,5 = 0.5")
  assert(scoring.gradeSA("0.5", ["0,5"]), "0.5 = 0,5")
  assert(scoring.gradeSA("0.50", ["0.5"]), "0.50 = 0.5")
  assert(scoring.gradeSA("0,50", ["0.5"]), "0,50 = 0.5")
  assert(!scoring.gradeSA("1/2", ["0.5"]), "1/2 khac 0.5")
  assert(!scoring.gradeSA("0.5", ["1/2"]), "0.5 khac 1/2")
  assert(!scoring.gradeSA("1 500", ["1500"]), "1 500 khac 1500")
  assert(scoring.gradeSA("tế  bào", ["tế bào"]), "SA chuoi sau normalize")
  assert(scoring.gradeSA("5\u2019", ["5'"]), "SA 5' smart quote")
  assert(!scoring.gradeSA("nuclêôtit", ["nucleotit"]), "SA khong bo dau TV")
}

{
  assertEq(scoring.gradeMC("a", "a"), true, "gradeMC dung")
  assertEq(scoring.gradeMC("b", "a"), false, "gradeMC sai")
  assertEq(scoring.gradeMC(null, "a"), false, "gradeMC null")
  assertEq(scoring.gradeMC("", "a"), false, "gradeMC empty")
}

{
  const opts = [
    { id: "o1", isCorrect: true },
    { id: "o2", isCorrect: false },
    { id: "o3", isCorrect: true },
  ]
  const missing = scoring.gradeTF({ o1: "D", o2: "S" }, opts)
  assertEq(missing.perOption[2].answered, false, "TF thieu key answered=false")
  assertEq(missing.perOption[2].isCorrect, false, "TF thieu key isCorrect=false")
  assertEq(missing.correctCount, 2, "TF thieu khong ?? S")
  const bad = scoring.gradeTF({ o1: "D", o2: "X", o3: "S" }, opts)
  assertEq(bad.perOption[1].answered, false, "TF gia tri ngoai D/S answered=false")
  assertEq(bad.perOption[1].isCorrect, false, "TF gia tri ngoai D/S sai")
  assertEq(bad.perOption[2].isCorrect, false, "TF o3 S vs Dung = sai")
}

{
  const s = scoring.scoreLinear(1, 2)
  assertEq(s.score, 5, "scoreLinear 1/2 = 5")
  assertEq(s.percentage, 50, "percentage 50")
  const full = scoring.scoreLinear(28, 28)
  assertEq(full.score, 10, "28/28 = 10")
  assertEq(full.percentage, 100, "28/28 pct 100")
}

console.log("phien 3 OK")
