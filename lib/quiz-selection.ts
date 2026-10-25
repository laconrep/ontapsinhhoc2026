import { seededShuffle } from "@/lib/grading"

export interface SelectableQuestion {
  id: string
  type: string
  knowledgePointId: string | null
  order: number
}

export interface SelectionResult {
  chosen: string[]
  mode: "by-kp" | "random" | "lesson"
}

export function selectQuizQuestions(
  qRows: SelectableQuestion[],
  kps: { id: string; order: number }[],
  isAssigned: (q: SelectableQuestion) => boolean,
  rng: () => number,
): SelectionResult {
  const assigned = qRows.filter(isAssigned)
  if (assigned.length > 0) {
    const kpOrder = new Map(kps.map((k) => [k.id, k.order]))
    const byKp = new Map<string, SelectableQuestion[]>()
    for (const q of assigned) {
      const kid = q.knowledgePointId
      if (!kid) continue
      const list = byKp.get(kid) ?? []
      list.push(q)
      byKp.set(kid, list)
    }
    const kpIdsSorted = [...byKp.keys()].sort(
      (a, b) => (kpOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (kpOrder.get(b) ?? Number.MAX_SAFE_INTEGER),
    )
    const chosen: string[] = []
    for (const kid of kpIdsSorted) {
      const list = (byKp.get(kid) ?? []).sort((a, b) => a.order - b.order)
      chosen.push(...list.map((q) => q.id))
    }
    const unassigned = qRows.filter((q) => !isAssigned(q)).sort((a, b) => a.order - b.order)
    chosen.push(...unassigned.map((q) => q.id))
    return { chosen, mode: "by-kp" }
  }

  // §25: bài toàn câu hỏi cấp bài học (không câu nào gắn KP) thì HIỆN
  // ĐỦ theo thứ tự trong bài (MC rồi TF rồi trả lời ngắn, đúng thứ tự
  // tài liệu) — KHÔNG rơi về chế độ ngẫu nhiên lấy mẫu như trước
  // (BUG-02: mẫu 18 MC + 4 TF + 6 SA làm mất câu hỏi và mất seed SR).
  // Spaced repetition vẫn bỏ qua các câu này vì không có KP để ghi
  // (bên nộp bài đã lọc knowledgePointId null từ trước).
  if (qRows.length > 0) {
    const ordered = [...qRows].sort((a, b) => a.order - b.order)
    return { chosen: ordered.map((q) => q.id), mode: "lesson" }
  }

  const byType = (t: string) => qRows.filter((q) => q.type === t)
  const mc = seededShuffle(byType("MC"), rng).slice(0, 18)
  const tf = seededShuffle(byType("TF"), rng).slice(0, 4)
  const sa = seededShuffle(byType("SA"), rng).slice(0, 6)
  const mixed = seededShuffle([...mc, ...tf, ...sa], rng)
  return { chosen: mixed.map((q) => q.id), mode: "random" }
}
