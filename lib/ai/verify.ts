// AI-MCP (§15.2 chốt 3): đối chiếu "giữ nguyên" BẰNG MÁY — không tin
// cam kết của worker. Nguyên tắc: mọi câu hỏi, phương án và nội dung KP
// có sẵn trong tài liệu gốc phải xuất hiện NGUYÊN VĂN trong bản dựng;
// worker chỉ được thêm gạch chân, gắn/sinh lời giải, điền đáp án cho câu
// vốn thiếu (khai báo trong filledAnswers) và sinh KP mới (khai báo
// generatedByAi). Vi phạm -> danh sách lỗi để worker sửa (vòng repair).

import {
  parseTextContent,
  stripUnderline,
  type ParseResult,
  type ParsedQuestion,
} from "@/lib/worksheet-parser"
import { accepts } from "@/lib/scoring"
import type { AiResult } from "./types"

/** §16: mỗi cụm gạch chân phải có ÍT NHẤT chừng này từ nhiễu kéo thả. */
export const MIN_AI_DISTRACTORS = 3

function norm(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim()
}

function flattenQuestions(parse: ParseResult): ParsedQuestion[] {
  const out: ParsedQuestion[] = []
  for (const c of parse.chapters)
    for (const l of c.lessons)
      for (const kp of l.knowledgePoints) out.push(...kp.questions)
  return out
}

function correctKey(q: ParsedQuestion): string {
  if (q.type === "SA") return norm(q.correctAnswer ?? "")
  return q.options
    .filter((o) => o.isCorrect)
    .map((o) => norm(o.content))
    .sort()
    .join("||")
}

export function verifyAiResult(
  sourceText: string,
  result: AiResult,
  renderedParse: ParseResult,
): string[] {
  const problems: string[] = []
  const originalParse = parseTextContent(sourceText)
  const sourceNorm = norm(stripUnderline(sourceText))

  const inSource = (text: string): boolean => {
    const n = norm(text)
    return n.length > 0 && sourceNorm.includes(n)
  }

  // 1) Nội dung KP: KP không khai báo AI sinh thì phải có nguyên văn
  //    trong tài liệu gốc.
  for (const chapter of result.chapters)
    for (const lesson of chapter.lessons)
      for (const kp of lesson.knowledgePoints) {
        if (kp.generatedByAi) continue
        if (!inSource(kp.content)) {
          problems.push(
            `Nội dung điểm kiến thức không khớp nguyên văn tài liệu gốc: "${kp.content.slice(0, 60)}..."`,
          )
        }
      }

  // 2) Câu hỏi trong bản dựng: thân câu + từng phương án phải lấy
  //    nguyên văn từ tài liệu gốc (AI không được chế câu/p.án mới).
  const renderedQuestions = flattenQuestions(renderedParse)
  for (const q of renderedQuestions) {
    if (!inSource(q.content)) {
      problems.push(`Thân câu hỏi không có nguyên văn trong tài liệu gốc: "${q.content.slice(0, 60)}..."`)
    }
    for (const o of q.options) {
      if (!inSource(o.content)) {
        problems.push(`Phương án không có nguyên văn trong tài liệu gốc: "${o.content.slice(0, 60)}..."`)
      }
    }
  }

  // 3) Số câu: nếu bản gốc parse ra được câu hỏi thì bản dựng phải giữ
  //    đúng số lượng (không thêm, không bớt).
  const originalQuestions = flattenQuestions(originalParse)
  if (originalQuestions.length > 0 && renderedQuestions.length !== originalQuestions.length) {
    problems.push(
      `Số câu hỏi thay đổi: gốc ${originalQuestions.length}, bản dựng ${renderedQuestions.length}`,
    )
    return problems
  }

  // 4) Đáp án: câu nào bản gốc ĐÃ có đáp án xác định thì bản dựng phải
  //    giữ đúng; chỉ câu gốc THIẾU đáp án và có khai báo filledAnswers
  //    mới được khác.
  const filled = new Set(result.filledAnswers ?? [])
  if (originalQuestions.length === renderedQuestions.length) {
    originalQuestions.forEach((oq, i) => {
      const rq = renderedQuestions[i]
      if (!rq || oq.type !== rq.type) return
      if (norm(oq.content) !== norm(rq.content)) return // đã bắt ở (2)/(3)
      const before = correctKey(oq)
      const after = correctKey(rq)
      if (before === after) return
      const originallyMissing = before === "" || (oq.type === "MC" && before.split("||").length !== 1)
      if (originallyMissing && filled.has(i + 1)) return
      problems.push(
        `Câu ${i + 1} bị đổi đáp án so với tài liệu gốc (chỉ được điền khi gốc thiếu và khai báo filledAnswers)`,
      )
    })
  }

  // 5) §16: từ nhiễu kéo thả cho TỪNG cụm gạch chân — ít nhất
  //    MIN_AI_DISTRACTORS từ, lấy nguyên văn từ tài liệu (phần trắc
  //    nghiệm), không lặp, và TUYỆT ĐỐI không được là đáp án mà lõi
  //    chấm sẽ chấp nhận cho bất kỳ chỗ trống nào trong cùng KP
  //    (trùng từ đúng, alias gene/gen, số tương đương...).
  for (const chapter of result.chapters)
    for (const lesson of chapter.lessons)
      for (const kp of lesson.knowledgePoints) {
        const kpTerms = kp.underlines.map((u) => ({
          text: u.text,
          slotIndex: 0,
          allowSwap: Boolean(u.swap),
          swapGroupId: null,
          extraAccepted: [] as string[],
        }))
        for (const u of kp.underlines) {
          const label = `Cụm "${u.text}" (KP "${kp.content.slice(0, 40)}...")`
          const ds = u.distractors ?? []
          if (ds.length < MIN_AI_DISTRACTORS) {
            problems.push(
              `${label}: cần ít nhất ${MIN_AI_DISTRACTORS} từ nhiễu kéo thả lấy từ phần trắc nghiệm, hiện có ${ds.length}`,
            )
          }
          const seen = new Set<string>()
          for (const d of ds) {
            const nd = norm(d).toLowerCase()
            if (!nd) {
              problems.push(`${label}: có từ nhiễu rỗng`)
              continue
            }
            if (seen.has(nd)) problems.push(`${label}: từ nhiễu "${d}" bị lặp`)
            seen.add(nd)
            if (!inSource(d)) {
              problems.push(
                `${label}: từ nhiễu "${d}" không thấy nguyên văn trong tài liệu gốc — phải lấy từ phần trắc nghiệm của tài liệu`,
              )
            }
            if (kpTerms.some((t) => accepts(t, d))) {
              problems.push(
                `${label}: từ nhiễu "${d}" sẽ bị chấm là ĐÚNG cho một chỗ trống trong cùng KP — chọn từ gần nghĩa nhưng không điền đúng được`,
              )
            }
          }
        }
      }

  return problems
}
