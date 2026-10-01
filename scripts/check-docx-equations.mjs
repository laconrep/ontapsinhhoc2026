// Script kiem tra phien 1+2: MathType OLE (WMF) va OMML -> SVG.
// Chay: tsx scripts/check-docx-equations.mjs
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { extractAndParse } from "../lib/extract-file.ts"
import { preprocessOmml } from "../lib/docx-omml.ts"

const DOCX = process.argv[2] || "BAI 1 - GENE VA SU TAI BAN DNA.docx"

const buffer = readFileSync(resolve(process.cwd(), DOCX))

const pre = await preprocessOmml(buffer)
const mathsOk = pre.maths.filter((m) => typeof m === "string" && m.startsWith("data:image/svg+xml"))
const mathsFail = pre.maths.filter((m) => !m)
console.log("omml tokens:", pre.maths.length)
console.log("omml svg:", mathsOk.length)
console.log("omml fail:", mathsFail.length)

const result = await extractAndParse(buffer, DOCX)

const leftoverMath = (result.sourceText.match(/@@MATH\d+@@/g) || []).length
console.log("@@MATH con lai trong sourceText:", leftoverMath)

const srcs = result.images.map(
  (tag) => tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? "",
)
const svg = srcs.filter((src) => src.startsWith("data:image/svg+xml"))
const wmf = srcs.filter((src) => /data:image\/(x-)?wmf\b/i.test(src))
const png = srcs.filter((src) => src.startsWith("data:image/png"))

console.log("images:", result.images.length)
console.log("svg:", svg.length)
console.log("wmf con lai:", wmf.length)
console.log("png:", png.length)

const questions = result.parseResult.chapters.flatMap((c) =>
  c.lessons.flatMap((l) => l.knowledgePoints.flatMap((k) => k.questions)),
)

function dumpQuestion(label, pred) {
  const q = questions.find(pred)
  if (!q) {
    console.log(`${label}: KHONG TIM THAY`)
    return
  }
  const optPreview = (q.options || [])
    .map((o) => `${o.content.slice(0, 80).replace(/\s+/g, " ")}`)
    .join(" | ")
  const hasImg = /@@IMG\d+@@/.test(q.content) || (q.options || []).some((o) => /@@IMG\d+@@/.test(o.content))
  console.log(
    `${label}: type=${q.type} contentHasIMG=${/@@IMG\d+@@/.test(q.content)} optHasIMG=${(q.options || []).some((o) => /@@IMG\d+@@/.test(o.content))} opts=${q.options?.length ?? 0} emptyOpts=${(q.options || []).filter((o) => !o.content.trim()).length}`,
  )
  if (optPreview) console.log(`  opts: ${optPreview.slice(0, 300)}`)
  console.log(`  stem: ${q.content.slice(0, 120).replace(/\s+/g, " ")}`)
  void hasImg
}

dumpQuestion("Cau 35 MC", (q) => q.content.includes("Câu 35") || (q.line && false))
const mcQs = questions.filter((q) => q.type === "MC")
const tfQs = questions.filter((q) => q.type === "TF")
const saQs = questions.filter((q) => q.type === "SA")
console.log("MC/TF/SA counts (parser cu):", mcQs.length, tfQs.length, saQs.length)

const imgInOptions = questions.filter((q) => (q.options || []).some((o) => /@@IMG\d+@@/.test(o.content))).length
const imgInStem = questions.filter((q) => /@@IMG\d+@@/.test(q.content)).length
console.log("cau co @@IMG trong stem:", imgInStem)
console.log("cau co @@IMG trong option:", imgInOptions)

if (wmf.length > 0) {
  console.error("THAT BAI: van con anh WMF khong doi duoc sang SVG")
  process.exit(1)
}
if (svg.length < 20) {
  console.error(`THAT BAI: so anh SVG (${svg.length}) < 20`)
  process.exit(1)
}
if (pre.maths.length < 20) {
  console.error(`THAT BAI: so OMML (${pre.maths.length}) < 20 (ky vong ~23)`)
  process.exit(1)
}
if (mathsOk.length === 0) {
  console.error("THAT BAI: khong convert duoc OMML nao sang SVG")
  process.exit(1)
}
if (leftoverMath > 0) {
  console.error("THAT BAI: token @@MATH con sot trong sourceText")
  process.exit(1)
}

const firstSvg = Buffer.from(svg[0].split(",")[1], "base64").toString("utf8")
if (!firstSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
  console.error("THAT BAI: SVG thieu default namespace, browser se khong render")
  process.exit(1)
}
console.log("OK: khong con WMF, OMML da thay bang anh SVG, khong sot @@MATH")
