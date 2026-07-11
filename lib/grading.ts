/**
 * EduSync — Logic chấm điểm dùng chung cho Tab 2/3/4 (student)
 * Chuyển thể từ student-progress.service.ts của spec v8.8.
 * Giữ đúng các FIX quan trọng: A-01 (swap group), A-02 (status lock),
 * V84-03 (computeOverallStatus theo nhánh luồng thực tế).
 */

import type { UnderlinedTerm } from "@/types"

export type SelfAssessment = "known" | "unknown" | null
export type FillDragStatus = "correct" | "incorrect" | null
export type OverallStatus = "not_started" | "known" | "unknown" | "mastered"

/** Chuẩn hoá đáp án: NFC + trim + lowercase (dùng cho FILL/DRAG/SA). */
export function normalizeAnswer(input: string): string {
  return (input ?? "").normalize("NFC").trim().toLowerCase()
}

/**
 * [FIX-V84-03] Tính overallStatus theo từng nhánh luồng thực tế.
 * Dùng chung cho Tab 1 (self), Tab 2 (fill), Tab 3 (drag).
 */
export function computeOverallStatus(args: {
  selfAssessment: SelfAssessment
  fillStatus: FillDragStatus
  dragStatus: FillDragStatus
}): OverallStatus {
  const { selfAssessment, fillStatus, dragStatus } = args

  // Bước 1: tín hiệu sai
  if (fillStatus === "incorrect" && dragStatus === null) return "unknown"
  if (fillStatus === "incorrect" && dragStatus === "incorrect") return "unknown"

  // Bước 2: tín hiệu đúng
  if (fillStatus === "correct") return "mastered"
  if (dragStatus === "correct") return "mastered"

  // Bước 3: chưa làm bài tập nào
  if (selfAssessment === "known") return "known"
  if (selfAssessment === "unknown") return "unknown"
  return "not_started"
}

/**
 * Chấm một câu FILL/DRAG có xét swap-group.
 * [FIX A-01]:
 *  - group allowSwap=false: so từng slot riêng (có xét extraAccepted)
 *  - group allowSwap=true: set-equality toàn group; nếu không khớp → cả group sai
 * Trả về kết quả từng slot + allCorrect.
 */
export function gradeSlots(
  terms: UnderlinedTerm[],
  answers: Record<number, string>,
): { results: { slotIndex: number; isCorrect: boolean; correctAnswer: string }[]; allCorrect: boolean } {
  // gom slot theo group (slot không có swapGroupId → group riêng theo slotIndex)
  const groups = new Map<string, UnderlinedTerm[]>()
  for (const t of terms) {
    const key = t.swapGroupId ? `g:${t.swapGroupId}` : `s:${t.slotIndex}`
    const arr = groups.get(key) ?? []
    arr.push(t)
    groups.set(key, arr)
  }

  const resultMap = new Map<number, { slotIndex: number; isCorrect: boolean; correctAnswer: string }>()

  const accepts = (term: UnderlinedTerm, value: string) => {
    const norm = normalizeAnswer(value)
    if (norm === normalizeAnswer(term.text)) return true
    return (term.extraAccepted ?? []).some((e) => normalizeAnswer(e) === norm)
  }

  for (const [, groupTerms] of groups) {
    const allowSwap = groupTerms.some((t) => t.allowSwap)
    if (allowSwap && groupTerms.length > 1) {
      // set equality: tập đáp án HS đặt vào group so với tập đáp án đúng
      const correctSet = groupTerms.map((t) => normalizeAnswer(t.text)).sort()
      const studentSet = groupTerms.map((t) => normalizeAnswer(answers[t.slotIndex] ?? "")).sort()
      // xét cả extraAccepted: nếu studentSet[i] được chấp nhận bởi bất kỳ term nào thì quy về text đúng
      let ok = correctSet.length === studentSet.length
      if (ok) {
        // greedy match từng student answer với 1 term chưa dùng
        const remaining = [...groupTerms]
        for (const t of groupTerms) {
          const val = answers[t.slotIndex] ?? ""
          const idx = remaining.findIndex((rt) => accepts(rt, val))
          if (idx === -1) {
            ok = false
            break
          }
          remaining.splice(idx, 1)
        }
      }
      for (const t of groupTerms) {
        resultMap.set(t.slotIndex, { slotIndex: t.slotIndex, isCorrect: ok, correctAnswer: t.text })
      }
    } else {
      // so từng slot riêng
      for (const t of groupTerms) {
        const ok = accepts(t, answers[t.slotIndex] ?? "")
        resultMap.set(t.slotIndex, { slotIndex: t.slotIndex, isCorrect: ok, correctAnswer: t.text })
      }
    }
  }

  const results = [...resultMap.values()].sort((a, b) => a.slotIndex - b.slotIndex)
  const allCorrect = results.length > 0 && results.every((r) => r.isCorrect)
  return { results, allCorrect }
}

/** Seeded RNG (mulberry32) — thay cho seedrandom, để xáo trộn ổn định theo attempt. */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Xáo trộn mảng bằng seeded RNG (Fisher-Yates). */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
