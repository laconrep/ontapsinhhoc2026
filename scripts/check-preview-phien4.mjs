import { applyKpWrap } from "../lib/kp-blank-wrap.ts"
import { extractBlanks } from "../lib/worksheet-parser.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const src = "- Gene cấu trúc: Gene mã hóa protein."
const idx = src.indexOf("protein")
const wrapped = applyKpWrap(src, idx, idx)
assert(wrapped.text.includes("__protein__"), `fixed wrap: ${wrapped.text}`)
const blanks = extractBlanks(wrapped.text)
assert(blanks.underlinedTerms.length === 1, `term count ${blanks.underlinedTerms.length}`)
assert(blanks.underlinedTerms[0].text === "protein", `term ${blanks.underlinedTerms[0].text}`)
assert(blanks.underlinedTerms[0].allowSwap === false, "protein allowSwap phai false")
console.log("OK wrap protein -> __protein__", wrapped.text)

const unwrapped = applyKpWrap(wrapped.text, wrapped.start, wrapped.end)
assert(unwrapped.text === src, `toggle off: ${unwrapped.text}`)
console.log("OK toggle off __protein__")

const phraseStart = src.indexOf("mã hóa protein")
const phraseEnd = phraseStart + "mã hóa protein".length
const phrase = applyKpWrap(src, phraseStart, phraseEnd)
assert(phrase.text.includes("__mã hóa protein__"), `phrase wrap: ${phrase.text}`)
const phraseBlanks = extractBlanks(phrase.text)
assert(phraseBlanks.underlinedTerms.length === 1, `phrase term count ${phraseBlanks.underlinedTerms.length}`)
assert(phraseBlanks.underlinedTerms[0].text === "mã hóa protein", `phrase term ${phraseBlanks.underlinedTerms[0].text}`)
assert(phraseBlanks.underlinedTerms[0].allowSwap === false, "cum tu allowSwap phai false")
console.log("OK wrap cum tu -> __mã hóa protein__", phrase.text)

const quoted = wrapped.text.replace("__protein__", '__"protein"__')
const quotedBlanks = extractBlanks(quoted)
assert(quotedBlanks.underlinedTerms[0].text === "protein", quotedBlanks.underlinedTerms[0].text)
assert(quotedBlanks.underlinedTerms[0].allowSwap === true, "protein+quote allowSwap phai true")
console.log("OK go ngoac kep quanh __protein__ -> __\"protein\"__", quoted)

const media = "- co anh @@IMG0@@ cuoi."
const imgAt = media.indexOf("@@IMG0@@")
const noWrap = applyKpWrap(media, imgAt, imgAt)
assert(noWrap.text === media, `khong boc token: ${noWrap.text}`)
console.log("OK khong boc @@IMG")

const dash = applyKpWrap(src, 0, 1)
assert(dash.text === src, `khong boc gach dau dong: ${dash.text}`)
console.log("OK khong boc - ")

console.log("OK phien 4")
