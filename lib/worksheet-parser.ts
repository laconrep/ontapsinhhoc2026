import type { UnderlinedTerm } from "@/types"
import { isBlobPublicUrl } from "./sanitize-shared"

// ============ Kiểu dữ liệu kết quả parse ============

export type ParsedQuestionType = "MC" | "TF" | "SA"

export interface ParsedOption {
  content: string
  isCorrect: boolean
  bodyHtml?: string
  /** Gạch chân chỉ bao một phần nội dung phương án (không bao trọn) — BUG-09. */
  underlinePartial?: boolean
}

export interface ParsedQuestion {
  type: ParsedQuestionType
  content: string
  options: ParsedOption[]
  /** đáp án đúng dạng text (SA) */
  correctAnswer?: string
  /** Giải chi tiết của câu (dòng "Giải chi tiết:" ngay sau câu) — §15.3. */
  solution?: string
  /** HTML de (anh/bang); phien 3+ moi gan */
  bodyHtml?: string
  line: number
}

export interface ParsedKnowledgePoint {
  content: string
  underlinedTerms: UnderlinedTerm[]
  questions: ParsedQuestion[]
  /** §19: HTML của riêng các phần tử ảnh/bảng xuất hiện trong nội dung
   * KP (gắn bởi attachBodyHtml) — hiển thị kèm dưới đoạn chữ. */
  bodyHtml?: string
  line: number
}

export interface ParsedLesson {
  title: string
  knowledgePoints: ParsedKnowledgePoint[]
  line: number
  /** §18: dòng [bài] có nhưng để trống tên — khi lưu, hệ thống gán tên
   * thay thế (AI/tên file) và để bài ở trạng thái nháp chờ GV duyệt. */
  titleMissing?: boolean
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
  /** Cảnh báo không chặn lưu: nhóm hoán đổi nhờ nhãn lặp, danh sách chưa bật hoán đổi, phương án chứa mẫu giống nhãn. */
  warnings: ValidationError[]
}

// ============ Tách ô trống trong nội dung KP ============

interface RawMarker {
  start: number
  end: number
  text: string
  allowSwap: boolean
  synonyms?: string[]
}

function peelBlankText(raw: string): { core: string; prefix: string; suffix: string } {
  const m = raw.match(/^([\s.,;:!?…]*)([\s\S]*?)([\s.,;:!?…]*)$/)
  if (!m) return { core: raw, prefix: "", suffix: "" }
  return { core: m[2], prefix: m[1], suffix: m[3] }
}

// Chuỗi nối giữa hai ô hoán đổi cùng nhóm: chỉ gồm khoảng trắng, dấu nối
// (, / - – →) và/hoặc từ nối "và"/"hoặc" (có dấu hoặc không dấu), cho phép
// tổ hợp như ", và " hay " và, ". Văn bản xen khác (vd " bổ sung với ")
// hoặc dấu ngắt câu (. ! ? ;) sẽ tách nhóm. Xem sualogic.md mục 10.
// Chuỗi nối được chuẩn hóa NFC trước khi xét regex (mục 11, BUG-04).
export const SWAP_GROUP_JOIN_RE = /^\s*(?:(?:[,\/\-–→]|và|hoặc|va|hoac)\s*)*$/i
export const MAX_SWAP_GROUP_SIZE = 8

const JOIN_ONLY_WORDS = new Set(["và", "hoặc", "va", "hoac"])

/**
 * Phần "nhãn lặp" còn lại trong chuỗi giữa hai ô sau khi bỏ dấu nối và
 * và/hoặc: ", vùng " -> "vùng". Trả null nếu không còn gì hoặc phần còn lại
 * dài hơn 3 từ (vd " bổ sung với bazơ " -> 4 từ -> null). Xem BUG-04.
 */
function residualSwapLabel(between: string): string | null {
  const tokens = between
    .normalize("NFC")
    .replace(/[,\/\-–→]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !JOIN_ONLY_WORDS.has(t.toLowerCase()))
  if (tokens.length === 0 || tokens.length > 3) return null
  return tokens.join(" ")
}

function tokenizeWords(s: string): string[] {
  return s
    .normalize("NFC")
    .replace(/[,\/\-–→]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function wordsEndWith(words: string[], tail: string[]): boolean {
  if (tail.length === 0 || tail.length > words.length) return false
  const slice = words.slice(words.length - tail.length)
  return slice.join(" ").toLowerCase() === tail.join(" ").toLowerCase()
}

export interface SwapRun {
  terms: UnderlinedTerm[]
  /** Ít nhất một cặp ô trong run được gộp nhờ nhãn lặp (không phải chỉ dấu nối/từ nối). */
  viaLabel: boolean
  label: string | null
}

/**
 * Tìm các run ô liên tiếp có thể gộp một nhóm hoán đổi. Hai ô kề nhau gộp
 * được khi chuỗi giữa chúng khớp SWAP_GROUP_JOIN_RE (sau NFC), hoặc phần
 * còn lại sau khi bỏ dấu nối/và/hoặc là một nhãn ngắn (<= 3 từ) VÀ nhãn đó
 * cũng đứng ngay trước ô đầu tiên của run (vd "là vùng __A__, vùng __B__").
 * swapOnly = true: ô không hoán đổi sẽ ngắt run và không thuộc run nào
 * (dùng khi gán swapGroupId). swapOnly = false: mọi ô đều là ứng viên
 * (dùng để cảnh báo danh sách trông hoán đổi được nhưng chưa bật hoán đổi).
 */
export function computeSwapRuns(
  content: string,
  terms: UnderlinedTerm[],
  opts?: { swapOnly?: boolean },
): SwapRun[] {
  const swapOnly = opts?.swapOnly ?? false
  const ordered = [...terms].sort((a, b) => a.slotIndex - b.slotIndex)
  const runs: (SwapRun & { preWords: string[] })[] = []
  let current: (SwapRun & { preWords: string[] }) | null = null
  let prev: UnderlinedTerm | null = null
  for (const t of ordered) {
    if (swapOnly && !t.allowSwap) {
      current = null
      prev = t
      continue
    }
    let joined = false
    if (current && prev && typeof prev.end === "number" && typeof t.start === "number") {
      const between = content.slice(prev.end, t.start)
      if (SWAP_GROUP_JOIN_RE.test(between.normalize("NFC"))) {
        joined = true
      } else {
        const label = residualSwapLabel(between)
        if (label && wordsEndWith(current.preWords, label.split(" "))) {
          joined = true
          current.viaLabel = true
          current.label = label
        }
      }
    }
    if (joined && current) {
      current.terms.push(t)
    } else {
      const from = prev && typeof prev.end === "number" ? prev.end : 0
      const chunk = typeof t.start === "number" ? content.slice(from, t.start) : ""
      current = { terms: [t], viaLabel: false, label: null, preWords: tokenizeWords(chunk) }
      runs.push(current)
    }
    prev = t
  }
  return runs.map(({ terms: ts, viaLabel, label }) => ({ terms: ts, viaLabel, label }))
}

/**
 * Gán swapGroupId từ content + offset: mỗi run (tối đa MAX_SWAP_GROUP_SIZE
 * ô/nhóm) thành một nhóm; nhóm chỉ có 1 ô -> swapGroupId = null (chấm như
 * ô thường). Dùng chung cho extractBlanks và backfill-swap-groups.
 */
export function assignSwapGroupIds(content: string, terms: UnderlinedTerm[]): void {
  for (const t of terms) t.swapGroupId = null
  const runs = computeSwapRuns(content, terms, { swapOnly: true })
  let groupCounter = 0
  for (const run of runs) {
    for (let s = 0; s < run.terms.length; s += MAX_SWAP_GROUP_SIZE) {
      const slice = run.terms.slice(s, s + MAX_SWAP_GROUP_SIZE)
      if (slice.length < 2) continue
      groupCounter += 1
      const gid = `g${groupCounter}`
      for (const t of slice) t.swapGroupId = gid
    }
  }
}

/**
 * Word/mammoth hay ra `"__từ"__` thay vì `__"từ"__`.
 * Cú pháp đúng: __từ__ | __"từ"__.
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

export function unusedPlainQuotes(raw: string): string[] {
  const s = raw.replace(/[\u201c\u201d]/g, '"')
  const masked = s.replace(/__(.+?)__/g, (m) => " ".repeat(m.length))
  const out: string[] = []
  const re = /"(.+?)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(masked)) !== null) {
    if (!m[1].trim()) continue
    const snippet = m[0].replace(/\s+/g, " ").trim().slice(0, 48)
    if (snippet) out.push(snippet)
  }
  return out
}

export function uncappedSwapRunLengths(content: string, terms: UnderlinedTerm[]): number[] {
  return computeSwapRuns(content, terms, { swapOnly: true }).map((r) => r.terms.length)
}

/**
 * Phân tích nội dung KP: tìm các ô trống đánh dấu bằng __từ__ (cố định) hoặc
 * __"từ"__ (hoán đổi).
 *
 * Hỗ trợ từ đồng nghĩa: __từ|đồng_nghĩa1|đồng_nghĩa2__ hoặc __"từ|đồng_nghĩa1"__
 * Phần trước | là text (bắt buộc), phần sau | là synonyms (tuỳ chọn).
 *
 * Trả về content đã bỏ ký hiệu delimiter và mảng underlinedTerms.
 */
export function extractBlanks(raw: string): {
  content: string
  underlinedTerms: UnderlinedTerm[]
} {
  const markers: RawMarker[] = []
  // 1) tìm __...__ trước (có thể chứa "..." bên trong). Delimiter phải là
  // đúng "__" không dính thêm gạch dưới hai phía: dãy _{3,} (________,
  // ____) là chỗ trống chưa có đáp án, không được ghép mảnh thành ô rác
  // (BUG-06) — dãy được giữ nguyên trong content để validateDocument báo lỗi.
  const underlineRe = /(?<!_)__(?!_)(.+?)(?<!_)__(?!_)/g
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
    // Dãy gạch dưới không có đáp án (________, ____): "chỗ trống chưa có
    // đáp án" — KHÔNG tạo term rác. Giữ nguyên dãy trong content để
    // validateDocument báo lỗi và hướng dẫn viết __đáp án__ (BUG-06).
    if (/^[_\s]*$/.test(inner)) continue
    markers.push({ start: m.index, end: m.index + m[0].length, text: inner, allowSwap, synonyms })
  }

  markers.sort((a, b) => a.start - b.start)

  // dựng content đã strip delimiter + tính vị trí ô trống trong content sạch
  let content = ""
  let cursor = 0
  const placed: { text: string; allowSwap: boolean; cleanStart: number; synonyms?: string[] }[] = []
  for (const mk of markers) {
    content += raw.slice(cursor, mk.start)
    const peeled = peelBlankText(mk.text)
    if (!peeled.core) {
      content += mk.text
      cursor = mk.end
      continue
    }
    content += peeled.prefix
    const cleanStart = content.length
    content += peeled.core
    content += peeled.suffix
    placed.push({ text: peeled.core, allowSwap: mk.allowSwap, cleanStart, synonyms: mk.synonyms })
    cursor = mk.end
  }
  content += raw.slice(cursor)

  const lead = content.length - content.trimStart().length

  const terms: UnderlinedTerm[] = placed.map((p, i) => {
    const start = p.cleanStart - lead
    return {
      text: p.text,
      slotIndex: i,
      allowSwap: p.allowSwap,
      swapGroupId: null,
      extraAccepted: [],
      synonyms: p.synonyms && p.synonyms.length > 0 ? p.synonyms : undefined,
      start,
      end: start + p.text.length,
    }
  })

  // Gán swapGroupId: hai ô swap cùng nhóm khi chuỗi giữa chúng chỉ gồm dấu
  // nối/và/hoặc, hoặc là nhãn lặp đứng ngay trước ô đầu (BUG-04). Tối đa
  // 8 ô/nhóm; nhóm 1 ô -> null (chấm như ô thường).
  const trimmed = content.trim()
  assignSwapGroupIds(trimmed, terms)

  return { content: trimmed, underlinedTerms: terms }
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

const SOLUTION_RE =
  /^(giải\s*chi\s*tiết|giai\s*chi\s*tiet|hướng\s*dẫn\s*giải|huong\s*dan\s*giai)\s*:\s*(.*)$/i

/** Dòng mở lời giải của câu hiện tại: "Giải chi tiết: ..." / "Hướng dẫn giải: ...". */
function parseSolutionLine(line: string): string | null {
  const m = line.match(SOLUTION_RE)
  return m ? m[2].trim() : null
}

/** ĐÁP ÁN / HƯỚNG DẪN GIẢI = hết phần câu. `Đáp án:` (có dấu :) là đáp án SA, không cắt. */
function isTailHeading(line: string): boolean {
  const bare = stripUnderline(line)
  if (DAP_AN_RE.test(bare)) return false
  // "Hướng dẫn giải: <nội dung>" (có dấu : và nội dung ngay sau) là lời
  // giải CỦA CÂU (§15.3), không phải tiêu đề phần cuối file.
  if (SOLUTION_RE.test(bare)) return false
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

interface ChoicePart {
  letter: string
  text: string
  underlined: boolean
  underlinePartial: boolean
}

/** Mọi vị trí ứng viên của nhãn `letter` trong khối (trên bản đã che "__"). */
function markerCandidates(searchable: string, letter: string): number[] {
  const re = new RegExp(`(^|[\\s\\u00A0]|\\.)\\s*(${letter}[.)])`, "gi")
  const out: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(searchable)) !== null) {
    out.push(m.index + m[0].length - m[2].length)
  }
  return out
}

/**
 * Ưu tiên 1 — tách theo đầu dòng: dòng bắt đầu bằng nhãn kế tiếp theo đúng
 * thứ tự mới mở phương án mới; dòng khác là phần tiếp của phương án trước.
 * Nhãn giống hệt nằm giữa dòng (vd "Nhóm B. là...") không bị cắt (BUG-07).
 */
function lineStartPositions(
  searchable: string,
  letters: string[],
): { letter: string; start: number }[] | null {
  const positions: { letter: string; start: number }[] = []
  let expect = 0
  let offset = 0
  for (const line of searchable.split("\n")) {
    if (expect < letters.length) {
      const m = line.match(new RegExp(`^\\s*(${letters[expect]}[.)])`, "i"))
      if (m) {
        positions.push({ letter: letters[expect], start: offset + line.indexOf(m[1]) })
        expect += 1
      }
    }
    offset += line.length + 1
  }
  return expect === letters.length ? positions : null
}

/**
 * Ưu tiên 2 — khối gộp một dòng: chọn lùi từ chữ cái cuối. Ứng viên nhái
 * nằm trong nội dung phương án trước luôn đứng TRƯỚC nhãn thật của phương
 * án sau, nên lấy ứng viên cuối cùng còn hợp lệ cho mỗi chữ (theo thứ tự
 * A -> B -> C -> D tăng dần) sẽ bỏ qua nhãn nhái (BUG-07).
 */
function backwardPositions(
  searchable: string,
  letters: string[],
): { letter: string; start: number }[] | null {
  const chosen = new Array<number>(letters.length).fill(-1)
  let bound = Number.POSITIVE_INFINITY
  for (let i = letters.length - 1; i >= 0; i--) {
    const cands = markerCandidates(searchable, letters[i]).filter((p) => p < bound)
    if (cands.length === 0) return null
    chosen[i] = cands[cands.length - 1]
    bound = chosen[i]
  }
  return letters.map((L, i) => ({ letter: L, start: chosen[i] }))
}

/** Dự phòng — thuật toán quét tiến cũ (khi hai cách trên không đủ chữ cái). */
function forwardPositions(
  searchable: string,
  letters: string[],
): { letter: string; start: number }[] {
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
  return positions
}

function normalizeForCompare(s: string): string {
  return s
    .replace(/^[A-Da-d][.)]\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.,;:!?…]+$/g, "")
    .trim()
}

/** Tách A-D (hoặc a-d) trong 1 khối: 1 dòng, 4-trong-1, hoặc 2+2. Giữ @@IMG/@@TBL. */
function splitChoiceBlock(block: string, letters: string[]): ChoicePart[] {
  const searchable = block.replace(/__/g, "  ")
  const positions =
    lineStartPositions(searchable, letters) ??
    backwardPositions(searchable, letters) ??
    forwardPositions(searchable, letters)
  const parts: ChoicePart[] = []
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].start
    let end = i + 1 < positions.length ? positions[i + 1].start : block.length
    if (i + 1 < positions.length && end >= 2 && block.slice(end - 2, end) === "__") {
      end -= 2
    }
    // "__" mở ngay trước nhãn thuộc về phương án này (vd __B. ...__).
    const segStart = start >= 2 && block.slice(start - 2, start) === "__" ? start - 2 : start
    const raw = block.slice(start, end)
    const rawFull = block.slice(segStart, end)
    const underlined = raw.includes("__") || segStart < start
    let text = raw.replace(/^[A-Da-d][.)]\s*/i, "")
    text = text.replace(/__/g, "").trim()
    // BUG-09: gạch chân chỉ bao một phần nội dung phương án thì KHÔNG được
    // coi là chỉ định đáp án đúng — validateDocument sẽ báo lỗi. Bao trọn
    // phương án (hoặc trọn phần nội dung sau nhãn) vẫn hợp lệ như cũ.
    let underlinePartial = false
    if (underlined) {
      const segs: string[] = []
      const re = /__([\s\S]*?)__/g
      let mm: RegExpExecArray | null
      while ((mm = re.exec(rawFull)) !== null) segs.push(mm[1])
      if (segs.length > 0) {
        const underText = normalizeForCompare(segs.join("").replace(/__/g, ""))
        underlinePartial = underText !== normalizeForCompare(text)
      }
    }
    parts.push({ letter: positions[i].letter, text, underlined, underlinePartial })
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
        underlinePartial: p.underlinePartial || undefined,
      }))
    } else if (curQuestion.type === "TF") {
      const { first, leftover } = takeFirstTfBlock(optionBuffer)
      const parts = splitChoiceBlock(first, TF_LETTERS)
      curQuestion.options = parts.slice(0, 4).map((p) => ({
        content: tfOptionContent(p.letter, p.text),
        isCorrect: p.underlined,
        underlinePartial: p.underlinePartial || undefined,
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

  let inSolution = false

  const closeQuestion = () => {
    flushChoiceBuffer()
    inSolution = false
    if (curQuestion?.solution != null) curQuestion.solution = curQuestion.solution.trim()
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
      if (inSolution && curQuestion?.solution != null) {
        curQuestion.solution += "\n"
        return
      }
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

    const lessonMatch = line.match(/^\[(.*)\]$/)
    if (lessonMatch) {
      sawStructure = true
      closeQuestion()
      const chap = ensureChapter()
      const lessonTitle = lessonMatch[1].trim()
      curLesson = {
        title: lessonTitle,
        knowledgePoints: [],
        line: lineNo,
        // §18: [] hoặc [ ] = GV bỏ trống tên bài.
        titleMissing: lessonTitle === "" || undefined,
      }
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
      const unusedQuotes = unusedPlainQuotes(body)
      if (unusedQuotes.length > 0) {
        errors.push({
          line: lineNo,
          message: `Ngoặc kép thường không tạo ô trống (cần __"từ"__): ${unusedQuotes.slice(0, 3).join(", ")}`,
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

    // §15.3: dòng "Giải chi tiết:" mở lời giải cho câu hiện tại; các dòng
    // thường tiếp theo (chưa gặp mốc cấu trúc nào) là phần tiếp của lời giải.
    const solBody = parseSolutionLine(line)
    if (solBody != null && curQuestion) {
      flushChoiceBuffer()
      curQuestion.solution = solBody
      inSolution = true
      return
    }
    if (inSolution && curQuestion?.solution != null) {
      curQuestion.solution =
        (curQuestion.solution ? curQuestion.solution + "\n" : "") + line
      return
    }

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
      // §19: token ảnh/bảng đứng một mình trong vùng lý thuyết thì gắn
      // vào điểm kiến thức hiện tại (thay vì biến mất như trước) để
      // attachBodyHtml chuyển thành hình/bảng thật của điểm đó.
      if (!curQuestion && curKp) {
        curKp.content = curKp.content ? `${curKp.content}\n${line}` : line
      }
      return
    }

    if (curQuestion && canAppendStem(curQuestion, optionBuffer != null)) {
      appendStem(curQuestion, line)
      return
    }

    if (!curQuestion && curKp && curLesson) {
      // §19: MỖI DÒNG LÀ MỘT ĐIỂM KIẾN THỨC — dòng chữ thường theo sau
      // một điểm kiến thức KHÔNG còn gộp vào điểm đó nữa, mà mở một
      // điểm kiến thức mới; gạch chân trên chính dòng này thành ô
      // trống của điểm mới, đúng như một dòng bắt đầu bằng "-".
      const { content, underlinedTerms } = extractBlanks(line)
      if (content) {
        curKp = { content, underlinedTerms, questions: [], line: lineNo }
        curLesson.knowledgePoints.push(curKp)
      }
      return
    }

    errors.push({ line: lineNo, message: `Không nhận dạng được cú pháp: "${line.slice(0, 40)}"` })
  })

  closeQuestion()
  return { chapters, errors }
}

// ============ Parser HTML (từ mammoth .docx) ============

/** Gộp các thẻ <u> liền kề (FIX B-01). Không gộp khi một phía chỉ là dấu câu. */
export function normalizeHtml(html: string): string {
  const punctOnly = /^[\s.,;:!?…]+$/
  return html.replace(/(?:<u>[\s\S]*?<\/u>\s*)+/gi, (seq) => {
    const parts: { inner: string; gap: string }[] = []
    const re = /<u>([\s\S]*?)<\/u>(\s*)/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(seq)) !== null) parts.push({ inner: m[1], gap: m[2] })
    const out: string[] = []
    let acc: string | null = null
    let pendingGap = ""
    for (const p of parts) {
      if (punctOnly.test(p.inner)) {
        if (acc != null) {
          out.push(`<u>${acc}</u>${pendingGap}`)
          acc = null
        }
        out.push(`<u>${p.inner}</u>${p.gap}`)
        pendingGap = ""
      } else {
        acc = acc == null ? p.inner : acc + pendingGap + p.inner
        pendingGap = p.gap
      }
    }
    if (acc != null) out.push(`<u>${acc}</u>${pendingGap}`)
    return out.join("")
  })
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
  // Chấp nhận data URI, đường dẫn nội bộ, và https URL từ host public của
  // Vercel Blob (ảnh raster đã upload lúc trích xuất) — mọi src khác bị bỏ.
  if (
    !/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(src) &&
    !src.startsWith("/") &&
    !isBlobPublicUrl(src)
  )
    return ""
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

/** §19: HTML của riêng các phần tử ảnh/bảng trong một dòng (bỏ phần
 * chữ xung quanh) — dùng cho bodyHtml của điểm kiến thức. */
function mediaOnlyHtml(line: string, images: string[], tables: string[]): string {
  const re = /@@(IMG|TBL)(\d+)@@/g
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const html = m[1] === "IMG" ? images[Number(m[2])] : tables[Number(m[2])]
    if (html) out.push(html)
  }
  return out.join("\n")
}

export function attachBodyHtml(result: ParseResult, images: string[], tables: string[]) {
  if (images.length === 0 && tables.length === 0) return
  for (const ch of result.chapters) {
    for (const lesson of ch.lessons) {
      for (const kp of lesson.knowledgePoints) {
        // §19: ảnh/bảng nằm trong nội dung điểm kiến thức — trước đây
        // mã giữ chỗ bị in nguyên văn; nay tách phần tử media thành
        // bodyHtml của điểm và xoá mã khỏi nội dung chữ.
        if (kp.content.includes("@@IMG") || kp.content.includes("@@TBL")) {
          const media = kp.content
            .split("\n")
            .map((ln) => mediaOnlyHtml(ln, images, tables))
            .filter(Boolean)
            .join("\n")
          if (media) kp.bodyHtml = media
          kp.content = stripRichTokens(kp.content)
          // Xoá token làm nội dung ngắn lại — offset start/end của các
          // cụm gạch chân nằm sau token bị lệch. Tính lại theo thứ tự
          // xuất hiện (bỏ qua vùng đã chiếm), cùng thuật toán đặt gạch
          // chân của bản dựng AI; cụm nào không tìm thấy thì giữ
          // nguyên (khâu lưu sẽ bắt lỗi như trước).
          const claimed: { start: number; end: number }[] = []
          for (const t of kp.underlinedTerms) {
            if (!t.text) continue
            let from = 0
            let idx = kp.content.indexOf(t.text, from)
            while (idx !== -1) {
              const end = idx + t.text.length
              if (!claimed.some((c) => idx < c.end && end > c.start)) {
                claimed.push({ start: idx, end })
                t.start = idx
                t.end = end
                break
              }
              from = idx + 1
              idx = kp.content.indexOf(t.text, from)
            }
          }
        }
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

/**
 * Tách đáp án SA dạng "x | y" thành các đáp án chấp nhận được (BUG-08):
 * mỗi vế là một đáp án đúng độc lập, giống cú pháp synonyms của ô điền
 * khuyết. Trả mảng đã trim, bỏ rỗng, bỏ trùng; rỗng -> [].
 */
export function splitSaAcceptedAnswers(correctAnswer: string | undefined | null): string[] {
  return [
    ...new Set(
      (correctAnswer ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
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
  const warnings: ValidationError[] = []

  const lessons = result.chapters.flatMap((c) => c.lessons)
  if (lessons.length === 0) {
    errors.push({ message: "Tài liệu phải có ít nhất 1 bài [Tên bài]" })
  }

  for (const lesson of lessons) {
    // §18: tên bài bỏ trống không chặn lưu — cảnh báo để GV biết bài sẽ
    // được gán tên thay thế. §21: lưu xong bài ở trạng thái Sẵn sàng
    // luôn nên GV kiểm tra lại tên ở bản xem trước trước khi bấm Lưu.
    if (lesson.titleMissing) {
      warnings.push({
        line: lesson.line,
        message:
          "Bài chưa có tên trong file — khi lưu, hệ thống sẽ gán tên thay thế (AI hoặc tên file). Kiểm tra lại tên trước khi lưu.",
      })
    }
    if (lesson.knowledgePoints.length === 0) {
      errors.push({
        line: lesson.line,
        message: `Bài "${lesson.title || "chưa đặt tên"}" phải có ít nhất 1 điểm kiến thức`,
      })
    }
    for (const kp of lesson.knowledgePoints) {
      if (kp.underlinedTerms.length === 0) {
        // §19: mỗi dòng là một điểm kiến thức — một dòng nội dung không
        // có gạch chân vẫn là điểm kiến thức hợp lệ (chỉ để đọc và tự
        // đánh giá ở Tab 1, không sinh bài điền khuyết/kéo thả). Hạ từ
        // lỗi chặn xuống cảnh báo để GV biết, không khoá cả tài liệu.
        warnings.push({
          line: kp.line,
          message: `Điểm kiến thức phải có ít nhất 1 từ gạch chân (__từ__ hoặc __"từ"__): "${kp.content.slice(0, 30)}"`,
        })
      }
      // BUG-06: dãy gạch dưới chưa có đáp án còn sót trong nội dung KP
      // (________, ____ hoặc __ chưa đóng) — không học sinh nào điền đúng được.
      if (/__/.test(kp.content) || /_{3,}/.test(kp.content)) {
        errors.push({
          line: kp.line,
          message: `Còn dãy gạch dưới chưa thành ô trống tại dòng ${kp.line}: hãy viết đáp án vào trong __đáp án__ (không để dãy gạch dưới trống): "${kp.content.slice(0, 40)}"`,
        })
      }
      // BUG-04: cảnh báo nhóm hoán đổi được gộp nhờ nhãn lặp — giáo viên rà
      // soát trường hợp danh sách có thứ tự cố định dùng chung nhãn (vd các
      // giai đoạn nguyên phân) thì không nên cho hoán đổi.
      for (const run of computeSwapRuns(kp.content, kp.underlinedTerms, { swapOnly: true })) {
        if (run.terms.length >= 2 && run.viaLabel) {
          warnings.push({
            line: kp.line,
            message: `Nhóm hoán đổi tại dòng ${kp.line} được gộp nhờ nhãn lặp "${run.label}" — học sinh điền đảo thứ tự vẫn đúng. Nếu đây là danh sách có thứ tự cố định, hãy bỏ ngoặc kép để chấm theo vị trí.`,
          })
        }
      }
      // BUG-04: danh sách trông hoán đổi được (nhãn lặp) nhưng các ô chưa
      // bật hoán đổi (chưa dùng __"từ"__).
      for (const run of computeSwapRuns(kp.content, kp.underlinedTerms)) {
        if (run.terms.length >= 2 && run.viaLabel && run.terms.some((t) => !t.allowSwap)) {
          warnings.push({
            line: kp.line,
            message: `Danh sách tại dòng ${kp.line} có nhãn lặp "${run.label}" trông như hoán đổi được nhưng các ô chưa bật hoán đổi — dùng __"từ"__ nếu muốn học sinh điền đảo thứ tự vẫn đúng.`,
          })
        }
      }
      for (const n of uncappedSwapRunLengths(kp.content, kp.underlinedTerms)) {
        if (n > 8) {
          errors.push({
            line: kp.line,
            message: `Nhóm hoán đổi có ${n} ô (tối đa 8): "${kp.content.slice(0, 40)}"`,
          })
        }
      }
      for (const q of kp.questions) {
        if (q.type === "MC" || q.type === "TF") {
          // BUG-09: gạch chân chỉ bao MỘT PHẦN phương án -> chặn cứng. Gạch
          // chân trong phương án chỉ để chỉ định đáp án khi bao trọn phương
          // án; dùng để nhấn mạnh sẽ âm thầm biến phương án sai thành đúng.
          q.options.forEach((o, i) => {
            if (o.underlinePartial) {
              const X = optionLabel(q.type, i, o.content)
              errors.push({
                line: q.line,
                message: `Lựa chọn ${X} có gạch chân chỉ bao một phần nội dung — gạch chân như vậy sẽ bị hiểu là đáp án đúng. Muốn chỉ định đáp án, hãy gạch chân toàn bộ lựa chọn; không dùng gạch chân để nhấn mạnh trong lựa chọn.`,
              })
            }
            // BUG-07: nội dung phương án chứa mẫu giống nhãn (B., c)...) —
            // cảnh báo để giáo viên rà soát việc tách phương án.
            const body = o.content.replace(/^[A-Da-d][.)]\s*/i, "")
            const fake = body.match(/[\s\u00A0]([A-Da-d][.)])[\s\u00A0]/)
            if (fake) {
              const X = optionLabel(q.type, i, o.content)
              warnings.push({
                line: q.line,
                message: `Lựa chọn ${X} chứa mẫu giống nhãn "${fake[1]}" trong nội dung — kiểm tra lại việc tách lựa chọn có đúng ý không.`,
              })
            }
          })
        }
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

  return { isValid: errors.length === 0, errors, warnings }
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
