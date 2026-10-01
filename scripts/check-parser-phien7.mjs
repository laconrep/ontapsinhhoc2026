import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"
import { parseTextContent, attachBodyHtml, attachOptionBodyHtml } from "../lib/worksheet-parser.ts"

const sample = `{Chương}
[Bài]
- KP "a" có "b"
#
Câu 1. stem
A.
@@IMG0@@
. B. 1. __C.__
@@IMG1@@
. D. 2.
`
const r = parseTextContent(sample)
const imgs = [
  '<img src="data:image/svg+xml;base64,PHN2Zy8+" alt="">',
  '<img src="data:image/png;base64,aaa" alt="">',
]
attachBodyHtml(r, imgs, [])
attachOptionBodyHtml(r, imgs, [])
const q = r.chapters[0].lessons[0].knowledgePoints[0].questions[0]
if (!q.options[0].bodyHtml?.includes("<img") || /@@IMG/.test(q.options[0].content)) {
  console.error("THAT BAI sample A thieu bodyHtml hoac con token", q.options[0])
  process.exit(1)
}
if (!q.options[2].bodyHtml?.includes("<img") || /@@IMG/.test(q.options[2].content)) {
  console.error("THAT BAI sample C thieu bodyHtml hoac con token", q.options[2])
  process.exit(1)
}
if (q.options[1].bodyHtml || q.options[3].bodyHtml) {
  console.error("THAT BAI sample B/D khong nen co bodyHtml", q.options)
  process.exit(1)
}

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const allQ = extracted.parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)
const mc = allQ.filter((q) => q.type === "MC")
const c5 = mc[4]
const c21 = mc[20]
const c35 = mc[34]

function show(label, q) {
  console.log(`\n${label}`)
  for (const o of q.options) {
    console.log(
      " ",
      o.content.slice(0, 40),
      "bodyHtml=",
      Boolean(o.bodyHtml),
      o.bodyHtml ? o.bodyHtml.includes("<img") : false,
      /@@IMG/.test(o.content),
    )
  }
}
show("MC Cau 5", c5)
show("MC Cau 21", c21)
show("MC Cau 35", c35)

if (!c5.options[0].bodyHtml?.includes("<img") || !c5.options[2].bodyHtml?.includes("<img")) {
  console.error("THAT BAI: Cau 5 A/C thieu img trong bodyHtml")
  process.exit(1)
}
if (c5.options.some((o) => /@@IMG/.test(o.content))) {
  console.error("THAT BAI: Cau 5 con token trong content")
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

console.log("OK phien 7")
