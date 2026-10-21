import type { UnderlinedTerm } from "@/types"
import { seededShuffle } from "@/lib/grading"
import { normalizeAnswer } from "@/lib/scoring"
import { cleanContentDisplay } from "./content-display"

export type SlotPart =
  | { type: "text"; value: string }
  | { type: "slot"; term: UnderlinedTerm }

export type ClientSlotPart =
  | { type: "text"; value: string }
  | { type: "slot"; slotIndex: number; groupId: string | null }

export type DragChip = { id: string; text: string }

export const REVEAL_FILL_AT = 3
export const REVEAL_DRAG_AT = 2

export type SlotGradeClient = {
  slotIndex: number
  isCorrect: boolean
  hint?: string
  correctAnswer?: string
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
  const parts = renderSlotsLegacy(content, terms)
  // Legacy có thể KHÔNG tìm thấy một term trong content (offset DB lệch) và
  // âm thầm làm mất ô đó khỏi parts: client chỉ thấy các ô còn lại trong khi
  // server vẫn chấm trên toàn bộ terms -> lệch kết quả (xem sualogic.md mục 10).
  // Phân biệt hai mức: rơi xuống legacy nhưng tìm đủ ô (warn) và mất ô (error).
  const present = new Set(
    parts.filter((p) => p.type === "slot").map((p) => (p as { term: UnderlinedTerm }).term.slotIndex),
  )
  const missing = terms.filter((t) => !present.has(t.slotIndex)).map((t) => t.slotIndex)
  if (missing.length > 0) {
    console.error("renderSlots legacy missing slots", {
      missing,
      texts: terms.map((t) => t.text),
    })
  } else {
    console.warn("renderSlots legacy", { texts: terms.map((t) => t.text) })
  }
  return parts
}

export function toClientSlotParts(parts: SlotPart[]): ClientSlotPart[] {
  return parts.map((p) =>
    p.type === "text"
      ? p
      : { type: "slot", slotIndex: p.term.slotIndex, groupId: p.term.swapGroupId ?? null },
  )
}

export function renderClientSlots(content: string, terms: UnderlinedTerm[]): ClientSlotPart[] {
  return toClientSlotParts(renderSlots(content, terms))
}

/** Số ô thực sự dựng được so với số term: lệch là dấu hiệu offset DB hỏng (BUG-01). */
export function countRenderedSlots(content: string, terms: UnderlinedTerm[]): number {
  return renderSlots(content, terms).filter((p) => p.type === "slot").length
}

export function slotRenderMismatch(content: string, terms: UnderlinedTerm[]): boolean {
  if (terms.length === 0) return false
  return countRenderedSlots(content, terms) !== terms.length
}

/**
 * Chuẩn bị KP trước khi LƯU (tạo/sửa/import): chuẩn hóa content và
 * term.text về NFC, tính lại end = start + text.length, rồi kiểm tra bất
 * biến content.slice(start, end) === text cho MỌI term. Không khớp -> ném
 * lỗi rõ ràng để giáo viên sửa, thay vì lưu dữ liệu lệch offset khiến học
 * sinh mất ô (BUG-01, BUG-12). Không tự đoán vị trí mới.
 */
export function prepareKpTermsForSave(
  content: string,
  terms: UnderlinedTerm[],
): { content: string; terms: UnderlinedTerm[] } {
  const nfcContent = (content ?? "").trim().normalize("NFC")
  const fixed = (terms ?? []).map((t) => {
    const text = (t.text ?? "").normalize("NFC")
    const hasStart = typeof t.start === "number" && Number.isInteger(t.start)
    return {
      ...t,
      text,
      start: hasStart ? (t.start as number) : t.start,
      end: hasStart ? (t.start as number) + text.length : t.end,
    }
  })
  const bad = fixed.filter(
    (t) =>
      typeof t.start !== "number" ||
      typeof t.end !== "number" ||
      t.start < 0 ||
      t.end > nfcContent.length ||
      nfcContent.slice(t.start, t.end) !== t.text,
  )
  if (bad.length > 0) {
    throw new Error(
      `Vị trí ô trống không khớp nội dung (${bad.map((t) => `"${t.text}"`).join(", ")}). Hãy kiểm tra lại phần gạch chân rồi lưu lại.`,
    )
  }
  return { content: nfcContent, terms: fixed }
}

export function acceptedNormsOf(terms: UnderlinedTerm[]): Set<string> {
  const out = new Set<string>()
  for (const t of terms) {
    out.add(normalizeAnswer(t.text))
    for (const s of t.synonyms ?? []) out.add(normalizeAnswer(s))
    for (const e of t.extraAccepted ?? []) out.add(normalizeAnswer(e))
  }
  return out
}

export function pickDistractors(
  pool: string[],
  terms: UnderlinedTerm[],
  rng: () => number,
  limit = 3,
): string[] {
  const blocked = acceptedNormsOf(terms)
  const seen = new Set<string>()
  const unique: string[] = []
  for (const d of pool) {
    const n = normalizeAnswer(d)
    if (!n || blocked.has(n) || seen.has(n)) continue
    seen.add(n)
    unique.push(d)
  }
  return seededShuffle(unique, rng).slice(0, limit)
}

export function buildDragChips(
  kpId: string,
  terms: UnderlinedTerm[],
  distractors: string[],
  rng: () => number,
): DragChip[] {
  const texts = [...terms.map((t) => t.text), ...distractors]
  return seededShuffle(texts, rng).map((text, index) => ({
    id: `${kpId}:${index}`,
    text,
  }))
}

export function stripFillResults(
  results: { slotIndex: number; isCorrect: boolean; correctAnswer: string }[],
  attemptsAfter: number,
  allCorrect: boolean,
): { stripped: SlotGradeClient[]; revealed: boolean } {
  let revealed = false
  const stripped = results.map((r) => {
    const out: SlotGradeClient = { slotIndex: r.slotIndex, isCorrect: r.isCorrect }
    if (allCorrect || r.isCorrect) return out
    if (attemptsAfter >= REVEAL_FILL_AT) {
      out.correctAnswer = r.correctAnswer
      revealed = true
    } else if (attemptsAfter >= 1) {
      const ch = (r.correctAnswer ?? "").charAt(0)
      if (ch) out.hint = ch
    }
    return out
  })
  return { stripped, revealed }
}

export function stripDragResults(
  results: { slotIndex: number; isCorrect: boolean; correctAnswer: string }[],
  attemptsAfter: number,
  allCorrect: boolean,
): { stripped: SlotGradeClient[]; revealed: boolean } {
  let revealed = false
  const stripped = results.map((r) => {
    const out: SlotGradeClient = { slotIndex: r.slotIndex, isCorrect: r.isCorrect }
    if (allCorrect || r.isCorrect) return out
    if (attemptsAfter >= REVEAL_DRAG_AT) {
      out.correctAnswer = r.correctAnswer
      revealed = true
    }
    return out
  })
  return { stripped, revealed }
}
