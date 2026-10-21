import type { UnderlinedTerm } from "@/types"

// ============ Chuẩn hoá vị trí dấu thanh (kiểu cũ -> kiểu mới) ============
// Hai kiểu gõ chỉ khác VỊ TRÍ dấu thanh trên các âm đôi oa / oe / uy:
//   kiểu cũ: hoá, thuỷ, khoẻ (dấu trên nguyên âm thứ hai)
//   kiểu mới: hóa, thủy, khỏe (dấu trên nguyên âm thứ nhất — khi âm đôi ở cuối âm tiết)
// Âm tiết đóng (có phụ âm cuối) thì cả hai kiểu đều đặt dấu trên nguyên âm
// thứ hai: hoàn, hoán, huỳnh — hàm này cũng đưa "hòan" sai kiểu về "hoàn".
// Chỉ di chuyển dấu thanh (huyền/sắc/hỏi/ngã/nặng); dấu chất nguyên âm
// (mũ, trăng, móc: â ă ê ô ơ ư) giữ nguyên, nên quyết định đã chốt trong
// sualogic.md vẫn giữ: nucleotit ≠ nuclêôtit. Xem sualogic.md mục 10.

const TONE_MARKS = new Set(["\u0300", "\u0301", "\u0309", "\u0303", "\u0323"])
const QUALITY_MARKS = new Set(["\u0302", "\u0306", "\u031B"])
const VOWEL_BASES = new Set(["a", "e", "i", "o", "u", "y"])

interface CharCluster {
  base: string
  marks: string[]
}

function moveToneInWord(word: string): string {
  const clusters: CharCluster[] = []
  for (const ch of word.normalize("NFD")) {
    if (/\p{M}/u.test(ch) && clusters.length > 0) {
      clusters[clusters.length - 1].marks.push(ch)
    } else {
      clusters.push({ base: ch, marks: [] })
    }
  }
  const toneIdx = clusters.findIndex((c) => c.marks.some((m) => TONE_MARKS.has(m)))
  if (toneIdx < 0) return word
  const tone = clusters[toneIdx].marks.find((m) => TONE_MARKS.has(m))
  if (!tone) return word

  const isPlain = (c: CharCluster, v: string) =>
    c.base === v && c.marks.every((m) => !QUALITY_MARKS.has(m))

  for (let i = 0; i + 1 < clusters.length; i++) {
    const a = clusters[i]
    const b = clusters[i + 1]
    const pair =
      (isPlain(a, "o") && isPlain(b, "a")) ||
      (isPlain(a, "o") && isPlain(b, "e")) ||
      (isPlain(a, "u") && isPlain(b, "y"))
    if (!pair) continue
    // "quý", "quỵ": u thuộc âm đầu "qu", nguyên âm chính là y — không di chuyển.
    if (a.base === "u" && i > 0 && clusters[i - 1].base === "q") continue
    if (toneIdx !== i && toneIdx !== i + 1) continue
    const rest = clusters.slice(i + 2)
    let target = -1
    if (rest.length === 0) target = i // âm tiết mở: kiểu mới đặt trên nguyên âm đầu
    else if (rest.every((c) => !VOWEL_BASES.has(c.base))) target = i + 1 // âm tiết đóng: nguyên âm thứ hai
    else continue // nguyên âm đôi + glide (oai, oay...): hai kiểu như nhau
    if (target === toneIdx) return word
    clusters[toneIdx].marks = clusters[toneIdx].marks.filter((m) => m !== tone)
    clusters[target].marks.push(tone)
    return clusters.map((c) => c.base + c.marks.join("")).join("").normalize("NFC")
  }
  return word
}

/** Đưa mọi từ trong chuỗi về một kiểu đặt dấu thanh duy nhất (kiểu mới). */
export function canonicalizeTonePlacement(text: string): string {
  return text
    .split(/([^\p{L}]+)/u)
    .map((part) => (/^\p{L}+$/u.test(part) ? moveToneInWord(part) : part))
    .join("")
}

// Chỉ số dưới/trên -> chữ số thường: CO₂ -> CO2, H₂O -> H2O.
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉"
const SUPERSCRIPT_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹"

export function normalizeAnswer(input: string): string {
  let s = (input ?? "")
    .normalize("NFC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[   ]/g, " ")
    .replace(/[‘’ʹ′´`]/g, "'")
    // Mũi tên: "->" gõ ASCII và "→" phải là một. Làm trước bước đổi dash.
    .replace(/->/g, "→")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/[“”«»]/g, '"')
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => String(SUBSCRIPT_DIGITS.indexOf(ch)))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => String(SUPERSCRIPT_DIGITS.indexOf(ch)))
    .replace(/₋/g, "-")
    .replace(/⁻/g, "-")
    .replace(/₊/g, "+")
    .replace(/⁺/g, "+")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
  // Vị trí dấu thanh: hoá = hóa, thuỷ = thủy (không bỏ dấu — xem ghi chú trên).
  s = canonicalizeTonePlacement(s)
  // Khoảng trắng quanh dấu nối/mũi tên và trước % không mang nghĩa: A - T = A-T, 50 % = 50%.
  s = s
    .replace(/\s*([-→])\s*/g, "$1")
    .replace(/\s+%/g, "%")
    .replace(/\s+/g, " ")
    .trim()
  return s
    .replace(/^"(.+)"$/, "$1")
    .replace(/^[\s.,;:!?…]+|[\s.,;:!?…]+$/g, "")
    .replace(/^\((.+)\)$/, "$1") // (DNA) = DNA — chỉ bóc khi ngoặc bọc toàn bộ đáp án
    .replace(/^[\s.,;:!?…]+|[\s.,;:!?…]+$/g, "")
    .trim()
}

function parseAnswers(answers: unknown): Record<number, string> {
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

function accepts(term: UnderlinedTerm, value: string): boolean {
  const norm = normalizeAnswer(value)
  if (norm === normalizeAnswer(term.text)) return true
  if ((term.extraAccepted ?? []).some((e) => normalizeAnswer(e) === norm)) return true
  if ((term.synonyms ?? []).some((s) => normalizeAnswer(s) === norm)) return true
  return false
}

function maxMatching(
  terms: UnderlinedTerm[],
  values: string[],
): { matchOfValue: number[]; matchOfTerm: number[] } {
  const n = terms.length
  const matchOfTerm = new Array<number>(n).fill(-1)
  const tryAssign = (i: number, seen: boolean[]): boolean => {
    for (let j = 0; j < n; j++) {
      if (seen[j] || !accepts(terms[j], values[i])) continue
      seen[j] = true
      if (matchOfTerm[j] === -1 || tryAssign(matchOfTerm[j], seen)) {
        matchOfTerm[j] = i
        return true
      }
    }
    return false
  }
  for (let i = 0; i < values.length; i++) {
    tryAssign(i, new Array(n).fill(false))
  }
  const matchOfValue = new Array<number>(values.length).fill(-1)
  matchOfTerm.forEach((vi, tj) => {
    if (vi !== -1) matchOfValue[vi] = tj
  })
  return { matchOfValue, matchOfTerm }
}

export function gradeSlots(
  terms: UnderlinedTerm[],
  answers: unknown,
): { results: { slotIndex: number; isCorrect: boolean; correctAnswer: string }[]; allCorrect: boolean } {
  const answerMap = parseAnswers(answers)
  const groups = new Map<string, UnderlinedTerm[]>()
  for (const t of terms) {
    const slotIndex = Number(t.slotIndex)
    const key = t.swapGroupId ? `g:${t.swapGroupId}` : `s:${slotIndex}`
    const arr = groups.get(key) ?? []
    arr.push({ ...t, slotIndex })
    groups.set(key, arr)
  }

  const resultMap = new Map<number, { slotIndex: number; isCorrect: boolean; correctAnswer: string }>()

  const readAnswer = (slotIndex: number): string =>
    answerMap[slotIndex] ?? answerMap[Number(slotIndex)] ?? ""

  for (const [, groupTerms] of groups) {
    if (groupTerms.length > 1) {
      const values = groupTerms.map((t) => readAnswer(t.slotIndex))
      const { matchOfValue, matchOfTerm } = maxMatching(groupTerms, values)
      const unmatchedTexts = groupTerms
        .filter((_, j) => matchOfTerm[j] === -1)
        .map((t) => t.text)
      let unmatchedIdx = 0
      for (let i = 0; i < groupTerms.length; i++) {
        const t = groupTerms[i]
        const termIdx = matchOfValue[i]
        const isCorrect = termIdx !== -1
        const correctAnswer = isCorrect
          ? groupTerms[termIdx].text
          : (unmatchedTexts[unmatchedIdx++] ?? t.text)
        resultMap.set(t.slotIndex, { slotIndex: t.slotIndex, isCorrect, correctAnswer })
      }
    } else {
      for (const t of groupTerms) {
        const ok = accepts(t, readAnswer(t.slotIndex))
        resultMap.set(t.slotIndex, { slotIndex: t.slotIndex, isCorrect: ok, correctAnswer: t.text })
      }
    }
  }

  const results = [...resultMap.values()].sort((a, b) => a.slotIndex - b.slotIndex)
  const allCorrect = results.length > 0 && results.every((r) => r.isCorrect)
  return { results, allCorrect }
}

export function gradeMC(chosenId: string | null, correctOptionId: string): boolean {
  if (chosenId == null || chosenId === "") return false
  return chosenId === correctOptionId
}

export function gradeTF(
  student: Record<string, "D" | "S" | null | undefined>,
  options: { id: string; isCorrect: boolean }[],
): { perOption: { optionId: string; isCorrect: boolean; answered: boolean }[]; correctCount: number } {
  const perOption = options.map((opt) => {
    const raw = student[opt.id]
    const answered = raw === "D" || raw === "S"
    if (!answered) {
      return { optionId: opt.id, isCorrect: false, answered: false }
    }
    const expected = opt.isCorrect ? "D" : "S"
    return { optionId: opt.id, isCorrect: raw === expected, answered: true }
  })
  const correctCount = perOption.filter((p) => p.isCorrect).length
  return { perOption, correctCount }
}

function parsePureNumber(raw: string): number | null {
  const s = (raw ?? "").trim()
  if (!/^\d+(?:[.,]\d+)?$/.test(s)) return null
  const n = Number(s.replace(",", "."))
  if (!Number.isFinite(n)) return null
  return n
}

export function gradeSA(input: string, accepted: string[]): boolean {
  const norm = normalizeAnswer(input)
  for (const a of accepted ?? []) {
    if (norm === normalizeAnswer(a)) return true
    const ni = parsePureNumber(input)
    const na = parsePureNumber(a)
    if (ni !== null && na !== null && ni === na) return true
  }
  return false
}

export function scoreLinear(
  correctSlots: number,
  totalSlots: number,
): { score: number; percentage: number } {
  if (!(totalSlots > 0) || !Number.isFinite(totalSlots)) {
    return { score: 0, percentage: 0 }
  }
  const correct = Number.isFinite(correctSlots) ? Math.max(0, correctSlots) : 0
  const score = Math.min(10, Number(((correct * 10) / totalSlots).toFixed(2)))
  const percentage = Math.min(100, Math.max(0, Math.floor((correct * 100) / totalSlots)))
  return { score, percentage }
}

export function gradeLive(input: {
  type: "MC" | "TF" | "SA"
  answer: string
  options: { id: string; isCorrect: boolean; content: string }[]
}): boolean {
  if (input.type === "MC") {
    const correctId = input.options.find((o) => o.isCorrect)?.id ?? ""
    return gradeMC(input.answer || null, correctId)
  }
  if (input.type === "SA") {
    const accepted = input.options.filter((o) => o.isCorrect).map((o) => o.content)
    return gradeSA(input.answer, accepted)
  }
  const picked = new Set(input.answer ? input.answer.split(",").filter(Boolean) : [])
  const student: Record<string, "D" | "S"> = {}
  for (const o of input.options) {
    student[o.id] = picked.has(o.id) ? "D" : "S"
  }
  const graded = gradeTF(student, input.options)
  return input.options.length > 0 && graded.perOption.every((p) => p.isCorrect)
}

export function resolveFirstTry(
  current: string | null | undefined,
  result: "correct" | "incorrect",
): "correct" | "incorrect" {
  if (current === "correct" || current === "incorrect") return current
  return result
}

export function inferFirstTryFromHistory(
  status: string | null | undefined,
  attempts: number,
): "correct" | "incorrect" | null {
  if (status === "incorrect" || (status === "correct" && attempts > 1)) return "incorrect"
  if (status === "correct" && attempts === 1) return "correct"
  return null
}

export function isOverconfident(args: {
  selfAssessment: string | null | undefined
  fillFirstTry: string | null | undefined
  fillAttempts?: number | null
}): boolean {
  if (args.selfAssessment !== "known") return false
  if (args.fillFirstTry === "incorrect") return true
  if ((args.fillFirstTry == null || args.fillFirstTry === "") && (args.fillAttempts ?? 0) > 1) {
    return true
  }
  return false
}
