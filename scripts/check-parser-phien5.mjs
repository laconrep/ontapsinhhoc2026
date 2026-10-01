import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"
import { parseTextContent, summarize } from "../lib/worksheet-parser.ts"

const sample = `{Chương}
[Bài]
- KP "a" có "b"
##
Câu 1. tf one-line
a. x b. y __c.__ z d. w
Câu 2. tf multiline
a. aa
__b.__ bb
c. cc
d. dd
Câu 3. leftover
a. 1
b. 2
c. 3
d. 4
a. Gene A
b. Gene a
c. extra
d. extra2
###
Câu 1. sa stem
1) y1
2) y2
Đáp án: 10
Câu 2. missing
Câu 3. ok
 Đáp án: 5
#
cau: legacy stem
A. 1 B. 2 C. 3 D. 4
`

const r = parseTextContent(sample)
const qs = r.chapters.flatMap((c) => c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)))
const tf = qs.filter((q) => q.type === "TF")
const sa = qs.filter((q) => q.type === "SA")
const leftoverErr = r.errors.filter((e) => /không thuộc câu nào/.test(e.message))
const saMissing = r.errors.filter((e) => /thiếu 'Đáp án:'/.test(e.message))
console.log("sample types", qs.map((q) => q.type))
console.log("sample TF", tf.map((q) => ({ n: q.content.slice(0, 24), nOpt: q.options.length, opts: q.options })))
console.log("sample SA", sa.map((q) => ({ n: q.content.slice(0, 40), ans: q.correctAnswer })))
console.log("sample leftover", leftoverErr)
console.log("sample saMissing", saMissing)

if (tf.length !== 3) {
  console.error("THAT BAI sample: ky vong 3 TF, got", tf.length)
  process.exit(1)
}
for (const q of tf) {
  if (q.options.length !== 4) {
    console.error("THAT BAI sample TF khong du 4 y", q)
    process.exit(1)
  }
  const letters = q.options.map((o) => o.content[0]).join("")
  if (letters !== "abcd") {
    console.error("THAT BAI sample TF nhan", letters, q.options)
    process.exit(1)
  }
}
if (!tf[0].options[2].isCorrect || tf[0].options.filter((o) => o.isCorrect).length !== 1) {
  console.error("THAT BAI sample TF 4-trong-1 dap an khong phai c", tf[0])
  process.exit(1)
}
if (!tf[2].options[3].content.includes("4") || /Gene/.test(tf[2].options[3].content)) {
  console.error("THAT BAI sample TF leftover nuot vao d", tf[2])
  process.exit(1)
}
if (leftoverErr.length < 1) {
  console.error("THAT BAI sample: khong bao khoi a-d du")
  process.exit(1)
}
if (qs.some((q) => /Gene A/.test(q.content) || q.options.some((o) => /Gene A/.test(o.content)) && q !== tf[2] && false)) {
  console.error("THAT BAI sample: tao cau gia tu khoi du")
  process.exit(1)
}
const sa1 = sa.find((q) => q.content.includes("sa stem"))
if (!sa1 || sa1.correctAnswer !== "10" || !sa1.content.includes("1) y1") || !sa1.content.includes("2) y2")) {
  console.error("THAT BAI sample SA Cau 1", sa1)
  process.exit(1)
}
if (saMissing.length < 1) {
  console.error("THAT BAI sample: thieu bao SA khong co Đáp án")
  process.exit(1)
}
const sa3 = sa.find((q) => q.content.includes("ok"))
if (!sa3 || sa3.correctAnswer !== "5") {
  console.error("THAT BAI sample SA Cau 3", sa3)
  process.exit(1)
}

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const allQ = extracted.parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)
const tfQ = allQ.filter((q) => q.type === "TF")
const saQ = allQ.filter((q) => q.type === "SA")
const mcQ = allQ.filter((q) => q.type === "MC")
console.log("summarize", summarize(extracted.parseResult))
console.log("byType", { MC: mcQ.length, TF: tfQ.length, SA: saQ.length })
console.log("errors", extracted.parseResult.errors)

if (tfQ.length !== 6) {
  console.error("THAT BAI: ky vong 6 TF, got", tfQ.length)
  process.exit(1)
}
for (let i = 0; i < tfQ.length; i++) {
  const q = tfQ[i]
  if (q.options.length !== 4) {
    console.error(`THAT BAI: TF Cau ${i + 1} co ${q.options.length} y`, q.options)
    process.exit(1)
  }
  const letters = q.options.map((o) => o.content[0]).join("")
  if (letters !== "abcd") {
    console.error(`THAT BAI: TF Cau ${i + 1} nhan ${letters}`)
    process.exit(1)
  }
  console.log(`TF Cau ${i + 1} line=${q.line} stem=${q.content.replace(/\s+/g, " ").slice(0, 80)}`)
  for (const o of q.options) console.log(" ", o.isCorrect ? "*" : " ", o.content.replace(/\s+/g, " ").slice(0, 120))
}
if (!/<table/i.test(tfQ[3].bodyHtml ?? "") && !/@@TBL/.test(tfQ[3].content)) {
  console.error("THAT BAI: TF Cau 4 thieu bang trong de", { content: tfQ[3].content, bodyHtml: tfQ[3].bodyHtml })
  process.exit(1)
}
if (!/<table/i.test(tfQ[4].bodyHtml ?? "") && !/@@TBL/.test(tfQ[4].content)) {
  console.error("THAT BAI: TF Cau 5 thieu bang trong de", { content: tfQ[4].content, bodyHtml: tfQ[4].bodyHtml })
  process.exit(1)
}
if (tfQ[5].options.some((o) => /Gene A/.test(o.content))) {
  console.error("THAT BAI: TF Cau 6 nuot khoi a-d du", tfQ[5].options)
  process.exit(1)
}

const leftover = extracted.parseResult.errors.filter((e) => /không thuộc câu nào/.test(e.message))
if (leftover.length < 1) {
  console.error("THAT BAI: khong bao khoi a-d du sau Cau 6")
  process.exit(1)
}

if (saQ.length !== 10) {
  console.error("THAT BAI: ky vong 10 SA, got", saQ.length)
  process.exit(1)
}
const wantAns = ["10", "3", "2", "40", "39", "180", "36", "40", "5", "5"]
for (let i = 0; i < saQ.length; i++) {
  console.log(`SA Cau ${i + 1} ans=${JSON.stringify(saQ[i].correctAnswer)} stem=${saQ[i].content.replace(/\s+/g, " ").slice(0, 80)}`)
  if (saQ[i].correctAnswer !== wantAns[i]) {
    console.error(`THAT BAI: SA Cau ${i + 1} ans=${saQ[i].correctAnswer} ky vong ${wantAns[i]}`)
    process.exit(1)
  }
}

if (mcQ.length !== 35) {
  console.error("THAT BAI: MC bi pha, got", mcQ.length)
  process.exit(1)
}

console.log("OK phien 5")
