import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"
import {
  parseTextContent,
  attachBodyHtml,
  attachOptionBodyHtml,
  validateDocument,
  summarize,
} from "../lib/worksheet-parser.ts"
import { applyKpWrap } from "../lib/kp-blank-wrap.ts"
import { blockRange, spliceBlock } from "../lib/worksheet-source-range.ts"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function decodeSvg(dataUri) {
  const b64 = dataUri.split(",")[1]
  if (!b64) throw new Error("thieu base64")
  return Buffer.from(b64, "base64").toString("utf8")
}

function stripLeftoverAd(block) {
  const ls = block.split("\n")
  const isAd = (s) => /^\s*(?:__)?[a-d]\.\s/i.test(s.trim())
  let firstAd = -1
  let firstAdEnd = -1
  let seen = 0
  for (let i = 0; i < ls.length; i++) {
    if (!isAd(ls[i])) continue
    if (firstAd < 0) firstAd = i
    seen += 1
    if (seen === 4) {
      firstAdEnd = i
      break
    }
  }
  if (firstAd < 0 || firstAdEnd < 0) return block
  let extraStart = -1
  let extraEnd = -1
  for (let i = firstAdEnd + 1; i < ls.length; i++) {
    const t = ls[i].trim()
    if (!t) continue
    if (isAd(ls[i])) {
      if (extraStart < 0) extraStart = i
      extraEnd = i
      continue
    }
    if (extraStart >= 0) break
  }
  if (extraStart < 0) return block
  return [...ls.slice(0, extraStart), ...ls.slice(extraEnd + 1)].join("\n")
}

function allQuestions(result) {
  return result.chapters.flatMap((c) =>
    c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
  )
}

function parseAttached(text, images, tables) {
  const result = parseTextContent(text)
  attachBodyHtml(result, images, tables)
  attachOptionBodyHtml(result, images, tables)
  return result
}

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const { parseResult, sourceText, images, tables } = extracted
const summary0 = summarize(parseResult)
const val0 = validateDocument(parseResult)

assert(summary0.chapters === 1 && summary0.lessons === 1, `chuong/bai ${JSON.stringify(summary0)}`)
assert(summary0.questions === 51, `cau ${summary0.questions}`)
assert(summary0.kps === 22, `kp ${summary0.kps}`)

const q0 = allQuestions(parseResult)
const mc0 = q0.filter((q) => q.type === "MC")
const tf0 = q0.filter((q) => q.type === "TF")
const sa0 = q0.filter((q) => q.type === "SA")
assert(mc0.length === 35 && tf0.length === 6 && sa0.length === 10, `type MC${mc0.length} TF${tf0.length} SA${sa0.length}`)

const c35 = mc0[34]
const htmlA = c35.options[0].bodyHtml ?? ""
assert(htmlA.includes("<img"), "Cau 35 A thieu <img")
const src = htmlA.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
assert(src.startsWith("data:image/svg+xml"), "Cau 35 A khong phai SVG")
const svg35 = decodeSvg(src)
assert(svg35.includes("<line"), "Cau 35 A thieu <line")
assert(svg35.includes(">G<") && svg35.includes(">C<") && svg35.includes(">2<") && svg35.includes(">3<"), "Cau 35 A khong ra G/C=2/3")
console.log("OK extract Cau 35 A phan so + 51 cau")

const kpErr = val0.errors.find((e) => /Điểm kiến thức/.test(e.message ?? ""))
const leftoverErr = val0.errors.find((e) => /không thuộc câu nào/.test(e.message ?? ""))
const quoteErr = val0.errors.find((e) => /Gạch chân kèm ngoặc kép/.test(e.message ?? ""))
assert(kpErr, "thieu loi KP chua gach chan")
assert(leftoverErr, "thieu loi khoi a-d du")
assert(quoteErr, "thieu loi gach chan kem ngoac kep lech cu phap")
assert(kpErr.line === 14, `loi KP line ${kpErr.line}`)
assert(quoteErr.line === 6 || quoteErr.line === 9, `loi ngoac kep line ${quoteErr.line}`)
assert(val0.errors.filter((e) => /Gạch chân kèm ngoặc kép/.test(e.message ?? "")).length >= 1, "thieu loi ngoac kep")
console.log("OK validate", val0.errors.map((e) => `L${e.line}`).join(", "))

const lines = sourceText.split("\n")
const line14 = lines[13] ?? ""
assert(line14.trim().startsWith("-"), `L14 khong phai KP: ${line14.slice(0, 80)}`)
const word = "protein"
const wordAt = line14.indexOf(word)
assert(wordAt >= 0, `L14 khong co "${word}": ${line14}`)
const wrappedLine = applyKpWrap(line14, wordAt, wordAt, "fixed")
assert(wrappedLine.text.includes("__protein__"), `wrap KP: ${wrappedLine.text}`)
const afterKp = spliceBlock(sourceText, 14, 14, wrappedLine.text)
const parsedKp = parseAttached(afterKp, images, tables)
const valKp = validateDocument(parsedKp)
assert(!valKp.errors.some((e) => /Điểm kiến thức/.test(e.message ?? "")), `con loi KP: ${valKp.errors.map((e) => e.message).join(" | ")}`)
assert(valKp.errors.some((e) => /không thuộc câu nào/.test(e.message ?? "")), "mat loi a-d sau wrap KP")
assert(valKp.errors.some((e) => /Gạch chân kèm ngoặc kép/.test(e.message ?? "")), "mat loi ngoac kep lech sau wrap KP")
assert(!valKp.errors.some((e) => /Điểm kiến thức/.test(e.message ?? "")), "con loi KP sau wrap")
const sumKp = summarize(parsedKp)
assert(sumKp.questions === 51, `sau wrap KP cau ${sumKp.questions}`)
console.log("OK wrap __protein__ mat loi KP, con a-d + ngoac kep lech")

const leftover = valKp.errors.find((e) => /không thuộc câu nào/.test(e.message ?? ""))
assert(leftover?.line, "loi a-d thieu line")
const range = blockRange(afterKp, leftover.line, leftover.message)
const block = afterKp.split("\n").slice(range.startLine - 1, range.endLine).join("\n")
const edited = stripLeftoverAd(block)
assert(edited !== block, "khong cat duoc dong a-d du trong khoi")
assert(/Câu\s*6\./.test(edited), "cat nham mat Cau 6")
const afterFix = spliceBlock(afterKp, range.startLine, range.endLine, edited)
const parsedFix = parseAttached(afterFix, images, tables)
const valFix = validateDocument(parsedFix)
const sumFix = summarize(parsedFix)
const qFix = allQuestions(parsedFix)
const mcFix = qFix.filter((q) => q.type === "MC")
const tfFix = qFix.filter((q) => q.type === "TF")
const saFix = qFix.filter((q) => q.type === "SA")

assert(sumFix.questions === 51, `sau xoa a-d cau ${sumFix.questions}`)
assert(mcFix.length === 35 && tfFix.length === 6 && saFix.length === 10, `sau xoa type MC${mcFix.length} TF${tfFix.length} SA${saFix.length}`)
assert(!valFix.errors.some((e) => /không thuộc câu nào/.test(e.message ?? "")), "con loi a-d sau xoa")
assert(!valFix.isValid, "sau xoa a-d van phai chan vi ngoac kep lech")
assert(valFix.errors.some((e) => /Gạch chân kèm ngoặc kép/.test(e.message ?? "")), `thieu loi ngoac kep: ${valFix.errors.map((e) => e.message).join(" | ")}`)

const c35b = mcFix[34]
const htmlAb = c35b.options[0].bodyHtml ?? ""
assert(htmlAb.includes("<img"), "sau luu-text Cau 35 A mat img")
const srcb = htmlAb.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
const svg35b = decodeSvg(srcb)
assert(svg35b.includes("<line"), "sau attach Cau 35 A thieu <line")
console.log("OK xoa khoi a-d du, con loi ngoac kep lech, 51 cau, Cau 35 A giu img")

console.log("OK phien 6")
