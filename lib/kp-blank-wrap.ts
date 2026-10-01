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

export function applyKpWrap(text: string, start: number, end: number): WrapResult {
  const exp = expandWord(text, start, end)
  if (exp.start === exp.end) return { text, start: exp.start, end: exp.end }
  if (overlapsMedia(text, exp.start, exp.end)) return { text, start: exp.start, end: exp.end }
  if (includesKpBullet(text, exp.start, exp.end)) return { text, start: exp.start, end: exp.end }
  return toggleFixed(text, exp.start, exp.end)
}
