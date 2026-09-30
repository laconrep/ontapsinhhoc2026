import type { UnderlinedTerm } from "@/types"

// ============ Kiểu dữ liệu kết quả parse ============

export type ParsedQuestionType = "MC" | "TF" | "SA"

export interface ParsedOption {
  content: string
  isCorrect: boolean
}

export interface ParsedQuestion {
  type: ParsedQuestionType
  content: string
  options: ParsedOption[]
  /** đáp án đúng dạng text (SA) */
  correctAnswer?: string
  /** HTML de (anh/bang); phien 3+ moi gan */
  bodyHtml?: string
  line: number
}

export interface ParsedKnowledgePoint {
  content: string
  underlinedTerms: UnderlinedTerm[]
  questions: ParsedQuestion[]
  line: number
}

export interface ParsedLesson {
  title: string
  knowledgePoints: ParsedKnowledgePoint[]
  line: number
}

export interface ParsedChapter {
  title: string
  lessons: ParsedLesson[]
  line: number
}

export interface ParseError {
  line?: number
  message: string
}

export interface ParseResult {
  chapters: ParsedChapter[]
  errors: ParseError[]
}

export interface ValidationError {
  line?: number
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// ============ Tách ô trống trong nội dung KP ============

interface RawMarker {
  start: number
  end: number
  text: string
  allowSwap: boolean
  synonyms?: string[]
}

/**
 * Phân tích nội dung KP: tìm các ô trống đánh dấu bằng __từ__ (cố định) hoặc
 * "từ" (hoán đổi). __"từ"__ = vừa gạch chân vừa hoán đổi.
 * 
 * Hỗ trợ từ đồng nghĩa: __từ|đồng_nghĩa1|đồng_nghĩa2__ hoặc "từ|đồng_nghĩa1"
 * Phần trước | là text (bắt buộc), phần sau | là synonyms (tuỳ chọn).
 * 
 * Trả về content đã bỏ ký hiệu delimiter và mảng underlinedTerms.
 */
export function extractBlanks(raw: string): {
  content: string
  underlinedTerms: UnderlinedTerm[]
} {
  const markers: RawMarker[] = []
  // 1) tìm __...__ trước (có thể chứa "..." bên trong)
  const underlineRe = /__(.+?)__/g
  let m: RegExpExecArray | null
  while ((m = underlineRe.exec(raw)) !== null) {
    let inner = m[1]
    let allowSwap = false
    let synonyms: string[] = []
    const q = inner.match(/^"(.+)"$/)
    if (q) {
      inner = q[1]
      allowSwap = true
    }
    // phân tích synonyms: từ|syn1|syn2
    const parts = inner.split("|")
    inner = parts[0]
    if (parts.length > 1) {
      synonyms = parts.slice(1).filter(p => p.trim().length > 0)
    }
    markers.push({ start: m.index, end: m.index + m[0].length, text: inner, allowSwap, synonyms })
  }
  // 2) tìm "..." không nằm trong vùng đã match ở bước 1
  const quoteRe = /"(.+?)"/g
  while ((m = quoteRe.exec(raw)) !== null) {
    const s = m.index
    const e = m.index + m[0].length
    const overlap = markers.some((mk) => s < mk.end && e > mk.start)
    if (!overlap) {
      let text = m[1]
      let synonyms: string[] = []
      const parts = text.split("|")
      text = parts[0]
      if (parts.length > 1) {
        synonyms = parts.slice(1).filter(p => p.trim().length > 0)
      }
      markers.push({ start: s, end: e, text, allowSwap: true, synonyms })
    }
  }

  markers.sort((a, b) => a.start - b.start)

  // dựng content đã strip delimiter + tính vị trí ô trống trong content sạch
  let content = ""
  let cursor = 0
  const placed: { text: string; allowSwap: boolean; cleanStart: number; synonyms?: string[] }[] = []
  for (const mk of markers) {
    content += raw.slice(cursor, mk.start)
    const cleanStart = content.length
    content += mk.text
    placed.push({ text: mk.text, allowSwap: mk.allowSwap, cleanStart, synonyms: mk.synonyms })
    cursor = mk.end
  }
  content += raw.slice(cursor)

  // gán swapGroupId: các ô hoán đổi liên tiếp, không có dấu chấm câu xen giữa → cùng group
  const terms: UnderlinedTerm[] = []
  let groupCounter = 0
  let currentGroup: string | null = null
  let prevEnd = -1
  let prevWasSwap = false
  placed.forEach((p, i) => {
    let swapGroupId: string | null = null
    if (p.allowSwap) {
      const between = prevEnd >= 0 ? content.slice(prevEnd, p.cleanStart) : "."
      const sentenceBreak = /[.!?;\n]/.test(between)
      if (prevWasSwap && !sentenceBreak && currentGroup) {
        swapGroupId = currentGroup
      } else {
        groupCounter += 1
        currentGroup = `g${groupCounter}`
        swapGroupId = currentGroup
      }
    } else {
      currentGroup = null
    }
    terms.push({
      text: p.text,
      slotIndex: i,
      allowSwap: p.allowSwap,
      swapGroupId,
      extraAccepted: [],
      synonyms: p.synonyms && p.synonyms.length > 0 ? p.synonyms : undefined,
    })
    prevEnd = p.cleanStart + p.text.length
    prevWasSwap = p.allowSwap
  })

  // group chỉ có 1 thành viên → swapGroupId = null (chấm như slot thường)
  const groupCount = new Map<string, number>()
  for (const t of terms) if (t.swapGroupId) groupCount.set(t.swapGroupId, (groupCount.get(t.swapGroupId) ?? 0) + 1)
  for (const t of terms) if (t.swapGroupId && (groupCount.get(t.swapGroupId) ?? 0) < 2) t.swapGroupId = null

  return { content: content.trim(), underlinedTerms: terms }
}

// ============ Helper parse lựa chọn MC/TF ============

const CAU_RE = /^(câu|cau)\s*:\s*(.*)$/i
const DAP_AN_RE = /^(đáp\s*án|dap\s*an)\s*:\s*(.*)$/i
const CHOICE_RE = /^([a-dA-D])[.)]\s*(.*)$/

export function stripUnderline(s: string): string {
  return s.replace(/__/g, "").trim()
}

export function hasUnderline(s: string): boolean {
  return /__/.test(s)
}

export function parseChoiceLine(line: string): { letter: string; text: string } | null {
  const stripped = stripUnderline(line)
  const m = stripped.match(CHOICE_RE) ?? stripped.match(/^([a-dA-D])\s+(.*)$/)
  if (!m) return null
  return { letter: m[1].toUpperCase(), text: m[2].trim() }
}

function parseCauLine(line: string): string | null {
  const m = line.match(CAU_RE)
  return m ? m[2].trim() : null
}

function parseDapAnLine(line: string): string | null {
  const m = line.match(DAP_AN_RE)
  return m ? m[2].trim() : null
}

function mcOptionContent(letter: string, text: string): string {
  return `${letter}. ${text}`.trim()
}

function tfOptionContent(letter: string, text: string): string {
  return `${letter.toLowerCase()}) ${text}`.trim()
}

function appendStem(q: ParsedQuestion, extra: string) {
  const t = extra.trim()
  if (!t) return
  q.content = q.content ? `${q.content}\n${t}` : t
}

function canAppendStem(q: ParsedQuestion): boolean {
  if (q.type === "SA") return !q.correctAnswer
  return q.options.length === 0
}

// ============ Parser văn bản thuần ============

export function parseTextContent(text: string): ParseResult {
  const errors: ParseError[] = []
  const chapters: ParsedChapter[] = []

  let curChapter: ParsedChapter | null = null
  let curLesson: ParsedLesson | null = null
  let curKp: ParsedKnowledgePoint | null = null
  let curQuestion: ParsedQuestion | null = null

  const ensureChapter = (): ParsedChapter => {
    if (!curChapter) {
      curChapter = { title: "Chương chưa đặt tên", lessons: [], line: 0 }
      chapters.push(curChapter)
    }
    return curChapter
  }

  const lines = text.split(/\r?\n/)
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    const lineNo = idx + 1
    if (!line) return
    // dòng chú thích — bị bỏ qua
    if (line.startsWith("//")) return

    // {Chương}
    let mm = line.match(/^\{(.+)\}$/)
    if (mm) {
      curChapter = { title: mm[1].trim(), lessons: [], line: lineNo }
      chapters.push(curChapter)
      curLesson = null
      curKp = null
      curQuestion = null
      return
    }

    // [Bài]
    mm = line.match(/^\[(.+)\]$/)
    if (mm) {
      const chap = ensureChapter()
      curLesson = { title: mm[1].trim(), knowledgePoints: [], line: lineNo }
      chap.lessons.push(curLesson)
      curKp = null
      curQuestion = null
      return
    }

    // ### SA — đề trên cùng dòng hoặc dòng sau `câu:`; đáp án dòng `dap an:` / `Đáp án:`
    if (line.startsWith("###")) {
      let body = line.slice(3).trim()
      const cauOnSame = parseCauLine(body)
      if (cauOnSame != null) body = cauOnSame
      const dapOnSame = parseDapAnLine(body)
      if (!curKp) {
        errors.push({ line: lineNo, message: "Câu hỏi phải nằm trong một điểm kiến thức (bắt đầu bằng '-')" })
        return
      }
      curQuestion = {
        type: "SA",
        content: dapOnSame != null ? "" : body,
        options: [],
        correctAnswer: dapOnSame ?? "",
        line: lineNo,
      }
      curKp.questions.push(curQuestion)
      return
    }

    // ## TF — đề trên cùng dòng, hoặc dòng sau `câu:`; lựa chọn a) b) c) d) (gạch chân = đúng)
    if (line.startsWith("##")) {
      let body = line.slice(2).trim()
      const cauOnSame = parseCauLine(body)
      if (cauOnSame != null) body = cauOnSame
      if (!curKp) {
        errors.push({ line: lineNo, message: "Câu hỏi phải nằm trong một điểm kiến thức (bắt đầu bằng '-')" })
        return
      }
      curQuestion = { type: "TF", content: body, options: [], line: lineNo }
      curKp.questions.push(curQuestion)
      return
    }

    // # MC — đề trên cùng dòng, hoặc dòng sau `câu:`; lựa chọn A. B. C. D. (gạch chân = đúng)
    if (line.startsWith("#")) {
      let body = line.slice(1).trim()
      const cauOnSame = parseCauLine(body)
      if (cauOnSame != null) body = cauOnSame
      if (!curKp) {
        errors.push({ line: lineNo, message: "Câu hỏi phải nằm trong một điểm kiến thức (bắt đầu bằng '-')" })
        return
      }
      curQuestion = { type: "MC", content: body, options: [], line: lineNo }
      curKp.questions.push(curQuestion)
      return
    }

    // Dòng `câu:` điền đề cho câu MC/TF/SA đang mở (khi #, ## hoặc ### đứng một mình)
    const cauBody = parseCauLine(line)
    if (cauBody != null && (curQuestion?.type === "MC" || curQuestion?.type === "TF" || curQuestion?.type === "SA")) {
      if (!curQuestion.content) curQuestion.content = cauBody
      return
    }

    // Dòng `dap an:` / `Đáp án:` điền đáp án cho câu SA đang mở
    const dapAnBody = parseDapAnLine(line)
    if (dapAnBody != null && curQuestion?.type === "SA") {
      curQuestion.correctAnswer = dapAnBody
      if (!dapAnBody) {
        errors.push({ line: lineNo, message: "Câu trả lời ngắn thiếu đáp án sau 'dap an:'" })
      }
      return
    }

    // Lựa chọn MC/TF: a. / a) / A. / A) — gạch chân cả dòng hoặc chữ cái đầu = đúng
    const choice = parseChoiceLine(line)
    if (choice && curQuestion?.type === "MC") {
      curQuestion.options.push({
        content: mcOptionContent(choice.letter, choice.text),
        isCorrect: hasUnderline(line),
      })
      return
    }
    if (choice && curQuestion?.type === "TF") {
      curQuestion.options.push({
        content: tfOptionContent(choice.letter, choice.text),
        isCorrect: hasUnderline(line),
      })
      return
    }

    if (line.startsWith("+")) {
      errors.push({
        line: lineNo,
        message: "Không dùng dấu +. Dùng A. B. C. D. (MC) hoặc a. b. c. d. (TF) và gạch chân đáp án đúng",
      })
      return
    }
    if (line.startsWith("*")) {
      errors.push({
        line: lineNo,
        message: "Không dùng dấu *. Gạch chân đáp án đúng (MC/TF) hoặc dùng cau: / dap an: (SA)",
      })
      return
    }

    // - Điểm kiến thức
    if (line.startsWith("-")) {
      let body = line.slice(1).trim()
      body = body.replace(/^Ý kiến thức\s*:\s*/i, "").replace(/^Y kien thuc\s*:\s*/i, "")
      if (!curLesson) {
        errors.push({ line: lineNo, message: "Điểm kiến thức phải nằm trong một bài [Tên bài]" })
        return
      }
      const { content, underlinedTerms } = extractBlanks(body)
      curKp = { content, underlinedTerms, questions: [], line: lineNo }
      curLesson.knowledgePoints.push(curKp)
      curQuestion = null
      return
    }

    // Token anh/bang (tu parseHtmlContent) ngoai de dang mo: bo qua, khong fail file
    if (/^@@(IMG|TBL)\d+@@$/.test(line) && !(curQuestion && canAppendStem(curQuestion))) {
      return
    }

    // De da dong: (1) (2) ... thuoc de khi dang mo cau, chua co lua chon / dap an
    if (curQuestion && canAppendStem(curQuestion)) {
      appendStem(curQuestion, line)
      return
    }

    // dòng không nhận dạng được
    errors.push({ line: lineNo, message: `Không nhận dạng được cú pháp: "${line.slice(0, 40)}"` })
  })

  return { chapters, errors }
}

// ============ Parser HTML (từ mammoth .docx) ============

/** Gộp các thẻ <u> liền kề (FIX B-01) */
export function normalizeHtml(html: string): string {
  return html.replace(/<\/u>(\s*)<u>/gi, "$1")
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function imgTagToPlaceholder(tag: string, images: string[]): string {
  const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
  if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(src) && !src.startsWith("/")) return ""
  const alt = (tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").replace(/[<>"']/g, "")
  const i = images.length
  images.push(`<img src="${src}" alt="${alt}">`)
  return `\n@@IMG${i}@@\n`
}

function sanitizeTableHtml(raw: string): string {
  let s = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  s = s.replace(/<(?!\/?(table|thead|tbody|tfoot|tr|th|td|caption|br|p|u)\b)[^>]+>/gi, "")
  s = s.replace(/<(table|thead|tbody|tfoot|tr|th|td|caption|br|p|u)(\s[^>]*)?>/gi, (_, name: string, attrs?: string) => {
    const tag = name.toLowerCase()
    if (!attrs) return `<${tag}>`
    if (tag !== "th" && tag !== "td") return `<${tag}>`
    const span: string[] = []
    const cs = attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)
    const rs = attrs.match(/\browspan\s*=\s*["']?(\d+)/i)
    if (cs) span.push(`colspan="${cs[1]}"`)
    if (rs) span.push(`rowspan="${rs[1]}"`)
    return span.length ? `<${tag} ${span.join(" ")}>` : `<${tag}>`
  })
  return s
}

function tableToPlaceholder(html: string, tables: string[]): string {
  return html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (block) => {
    const cleaned = sanitizeTableHtml(block)
    if (!cleaned) return "\n"
    const i = tables.length
    tables.push(cleaned)
    return `\n@@TBL${i}@@\n`
  })
}

function lineWithRichToHtml(line: string, images: string[], tables: string[]): string {
  const parts: string[] = []
  let last = 0
  const re = /@@(IMG|TBL)(\d+)@@/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push(escapeHtmlText(line.slice(last, m.index)))
    const idx = Number(m[2])
    parts.push(m[1] === "IMG" ? (images[idx] ?? "") : (tables[idx] ?? ""))
    last = m.index + m[0].length
  }
  if (last < line.length) parts.push(escapeHtmlText(line.slice(last)))
  return parts.join("")
}

function attachBodyHtml(result: ParseResult, images: string[], tables: string[]) {
  if (images.length === 0 && tables.length === 0) return
  for (const ch of result.chapters) {
    for (const lesson of ch.lessons) {
      for (const kp of lesson.knowledgePoints) {
        for (const q of kp.questions) {
          if (!q.content.includes("@@IMG") && !q.content.includes("@@TBL")) continue
          const lines = q.content.split("\n")
          q.bodyHtml = lines.map((ln) => lineWithRichToHtml(ln, images, tables)).join("<br>\n")
          q.content = lines
            .map((ln) => ln.replace(/@@(IMG|TBL)\d+@@/g, "").trim())
            .filter((ln) => ln.length > 0)
            .join("\n")
        }
      }
    }
  }
}

/**
 * Chuyển HTML (mammoth) thành text có delimiter: <u>...</u> → __...__, giữ nguyên
 * "..." để đánh dấu hoán đổi, rồi tái sử dụng parseTextContent.
 * Thẻ <img> / <table> giữ qua placeholder rồi gắn `bodyHtml` trên câu hỏi.
 */
export function parseHtmlContent(html: string): ParseResult {
  const images: string[] = []
  const tables: string[] = []
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  const normalized = normalizeHtml(withoutScripts)
  const withImgs = normalized.replace(/<img\b[^>]*>/gi, (tag) => imgTagToPlaceholder(tag, images))
  const withTables = tableToPlaceholder(withImgs, tables)
  const withBreaks = withTables
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
  const withUnderline = withBreaks.replace(/<u>([\s\S]*?)<\/u>/gi, "__$1__")
  const stripped = withUnderline.replace(/<[^>]+>/g, "")
  const text = decodeEntities(stripped)
  const result = parseTextContent(text)
  attachBodyHtml(result, images, tables)
  return result
}

// ============ Validate ============

export function validateDocument(result: ParseResult): ValidationResult {
  const errors: ValidationError[] = [...result.errors]

  const lessons = result.chapters.flatMap((c) => c.lessons)
  if (lessons.length === 0) {
    errors.push({ message: "Tài liệu phải có ít nhất 1 bài [Tên bài]" })
  }

  for (const lesson of lessons) {
    if (lesson.knowledgePoints.length === 0) {
      errors.push({ line: lesson.line, message: `Bài "${lesson.title}" phải có ít nhất 1 điểm kiến thức` })
    }
    for (const kp of lesson.knowledgePoints) {
      if (kp.underlinedTerms.length === 0) {
        errors.push({
          line: kp.line,
          message: `Điểm kiến thức phải có ít nhất 1 từ gạch chân (__từ__ hoặc "từ"): "${kp.content.slice(0, 30)}"`,
        })
      }
      for (const q of kp.questions) {
        if (q.type === "MC") {
          if (q.options.length !== 4) {
            errors.push({ line: q.line, message: `Câu trắc nghiệm phải có đúng 4 lựa chọn (hiện có ${q.options.length})` })
          }
          if (q.options.filter((o) => o.isCorrect).length !== 1) {
            errors.push({ line: q.line, message: "Câu trắc nghiệm phải có đúng 1 đáp án đúng (gạch chân)" })
          }
        } else if (q.type === "TF") {
          if (q.options.length !== 4) {
            errors.push({ line: q.line, message: `Câu Đúng/Sai phải có đúng 4 ý a) b) c) d) (hiện có ${q.options.length})` })
          }
        } else if (q.type === "SA") {
          if (!q.correctAnswer) {
            errors.push({ line: q.line, message: "Câu trả lời ngắn phải có đáp án sau 'dap an:'" })
          }
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors }
}

// ============ Thống kê preview ============

export function summarize(result: ParseResult) {
  const chapters = result.chapters.length
  const lessons = result.chapters.reduce((s, c) => s + c.lessons.length, 0)
  const kps = result.chapters.reduce(
    (s, c) => s + c.lessons.reduce((s2, l) => s2 + l.knowledgePoints.length, 0),
    0,
  )
  const questions = result.chapters.reduce(
    (s, c) =>
      s +
      c.lessons.reduce(
        (s2, l) => s2 + l.knowledgePoints.reduce((s3, kp) => s3 + kp.questions.length, 0),
        0,
      ),
    0,
  )
  return { chapters, lessons, kps, questions }
}
