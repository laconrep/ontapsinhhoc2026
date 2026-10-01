import { reconstructMathTypeSvg } from "../lib/docx-equations.ts"
import { readFileSync } from "node:fs"
import { extractAndParse } from "../lib/extract-file.ts"

function decodeSvg(dataUri) {
  const b64 = dataUri.split(",")[1]
  if (!b64) throw new Error("thieu base64")
  return Buffer.from(b64, "base64").toString("utf8")
}

function textPositions(svg) {
  const out = []
  const re = /<text\b([^>]*)>/g
  let m
  while ((m = re.exec(svg))) {
    const attrs = m[1]
    const x = attrs.match(/\bx="([^"]*)"/)?.[1]
    const y = attrs.match(/\by="([^"]*)"/)?.[1]
    out.push(`${x},${y}`)
  }
  return out
}

function assertNoOverlap(svg, label) {
  if (!svg.includes("<line")) {
    throw new Error(`${label}: thieu <line`)
  }
  const pos = textPositions(svg)
  const set = new Set(pos)
  if (set.size !== pos.length) {
    throw new Error(`${label}: text chong nhau ${pos.join(" | ")}`)
  }
}

function assertCase(tokens, expectSubstrings, label) {
  const uri = reconstructMathTypeSvg(tokens)
  if (!uri || !uri.startsWith("data:image/svg+xml;base64,")) {
    throw new Error(`${label}: khong ra data URI`)
  }
  const svg = decodeSvg(uri)
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
    throw new Error(`${label}: thieu xmlns`)
  }
  assertNoOverlap(svg, label)
  for (const s of expectSubstrings) {
    if (!svg.includes(s)) {
      throw new Error(`${label}: thieu ${JSON.stringify(s)}\n${svg}`)
    }
  }
  console.log("OK reconstruct", label, tokens.join(","))
}

assertCase(["A+G", "T+C"], [">A+G<", ">T+C<"], "2 token phan so A+G/T+C")
assertCase(["1", "4"], [">1<", ">4<"], "2 token phan so 1/4")
assertCase(["G2", "C3", "="], [">G<", ">C<", ">2<", ">3<", ">=</"], "G2 C3 = -> G/C = 2/3")
assertCase(["A+G9", "T+C6", "="], [">A+G<", ">T+C<", ">9<", ">6<"], "A+G9 T+C6 = -> (A+G)/(T+C)=9/6")
assertCase(["A+G", "4", "T+C", "="], [">A+G<", ">T+C<", ">4<", ">=</"], "A+G 4 T+C = -> (A+G)/(T+C)=4")

const DOCX = "BAI 1 - GENE VA SU TAI BAN DNA.docx"
const extracted = await extractAndParse(readFileSync(DOCX), DOCX)
const allQ = extracted.parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)
const mc = allQ.filter((q) => q.type === "MC")
if (mc.length !== 35) {
  throw new Error(`ky vong MC35 got ${mc.length}`)
}

const c35 = mc[34]
const htmlA = c35.options[0].bodyHtml ?? ""
if (!htmlA.includes("<img")) {
  throw new Error("Cau 35 A thieu <img")
}
const src = htmlA.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
if (!src.startsWith("data:image/svg+xml")) {
  throw new Error("Cau 35 A khong phai SVG")
}
const svg35 = decodeSvg(src)
assertNoOverlap(svg35, "Cau 35 A")
if (!svg35.includes(">G<") || !svg35.includes(">C<") || !svg35.includes(">2<") || !svg35.includes(">3<")) {
  throw new Error(`Cau 35 A khong ra G/C=2/3\n${svg35}`)
}
console.log("OK Cau 35 A G/C=2/3")

const c5 = mc[4]
const html5Stem = c5.bodyHtml ?? ""
if (!html5Stem.includes("<img")) throw new Error("Cau 5 de thieu img")
const src5 = html5Stem.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
const svg5 = decodeSvg(src5)
assertNoOverlap(svg5, "Cau 5 de")
if (!svg5.includes("A+G") || !svg5.includes("T+C")) {
  throw new Error(`Cau 5 de khong ra (A+G)/(T+C)\n${svg5}`)
}
console.log("OK Cau 5 de (A+G)/(T+C)")

console.log("OK phien 1")
