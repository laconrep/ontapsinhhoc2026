import { malformedQuoteUnderlineMarks, parseTextContent, validateDocument } from "../lib/worksheet-parser.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(malformedQuoteUnderlineMarks('__"Thành phần"__').length === 0, "dung __\"tu\"__ khong loi")
assert(malformedQuoteUnderlineMarks("__Thành phần__").length === 0, "dung __tu__ khong loi")
assert(malformedQuoteUnderlineMarks('"Thành phần"').length === 0, "dung \"tu\" khong loi")
assert(malformedQuoteUnderlineMarks('__từ__ và "từ"').length === 0, "hai form dung khong loi")

const bad = malformedQuoteUnderlineMarks('"__Thành phần"__, "__số lượng"__ và "__nucleotide"__')
assert(bad.length >= 1, `sai "__tu"__ phai bat: ${JSON.stringify(bad)}`)
console.log("OK bat", bad)

const sample = `{Chương}
[Bài]
- DNA mang thông tin : "__Thành phần"__, "__số lượng"__ và "__nucleotide"__.
#
Câu 1. de
A. 1
B. 2
C. 3
D. 4
`
const r = parseTextContent(sample)
const val = validateDocument(r)
const err = val.errors.filter((e) => /Gạch chân kèm ngoặc kép/.test(e.message ?? ""))
assert(err.length === 1, `ky vong 1 loi malformed, got ${JSON.stringify(val.errors)}`)
assert(err[0].line === 3, `line ${err[0].line}`)
console.log("OK validate", err[0].message)

const okSrc = `{Chương}
[Bài]
- DNA mang thông tin : __"Thành phần"__, __"số lượng"__ và __"nucleotide"__.
#
Câu 1. de
A. 1
B. 2
C. 3
D. 4
`
const ok = parseTextContent(okSrc)
const valOk = validateDocument(ok)
assert(!valOk.errors.some((e) => /Gạch chân kèm ngoặc kép/.test(e.message ?? "")), JSON.stringify(valOk.errors))
const kp = ok.chapters[0].lessons[0].knowledgePoints[0]
assert(kp.underlinedTerms.length === 3, `terms ${kp.underlinedTerms.length}`)
assert(kp.underlinedTerms.every((t) => t.allowSwap), JSON.stringify(kp.underlinedTerms))
assert(kp.underlinedTerms[0].text === "Thành phần", kp.underlinedTerms[0].text)
console.log("OK form dung __\"tu\"__ allowSwap")

console.log("OK malformed quote underline")
