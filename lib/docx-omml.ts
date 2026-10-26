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

function replaceOmmlFragments(
  xml: string,
  maths: (string | null)[],
  re: RegExp,
  wrapInParagraph: boolean,
): string {
  return xml.replace(re, (fragment) => {
    const i = maths.length
    maths.push(ommlToSvgDataUri(fragment))
    const run = `<w:r><w:t xml:space="preserve">@@MATH${i}@@</w:t></w:r>`
    // §34b: oMathPara là khối (block) — thay bằng run trần ngoài mọi
    // <w:p> sẽ làm mammoth gán token vào ĐẦU đoạn sau (tái hiện: công
    // thức hiển thị của câu trước rơi lên đầu câu sau, vd phân số của
    // Q21 hiện trên đầu Q22). Khối phải thành đoạn riêng của nó.
    // oMath nội tuyến thì ngược lại: run trần trong đoạn là đúng vị trí.
    return wrapInParagraph ? `<w:p>${run}</w:p>` : run
  })
}

// --- SEC-06: giới hạn chống zip bomb -------------------------------------
// Duyệt danh sách entry (kích thước giải nén lấy từ central directory,
// CHƯA giải nén nội dung) và từ chối file vượt ngưỡng trước khi xử lý.
export const MAX_ZIP_ENTRIES = 2000
export const MAX_ZIP_TOTAL_UNCOMPRESSED = 50 * 1024 * 1024 // 50MB
export const MAX_DOCUMENT_XML_SIZE = 20 * 1024 * 1024 // 20MB
export const MAX_SINGLE_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_IMAGE_COUNT = 200

const GUARD_PREFIX = "File tải lên bị từ chối:"

export function assertDocxZipSafe(zip: JSZip): void {
  const files = Object.values(zip.files).filter((f) => !f.dir)
  if (files.length > MAX_ZIP_ENTRIES) {
    throw new Error(`${GUARD_PREFIX} file nén có quá nhiều thành phần (>${MAX_ZIP_ENTRIES})`)
  }
  let total = 0
  let imageCount = 0
  for (const f of files) {
    const size =
      (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0
    total += size
    if (f.name === "word/document.xml" && size > MAX_DOCUMENT_XML_SIZE) {
      throw new Error(`${GUARD_PREFIX} nội dung tài liệu giải nén vượt quá 20MB`)
    }
    if (/^word\/media\//i.test(f.name)) {
      imageCount += 1
      if (size > MAX_SINGLE_IMAGE_SIZE) {
        throw new Error(`${GUARD_PREFIX} có ảnh đơn lẻ vượt quá 5MB`)
      }
    }
  }
  if (total > MAX_ZIP_TOTAL_UNCOMPRESSED) {
    throw new Error(`${GUARD_PREFIX} tổng dung lượng giải nén vượt quá 50MB`)
  }
  if (imageCount > MAX_IMAGE_COUNT) {
    throw new Error(`${GUARD_PREFIX} số ảnh trong file vượt quá 200`)
  }
}

/**
 * Giai nen docx, thay moi m:oMath (va m:oMathPara) bang token @@MATHn@@,
 * dong thoi render SVG data URI tuong ung. Khong co oMath -> buffer goc.
 */
export async function preprocessOmml(buffer: Buffer): Promise<{ buffer: Buffer; maths: (string | null)[] }> {
  if (!buffer || buffer.length === 0) return { buffer, maths: [] }

  try {
    const zip = await JSZip.loadAsync(buffer)
    // SEC-06: quét entry TRƯỚC khi đọc/giải nén bất kỳ nội dung nào.
    assertDocxZipSafe(zip)
    const docFile = zip.file("word/document.xml")
    if (!docFile) return { buffer, maths: [] }

    const xml = await docFile.async("string")
    if (!xml.includes("oMath")) return { buffer, maths: [] }

    const maths: (string | null)[] = []
    let next = replaceOmmlFragments(xml, maths, OMATH_PARA_RE, true)
    next = replaceOmmlFragments(next, maths, OMATH_RE, false)
    if (maths.length === 0) return { buffer, maths: [] }

    zip.file("word/document.xml", next)
    const out = await zip.generateAsync({ type: "nodebuffer" })
    return { buffer: out, maths }
  } catch (e) {
    // SEC-06: lỗi guard (zip bomb...) phải nổi lên để route từ chối file;
    // các lỗi xử lý OMML khác vẫn nuốt như cũ (trả buffer gốc).
    if (e instanceof Error && e.message.startsWith(GUARD_PREFIX)) throw e
    return { buffer, maths: [] }
  }
}
