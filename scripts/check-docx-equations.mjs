// Script kiem tra tam cho phien 1: MathType OLE (WMF) -> SVG.
// Chay: tsx scripts/check-docx-equations.mjs
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { extractAndParse } from "../lib/extract-file.ts"

const DOCX = process.argv[2] || "BAI 1 - GENE VA SU TAI BAN DNA.docx"

const buffer = readFileSync(resolve(process.cwd(), DOCX))
const result = await extractAndParse(buffer, DOCX)

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

if (wmf.length > 0) {
  console.error("THAT BAI: van con anh WMF khong doi duoc sang SVG")
  process.exit(1)
}
if (svg.length < 20) {
  console.error(`THAT BAI: so anh SVG (${svg.length}) < 20`)
  process.exit(1)
}

const firstSvg = Buffer.from(svg[0].split(",")[1], "base64").toString("utf8")
if (!firstSvg.includes('xmlns="http://www.w3.org/2000/svg"')) {
  console.error("THAT BAI: SVG thieu default namespace, browser se khong render")
  process.exit(1)
}
console.log("OK: khong con WMF, so anh SVG >= 20, co default namespace")
