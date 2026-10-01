import { DOMParser } from "@xmldom/xmldom"
import JSZip from "jszip"
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js"
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js"
import { MathML } from "mathjax-full/js/input/mathml.js"
import { mathjax } from "mathjax-full/js/mathjax.js"
import { SVG } from "mathjax-full/js/output/svg.js"
import omml2mathml from "omml2mathml"

/**
 * Chuyen cong thuc Word native (OMML m:oMath) sang SVG data URI.
 * Server-only: unzip docx, MathJax, xmldom.
 */

const MATH_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

const OMATH_RE = /<m:oMath\b[^>]*>[\s\S]*?<\/m:oMath>/g
const OMATH_PARA_RE = /<m:oMathPara\b[^>]*>[\s\S]*?<\/m:oMathPara>/g

type MathJaxRuntime = {
  adaptor: ReturnType<typeof liteAdaptor>
  document: ReturnType<typeof mathjax.document>
}

let mjRuntime: MathJaxRuntime | null = null

function getMathJax(): MathJaxRuntime {
  if (mjRuntime) return mjRuntime
  const adaptor = liteAdaptor()
  RegisterHTMLHandler(adaptor)
  const document = mathjax.document("", {
    InputJax: new MathML(),
    OutputJax: new SVG({ fontCache: "none" }),
  })
  mjRuntime = { adaptor, document }
  return mjRuntime
}

function ensureSvgNamespace(svg: string): string {
  const match = svg.match(/<svg\b([^>]*)>/)
  if (!match) return svg
  if (/\bxmlns\s*=/.test(match[1])) return svg
  return svg.replace(/<svg\b([^>]*)>/, `<svg xmlns="http://www.w3.org/2000/svg"$1>`)
}

/** OMML fragment -> data URI SVG. Loi 1 cong thuc -> null, khong fail ca file. */
export function ommlToSvgDataUri(ommlFragment: string): string | null {
  if (!ommlFragment || !ommlFragment.includes("oMath")) return null
  try {
    const wrapped = `<w:document xmlns:m="${MATH_NS}" xmlns:w="${W_NS}">${ommlFragment}</w:document>`
    const doc = new DOMParser().parseFromString(wrapped, "text/xml")
    const oMathEl =
      doc.getElementsByTagNameNS(MATH_NS, "oMath")[0] ||
      doc.getElementsByTagNameNS(MATH_NS, "oMathPara")[0]
    if (!oMathEl) return null

    const mathEl = omml2mathml(oMathEl)
    const mathml = mathEl?.outerHTML
    if (!mathml || !mathml.includes("<math")) return null

    const mj = getMathJax()
    const node = mj.document.convert(mathml, { display: false })
    const html = mj.adaptor.outerHTML(node)
    const svgMatch = html.match(/<svg\b[\s\S]*?<\/svg>/i)
    if (!svgMatch) return null

    const svg = ensureSvgNamespace(svgMatch[0])
    return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`
  } catch {
    return null
  }
}

function replaceOmmlFragments(xml: string, maths: (string | null)[], re: RegExp): string {
  return xml.replace(re, (fragment) => {
    const i = maths.length
    maths.push(ommlToSvgDataUri(fragment))
    return `<w:r><w:t xml:space="preserve">@@MATH${i}@@</w:t></w:r>`
  })
}

/**
 * Giai nen docx, thay moi m:oMath (va m:oMathPara) bang token @@MATHn@@,
 * dong thoi render SVG data URI tuong ung. Khong co oMath -> buffer goc.
 */
export async function preprocessOmml(buffer: Buffer): Promise<{ buffer: Buffer; maths: (string | null)[] }> {
  if (!buffer || buffer.length === 0) return { buffer, maths: [] }

  try {
    const zip = await JSZip.loadAsync(buffer)
    const docFile = zip.file("word/document.xml")
    if (!docFile) return { buffer, maths: [] }

    const xml = await docFile.async("string")
    if (!xml.includes("oMath")) return { buffer, maths: [] }

    const maths: (string | null)[] = []
    let next = replaceOmmlFragments(xml, maths, OMATH_PARA_RE)
    next = replaceOmmlFragments(next, maths, OMATH_RE)
    if (maths.length === 0) return { buffer, maths: [] }

    zip.file("word/document.xml", next)
    const out = await zip.generateAsync({ type: "nodebuffer" })
    return { buffer: out, maths }
  } catch {
    return { buffer, maths: [] }
  }
}
