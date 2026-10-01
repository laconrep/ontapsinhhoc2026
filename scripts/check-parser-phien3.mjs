import { parseTextContent, summarize } from "../lib/worksheet-parser.ts"
import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"

const sample = `{Chương}
[Bài]
- KP "a" có "b"
#
Câu 1. D?____
A. 1 B. 2 C. 3 D. 4
Câu 2. hai
A. 1
B. 2
C. 3
D. 4
##
Câu 1. tf
a. x
b. y
c. z
d. w
ĐÁP ÁN
Câu 1. fake
A. 1 B. 2 C. 3 D. 4
`

const r = parseTextContent(sample)
const qs = r.chapters.flatMap((c) => c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)))
const types = qs.map((q) => q.type)
console.log("sample summarize", summarize(r))
console.log("sample types", types)
console.log("sample errors", r.errors)
console.log("sample stems", qs.map((q) => q.content))

if (qs.length !== 3) {
  console.error(`THAT BAI: ky vong 3 cau, got ${qs.length}`)
  process.exit(1)
}
if (types.join(",") !== "MC,MC,TF") {
  console.error(`THAT BAI: types ${types.join(",")}`)
  process.exit(1)
}
if (qs.some((q) => /fake/i.test(q.content))) {
  console.error("THAT BAI: phan sau DAP AN van bi nuot")
  process.exit(1)
}

const preamble = parseTextContent(`PHẦN V – DI TRUYỀN HỌC\n{Chương A}\n[Bài 1]\n- KP "x"\n#\nCâu 1. de\nA. 1\nB. 2\nC. 3\nD. 4\n`)
const preErr = preamble.errors.filter((e) => /PHẦN V/i.test(e.message))
console.log("preamble errors about PHAN V:", preErr.length)
if (preErr.length > 0) {
  console.error("THAT BAI: preamble bi bao loi")
  process.exit(1)
}

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const s = summarize(extracted.parseResult)
console.log("doi chieu summarize", s)
console.log("doi chieu errors", extracted.parseResult.errors.length)
console.log("doi chieu first errors", extracted.parseResult.errors.slice(0, 12))

const allQ = extracted.parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)
const byType = { MC: 0, TF: 0, SA: 0 }
for (const q of allQ) byType[q.type]++
console.log("byType", byType)

if (s.questions >= 100) {
  console.error(`THAT BAI: van con ~107 cau gia (got ${s.questions})`)
  process.exit(1)
}
if (extracted.parseResult.errors.some((e) => /PHẦN V/i.test(e.message))) {
  console.error("THAT BAI: preamble PHAN V van loi")
  process.exit(1)
}

console.log("OK phien 3")
