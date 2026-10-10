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

const { extractBlanks } = await import("../lib/worksheet-parser.ts")
const { renderMarkedContent } = await import("../lib/kp-render.ts")
const { renderSlots } = await import("../lib/slot-render.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}

function viz(content, terms) {
  return renderSlots(content, terms)
    .map((p) => (p.type === "text" ? p.value : `[[${p.term.text}]]`))
    .join("")
}

function assertEq(actual, expected, label) {
  if (actual !== expected) fail(`${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
}

function assert(cond, msg) {
  if (!cond) fail(msg)
}

function checkInvariant(content, terms, label) {
  for (const t of terms) {
    assert(typeof t.start === "number" && typeof t.end === "number", `${label}: missing start/end for ${t.text}`)
    assert(
      content.slice(t.start, t.end) === t.text,
      `${label}: invariant fail slot ${t.slotIndex} ${JSON.stringify(t.text)} at ${t.start}:${t.end}`,
    )
  }
}

function roundtrip(raw, label) {
  const { content, underlinedTerms: t } = extractBlanks(raw)
  const marked = renderMarkedContent(content, t)
  const again = extractBlanks(marked)
  assertEq(again.content, content, `${label} roundtrip content`)
  assertEq(again.underlinedTerms.length, t.length, `${label} roundtrip term count`)
  for (let i = 0; i < t.length; i++) {
    const a = t[i]
    const b = again.underlinedTerms[i]
    assertEq(b.text, a.text, `${label} term[${i}].text`)
    assertEq(b.slotIndex, a.slotIndex, `${label} term[${i}].slotIndex`)
    assertEq(b.allowSwap, a.allowSwap, `${label} term[${i}].allowSwap`)
    assertEq(JSON.stringify(b.synonyms ?? []), JSON.stringify(a.synonyms ?? []), `${label} term[${i}].synonyms`)
    assertEq(b.start, a.start, `${label} term[${i}].start`)
    assertEq(b.end, a.end, `${label} term[${i}].end`)
  }
}

{
  const raw = "Trong ADN, A liên kết với __T__ bằng 2 liên kết hydro."
  const { content, underlinedTerms } = extractBlanks(raw)
  checkInvariant(content, underlinedTerms, "T")
  assertEq(underlinedTerms.length, 1, "T term count")
  assertEq(underlinedTerms[0].text, "T", "T text")
  assertEq(viz(content, underlinedTerms), "Trong ADN, A liên kết với [[T]] bằng 2 liên kết hydro.", "T viz")
  assert(!viz(content, underlinedTerms).startsWith("[[T]]"), "T must not eat Trong")
  roundtrip(raw, "T")
}

{
  const raw = "Mạch ADN gồm các nucleotit; chuỗi __nucleotit__ liên kết."
  const { content, underlinedTerms } = extractBlanks(raw)
  checkInvariant(content, underlinedTerms, "nucleotit")
  assertEq(viz(content, underlinedTerms), "Mạch ADN gồm các nucleotit; chuỗi [[nucleotit]] liên kết.", "nucleotit viz")
  roundtrip(raw, "nucleotit")
}

{
  const raw = "Enzim ADN polimeraza bắt đầu; ADN gồm hai mạch, __ADN__ có cấu trúc xoắn kép."
  const { content, underlinedTerms } = extractBlanks(raw)
  checkInvariant(content, underlinedTerms, "ADN")
  assertEq(
    viz(content, underlinedTerms),
    "Enzim ADN polimeraza bắt đầu; ADN gồm hai mạch, [[ADN]] có cấu trúc xoắn kép.",
    "ADN viz",
  )
  roundtrip(raw, "ADN")
}

{
  const raw = "  Trong ADN, A liên kết với __T__ bằng 2 liên kết hydro."
  const { content, underlinedTerms } = extractBlanks(raw)
  assertEq(content, content.trim(), "lead trim")
  assert(!content.startsWith(" "), "no leading space after trim")
  checkInvariant(content, underlinedTerms, "lead space")
  assertEq(viz(content, underlinedTerms), "Trong ADN, A liên kết với [[T]] bằng 2 liên kết hydro.", "lead space viz")
  roundtrip(raw, "lead space")
}

{
  const raw = '__"timin"__ và __nucleotit|đơn phân__'
  const { content, underlinedTerms } = extractBlanks(raw)
  checkInvariant(content, underlinedTerms, "syn+swap")
  assert(underlinedTerms[0].allowSwap, "swap flag")
  assertEq(underlinedTerms[1].synonyms?.join(","), "đơn phân", "synonyms")
  roundtrip(raw, "syn+swap")
}

{
  const content = "Trong ADN, A liên kết với T bằng 2 liên kết hydro."
  const terms = [{ text: "T", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  const v = viz(content, terms)
  assert(v.startsWith("[[T]]"), "legacy without offset uses first T")
}

console.log("phien 1 OK")
