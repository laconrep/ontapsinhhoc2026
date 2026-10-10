import { extractBlanks } from "@/lib/worksheet-parser"
import type { UnderlinedTerm } from "@/types"

function wrapTerm(term: UnderlinedTerm): string {
  const syn = (term.synonyms ?? []).filter((s) => s.trim().length > 0)
  const inner = syn.length > 0 ? `${term.text}|${syn.join("|")}` : term.text
  if (term.allowSwap) return `__"${inner}"__`
  return `__${inner}__`
}

function offsetsValid(content: string, terms: UnderlinedTerm[]): boolean {
  return terms.every(
    (t) =>
      typeof t.start === "number" &&
      typeof t.end === "number" &&
      Number.isInteger(t.start) &&
      Number.isInteger(t.end) &&
      t.start >= 0 &&
      t.end <= content.length &&
      t.end >= t.start &&
      content.slice(t.start, t.end) === t.text,
  )
}

function renderMarkedByOffset(content: string, terms: UnderlinedTerm[]): string | null {
  const sorted = [...terms]
    .filter((t) => t.text)
    .sort((a, b) => (a.start as number) - (b.start as number) || a.slotIndex - b.slotIndex)
  let cursor = 0
  let out = ""
  for (const term of sorted) {
    const start = term.start as number
    const end = term.end as number
    if (start < cursor) return null
    out += content.slice(cursor, start)
    out += wrapTerm(term)
    cursor = end
  }
  out += content.slice(cursor)
  return out
}

export function renderMarkedContent(content: string, terms: UnderlinedTerm[]): string {
  const usable = terms.filter((t) => t.text)
  if (usable.length === 0) return content
  if (offsetsValid(content, usable)) {
    const marked = renderMarkedByOffset(content, usable)
    if (marked != null) return marked
  }
  console.warn("renderMarkedContent legacy", { texts: usable.map((t) => t.text) })
  const sorted = [...usable].sort((a, b) => a.slotIndex - b.slotIndex)
  let cursor = 0
  let out = ""
  for (const term of sorted) {
    const idx = content.indexOf(term.text, cursor)
    if (idx < 0) continue
    out += content.slice(cursor, idx)
    out += wrapTerm(term)
    cursor = idx + term.text.length
  }
  out += content.slice(cursor)
  return out
}

export function parseMarkedContent(raw: string): { content: string; underlinedTerms: UnderlinedTerm[] } {
  return extractBlanks(raw)
}
