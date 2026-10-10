import type { UnderlinedTerm } from "@/types"

export function normalizeAnswer(input: string): string {
  return (input ?? "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[\u2018\u2019\u02B9\u2032\u00B4\u0060]/g, "'")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u201C\u201D\u00AB\u00BB]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^"(.+)"$/, "$1")
    .replace(/^[\s.,;:!?…]+|[\s.,;:!?…]+$/g, "")
    .trim()
    .toLowerCase()
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
