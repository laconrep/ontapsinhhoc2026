import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"
import { parseTextContent, summarize } from "../lib/worksheet-parser.ts"

const sample = `{Chương}
[Bài]
- KP "a" có "b"
#
Câu 1. four-in-one
A. 1 B. 2 __C.__ 3 D. 4
Câu 2. two-plus-two
A. aa B. bb
C. cc __D.__ dd
Câu 3. multiline
A. x
B. y
__C.__ z
D. w
Câu 5. stem
@@IMG0@@
more?
A.
@@IMG1@@
. B. 1. __C.__
@@IMG2@@
. D. 2.
Câu 6. same
__A.____ Nucleotide.__		B. Amino acid.		C. Monosaccharide.		D. Glicerol.
`

const r = parseTextContent(sample)
const qs = r.chapters.flatMap((c) => c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)))
console.log("sample", qs.map((q) => ({ n: q.content.slice(0, 20), nOpt: q.options.length, opts: q.options, correct: q.options.filter((o) => o.isCorrect).map((o) => o.content) })))
for (const q of qs) {
  if (q.options.length !== 4) {
    console.error("THAT BAI sample: khong du 4 lua chon", q.content, q.options)
    process.exit(1)
  }
}
const q5 = qs.find((q) => q.content.includes("stem"))
if (!q5 || !q5.options[0].content.includes("@@IMG1@@") || !q5.options[2].content.includes("@@IMG2@@")) {
  console.error("THAT BAI sample Cau 5 thieu IMG trong A/C", q5)
  process.exit(1)
}
const q1s = qs.find((q) => q.content.includes("four-in-one"))
if (!q1s || q1s.options.filter((o) => o.isCorrect).map((o) => o.content[0]).join("") !== "C") {
  console.error("THAT BAI sample four-in-one dap an khong phai chi C", q1s)
  process.exit(1)
}
const q6 = qs.find((q) => q.content.includes("same"))
if (!q6 || !q6.options[0].isCorrect || q6.options.slice(1).some((o) => o.isCorrect)) {
  console.error("THAT BAI sample Cau 6 A khong dung", q6)
  process.exit(1)
}

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const allQ = extracted.parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)
const mc = allQ.filter((q) => q.type === "MC")
console.log("summarize", summarize(extracted.parseResult))
console.log("MC", mc.length, "optCounts", mc.map((q) => q.options.length))
console.log("errors", extracted.parseResult.errors.length, extracted.parseResult.errors.slice(0, 8))

function show(q, label) {
  console.log(`\n${label} line=${q.line} opts=${q.options.length} stem=${q.content.slice(0, 80).replace(/\s+/g, " ")}`)
  for (const o of q.options) {
    console.log(" ", o.isCorrect ? "*" : " ", o.content.replace(/\s+/g, " ").slice(0, 120))
  }
}

const want = [1, 5, 6, 11, 14, 17, 21, 22, 26, 29, 30, 35]
for (const n of want) {
  const q = mc.find((x) => x.content.startsWith("Câu") ? false : true) || mc[n - 1]
  void q
}

// Match by order: MC Câu 1..35 are first 35 MC in group after #
const byOrder = mc
for (const n of want) {
  const q = byOrder[n - 1]
  if (!q) {
    console.error("THAT BAI: thieu MC Cau", n)
    process.exit(1)
  }
  show(q, `MC Cau ${n}`)
  if (q.options.length !== 4) {
    console.error(`THAT BAI: Cau ${n} co ${q.options.length} lua chon`)
    process.exit(1)
  }
  const letters = q.options.map((o) => o.content[0])
  if (letters.join("") !== "ABCD") {
    console.error(`THAT BAI: Cau ${n} nhan ${letters.join(",")}`)
    process.exit(1)
  }
  if (q.options.some((o) => /^\d+\./.test(o.content) || /^\(\d+\)/.test(o.content))) {
    console.error(`THAT BAI: Cau ${n} sinh lua chon tu 1./(1)`)
    process.exit(1)
  }
}

function hasRich(o) {
  return /@@IMG/.test(o.content) || /<img\b/i.test(o.bodyHtml ?? "")
}

const c5 = byOrder[4]
if (!hasRich(c5.options[0]) || !hasRich(c5.options[2])) {
  console.error("THAT BAI: Cau 5 A/C thieu @@IMG", c5.options)
  process.exit(1)
}
const c21 = byOrder[20]
if (!c21.options.every((o) => hasRich(o))) {
  console.error("THAT BAI: Cau 21 thieu @@IMG trong A-D", c21.options)
  process.exit(1)
}
const c35 = byOrder[34]
if (!hasRich(c35.options[0])) {
  console.error("THAT BAI: Cau 35 A thieu @@IMG", c35.options)
  process.exit(1)
}

const notFour = mc.filter((q) => q.options.length !== 4)
console.log("MC khong du 4:", notFour.length, notFour.map((q) => q.line))
if (notFour.length) {
  console.error("THAT BAI: van con MC khong du 4 lua chon")
  process.exit(1)
}

console.log("OK phien 4")
