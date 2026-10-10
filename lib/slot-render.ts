import type { UnderlinedTerm } from "@/types"
import { cleanContentDisplay } from "./content-display"

export type SlotPart =
  | { type: "text"; value: string }
  | { type: "slot"; term: UnderlinedTerm }

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

function cutByOffset(content: string, terms: UnderlinedTerm[]): SlotPart[] | null {
  const placements = [...terms]
    .filter((t) => t.text)
    .map((t) => ({ start: t.start as number, end: t.end as number, term: t }))
    .sort((a, b) => a.start - b.start || a.term.slotIndex - b.term.slotIndex)

  let seen = 0
  for (const p of placements) {
    if (p.start < seen) return null
    seen = p.end
  }

  const parts: SlotPart[] = []
  let cursor = 0
  for (const p of placements) {
    if (p.start > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, p.start) })
    }
    parts.push({ type: "slot", term: p.term })
    cursor = p.end
  }
  if (cursor < content.length) {
    parts.push({ type: "text", value: content.slice(cursor) })
  }
  return parts
}

function renderSlotsLegacy(content: string, terms: UnderlinedTerm[]): SlotPart[] {
  const cleanContent = cleanContentDisplay(content)
  const placements: { start: number; end: number; term: UnderlinedTerm }[] = []
  const claimed: { start: number; end: number }[] = []

  const overlaps = (s: number, e: number) => claimed.some((c) => s < c.end && e > c.start)

  const ordered = [...terms].sort((a, b) => a.slotIndex - b.slotIndex)
  for (const term of ordered) {
    if (!term.text) continue
    let from = 0
    let idx = cleanContent.indexOf(term.text, from)
    while (idx !== -1) {
      const end = idx + term.text.length
      if (!overlaps(idx, end)) {
        placements.push({ start: idx, end, term })
        claimed.push({ start: idx, end })
        break
      }
      from = idx + 1
      idx = cleanContent.indexOf(term.text, from)
    }
  }

  placements.sort((a, b) => a.start - b.start)

  const parts: SlotPart[] = []
  let cursor = 0
  for (const p of placements) {
    if (p.start > cursor) {
      parts.push({ type: "text", value: cleanContent.slice(cursor, p.start) })
    }
    parts.push({ type: "slot", term: p.term })
    cursor = p.end
  }
  if (cursor < cleanContent.length) {
    parts.push({ type: "text", value: cleanContent.slice(cursor) })
  }
  return parts
}

export function renderSlots(content: string, terms: UnderlinedTerm[]): SlotPart[] {
  if (offsetsValid(content, terms)) {
    const parts = cutByOffset(content, terms)
    if (parts) return parts
  }
  console.warn("renderSlots legacy", { texts: terms.map((t) => t.text) })
  return renderSlotsLegacy(content, terms)
}
