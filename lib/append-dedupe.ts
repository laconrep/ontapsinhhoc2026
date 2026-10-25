// §18: nạp CỘNG THÊM vào một bài có sẵn (nút "Nạp file"/"Đã nạp file"
// trên thẻ bài + màn hình tạo bài) — nội dung file mới cộng dồn vào
// bài, mục trùng thì chỉ giữ 1 bản và cảnh báo cho GV.
//
// Dùng chung cho cả hai phía: importer (client) tính trước để hiện
// cảnh báo ở bản xem trước, persist (server) tính lại lúc lưu làm
// kết quả chính thức. "Trùng" ở đây là so khớp nội dung đã chuẩn hoá
// (trim + gộp khoảng trắng + thường hoá) — CHỈ phục vụ chống trùng
// khi nạp, không liên quan tới logic chấm bài.
import {
  splitSaAcceptedAnswers,
  type ParsedKnowledgePoint,
  type ParsedQuestion,
} from "@/lib/worksheet-parser"

export interface ExistingKpRef {
  id: string
  content: string
}

export interface ExistingQuestionRef {
  knowledgePointId: string
  type: string
  content: string
  /** Nội dung các phương án (MC/TF); SA để rỗng. */
  options: string[]
  /** SA: đáp án dạng thô "x | y" như bản parse; loại khác để null. */
  correctAnswer: string | null
}

export function normDedupeKey(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase()
}

function fingerprint(type: string, content: string, options: string[], correctAnswer: string | null): string {
  let tail: string
  if (type === "SA") {
    tail = splitSaAcceptedAnswers(correctAnswer ?? "")
      .map(normDedupeKey)
      .sort()
      .join("|")
  } else {
    tail = options.map(normDedupeKey).join("~")
  }
  return `${type}|${normDedupeKey(content)}|${tail}`
}

export function parsedQuestionFingerprint(q: ParsedQuestion): string {
  return fingerprint(q.type, q.content, q.options.map((o) => o.content), q.correctAnswer ?? null)
}

export function existingQuestionFingerprint(q: ExistingQuestionRef): string {
  return fingerprint(q.type, q.content, q.options, q.correctAnswer)
}

export interface AppendKpAction {
  source: ParsedKnowledgePoint
  /** null = tạo điểm kiến thức mới; có id = gộp câu mới vào KP đã có. */
  targetKpId: string | null
  addQuestions: ParsedQuestion[]
  duplicateQuestions: ParsedQuestion[]
}

export interface AppendPlan {
  actions: AppendKpAction[]
  warnings: string[]
  addedKps: number
  addedQuestions: number
  skippedQuestions: number
  /** §25: câu hỏi cấp bài học trong file nạp thêm — chống trùng cùng
   * một bộ `seen` với câu trong KP (trùng nội dung là trùng, không
   * phân biệt chỗ gắn), lưu với KP null ở bước persist. */
  lessonQuestions: {
    addQuestions: ParsedQuestion[]
    duplicateQuestions: ParsedQuestion[]
  }
}

function shortLabel(text: string, max = 60): string {
  const t = text.trim().replace(/\s+/g, " ")
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export function computeAppendPlan(
  existingKps: ExistingKpRef[],
  existingQuestions: ExistingQuestionRef[],
  incoming: ParsedKnowledgePoint[],
  incomingLessonQuestions: ParsedQuestion[] = [],
): AppendPlan {
  const kpByKey = new Map<string, string>()
  for (const kp of existingKps) {
    const key = normDedupeKey(kp.content)
    if (!kpByKey.has(key)) kpByKey.set(key, kp.id)
  }
  const seen = new Set<string>(existingQuestions.map(existingQuestionFingerprint))

  const actions: AppendKpAction[] = []
  const warnings: string[] = []
  let addedQuestions = 0
  let skippedQuestions = 0

  for (const kp of incoming) {
    const targetKpId = kpByKey.get(normDedupeKey(kp.content)) ?? null
    const addQuestions: ParsedQuestion[] = []
    const duplicateQuestions: ParsedQuestion[] = []
    for (const q of kp.questions) {
      const fp = parsedQuestionFingerprint(q)
      if (seen.has(fp)) {
        duplicateQuestions.push(q)
      } else {
        seen.add(fp)
        addQuestions.push(q)
      }
    }
    addedQuestions += addQuestions.length
    skippedQuestions += duplicateQuestions.length
    for (const q of duplicateQuestions) {
      warnings.push(`Câu hỏi trùng, đã bỏ qua: "${shortLabel(q.content)}"`)
    }
    if (targetKpId && (addQuestions.length > 0 || duplicateQuestions.length > 0)) {
      warnings.push(
        `Điểm kiến thức "${shortLabel(kp.content, 40)}" đã có trong bài — gộp ${addQuestions.length} câu mới, bỏ qua ${duplicateQuestions.length} câu trùng.`,
      )
    }
    actions.push({ source: kp, targetKpId, addQuestions, duplicateQuestions })
  }

  // §25: câu hỏi cấp bài học trong file nạp thêm — chống trùng bằng
  // cùng bộ `seen` (đã gồm câu trong KP của bài đích + câu đã cộng
  // trong lượt này), để một câu không chui vào hai chỗ.
  const lessonAdd: ParsedQuestion[] = []
  const lessonDup: ParsedQuestion[] = []
  for (const q of incomingLessonQuestions) {
    const fp = parsedQuestionFingerprint(q)
    if (seen.has(fp)) {
      lessonDup.push(q)
    } else {
      seen.add(fp)
      lessonAdd.push(q)
    }
  }
  addedQuestions += lessonAdd.length
  skippedQuestions += lessonDup.length
  for (const q of lessonDup) {
    warnings.push(`Câu hỏi trùng, đã bỏ qua: "${shortLabel(q.content)}"`)
  }

  return {
    actions,
    warnings,
    addedKps: actions.filter((a) => a.targetKpId === null).length,
    addedQuestions,
    skippedQuestions,
    lessonQuestions: { addQuestions: lessonAdd, duplicateQuestions: lessonDup },
  }
}
