import { parseTextContent, attachBodyHtml, attachOptionBodyHtml } from "../lib/worksheet-parser.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const sample = `{Chương}
[Bài]
- KP có __protein__
#
Câu 5. stem
A. @@IMG0@@
B. 1
C. 2
D. 3
`

const imgTag = '<img src="data:image/svg+xml;base64,PHN2Zy8+" alt="">'
const parsed = parseTextContent(sample)
attachBodyHtml(parsed, [imgTag], [])
attachOptionBodyHtml(parsed, [imgTag], [])
const q = parsed.chapters[0].lessons[0].knowledgePoints[0].questions[0]
assert(q.options[0].bodyHtml?.includes("<img"), "Cau 5 A thieu img sau attach")
assert(!/@@IMG/.test(q.options[0].content), "Cau 5 A con token trong content")
assert(!q.options[1].bodyHtml, "Cau 5 B khong nen co bodyHtml")
console.log("OK Cau 5 A @@IMG0@@ + img -> bodyHtml co <img")

const plain = parseTextContent(sample)
assert(plain.chapters[0].lessons[0].knowledgePoints[0].questions[0].options[0].content.includes("@@IMG0@@"), "chua attach thi con token")
assert(!plain.chapters[0].lessons[0].knowledgePoints[0].questions[0].options[0].bodyHtml, "chua attach thi khong bodyHtml")
console.log("OK parse text thuan mat anh neu khong attach")

console.log("OK phien 5")
