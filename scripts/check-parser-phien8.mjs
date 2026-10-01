import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"
import { validateDocument, summarize } from "../lib/worksheet-parser.ts"

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const { parseResult, sourceText, images, tables } = extracted
const summary = summarize(parseResult)
const val = validateDocument(parseResult)

const allQ = parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)
const mc = allQ.filter((q) => q.type === "MC")
const tf = allQ.filter((q) => q.type === "TF")
const sa = allQ.filter((q) => q.type === "SA")

console.log("e2e summarize", summary)
console.log("byType", { MC: mc.length, TF: tf.length, SA: sa.length })
console.log("images", images.length, "tables", tables.length)
console.log("sourceText lines", sourceText.split(/\r?\n/).length)
console.log("parse errors", parseResult.errors.length)
for (const e of parseResult.errors) console.log(`  parse L${e.line ?? "-"} ${e.message}`)
console.log("validate", val.isValid, val.errors.length)
for (const e of val.errors) console.log(`  val L${e.line ?? "-"} ${e.message}`)

if (summary.chapters !== 1 || summary.lessons !== 1) {
  console.error("THAT BAI: ky vong 1 chuong 1 bai", summary)
  process.exit(1)
}
if (mc.length !== 35 || tf.length !== 6 || sa.length !== 10) {
  console.error("THAT BAI: ky vong MC35 TF6 SA10", { MC: mc.length, TF: tf.length, SA: sa.length })
  process.exit(1)
}
if (summary.questions !== 51) {
  console.error("THAT BAI: ky vong 51 cau, got", summary.questions)
  process.exit(1)
}
if (summary.questions >= 100) {
  console.error("THAT BAI: van con cau gia ~107")
  process.exit(1)
}

const saAnswers = sa.map((q) => (q.correctAnswer ?? "").trim())
const expectedSa = ["10", "3", "2", "40", "39", "180", "36", "40", "5", "5"]
if (saAnswers.join(",") !== expectedSa.join(",")) {
  console.error("THAT BAI: SA dap an", saAnswers)
  process.exit(1)
}

for (const q of mc) {
  if (q.options.length !== 4) {
    console.error("THAT BAI: MC khong du 4 lua chon", q.content.slice(0, 40), q.options.length)
    process.exit(1)
  }
}
for (const q of tf) {
  if (q.options.length !== 4) {
    console.error("THAT BAI: TF khong du 4 y", q.content.slice(0, 40), q.options.length)
    process.exit(1)
  }
}

const c5 = mc[4]
const c21 = mc[20]
const c35 = mc[34]
if (!c5.options[0].bodyHtml?.includes("<img") || !c5.options[2].bodyHtml?.includes("<img")) {
  console.error("THAT BAI: Cau 5 A/C thieu img", c5.options.map((o) => o.bodyHtml?.slice(0, 40)))
  process.exit(1)
}
if (!c21.options.every((o) => o.bodyHtml?.includes("<img"))) {
  console.error("THAT BAI: Cau 21 thieu img A-D")
  process.exit(1)
}
if (!c35.options[0].bodyHtml?.includes("<img")) {
  console.error("THAT BAI: Cau 35 A thieu img")
  process.exit(1)
}
if (allQ.some((q) => /@@IMG/.test(q.content) || q.options.some((o) => /@@IMG/.test(o.content)))) {
  console.error("THAT BAI: con token @@IMG trong content sau attach")
  process.exit(1)
}

const srcs = images.map((tag) => tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? "")
const wmf = srcs.filter((src) => /data:image\/(x-)?wmf\b/i.test(src))
if (wmf.length > 0) {
  console.error("THAT BAI: con WMF", wmf.length)
  process.exit(1)
}
if ((sourceText.match(/@@MATH\d+@@/g) || []).length > 0) {
  console.error("THAT BAI: con @@MATH trong sourceText")
  process.exit(1)
}

if (val.errors.length > 4) {
  console.error("THAT BAI: qua nhieu loi gia", val.errors.length)
  process.exit(1)
}
if (!val.errors.some((e) => /không thuộc câu nào/.test(e.message ?? ""))) {
  console.error("THAT BAI: mat loi khoi a-d du")
  process.exit(1)
}
if (val.errors.some((e) => /ĐÁP ÁN|HƯỚNG DẪN/i.test(e.message ?? ""))) {
  console.error("THAT BAI: van loi tu phan dap an/huong dan")
  process.exit(1)
}
if (val.errors.some((e) => /công thức Word không đọc được/.test(e.message ?? ""))) {
  console.error("THAT BAI: lua chon bi coi rong")
  process.exit(1)
}

const persistShape = allQ.filter((q) => q.type !== "SA").flatMap((q) =>
  q.options.map((o) => ({ content: o.content, bodyHtml: o.bodyHtml ?? null, isCorrect: o.isCorrect })),
)
const withHtml = persistShape.filter((o) => o.bodyHtml)
console.log("persist options", persistShape.length, "with bodyHtml", withHtml.length)
if (withHtml.length < 7) {
  console.error("THAT BAI: thieu bodyHtml lua chon de luu DB", withHtml.length)
  process.exit(1)
}

console.log("OK phien 8")
