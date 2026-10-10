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

const { extractBlanks, unusedPlainQuotes, validateDocument, uncappedSwapRunLengths } = await import(
  "../lib/worksheet-parser.ts"
)
const { renderMarkedContent } = await import("../lib/kp-render.ts")
const { assignOffsetsByWordBoundary, findWordBoundaryOccurrences } = await import("./backfill-term-offsets.mjs")

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
    assertEq(a.swapGroupId, b.swapGroupId, `${label} term[${i}].swapGroupId`)
    assertEq(JSON.stringify(b.synonyms ?? []), JSON.stringify(a.synonyms ?? []), `${label} term[${i}].synonyms`)
    assertEq(b.start, a.start, `${label} term[${i}].start`)
    assertEq(b.end, a.end, `${label} term[${i}].end`)
  }
}

{
  const raw = 'Bazơ __"timin"__ bổ sung với bazơ __"xitozin"__.'
  const { content, underlinedTerms } = extractBlanks(raw)
  checkInvariant(content, underlinedTerms, "timin/xitozin")
  assertEq(underlinedTerms.length, 2, "timin/xitozin count")
  assert(underlinedTerms[0].allowSwap, "timin allowSwap")
  assert(underlinedTerms[1].allowSwap, "xitozin allowSwap")
  assertEq(underlinedTerms[0].swapGroupId, null, "timin group (1 member -> null)")
  assertEq(underlinedTerms[1].swapGroupId, null, "xitozin group (1 member -> null)")
  assert(underlinedTerms[0].swapGroupId === underlinedTerms[1].swapGroupId, "both null after collapse")
  roundtrip(raw, "timin/xitozin")
}

{
  const raw = '__"A"__, __"T"__, __"G"__ va __"X"__'
  const { content, underlinedTerms } = extractBlanks(raw)
  checkInvariant(content, underlinedTerms, "ATGX")
  assertEq(underlinedTerms.length, 4, "ATGX count")
  assert(
    underlinedTerms.every((t) => t.allowSwap && t.swapGroupId === underlinedTerms[0].swapGroupId && t.swapGroupId != null),
    `ATGX one group got ${underlinedTerms.map((t) => t.swapGroupId).join(",")}`,
  )
  roundtrip(raw, "ATGX")
}

{
  const raw = 'ADN "nhan doi" trong nhan'
  const { content, underlinedTerms } = extractBlanks(raw)
  assertEq(underlinedTerms.length, 0, '"nhan doi" khong tao term')
  assert(content.includes('"nhan doi"'), "quote thuong giu nguyen trong content")
  const unused = unusedPlainQuotes(raw)
  assert(unused.length >= 1, "unusedPlainQuotes bat nhan doi")
  roundtrip(raw, "plain quote")
}

{
  const raw = 'ADN __"nhan doi"__ trong nhan'
  const { content, underlinedTerms } = extractBlanks(raw)
  assertEq(underlinedTerms.length, 1, '__"nhan doi"__ tao 1 term')
  assertEq(underlinedTerms[0].text, "nhan doi", "nhan doi text")
  assert(underlinedTerms[0].allowSwap, "nhan doi allowSwap")
  assertEq(underlinedTerms[0].swapGroupId, null, "nhan doi 1 member")
  assert(!content.includes('"nhan doi"'), "delimiter quote bi strip")
  roundtrip(raw, "wrapped quote")
}

{
  const letters = Array.from({ length: 9 }, (_, i) => `__"${String.fromCharCode(65 + i)}"__`).join(", ")
  const { content, underlinedTerms } = extractBlanks(letters)
  const sizes = new Map()
  for (const t of underlinedTerms) {
    if (!t.swapGroupId) continue
    sizes.set(t.swapGroupId, (sizes.get(t.swapGroupId) ?? 0) + 1)
  }
  assert(
    [...sizes.values()].every((n) => n <= 8),
    `group size cap: ${[...sizes.entries()].join(";")}`,
  )
  const runs = uncappedSwapRunLengths(content, underlinedTerms)
  assert(runs.some((n) => n > 8), `uncapped run ${JSON.stringify(runs)}`)
  const val = validateDocument({
    chapters: [
      {
        title: "C",
        line: 1,
        lessons: [
          {
            title: "B",
            line: 2,
            knowledgePoints: [{ content, underlinedTerms, questions: [], line: 3 }],
          },
        ],
      },
    ],
    errors: [],
  })
  assert(
    val.errors.some((e) => /Nhóm hoán đổi có 9 ô/.test(e.message ?? "")),
    `validate 9 o: ${JSON.stringify(val.errors)}`,
  )
}

{
  const content = "Trong ADN, A liên kết với T bằng 2 liên kết hydro."
  const hits = findWordBoundaryOccurrences(content, "T")
  assertEq(hits.length, 1, "T boundary khong an Trong")
  assertEq(content.slice(hits[0].start, hits[0].end), "T", "T hit text")
  const terms = [
    { text: "T", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] },
  ]
  const result = assignOffsetsByWordBoundary(content, terms)
  assert(!result.unmatched, "T unique match")
  assertEq(result.terms[0].start, hits[0].start, "backfill start")
  assertEq(content.slice(result.terms[0].start, result.terms[0].end), "T", "backfill invariant")
}

{
  const content = "Trong ADN, A liên kết với T."
  const terms = [
    { text: "T", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] },
    { text: "T", slotIndex: 1, allowSwap: false, swapGroupId: null, extraAccepted: [] },
  ]
  const result = assignOffsetsByWordBoundary(content, terms)
  assert(result.unmatched, "2 term T vs 1 boundary -> needsReview")
}

{
  const raw = '__"timin"__ và __"xitozin"__'
  const { underlinedTerms } = extractBlanks(raw)
  assertEq(underlinedTerms[0].swapGroupId, null, "va accent khong gop nhom")
  assertEq(underlinedTerms[1].swapGroupId, null, "va accent khong gop nhom 2")
}

console.log("phien 2 OK")
