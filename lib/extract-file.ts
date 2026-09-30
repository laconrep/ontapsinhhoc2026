import mammoth from "mammoth"
import { parseTextContent, parseHtmlToResultAndText, type ParseResult } from "./worksheet-parser"

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export type FileKind = "txt" | "pdf" | "docx"

export interface ExtractResult {
  parseResult: ParseResult
  sourceText: string
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
    return { parseResult: parseTextContent(sourceText), sourceText }
  }

  if (kind === "docx") {
    const { value: html } = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: ["u => u"],
        convertImage: mammoth.images.imgElement(async (image) => {
          const encoded = await image.readAsBase64String()
          return { src: `data:${image.contentType};base64,${encoded}` }
        }),
      },
    )
    return parseHtmlToResultAndText(html)
  }

  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const res = await parser.getText()
    const sourceText = res.text
    return { parseResult: parseTextContent(sourceText), sourceText }
  } finally {
    await parser.destroy()
  }
}
