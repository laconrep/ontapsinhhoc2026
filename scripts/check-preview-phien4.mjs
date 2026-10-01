import { applyKpWrap } from "../lib/kp-blank-wrap.ts"
import { extractBlanks } from "../lib/worksheet-parser.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const src = "- Gene cấu trúc: Gene mã hóa protein."
const idx = src.indexOf("protein")
const wrapped = applyKpWrap(src, idx, idx, "fixed")
assert(wrapped.text.includes("__protein__"), `fixed wrap: ${wrapped.text}`)
const blanks = extractBlanks(wrapped.text)
assert(blanks.underlinedTerms.length === 1, `term count ${blanks.underlinedTerms.length}`)
assert(blanks.underlinedTerms[0].text === "protein", `term ${blanks.underlinedTerms[0].text}`)
assert(blanks.underlinedTerms[0].allowSwap === false, "protein allowSwap phai false")
console.log("OK wrap protein -> __protein__", wrapped.text)

const unwrapped = applyKpWrap(wrapped.text, wrapped.start, wrapped.end, "fixed")
assert(unwrapped.text === src, `toggle off: ${unwrapped.text}`)
console.log("OK toggle off __protein__")

const geneIdx = src.indexOf("Gene")
const swapped = applyKpWrap(src, geneIdx, geneIdx + 4, "swap")
assert(swapped.text.includes('"Gene"'), `swap wrap: ${swapped.text}`)
const swapBlanks = extractBlanks(swapped.text)
assert(swapBlanks.underlinedTerms.some((t) => t.text === "Gene" && t.allowSwap === true), JSON.stringify(swapBlanks.underlinedTerms))
console.log("OK wrap Gene -> \"Gene\"", swapped.text)

const both = applyKpWrap(wrapped.text, wrapped.start, wrapped.end, "swap")
assert(both.text.includes('__"protein"__'), `fixed then swap: ${both.text}`)
const bothBlanks = extractBlanks(both.text)
assert(bothBlanks.underlinedTerms[0].text === "protein", bothBlanks.underlinedTerms[0].text)
assert(bothBlanks.underlinedTerms[0].allowSwap === true, "protein+quote allowSwap phai true")
console.log("OK __protein__ + swap -> __\"protein\"__", both.text)

const media = "- co anh @@IMG0@@ cuoi."
const imgAt = media.indexOf("@@IMG0@@")
const noWrap = applyKpWrap(media, imgAt, imgAt, "fixed")
assert(noWrap.text === media, `khong boc token: ${noWrap.text}`)
console.log("OK khong boc @@IMG")

const dash = applyKpWrap(src, 0, 1, "fixed")
assert(dash.text === src, `khong boc gach dau dong: ${dash.text}`)
console.log("OK khong boc - ")

console.log("OK phien 4")
