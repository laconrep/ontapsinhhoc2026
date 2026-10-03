import type { UnderlinedTerm } from "@/types"

// ============ Kiểu dữ liệu kết quả parse ============

export type ParsedQuestionType = "MC" | "TF" | "SA"

export interface ParsedOption {
  content: string
  isCorrect: boolean
  bodyHtml?: string
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
 * Word/mammoth hay ra `"__từ"__` thay vì `__"từ"__`.
 * Cú pháp đúng: __từ__ | "từ" | __"từ"__.
 */
export function malformedQuoteUnderlineMarks(raw: string): string[] {
  const s = raw.replace(/[\u201c\u201d]/g, '"')
  const masked = s.replace(/__"(.*?)"__/g, (m) => " ".repeat(m.length))
  const out: string[] = []
  const re = /"__[\s\S]*?"__|"__[\s\S]*?__"|__"[^"]*?__/g
  let m: RegExpExecArray | null
  while ((m = re.exec(masked)) !== null) {
    const snippet = m[0].replace(/\s+/g, " ").trim().slice(0, 48)
    if (snippet) out.push(snippet)
  }
  if (out.length === 0 && /"__|__"/.test(masked)) out.push('"__')
  return out
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

const CAU_RE = /^(câu|cau)\s*(?:(\d+)\s*)?[.:]\s*(.*)$/i
const DAP_AN_RE = /^(đáp\s*án|dap\s*an)\s*:\s*(.*)$/i
const CHOICE_RE = /^([a-dA-D])[.)]\s*(.*)$/
const BULLET_RE = /^[•●◦·▪▸►]\s*/
const MC_LETTERS = ["A", "B", "C", "D"]
const TF_LETTERS = ["a", "b", "c", "d"]

/** Chuẩn hoá BOM, NBSP, ngoặc kép cong, dấu fullwidth — file Word/Notepad hay lệch so với mẫu. */
export function normalizeParseText(text: string): string {
  let s = text.replace(/^\uFEFF/, "").normalize("NFC")
  s = s.replace(/[\u00A0\u202F\u2007]/g, " ")
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "")
  s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
  s = s.replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
  s = s.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
  s = s.replace(/\u3000/g, " ")
  return s
}

export function stripUnderline(s: string): string {
  return s.replace(/__/g, "").trim()
}

export function hasUnderline(s: string): boolean {
  return /__/.test(s)
}

export function parseChoiceLine(line: string): { letter: string; text: string } | null {
  const stripped = stripUnderline(line)
  const m = stripped.match(CHOICE_RE) ?? stripped.match(/^([a-dA-D])\s+(.*)$/)
  if (m) return { letter: m[1].toUpperCase(), text: m[2].trim() }
  const num = stripped.match(/^([1-4])[.)]\s*(.*)$/)
  if (num) return { letter: String.fromCharCode(64 + Number(num[1])), text: num[2].trim() }
  return null
}

export function parseCauLine(line: string): string | null {
  const m = line.match(CAU_RE)
  return m ? m[3].trim() : null
}

export function isCauHeading(line: string): boolean {
  return CAU_RE.test(stripUnderline(line))
}

function parseDapAnLine(line: string): string | null {
  const m = line.match(DAP_AN_RE)
  return m ? m[2].trim() : null
}

/** ĐÁP ÁN / HƯỚNG DẪN GIẢI = hết phần câu. `Đáp án:` (có dấu :) là đáp án SA, không cắt. */
function isTailHeading(line: string): boolean {
  const bare = stripUnderline(line)
  if (DAP_AN_RE.test(bare)) return false
  if (/^(đáp\s*án|dap\s*an)(\s|$)/i.test(bare)) return true
  if (/^(hướng\s*dẫn\s*giải|huong\s*dan\s*giai)\b/i.test(bare)) return true
  return false
}

function matchGroupMarker(line: string): { type: ParsedQuestionType; rest: string } | null {
  const stripped = stripUnderline(line)
  const m = stripped.match(/^(#{1,3})(?:\s+|$)(.*)$/)
  if (!m) return null
  const type: ParsedQuestionType = m[1] === "###" ? "SA" : m[1] === "##" ? "TF" : "MC"
  const rest = line.replace(/^[\s_]*#{1,3}(?:__)?\s*/, "").trim()
  return { type, rest }
}

function mcOptionContent(letter: string, text: string): string {
  return `${letter}. ${text}`.trim()
}

function isMcChoiceStart(line: string): boolean {
  return /^[A-Da-d][.)]\s*/.test(stripUnderline(line))
}

function isTfChoiceStart(line: string): boolean {
  return /^[A-Da-d][.)]\s*/.test(stripUnderline(line))
}

function takeFirstTfBlock(block: string): { first: string; leftover: boolean } {
  const searchable = block.replace(/__/g, "  ")
  const re = /(^|[\s\u00A0])\s*([aA][.)])/g
  let found = 0
  let secondStart = -1
  let m: RegExpExecArray | null
  while ((m = re.exec(searchable)) !== null) {
    found += 1
    if (found === 2) {
      secondStart = m.index + m[0].length - m[2].length
      break
    }
  }
  if (secondStart < 0) return { first: block, leftover: false }
  let cut = secondStart
  if (cut >= 2 && block.slice(cut - 2, cut) === "__") cut -= 2
  return { first: block.slice(0, cut), leftover: true }
}

/** Tách A-D (hoặc a-d) trong 1 khối: 1 dòng, 4-trong-1, hoặc 2+2. Giữ @@IMG/@@TBL. */
function splitChoiceBlock(
  block: string,
  letters: string[],
): { letter: string; text: string; underlined: boolean }[] {
  const searchable = block.replace(/__/g, "  ")
  const positions: { letter: string; start: number }[] = []
  let from = 0
  for (const L of letters) {
    const re = new RegExp(`(^|[\\s\\u00A0]|\\.)\\s*(${L}[.)])`, "i")
    const slice = searchable.slice(from)
    const m = slice.match(re)
    if (!m) break
    const letterStart = (m.index ?? 0) + m[0].length - m[2].length
    const idx = from + letterStart
    positions.push({ letter: L, start: idx })
    from = idx + L.length + 1
  }
  const parts: { letter: string; text: string; underlined: boolean }[] = []
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start
    let end = i + 1 < positions.length ? positions[i + 1].start : block.length
    if (i + 1 < positions.length && end >= 2 && block.slice(end - 2, end) === "__") {
      end -= 2
    }
    const raw = block.slice(start, end)
    const underlined = raw.includes("__") || (start >= 2 && block.slice(start - 2, start) === "__")
    let text = raw.replace(/^[A-Da-d][.)]\s*/i, "")
    text = text.replace(/__/g, "").trim()
    parts.push({ letter: positions[i].letter, text, underlined })
  }
  return parts
}

function tfOptionContent(letter: string, text: string): string {
  return `${letter.toLowerCase()}) ${text}`.trim()
}

function appendStem(q: ParsedQuestion, extra: string) {
  const t = extra.trim()
  if (!t) return
  q.content = q.content ? `${q.content}\n${t}` : t
}

function canAppendStem(q: ParsedQuestion, buffering: boolean): boolean {
  if (q.type === "SA") return !q.correctAnswer
  return !buffering && q.options.length === 0
}

// ============ Parser văn bản thuần ============

export function parseTextContent(text: string): ParseResult {
  text = normalizeParseText(text)
  const errors: ParseError[] = []
  const chapters: ParsedChapter[] = []

  let curChapter: ParsedChapter | null = null
  let curLesson: ParsedLesson | null = null
  let curKp: ParsedKnowledgePoint | null = null
  let curQuestion: ParsedQuestion | null = null
  let groupType: ParsedQuestionType | null = null
  let inTail = false
  let sawStructure = false
  let optionBuffer: string | null = null

  const ensureChapter = (): ParsedChapter => {
    if (!curChapter) {
      curChapter = { title: "Chương chưa đặt tên", lessons: [], line: 0 }
      chapters.push(curChapter)
    }
    return curChapter
  }

  let leftoverTf = false

  const flushChoiceBuffer = () => {
    if (!curQuestion || optionBuffer == null) {
      optionBuffer = null
      return
    }
    if (curQuestion.type === "MC") {
      const parts = splitChoiceBlock(optionBuffer, MC_LETTERS)
      curQuestion.options = parts.map((p) => ({
        content: mcOptionContent(p.letter, p.text),
        isCorrect: p.underlined,
      }))
    } else if (curQuestion.type === "TF") {
      const { first, leftover } = takeFirstTfBlock(optionBuffer)
      const parts = splitChoiceBlock(first, TF_LETTERS)
      curQuestion.options = parts.slice(0, 4).map((p) => ({
        content: tfOptionContent(p.letter, p.text),
        isCorrect: p.underlined,
      }))
      if (leftover) {
        errors.push({
          line: curQuestion.line,
          message: "Các ý a)-d) không thuộc câu nào (thiếu Câu n.)",
        })
      }
    }
    optionBuffer = null
  }

  const closeQuestion = () => {
    flushChoiceBuffer()
    if (curQuestion?.type === "SA" && !curQuestion.correctAnswer) {
      errors.push({ line: curQuestion.line, message: "Câu trả lời ngắn thiếu 'Đáp án:'" })
    }
    curQuestion = null
  }

  const startQuestion = (type: ParsedQuestionType, content: string, lineNo: number) => {
    closeQuestion()
    if (!curKp) {
      errors.push({ line: lineNo, message: "Câu hỏi phải nằm trong một điểm kiến thức (bắt đầu bằng '-')" })
      return
    }
    curQuestion = { type, content, options: [], line: lineNo }
    curKp.questions.push(curQuestion)
  }

  const lines = text.split(/\r?\n/)
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1
    if (inTail) return

    let line = rawLine.trim()
    if (BULLET_RE.test(line) || /^[–—−]\s*/.test(line)) {
      const rest = line.replace(BULLET_RE, "").replace(/^[–—−]\s*/, "").trim()
      const keep =
        parseChoiceLine(rest) != null ||
        rest.startsWith("#") ||
        rest.startsWith("{") ||
        rest.startsWith("[") ||
        CAU_RE.test(stripUnderline(rest)) ||
        DAP_AN_RE.test(stripUnderline(rest))
      line = keep ? rest : `- ${rest}`
    }

    if (!line) {
      if (optionBuffer != null && (curQuestion?.type === "MC" || curQuestion?.type === "TF")) optionBuffer += "\n"
      return
    }
    if (line.startsWith("//")) return

    if (isTailHeading(line)) {
      closeQuestion()
      inTail = true
      return
    }

    const chapterMatch = line.match(/^\{(.+)\}$/)
    if (chapterMatch) {
      sawStructure = true
      closeQuestion()
      curChapter = { title: chapterMatch[1].trim(), lessons: [], line: lineNo }
      chapters.push(curChapter)
      curLesson = null
      curKp = null
      return
    }

    const lessonMatch = line.match(/^\[(.+)\]$/)
    if (lessonMatch) {
      sawStructure = true
      closeQuestion()
      const chap = ensureChapter()
      curLesson = { title: lessonMatch[1].trim(), knowledgePoints: [], line: lineNo }
      chap.lessons.push(curLesson)
      curKp = null
      return
    }

    if (line.startsWith("-")) {
      closeQuestion()
      let body = line.slice(1).trim()
      body = body.replace(/^Ý kiến thức\s*:\s*/i, "").replace(/^Y kien thuc\s*:\s*/i, "")
      if (!curLesson) {
        errors.push({ line: lineNo, message: "Điểm kiến thức phải nằm trong một bài [Tên bài]" })
        return
      }
      const badMarks = malformedQuoteUnderlineMarks(body)
      if (badMarks.length > 0) {
        errors.push({
          line: lineNo,
          message: `Gạch chân kèm ngoặc kép phải viết __"từ"__ (không phải "__từ"__): ${badMarks.slice(0, 3).join(", ")}`,
        })
      }
      const { content, underlinedTerms } = extractBlanks(body)
      curKp = { content, underlinedTerms, questions: [], line: lineNo }
      curLesson.knowledgePoints.push(curKp)
      return
    }

    const group = matchGroupMarker(line)
    if (group) {
      groupType = group.type
      closeQuestion()
      if (!group.rest) return
      let body = group.rest
      const cauOnSame = parseCauLine(stripUnderline(body))
      if (cauOnSame != null) body = cauOnSame
      const dapOnSame = group.type === "SA" ? parseDapAnLine(stripUnderline(body)) : null
      startQuestion(group.type, dapOnSame != null ? "" : body, lineNo)
      if (curQuestion && dapOnSame != null) curQuestion.correctAnswer = dapOnSame
      leftoverTf = false
      return
    }

    if (parseCauLine(stripUnderline(line)) != null) {
      leftoverTf = false
      const cauBody = parseCauLine(line) ?? parseCauLine(stripUnderline(line)) ?? ""
      if (groupType == null) {
        errors.push({ line: lineNo, message: "Câu hỏi phải nằm sau mốc #/##/###" })
        return
      }
      if (curQuestion && !curQuestion.content && curQuestion.type === groupType) {
        curQuestion.content = cauBody
        return
      }
      startQuestion(groupType, cauBody, lineNo)
      return
    }

    if (!sawStructure) return

    const dapAnBody = parseDapAnLine(stripUnderline(line))
    if (dapAnBody != null && curQuestion?.type === "SA") {
      curQuestion.correctAnswer = dapAnBody
      return
    }

    if ((curQuestion?.type === "MC" || curQuestion?.type === "TF") && optionBuffer != null) {
      optionBuffer += `\n${line}`
      return
    }
    if (curQuestion?.type === "MC" && optionBuffer == null && isMcChoiceStart(line)) {
      optionBuffer = line
      return
    }
    if (curQuestion?.type === "TF" && optionBuffer == null && isTfChoiceStart(line)) {
      optionBuffer = line
      return
    }

    if (!curQuestion && groupType === "TF" && isTfChoiceStart(line)) {
      if (!leftoverTf) {
        leftoverTf = true
        errors.push({
          line: lineNo,
          message: "Các ý a)-d) không thuộc câu nào (thiếu Câu n.)",
        })
      }
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

    if (/^@@(IMG|TBL)\d+@@$/.test(line) && !(curQuestion && canAppendStem(curQuestion, optionBuffer != null))) {
      return
    }

    if (curQuestion && canAppendStem(curQuestion, optionBuffer != null)) {
      appendStem(curQuestion, line)
      return
    }

    if (!curQuestion && curKp) {
      const extra = stripUnderline(line)
      if (extra) curKp.content = curKp.content ? `${curKp.content}\n${extra}` : extra
      return
    }

    errors.push({ line: lineNo, message: `Không nhận dạng được cú pháp: "${line.slice(0, 40)}"` })
  })

  closeQuestion()
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
    .replace(/&ldquo;|&rdquo;|&laquo;|&raquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
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
  const cls = tag.match(/\bclass\s*=\s*["'](eq-inline|eq-figure)["']/i)?.[1] ?? ""
  const h = tag.match(/\bstyle\s*=\s*["']height:([\d.]+)em;width:auto["']/i)?.[1]
  const extra =
    (cls ? ` class="${cls}"` : "") +
    (cls === "eq-inline" && h ? ` style="height:${h}em;width:auto"` : "")
  const i = images.length
  images.push(`<img src="${src}" alt="${alt}"${extra}>`)
  return cls === "eq-inline" ? `@@IMG${i}@@` : `\n@@IMG${i}@@\n`
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

function liPlain(content: string): string {
  return decodeEntities(content.replace(/<[^>]+>/g, "")).replace(/__/g, "").trim()
}

function alreadyLabeled(plain: string): boolean {
  return /^([a-dA-D]|[1-4])[.)]/.test(plain) || /^[-–—*+]/.test(plain) || BULLET_RE.test(plain)
}

/** Word hay biến - KP thành <ul><li> và A.B.C.D thành <ol><li>, mất marker khi strip tag. */
function convertHtmlLists(html: string): string {
  let out = html.replace(/<ol\b([^>]*)>([\s\S]*?)<\/ol>/gi, (_m, attrs: string, inner: string) => {
    const type = attrs.match(/\btype\s*=\s*["']?([AIa1])/i)?.[1] ?? ""
    let i = 0
    const items = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_li, content: string) => {
      const plain = liPlain(content)
      if (!plain || alreadyLabeled(plain)) return `${content}\n`
      i += 1
      if (type === "1") return `${i}. ${content}\n`
      const letter = type === "a" ? String.fromCharCode(96 + i) : String.fromCharCode(64 + i)
      return `${letter}. ${content}\n`
    })
    return `\n${items}\n`
  })
  out = out.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
    const items = inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_li, content: string) => {
      const plain = liPlain(content)
      if (!plain) return `${content}\n`
      if (alreadyLabeled(plain) || plain.startsWith("#") || plain.startsWith("{") || plain.startsWith("[")) {
        return `${content}\n`
      }
      return `- ${content}\n`
    })
    return `\n${items}\n`
  })
  return out
}

function stripRichTokens(text: string): string {
  return text
    .split("\n")
    .map((ln) => ln.replace(/@@(IMG|TBL)\d+@@/g, "").trim())
    .filter((ln) => ln.length > 0)
    .join("\n")
}

export function attachBodyHtml(result: ParseResult, images: string[], tables: string[]) {
  if (images.length === 0 && tables.length === 0) return
  for (const ch of result.chapters) {
    for (const lesson of ch.lessons) {
      for (const kp of lesson.knowledgePoints) {
        for (const q of kp.questions) {
          if (!q.content.includes("@@IMG") && !q.content.includes("@@TBL")) continue
          const lines = q.content.split("\n")
          q.bodyHtml = lines.map((ln) => lineWithRichToHtml(ln, images, tables)).join("<br>\n")
          q.content = stripRichTokens(q.content)
        }
      }
    }
  }
}

export function attachOptionBodyHtml(result: ParseResult, images: string[], tables: string[]) {
  if (images.length === 0 && tables.length === 0) return
  for (const ch of result.chapters) {
    for (const lesson of ch.lessons) {
      for (const kp of lesson.knowledgePoints) {
        for (const q of kp.questions) {
          for (const o of q.options) {
            if (!o.content.includes("@@IMG") && !o.content.includes("@@TBL")) continue
            const lines = o.content.split("\n")
            o.bodyHtml = lines.map((ln) => lineWithRichToHtml(ln, images, tables)).join("<br>\n")
            o.content = stripRichTokens(o.content)
          }
        }
      }
    }
  }
}

export function sourceTextToPreviewHtml(text: string, images: string[], tables: string[]): string {
  return text
    .split(/\r?\n/)
    .map((ln) => lineWithRichToHtml(ln, images, tables) || "&nbsp;")
    .join("<br>\n")
}

/**
 * Chuyển HTML (mammoth) thành text có delimiter: <u>...</u> → __...__, giữ nguyên
 * "..." để đánh dấu hoán đổi, rồi tái sử dụng parseTextContent.
 * Thẻ <img> / <table> giữ qua placeholder rồi gắn `bodyHtml` trên câu hỏi.
 */
export function parseHtmlToResultAndText(html: string): {
  parseResult: ParseResult
  sourceText: string
  images: string[]
  tables: string[]
} {
  const images: string[] = []
  const tables: string[] = []
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  const normalized = normalizeHtml(withoutScripts)
  const withImgs = normalized.replace(/<img\b[^>]*>/gi, (tag) => imgTagToPlaceholder(tag, images))
  const withTables = tableToPlaceholder(withImgs, tables)
  const withLists = convertHtmlLists(withTables)
  const withBreaks = withLists
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
  const withUnderline = withBreaks.replace(/<u>([\s\S]*?)<\/u>/gi, "__$1__")
  const stripped = withUnderline.replace(/<[^>]+>/g, "")
  const sourceText = normalizeParseText(decodeEntities(stripped))
  const parseResult = parseTextContent(sourceText)
  attachBodyHtml(parseResult, images, tables)
  attachOptionBodyHtml(parseResult, images, tables)
  return { parseResult, sourceText, images, tables }
}

export function parseHtmlContent(html: string): ParseResult {
  return parseHtmlToResultAndText(html).parseResult
}

// ============ Validate ============

function isEffectivelyEmpty(text: string, html?: string): boolean {
  if (/@@(?:IMG|TBL)\d+@@/i.test(text)) return false
  if (/<img\b/i.test(text) || /<table\b/i.test(text)) return false
  if (html && (/<img\b/i.test(html) || /<table\b/i.test(html))) return false
  let s = text.replace(/^[A-Da-d][.)]\s*/i, "")
  s = s.replace(/<[^>]+>/g, "")
  s = s.replace(/[.,;:]/g, "")
  s = s.replace(/\s+/g, "")
  return s.length === 0
}

function optionLabel(type: ParsedQuestionType, index: number, content: string): string {
  const m = content.match(/^([A-Da-d])[.)]/)
  if (m) return type === "TF" ? m[1].toLowerCase() : m[1].toUpperCase()
  if (type === "TF") return TF_LETTERS[index] ?? String.fromCharCode(97 + index)
  return MC_LETTERS[index] ?? String.fromCharCode(65 + index)
}

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
          const nCorrect = q.options.filter((o) => o.isCorrect).length
          if (nCorrect === 0) {
            errors.push({ line: q.line, message: "Câu chưa gạch chân đáp án đúng" })
          } else if (nCorrect !== 1) {
            errors.push({ line: q.line, message: "Câu trắc nghiệm phải có đúng 1 đáp án đúng (gạch chân)" })
          }
          q.options.forEach((o, i) => {
            if (isEffectivelyEmpty(o.content, o.bodyHtml)) {
              const X = optionLabel("MC", i, o.content)
              errors.push({
                line: q.line,
                message: `Lựa chọn ${X} thiếu nội dung (công thức Word không đọc được)`,
              })
            }
          })
        } else if (q.type === "TF") {
          if (q.options.length !== 4) {
            errors.push({ line: q.line, message: `Câu Đúng/Sai phải có đúng 4 ý a) b) c) d) (hiện có ${q.options.length})` })
          }
          q.options.forEach((o, i) => {
            if (isEffectivelyEmpty(o.content, o.bodyHtml)) {
              const X = optionLabel("TF", i, o.content)
              errors.push({
                line: q.line,
                message: `Lựa chọn ${X} thiếu nội dung (công thức Word không đọc được)`,
              })
            }
          })
        } else if (q.type === "SA") {
          if (!q.correctAnswer) {
            const already = errors.some((e) => e.line === q.line && /đáp án|dap an/i.test(e.message ?? ""))
            if (!already) errors.push({ line: q.line, message: "Câu trả lời ngắn thiếu 'Đáp án:'" })
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
