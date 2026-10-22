// AI-MCP (§15.2 chốt 1): dựng văn bản worksheet ĐÚNG FORM từ JSON cấu
// trúc của worker. Worker không tự gõ định dạng — hàm này là nơi duy
// nhất biến cấu trúc thành cú pháp mẫu (đối chiếu public/templates/
// mau-cau-hoi.txt): __từ__ = ô cố định, __"từ"__ = ô hoán đổi, đáp án
// MC/TF gạch chân cả dòng, SA dùng "dap an:".

import type { AiResult } from "./types"

const MC_LETTERS = ["A", "B", "C", "D"]
const TF_LETTERS = ["a", "b", "c", "d"]

function stripOptionPrefix(content: string, letter: string): string {
  const re = new RegExp(`^${letter}[.)]\\s*`, "i")
  return content.replace(re, "").trim()
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

export function renderAiResult(result: AiResult): RenderOutcome {
  const problems: string[] = []
  const out: string[] = []

  for (const chapter of result.chapters) {
    out.push(`{${chapter.title}}`)
    for (const lesson of chapter.lessons) {
      out.push(`[${lesson.title}]`)
      for (const kp of lesson.knowledgePoints) {
        const rendered = renderKpContent(kp.content, kp.underlines ?? [])
        if ("problem" in rendered) {
          problems.push(`KP "${kp.content.slice(0, 60)}...": ${rendered.problem}`)
          continue
        }
        out.push(`- ${rendered.text}`)
        for (const q of kp.questions) {
          if (q.type === "MC") {
            out.push("#")
            out.push(`cau: ${q.content}`)
            q.options.forEach((o, i) => {
              const letter = MC_LETTERS[i] ?? String(i + 1)
              const text = stripOptionPrefix(o.content, letter)
              out.push(o.isCorrect ? underlineOption(letter, text) : plainOption(letter, text))
            })
          } else if (q.type === "TF") {
            out.push("##")
            out.push(`cau: ${q.content}`)
            q.options.forEach((o, i) => {
              const letter = TF_LETTERS[i] ?? String(i + 1)
              const text = stripOptionPrefix(o.content, letter)
              out.push(o.isCorrect ? underlineOption(letter, text) : plainOption(letter, text))
            })
          } else {
            out.push("###")
            out.push(`cau: ${q.content}`)
            out.push(`dap an: ${q.correctAnswer ?? ""}`)
          }
          if (q.solution && q.solution.trim()) {
            const solLines = q.solution.trim().split("\n")
            out.push(`Giải chi tiết: ${solLines[0]}`)
            for (const extra of solLines.slice(1)) out.push(extra)
          }
        }
      }
    }
  }

  if (problems.length > 0) return { problems }
  return { text: out.join("\n") + "\n", problems: [] }
}
