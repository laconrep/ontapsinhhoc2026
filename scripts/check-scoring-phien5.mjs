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

const slots = await import("../lib/slot-render.ts")
const parser = await import("../lib/worksheet-parser.ts")
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
    allowSwap: false,
    swapGroupId: null,
    extraAccepted: [],
    ...extra,
  }
}

{
  const raw = "Trong ADN, A liên kết với __T__ theo nguyên tắc."
  const { content, underlinedTerms } = parser.extractBlanks(raw)
  const parts = slots.renderClientSlots(content, underlinedTerms)
  const slotParts = parts.filter((p) => p.type === "slot")
  assertEq(slotParts.length, 1, "1 o trong")
  assertEq(slotParts[0].slotIndex, 0, "slotIndex 0")
  assert(!("term" in slotParts[0]), "client slot khong chua term")
  assert(!("text" in slotParts[0]), "client slot khong chua text")
  assert(
    parts.every((p) => p.type !== "text" || p.value !== "T"),
    "text parts khong bang dung dap an T",
  )
  const json = JSON.stringify(parts)
  assert(!/"text"\s*:\s*"T"/.test(json), "parts JSON khong chua terms[].text")
  assert(!json.includes("synonyms"), "parts khong chua synonyms")
}

{
  const terms = [
    term("timin", 0, { synonyms: ["T"], extraAccepted: ["Thy"] }),
    term("xitozin", 1),
  ]
  const pool = ["timin", "T", "Thy", "tê  bào", "guanin", "adenin", "xitozin", "C"]
  const rng = grading.seededRng("phien5-dist")
  const picked = slots.pickDistractors(pool, terms, rng, 3)
  const blocked = new Set(["timin", "t", "thy", "xitozin"])
  for (const d of picked) {
    const n = d.normalize("NFC").toLowerCase()
    assert(!blocked.has(n), `distractor khong trung dap an/syn: ${d}`)
  }
  const norms = picked.map((d) => d.toLowerCase())
  assertEq(new Set(norms).size, norms.length, "distractor khong trung nhau")
}

{
  const terms = [term("A", 0), term("T", 1)]
  const rng = grading.seededRng("phien5-chips")
  const chips = slots.buildDragChips("kp-1", terms, ["G"], rng)
  assertEq(chips.length, 3, "chip = terms + distractor")
  chips.forEach((c, i) => {
    assertEq(c.id, `kp-1:${i}`, `chip id = kpId:index tai ${i}`)
    assert(typeof c.text === "string" && c.text.length > 0, "chip co text")
  })
  const ids = new Set(chips.map((c) => c.id))
  assertEq(ids.size, chips.length, "chip id unique")
}

{
  const results = [
    { slotIndex: 0, isCorrect: false, correctAnswer: "timin" },
    { slotIndex: 1, isCorrect: true, correctAnswer: "xitozin" },
  ]
  const t1 = slots.stripFillResults(results, 1, false)
  assertEq(t1.stripped[0].isCorrect, false, "fill lan 1 o sai isCorrect false")
  assertEq(t1.stripped[0].hint, "t", "fill lan 1 hint chu dau")
  assertEq(t1.stripped[0].correctAnswer, undefined, "fill lan 1 khong lo dap an")
  assertEq(t1.stripped[1].correctAnswer, undefined, "o dung khong lo dap an")
  assertEq(t1.revealed, false, "fill lan 1 chua revealed")

  const t2 = slots.stripFillResults(results, 2, false)
  assertEq(t2.stripped[0].hint, "t", "fill lan 2 van hint")
  assertEq(t2.stripped[0].correctAnswer, undefined, "fill lan 2 chua lo dap an")

  const t3 = slots.stripFillResults(results, 3, false)
  assertEq(t3.stripped[0].correctAnswer, "timin", "fill lan 3 lo dap an")
  assertEq(t3.stripped[0].hint, undefined, "fill lan 3 khong can hint")
  assertEq(t3.revealed, true, "fill lan 3 revealed")

  const ok = slots.stripFillResults(results, 3, true)
  assertEq(ok.stripped[0].correctAnswer, undefined, "allCorrect khong lo dap an")
  assertEq(ok.revealed, false, "allCorrect khong set revealed")
}

{
  const results = [{ slotIndex: 0, isCorrect: false, correctAnswer: "adenin" }]
  const d1 = slots.stripDragResults(results, 1, false)
  assertEq(d1.stripped[0].isCorrect, false, "drag lan 1 chi dung/sai")
  assertEq(d1.stripped[0].correctAnswer, undefined, "drag lan 1 khong lo dap an")
  assertEq(d1.stripped[0].hint, undefined, "drag khong hint chu dau")
  assertEq(d1.revealed, false, "drag lan 1 chua revealed")

  const d2 = slots.stripDragResults(results, 2, false)
  assertEq(d2.stripped[0].correctAnswer, "adenin", "drag lan 2 lo dap an")
  assertEq(d2.revealed, true, "drag lan 2 revealed")
}

console.log("phien 5 OK")
