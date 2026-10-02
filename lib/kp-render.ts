import { extractBlanks } from "@/lib/worksheet-parser"
import type { UnderlinedTerm } from "@/types"

export function renderMarkedContent(content: string, terms: UnderlinedTerm[]): string {
  const sorted = [...terms].sort((a, b) => a.slotIndex - b.slotIndex)
  let cursor = 0
  let out = ""
  for (const term of sorted) {
    const idx = content.indexOf(term.text, cursor)
    if (idx < 0) continue
    out += content.slice(cursor, idx)
    const syn = (term.synonyms ?? []).filter((s) => s.trim().length > 0)
    const inner = syn.length > 0 ? `${term.text}|${syn.join("|")}` : term.text
    if (term.allowSwap) out += `__"${inner}"__`
    else out += `__${inner}__`
    cursor = idx + term.text.length
  }
  out += content.slice(cursor)
  return out
}

export function parseMarkedContent(raw: string): { content: string; underlinedTerms: UnderlinedTerm[] } {
  return extractBlanks(raw)
}
