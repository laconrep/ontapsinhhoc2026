import type { LessonStatsDto } from "@/app/actions/lesson-stats"

/**
 * Ẩn danh thống kê lớp cho AI (nền cho bản tin lớp #1 và hỏi đáp số liệu #11).
 *
 * - Học sinh chỉ còn mã HS01.. theo thứ tự mảng students (thứ tự tên A→Z,
 *   GV tự đối chiếu lại được); AI không bao giờ thấy tên hay id thật.
 * - Mọi số liệu giữ nguyên; rawStudents (tiến trình thô từng ô) bị bỏ —
 *   AI không cần mức chi tiết đó để viết bản tin hay trả lời.
 * - studentId/name/studentName đều đổi thành mã, kể cả khóa của matrixCells
 *   và tên lồng trong chuỗi (cờ chất lượng).
 */
export function anonymizeLessonStats(dto: LessonStatsDto): LessonStatsDto {
  const codeById = new Map<string, string>()
  const codeByName = new Map<string, string>()
  dto.students.forEach((s, i) => {
    const code = `HS${String(i + 1).padStart(2, "0")}`
    codeById.set(s.studentId, code)
    codeByName.set(s.name, code)
  })
  // Tên dài thay trước để tên ngắn không ăn mất một phần tên dài.
  const namesSorted = [...codeByName.keys()].sort((a, b) => b.length - a.length)
  const scrubText = (t: string): string => {
    let out = t
    for (const name of namesSorted) {
      out = out.split(name).join(codeByName.get(name)!)
    }
    return out
  }
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        if (k === "rawStudents") continue
        const key = codeById.has(k) ? codeById.get(k)! : k
        if (k === "studentId" && typeof val === "string" && codeById.has(val)) {
          out[key] = codeById.get(val)
          continue
        }
        if ((k === "name" || k === "studentName") && typeof val === "string" && codeByName.has(val)) {
          out[key] = codeByName.get(val)
          continue
        }
        out[key] = walk(val)
      }
      return out
    }
    if (typeof v === "string") return scrubText(v)
    return v
  }
  return walk(dto) as LessonStatsDto
}
