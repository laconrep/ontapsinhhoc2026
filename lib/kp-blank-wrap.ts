export interface WrapResult {
  text: string
  start: number
  end: number
}

function replaceRange(text: string, start: number, end: number, insert: string): WrapResult {
  const next = text.slice(0, start) + insert + text.slice(end)
  return { text: next, start, end: start + insert.length }
}

export function expandWord(text: string, start: number, end: number): { start: number; end: number } {
  let a = start
  let b = end
  if (a > b) {
    const t = a
    a = b
    b = t
  }
  if (a !== b) {
    while (a < b && /\s/.test(text[a])) a += 1
    while (b > a && /\s/.test(text[b - 1])) b -= 1
    return { start: a, end: b }
  }
  let l = a
  let r = a
  while (l > 0 && /\S/.test(text[l - 1])) l -= 1
  while (r < text.length && /\S/.test(text[r])) r += 1
  while (l < r && /[.,;:!?()[\]{}]/.test(text[l])) l += 1
  while (r > l && /[.,;:!?()[\]{}]/.test(text[r - 1])) r -= 1
  return { start: l, end: r }
}

function overlapsMedia(text: string, start: number, end: number): boolean {
  const re = /@@(?:IMG|TBL)\d+@@/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index < end && m.index + m[0].length > start) return true
  }
  return false
}

function includesKpBullet(text: string, start: number, end: number): boolean {
  const lineStart = text.lastIndexOf("\n", Math.max(0, start - 1)) + 1
  if (!text.startsWith("-", lineStart)) return false
  const afterDash = text[lineStart + 1] === " " ? lineStart + 2 : lineStart + 1
  return start < afterDash && end > start
}

function toggleFixed(text: string, start: number, end: number): WrapResult {
  const sel = text.slice(start, end)
  if (sel.startsWith("__") && sel.endsWith("__") && sel.length > 4) {
    return replaceRange(text, start, end, sel.slice(2, -2))
  }
  if (text.slice(Math.max(0, start - 2), start) === "__" && text.slice(end, end + 2) === "__") {
    return replaceRange(text, start - 2, end + 2, sel)
  }
  return replaceRange(text, start, end, `__${sel}__`)
}

interface UnderlineSpan {
  start: number
  end: number
}

/**
 * Tìm cụm đã gạch chân mà con trỏ/vùng chọn đang chạm vào. Cần kiểm tra
 * TRƯỚC expandWord vì "_" được tính là ký tự từ: không chặn trước thì
 * caret trong "__phân tử__" bị nở thành "__phân" rồi bọc thêm một lớp
 * dấu nữa thành "____phân__ tử__" thay vì gỡ gạch như thiết kế.
 */
function spanAt(
  text: string,
  start: number,
  end: number,
): { toggle: UnderlineSpan | null; blocked: boolean } {
  const re = /__([\s\S]+?)__/g
  let m: RegExpExecArray | null
  let blocked = false
  while ((m = re.exec(text)) !== null) {
    const open = m.index
    const close = open + m[0].length
    if (start === end) {
      if (open <= start && start < close) return { toggle: { start: open, end: close }, blocked: false }
    } else if (open <= start && end <= close) {
      return { toggle: { start: open, end: close }, blocked: false }
    } else if (start < close && open < end) {
      blocked = true
    }
  }
  return { toggle: null, blocked }
}

export function applyKpWrap(text: string, start: number, end: number): WrapResult {
  const { toggle, blocked } = spanAt(text, start, end)
  if (toggle) {
    const inner = text.slice(toggle.start + 2, toggle.end - 2)
    return replaceRange(text, toggle.start, toggle.end, inner)
  }
  // Vùng chọn giao một phần với dấu gạch nhưng không nằm gọn trong một
  // cụm: không bọc thêm để khỏi làm hỏng dấu, để giáo viên chọn lại.
  if (blocked) return { text, start, end }
  const exp = expandWord(text, start, end)
  if (exp.start === exp.end) return { text, start: exp.start, end: exp.end }
  if (overlapsMedia(text, exp.start, exp.end)) return { text, start: exp.start, end: exp.end }
  if (includesKpBullet(text, exp.start, exp.end)) return { text, start: exp.start, end: exp.end }
  return toggleFixed(text, exp.start, exp.end)
}
