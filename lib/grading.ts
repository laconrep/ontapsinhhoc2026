/**
 * EduSync — Logic chấm điểm dùng chung cho Tab 2/3/4 (student)
 * Chuyển thể từ student-progress.service.ts của spec v8.8.
 * Giữ đúng các FIX quan trọng: A-01 (swap group), A-02 (status lock),
 * V84-03 (computeOverallStatus theo nhánh luồng thực tế).
 *
 * normalizeAnswer / gradeSlots sống ở lib/scoring.ts (thuần, không DB).
 */

export {
  normalizeAnswer,
  gradeSlots,
  gradeMC,
  gradeTF,
  gradeSA,
  scoreLinear,
  gradeLive,
  resolveFirstTry,
  inferFirstTryFromHistory,
  isOverconfident,
} from "@/lib/scoring"

export type SelfAssessment = "known" | "unknown" | null
export type FillDragStatus = "correct" | "incorrect" | null
export type OverallStatus = "not_started" | "known" | "unknown" | "mastered"

export type SlotAnswer = { slotIndex: number; value: string }

export function toAnswerMap(answers: unknown): Record<number, string> {
  const out: Record<number, string> = {}
  if (answers == null) return out
  if (Array.isArray(answers)) {
    for (let i = 0; i < answers.length; i++) {
      const item = answers[i]
      if (typeof item === "string") {
        out[i] = item
        continue
      }
      if (item && typeof item === "object" && "slotIndex" in item) {
        const rec = item as { slotIndex: unknown; value?: unknown }
        const idx = Number(rec.slotIndex)
        if (Number.isFinite(idx)) out[idx] = String(rec.value ?? "")
      }
    }
    return out
  }
  if (typeof answers === "object") {
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      const idx = Number(k)
      if (!Number.isFinite(idx) || v == null) continue
      out[idx] = String(v)
    }
  }
  return out
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

  if (fillStatus === "incorrect" && dragStatus === null) return "unknown"
  if (fillStatus === "incorrect" && dragStatus === "incorrect") return "unknown"

  if (fillStatus === "correct") return "mastered"
  if (dragStatus === "correct") return "mastered"

  if (selfAssessment === "known") return "known"
  if (selfAssessment === "unknown") return "unknown"
  return "not_started"
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
