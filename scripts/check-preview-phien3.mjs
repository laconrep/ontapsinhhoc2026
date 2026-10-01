import { readFileSync } from "node:fs"
import { blockRange, spliceBlock } from "../lib/worksheet-source-range.ts"
import { extractAndParse } from "../lib/extract-file.ts"

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: got ${a} expected ${e}`)
  console.log("OK", label, a)
}

const sample = [
  "{Chuong I}",
  "[Bai 1]",
  "- Gene cấu trúc: Gene mã hóa protein.",
  "#",
  "Câu 1. De mot.",
  "A. 1",
  "B. 2",
  "C. 3",
  "D. 4",
  "Câu 35. Gene D o sinh vat nhan so.",
  "A. @@IMG13@@",
  "B. so lien ket",
  "C. tren mach 2",
  "D. chieu dai",
  "##",
  "Câu 36. Y dung sai.",
].join("\n")

assertEqual(blockRange(sample, 3), { startLine: 3, endLine: 3 }, "mau KP 1 dong")
assertEqual(
  blockRange(sample, 3, "Điểm kiến thức phải có ít nhất 1 từ gạch chân"),
  { startLine: 3, endLine: 3 },
  "mau KP theo message",
)
assertEqual(blockRange(sample, 5), { startLine: 5, endLine: 9 }, "mau Cau 1 den truoc Cau 35")
assertEqual(blockRange(sample, 10), { startLine: 10, endLine: 14 }, "mau Cau 35 den truoc ##")

const spliced = spliceBlock(sample, 3, 3, "- Gene cấu trúc: Gene mã hóa __protein__.")
if (!spliced.split("\n")[2].includes("__protein__")) throw new Error("splice KP that bai")
if (spliced.split("\n")[9] !== "Câu 35. Gene D o sinh vat nhan so.") throw new Error("splice lam lech Cau 35")
console.log("OK spliceBlock KP")

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const src = extracted.sourceText
const kp = blockRange(src, 14, "Điểm kiến thức phải có ít nhất 1 từ gạch chân")
assertEqual(kp, { startLine: 14, endLine: 14 }, "file L14 KP")
const line14 = src.split("\n")[13] ?? ""
if (!line14.trim().startsWith("-")) throw new Error(`L14 khong phai KP: ${line14.slice(0, 80)}`)

const r35 = blockRange(src, 177)
const srcLines = src.split("\n")
if (r35.startLine > 177) throw new Error(`Cau 35 start ${r35.startLine} > 177`)
const startText = srcLines[r35.startLine - 1] ?? ""
if (!/Câu\s*35/i.test(startText) && !/^#{1,3}(\s|$)/.test(startText.trim())) {
  throw new Error(`Cau 35 start dong la: ${startText.slice(0, 80)}`)
}
const after = (srcLines[r35.endLine] ?? "").trim()
if (after && !after.startsWith("#") && !after.startsWith("-") && !/^Câu\s/i.test(after)) {
  throw new Error(`Cau 35 endLine ${r35.endLine} bien sau la: ${after.slice(0, 80)}`)
}
const block35 = srcLines.slice(r35.startLine - 1, r35.endLine).join("\n")
if (!/Câu\s*35/i.test(block35)) throw new Error("khoi 35 thieu Cau 35")
if (/^##/m.test(block35.split("\n").slice(1).join("\n")) && block35.trim().endsWith("##")) {
  throw new Error("khoi 35 nuot ##")
}
console.log("OK file L177 Cau 35", r35)

console.log("OK phien 3")
