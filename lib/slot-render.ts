import type { UnderlinedTerm } from "@/types"
import { cleanContentDisplay } from "./content-display"

export type SlotPart =
  | { type: "text"; value: string }
  | { type: "slot"; term: UnderlinedTerm }

/**
 * Chia nội dung KP thành các phần text và slot (ô trống), dựa trên vị trí
 * xuất hiện đầu tiên của mỗi term trong content. Mỗi term (theo slotIndex)
 * thay thế đúng 1 lần xuất hiện, xử lý theo thứ tự trong văn bản để tránh
 * chồng lấn khi nhiều term có cùng chuỗi.
 * 
 * Bỏ dấu ngoặc kép xung quanh từ hoán đổi trước khi render.
 */
export function renderSlots(content: string, terms: UnderlinedTerm[]): SlotPart[] {
  // Bỏ dấu ngoặc kép trước khi tìm slot
  const cleanContent = cleanContentDisplay(content)
  // Tìm vị trí cho từng term (occurrence đầu tiên chưa bị chiếm)
  const placements: { start: number; end: number; term: UnderlinedTerm }[] = []
  const claimed: { start: number; end: number }[] = []

  const overlaps = (s: number, e: number) =>
    claimed.some((c) => s < c.end && e > c.start)

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
