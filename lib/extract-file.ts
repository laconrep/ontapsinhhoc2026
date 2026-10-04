import mammoth from "mammoth"
import { parseTextContent, parseHtmlToResultAndText, type ParseResult } from "./worksheet-parser"
import { isConvertibleMetafile, wmfToSvg } from "./docx-equations"
import { preprocessOmml } from "./docx-omml"

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

const EQ_SVG_FONT_PX = 18
const EQ_TEXT_RATIO = 0.85
const EQ_MIN_EM = 1.5
const EQ_MAX_EM = 3.6

function equationHeightEm(src: string): number | null {
  const b64 = src.match(/^data:image\/svg\+xml;base64,(.+)$/i)?.[1]
  if (!b64) return null
  try {
    const svg = Buffer.from(b64, "base64").toString("utf8")
    const vb = svg.match(/viewBox\s*=\s*["'][\d.\-]+[ ,]+[\d.\-]+[ ,]+[\d.]+[ ,]+([\d.]+)["']/i)?.[1]
    const h = Number(vb ?? svg.match(/<svg\b[^>]*\bheight\s*=\s*["']([\d.]+)/i)?.[1])
    if (!Number.isFinite(h) || h <= 0) return null
    const em = (h * EQ_TEXT_RATIO) / EQ_SVG_FONT_PX
    return Math.round(Math.min(EQ_MAX_EM, Math.max(EQ_MIN_EM, em)) * 10) / 10
  } catch {
    return null
  }
}

function withEqInlineStyle(tag: string, em: number | null): string {
  if (!em) return tag
  const style = `height:${em}em;width:auto`
  if (/\bstyle\s*=/.test(tag)) {
    return tag.replace(/\bstyle\s*=\s*["'][^"']*["']/i, `style="${style}"`)
  }
  return tag.replace(/<img\b/i, `<img style="${style}"`)
}

function tagEquationImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
    const cls = tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? ""
    const isInline = /\beq-inline\b/.test(cls)
    const isFigure = /\beq-figure\b/.test(cls)
    if (!/data:image\/svg\+xml/i.test(src)) {
      if (isInline || isFigure) return tag
      return tag.replace(/<img\b/i, `<img class="eq-figure"`)
    }
    const em = equationHeightEm(src)
    if (isFigure) return tag
    const next = isInline ? tag : tag.replace(/<img\b/i, `<img class="eq-inline"`)
    return withEqInlineStyle(next, em)
  })
}

export type FileKind = "txt" | "pdf" | "docx"

export interface ExtractResult {
  parseResult: ParseResult
  sourceText: string
  images: string[]
  tables: string[]
}

/** Nhận diện loại file bằng magic bytes + phần mở rộng, không tin tên file tuyệt đối. */
export function detectKind(buffer: Buffer, filename: string): FileKind | null {
  const name = filename.toLowerCase()
  // PDF = "%PDF"
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") return "pdf"
  // DOCX = PK\x03\x04 (zip) + đuôi .docx
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    name.endsWith(".docx")
  ) {
    return "docx"
  }
  // TXT: đuôi .txt và không phải nhị phân
  if (name.endsWith(".txt")) return "txt"
  return null
}

/** Trích xuất và parse nội dung file. sourceText cung dong voi errors[].line. */
export async function extractAndParse(buffer: Buffer, filename: string): Promise<ExtractResult> {
  const kind = detectKind(buffer, filename)
  if (!kind) {
    throw new Error("Loại file không hỗ trợ. Chỉ chấp nhận .txt, .docx, .pdf")
  }
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error("File vượt quá 10MB")
  }

  if (kind === "txt") {
    const sourceText = buffer.toString("utf8")
    return { parseResult: parseTextContent(sourceText), sourceText, images: [], tables: [] }
  }

  if (kind === "docx") {
    const { buffer: buf2, maths } = await preprocessOmml(buffer)
    const { value: rawHtml } = await mammoth.convertToHtml(
      { buffer: buf2 },
      {
        styleMap: ["u => u"],
        convertImage: mammoth.images.imgElement(async (image) => {
          if (isConvertibleMetafile(image.contentType)) {
            const raw = await image.read()
            const svg = await wmfToSvg(raw)
            if (svg) return { src: svg }
            return { src: `data:${image.contentType};base64,${raw.toString("base64")}` }
          }
          const encoded = await image.readAsBase64String()
          return { src: `data:${image.contentType};base64,${encoded}` }
        }),
      },
    )
    const html = rawHtml.replace(/@@MATH(\d+)@@/g, (_, n: string) => {
      const src = maths[+n]
      return src ? `<img src="${src}" class="eq-inline" alt="">` : "[công thức]"
    })
    return parseHtmlToResultAndText(tagEquationImages(html))
  }

  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const res = await parser.getText()
    const sourceText = res.text
    return { parseResult: parseTextContent(sourceText), sourceText, images: [], tables: [] }
  } finally {
    await parser.destroy()
  }
}
