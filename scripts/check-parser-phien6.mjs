import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"
import { parseTextContent, validateDocument, summarize } from "../lib/worksheet-parser.ts"

const emptyMc = `{Chương}
[Bài]
- KP "a" có "b"
#
Câu 1. empty formula
A.
.
B. 1
C. 2
D. 3
Câu 2. img is not empty
A. @@IMG0@@
B. 1
__C.__ 2
D. 3
Câu 3. no underline
A. 1
B. 2
C. 3
D. 4
##
Câu 1. tf empty
a.
.
b. x
c. y
d. z
###
Câu 1. sa missing
`

const r = parseTextContent(emptyMc)
const v = validateDocument(r)
const msgs = v.errors.map((e) => e.message)
console.log("sample errors")
for (const e of v.errors) console.log(`  L${e.line ?? "-"} ${e.message}`)

const emptyA = v.errors.find((e) => /Lựa chọn A thiếu nội dung/.test(e.message ?? "") && e.line === r.chapters[0].lessons[0].knowledgePoints[0].questions[0].line)
if (!emptyA) {
  console.error("THAT BAI: thieu loi lua chon A rong (cong thuc)")
  process.exit(1)
}
const imgQ = r.chapters[0].lessons[0].knowledgePoints[0].questions[1]
if (v.errors.some((e) => e.line === imgQ.line && /Lựa chọn A thiếu nội dung/.test(e.message ?? ""))) {
  console.error("THAT BAI: @@IMG bi coi rong")
  process.exit(1)
}
if (!v.errors.some((e) => /chưa gạch chân đáp án đúng/.test(e.message ?? ""))) {
  console.error("THAT BAI: thieu loi 0 dap an dung")
  process.exit(1)
}
const tfQ = r.chapters[0].lessons[0].knowledgePoints[0].questions.find((q) => q.type === "TF")
if (!tfQ || !v.errors.some((e) => e.line === tfQ.line && /Lựa chọn a thiếu nội dung/.test(e.message ?? ""))) {
  console.error("THAT BAI: thieu loi TF y rong")
  process.exit(1)
}
if (!v.errors.some((e) => /thiếu 'Đáp án:'/.test(e.message ?? ""))) {
  console.error("THAT BAI: thieu loi SA")
  process.exit(1)
}
if (msgs.filter((m) => /thiếu 'Đáp án:'/.test(m)).length !== 1) {
  console.error("THAT BAI: SA duplicate loi", msgs.filter((m) => /thiếu 'Đáp án:'/.test(m)))
  process.exit(1)
}

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const val = validateDocument(extracted.parseResult)
console.log("doi chieu summarize", summarize(extracted.parseResult))
console.log("doi chieu validate", val.isValid, val.errors.length)
for (const e of val.errors) console.log(`  L${e.line ?? "-"} ${e.message}`)

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
  console.error("THAT BAI: lua chon bi coi rong tren file doi chieu")
  process.exit(1)
}

console.log("OK phien 6")
