import { isCauHeading, type ParseResult } from "./worksheet-parser"

export interface LineRange {
  startLine: number
  endLine: number
}

export function offsetRange(
  text: string,
  startLine: number,
  endLine: number,
): { start: number; end: number } {
  const lines = text.split("\n")
  let start = 0
  const from = Math.max(1, startLine) - 1
  const to = Math.max(from, Math.min(endLine, lines.length) - 1)
  for (let i = 0; i < from && i < lines.length; i++) start += lines[i].length + 1
  let end = start
  for (let i = from; i <= to && i < lines.length; i++) {
    end += lines[i].length
    if (i < to) end += 1
  }
  return { start, end }
}

function isTailHeading(line: string): boolean {
  const s = line.trim()
  if (/^(đáp\s*án|dap\s*an)\s*:/i.test(s)) return false
  if (/^(đáp\s*án|dap\s*an)(\s|$)/i.test(s)) return true
  if (/^(hướng\s*dẫn\s*giải|huong\s*dan\s*giai)\b/i.test(s)) return true
  return false
}

export function blockRange(text: string, line: number, message?: string): LineRange {
  const lines = text.split("\n")
  if (lines.length === 0) return { startLine: 1, endLine: 1 }
  const idx = Math.max(1, Math.min(line, lines.length)) - 1
  const t = (i: number) => lines[i]?.trim() ?? ""
  const cur = t(idx)

  if (cur.startsWith("-") || (message != null && message.includes("Điểm kiến thức"))) {
    return { startLine: idx + 1, endLine: idx + 1 }
  }

  const isQStart = (s: string) => /^#{1,3}(\s|$)/.test(s) || isCauHeading(s)
  const isNewBlock = (s: string) =>
    s.startsWith("#") ||
    s.startsWith("{") ||
    s.startsWith("[") ||
    s.startsWith("-") ||
    s.startsWith("+") ||
    s.startsWith("*") ||
    s.startsWith("//") ||
    isTailHeading(s)

  let start = idx
  while (start > 0 && !isQStart(t(start))) start -= 1
  if (!isQStart(t(start))) start = idx

  let seenCau = isCauHeading(t(start))
  let end = idx
  for (let i = start + 1; i < lines.length; i++) {
    const s = t(i)
    if (s && isNewBlock(s)) break
    if (s && isCauHeading(s)) {
      if (seenCau) break
      seenCau = true
    }
    end = i
  }
  if (end < idx) end = idx
  return { startLine: start + 1, endLine: end + 1 }
}

/** Tập hợp các dòng bắt đầu một điểm kiến thức trong kết quả parse. */
export function collectKpLines(parseResult: ParseResult): Set<number> {
  const lines = new Set<number>()
  for (const chapter of parseResult.chapters ?? []) {
    for (const lesson of chapter.lessons ?? []) {
      for (const kp of lesson.knowledgePoints ?? []) {
        if (typeof kp.line === "number") lines.add(kp.line)
      }
    }
  }
  return lines
}

/**
 * Khối đang sửa có phải khối điểm kiến thức không — quyết định khung
 * sửa có bật Ctrl+click gạch chân hay không. Trước đây chỉ nhận diện
 * bằng tiền tố "-" ở dòng đầu khối, nên điểm kiến thức dạng "1. ...",
 * "a. ..." (luật §19 công nhận là điểm riêng) bị mất chức năng gạch
 * chân dù parse đã xác định đó là điểm. Nay nhận diện thêm bằng dòng
 * bắt đầu của khối có nằm trong tập dòng điểm của parse hay không.
 */
export function isKpBlock(
  block: string,
  message: string | undefined,
  kpLines: Set<number>,
  startLine: number,
): boolean {
  const first = block.split("\n")[0]?.trim() ?? ""
  if (first.startsWith("-")) return true
  if (message != null && message.includes("Điểm kiến thức")) return true
  return kpLines.has(startLine)
}

export function spliceBlock(text: string, startLine: number, endLine: number, edit: string): string {
  const lines = text.split("\n")
  const before = lines.slice(0, Math.max(0, startLine - 1))
  const after = lines.slice(Math.max(0, endLine))
  return [...before, ...edit.split("\n"), ...after].join("\n")
}

export function collectMediaTokens(text: string): string[] {
  return text.match(/@@(?:IMG|TBL)\d+@@/g) ?? []
}
