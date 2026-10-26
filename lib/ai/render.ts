// AI-MCP (§15.2 chốt 1): dựng văn bản worksheet ĐÚNG FORM từ JSON cấu
// trúc của worker. Worker không tự gõ định dạng — hàm này là nơi duy
// nhất biến cấu trúc thành cú pháp mẫu (đối chiếu public/templates/
// mau-cau-hoi.txt): __từ__ = ô cố định, __"từ"__ = ô hoán đổi, đáp án
// MC/TF gạch chân cả dòng, SA dùng "dap an:".

import type { AiQuestion, AiResult } from "./types"
import { LESSON_QUESTIONS_MARKER } from "../worksheet-parser"

const MC_LETTERS = ["A", "B", "C", "D"]
const TF_LETTERS = ["a", "b", "c", "d"]

function stripOptionPrefix(content: string, letter: string): string {
  const re = new RegExp(`^${letter}[.)]\\s*`, "i")
  return content.replace(re, "").trim()
}

/**
 * §34b: nội dung câu hỏi của worker hay giữ nguyên đầu dòng "Câu 6."
 * của tài liệu (số thứ tự trong PHẦN, không phải số toàn bài). Khi render
 * ra "cau: Câu 6. ..." rồi parse lại, CAU_RE chỉ bóc "cau:" nên "Câu 6."
 * còn sót lại trong thân câu — học sinh thấy "Câu 6." trong khi thẻ bài
 * ghi "Câu 52/56". Số thứ tự là việc của renderer (parse đánh lại),
 * không phải của nội dung: bóc đầu dòng "Câu n." ở đây, giống như
 * stripOptionPrefix đã bóc "A." ở phương án. Thân câu còn lại vẫn là
 * chuỗi con nguyên văn của tài liệu nên verifyAiResult (so khớp chuỗi
 * con) vẫn đạt.
 */
function stripLeadingCau(content: string): string {
  return content.replace(/^\s*(câu|cau)\s*(?:\d+\s*)?[.:]\s*/i, "")
}

function underlineOption(letter: string, text: string): string {
  return `__${letter}. ${text}__`
}

function plainOption(letter: string, text: string): string {
  return `${letter}. ${text}`
}

/**
 * Chèn __..__ vào nội dung KP theo danh sách cụm worker chọn. Tìm lần
 * xuất hiện chưa bị chiếm theo thứ tự (giống thuật toán dự phòng của bản
 * xem trước). Trả về { text } hoặc { problem } nếu có cụm không khớp
 * nguyên văn — caller biến problem thành lỗi sửa cho worker.
 */
function renderKpContent(
  content: string,
  underlines: { text: string; swap?: boolean }[],
): { text: string } | { problem: string } {
  const claimed: { start: number; end: number; swap?: boolean }[] = []
  for (const u of underlines) {
    const t = u.text
    if (!t) continue
    let from = 0
    let idx = content.indexOf(t, from)
    let placed = false
    while (idx !== -1) {
      const end = idx + t.length
      if (!claimed.some((c) => idx < c.end && end > c.start)) {
        claimed.push({ start: idx, end, swap: u.swap })
        placed = true
        break
      }
      from = idx + 1
      idx = content.indexOf(t, from)
    }
    if (!placed) return { problem: `Cụm gạch chân "${t}" không khớp nguyên văn trong điểm kiến thức` }
  }
  claimed.sort((a, b) => a.start - b.start)
  let out = ""
  let cursor = 0
  for (const c of claimed) {
    out += content.slice(cursor, c.start)
    const term = content.slice(c.start, c.end)
    out += c.swap ? `__"${term}"__` : `__${term}__`
    cursor = c.end
  }
  out += content.slice(cursor)
  return { text: out }
}

export interface RenderOutcome {
  text?: string
  problems: string[]
}

/** Dựng một câu hỏi thành các dòng worksheet (dùng chung cho câu hỏi
 * trong KP và câu hỏi cấp bài học — cùng một form, chỉ khác vị trí). */
function renderQuestion(q: AiQuestion, out: string[]) {
  if (q.type === "MC") {
    out.push("#")
    out.push(`cau: ${stripLeadingCau(q.content)}`)
    q.options.forEach((o, i) => {
      const letter = MC_LETTERS[i] ?? String(i + 1)
      const text = stripOptionPrefix(o.content, letter)
      out.push(o.isCorrect ? underlineOption(letter, text) : plainOption(letter, text))
    })
  } else if (q.type === "TF") {
    out.push("##")
    out.push(`cau: ${stripLeadingCau(q.content)}`)
    q.options.forEach((o, i) => {
      const letter = TF_LETTERS[i] ?? String(i + 1)
      const text = stripOptionPrefix(o.content, letter)
      out.push(o.isCorrect ? underlineOption(letter, text) : plainOption(letter, text))
    })
  } else {
    out.push("###")
    out.push(`cau: ${stripLeadingCau(q.content)}`)
    out.push(`dap an: ${q.correctAnswer ?? ""}`)
  }
  if (q.solution && q.solution.trim()) {
    const solLines = q.solution.trim().split("\n")
    out.push(`Giải chi tiết: ${solLines[0]}`)
    for (const extra of solLines.slice(1)) out.push(extra)
  }
}

export function renderAiResult(result: AiResult): RenderOutcome {
  const problems: string[] = []
  const out: string[] = []

  for (const chapter of result.chapters) {
    out.push(`{${chapter.title}}`)
    for (const lesson of chapter.lessons) {
      out.push(`[${lesson.title}]`)
      for (const kp of lesson.knowledgePoints) {
        // §19: MỖI DÒNG LÀ MỘT ĐIỂM KIẾN THỨC — nội dung một điểm chỉ
        // được là một dòng duy nhất; worker phải tách mỗi dòng của tài
        // liệu thành một điểm riêng (đề mục thì bỏ, không thành điểm).
        if (kp.content.split("\n").filter((s) => s.trim()).length > 1) {
          problems.push(
            `KP "${kp.content.slice(0, 60)}...": nội dung điểm kiến thức phải là MỘT dòng duy nhất — tách mỗi dòng thành một điểm kiến thức riêng`,
          )
          continue
        }
        const rendered = renderKpContent(kp.content, kp.underlines ?? [])
        if ("problem" in rendered) {
          problems.push(`KP "${kp.content.slice(0, 60)}...": ${rendered.problem}`)
          continue
        }
        out.push(`- ${rendered.text}`)
        for (const q of kp.questions) renderQuestion(q, out)
      }
      // §25: câu hỏi cấp bài học (worker không map được vào KP nào) —
      // đặt sau chỉ thị để parser giữ ở cấp bài học, không dồn về KP
      // cuối. Thứ tự trong bài: KP trước, trắc nghiệm chung sau — đúng
      // bố cục bản xem trước (KP trên, trắc nghiệm dưới).
      if (lesson.lessonQuestions && lesson.lessonQuestions.length > 0) {
        out.push(LESSON_QUESTIONS_MARKER)
        for (const q of lesson.lessonQuestions) renderQuestion(q, out)
      }
    }
  }

  if (problems.length > 0) return { problems }
  return { text: out.join("\n") + "\n", problems: [] }
}
