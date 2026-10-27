import { isOverconfident } from "@/lib/scoring"

/**
 * §38 (full) — Lõi tính toán thống kê bài học, THUẦN TÚY (không chạm DB).
 *
 * Mọi số liệu giáo viên nhìn thấy trên 4 màn đều đi qua file này, nên mọi
 * quy tắc đều viết thành hàm thuần để kiểm thử được bằng script
 * scripts/check-class-stats-*.mjs mà không cần dựng app.
 *
 * Quy tắc tầng (tier) cho một (học sinh, điểm kiến thức), theo lượt hiện tại:
 *   A — có câu kiểm tra trong lượt kiểm tra gần nhất đã nộp:
 *       tỉ lệ ô đúng trên lượt đó, ngưỡng theo lớp (mặc định 80/50).
 *   B — chưa có câu kiểm tra trong lượt đó nhưng đã làm Tab 2/3:
 *       làm đúng (dù lần đầu hay lần sau) -> Tạm ổn;
 *       làm sai, chưa xem đáp án -> Chưa tốt;
 *       đã xem đáp án mà chưa làm đúng -> Chưa kiểm chứng.
 *   C — chỉ tự nhận xét, chưa làm Tab 2/3 -> Chưa kiểm chứng.
 *   Không có hoạt động nào -> Chưa làm.
 * Điểm không gắn câu kiểm tra nào luôn mang nhãn "Chưa có câu kiểm tra"
 * (ô ma trận gạch chéo), bất kể nguồn tầng nào.
 *
 * Lưu ý về "chuyển sang kéo thả": code luồng học hiện tại CHỈ đưa điểm
 * Chưa biết vào Tab 3 (getTab3Questions lọc selfAssessment = "unknown");
 * điểm Biết mà điền sai lần đầu KHÔNG tự chuyển sang kéo thả. Vì vậy
 * pool Điền khuyết = điểm Biết có ô trống, pool Kéo thả = điểm Chưa biết
 * có ô trống — đúng luồng học thật, không tự bịa thêm pool chuyển đổi.
 */

export type StatsLevel = "mastered" | "ok" | "weak" | "unverified" | "not_started"
export type TierSource = "Q" | "F" | "D" | "S" | null
export type StatsThresholds = { mastery: number; ok: number }

export const DEFAULT_THRESHOLDS: StatsThresholds = { mastery: 80, ok: 50 }

export const LEVEL_LABEL: Record<StatsLevel, string> = {
  mastered: "Thành thạo",
  ok: "Tạm ổn",
  weak: "Chưa tốt",
  unverified: "Chưa kiểm chứng",
  not_started: "Chưa làm",
}

/** Thứ tự mức để so sánh tiến bộ (chỉ dùng cho tầng có kiểm chứng). */
export function quizLevelRank(level: StatsLevel): number {
  if (level === "mastered") return 2
  if (level === "ok") return 1
  return 0 // weak
}

export function levelFromRate(ratePercent: number, t: StatsThresholds): StatsLevel {
  if (ratePercent >= t.mastery) return "mastered"
  if (ratePercent >= t.ok) return "ok"
  return "weak"
}

export interface TabState {
  status: "correct" | "incorrect" | null
  firstTry: "correct" | "incorrect" | null
  attempts: number
  revealed: boolean
}

export interface TierInput {
  quizCorrect: number | null
  quizTotal: number | null
  self: "known" | "unknown" | null
  fill: TabState | null
  drag: TabState | null
  hasQuizQuestion: boolean
}

export interface TierResult {
  level: StatsLevel
  source: TierSource
  quizCorrect: number | null
  quizTotal: number | null
  noQuizQuestion: boolean
}

export function tierForKp(input: TierInput, t: StatsThresholds): TierResult {
  const noQuizQuestion = !input.hasQuizQuestion
  if (input.quizTotal != null && input.quizTotal > 0) {
    const correct = input.quizCorrect ?? 0
    return {
      level: levelFromRate((correct / input.quizTotal) * 100, t),
      source: "Q",
      quizCorrect: correct,
      quizTotal: input.quizTotal,
      noQuizQuestion,
    }
  }
  const tab =
    input.fill?.status != null
      ? { state: input.fill, source: "F" as const }
      : input.drag?.status != null
        ? { state: input.drag, source: "D" as const }
        : null
  if (tab) {
    if (tab.state.status === "correct") {
      return { level: "ok", source: tab.source, quizCorrect: null, quizTotal: null, noQuizQuestion }
    }
    if (tab.state.revealed) {
      return { level: "unverified", source: tab.source, quizCorrect: null, quizTotal: null, noQuizQuestion }
    }
    return { level: "weak", source: tab.source, quizCorrect: null, quizTotal: null, noQuizQuestion }
  }
  if (input.self != null) {
    return { level: "unverified", source: "S", quizCorrect: null, quizTotal: null, noQuizQuestion }
  }
  return { level: "not_started", source: null, quizCorrect: null, quizTotal: null, noQuizQuestion }
}

// ================= Dữ liệu thô (server action ráp từ DB) =================

export interface RawKp {
  id: string
  content: string
  order: number
  slotCount: number // số ô trống (terms.length); 0 = điểm chỉ đọc
  questionIds: string[]
  quizSlotCount: number // số ô kiểm tra gắn vào điểm (MC/SA = 1, TF = số ý)
}

export interface RawAttempt {
  id: string
  score10: number | null
  completedAt: string | null
  slotsByKp: Record<string, { correct: number; total: number }>
  questionIds: string[] // đề của lượt này (để đếm mẫu số đúng cả bài sample-mode)
  wrongAnswers: {
    questionId: string
    questionNo: number
    questionType: "MC" | "TF" | "SA"
    optionId: string | null
    studentAnswer: string | null
    optionContent: string | null
  }[]
  totalSlots: number
  durationMs: number | null
  quickAnswers: number // số câu trả lời cách câu trước < 5 giây
}

export interface RawStudentLesson {
  studentId: string
  name: string
  selfByKp: Record<string, "known" | "unknown">
  progressByKp: Record<
    string,
    {
      self: "known" | "unknown" | null
      fill: TabState
      drag: TabState
    }
  >
  submittedAttempts: RawAttempt[] // đã nộp, xếp theo thời gian tăng dần
  openAttempt: { attemptNo: number; answeredSlots: number; totalSlots: number } | null
  lastActivityAt: string | null
  dueAt: string | null
  activityDays: string[] // YYYY-MM-DD, để tính streak
}

export function attemptTierForKp(
  attempt: RawAttempt,
  kpId: string,
  t: StatsThresholds,
): StatsLevel | null {
  const slots = attempt.slotsByKp[kpId]
  if (!slots || slots.total <= 0) return null
  return levelFromRate((slots.correct / slots.total) * 100, t)
}

// ================= Màn 1 — Tiến trình =================

export interface StudentRow {
  studentId: string
  name: string
  deadlineBadge: "Đúng hạn" | "Trễ" | "Quá hạn" | "Đang làm" | null
  selfKnown: number
  selfUnknown: number
  selfAssessed: number
  selfTotal: number
  fillGreen: number
  fillRed: number
  fillPool: number
  fillEventual: number
  dragGreen: number
  dragRed: number
  dragPool: number
  dragEventual: number
  quizAnswered: number
  quizTotal: number
  quizState: "done" | "doing" | "none"
  retakesText: string
  retakeCount: number
  needsHelp: boolean
  helpReasons: string[]
  tiersByKp: Record<string, TierResult>
  weakCount: number
  firstScore10: number | null
  latestScore10: number | null
  lastActivityAt: string | null
  // Phục vụ Màn 4 (so sánh lượt đầu — gần nhất theo mức từng điểm).
  levelUp: number
  levelSame: number
  levelDown: number
  persistentWeakKpNos: number[]
  hasQuizQuestion: boolean
}

export function buildStudentRow(
  s: RawStudentLesson,
  kps: RawKp[],
  thresholds: StatsThresholds,
  lessonTotalSlots: number,
  now: Date,
): StudentRow {
  const tiersByKp: Record<string, TierResult> = {}
  let selfKnown = 0
  let selfUnknown = 0
  let fillGreen = 0
  let fillRed = 0
  let fillPool = 0
  let fillEventual = 0
  let dragGreen = 0
  let dragRed = 0
  let dragPool = 0
  let dragEventual = 0
  let weakCount = 0

  const latestAttempt = s.submittedAttempts[s.submittedAttempts.length - 1] ?? null
  const firstAttempt = s.submittedAttempts[0] ?? null

  for (const kp of kps) {
    const self = s.selfByKp[kp.id] ?? s.progressByKp[kp.id]?.self ?? null
    if (self === "known") selfKnown += 1
    else if (self === "unknown") selfUnknown += 1
    const prog = s.progressByKp[kp.id]
    const quizSlots = latestAttempt?.slotsByKp[kp.id] ?? null
    const tier = tierForKp(
      {
        quizCorrect: quizSlots?.correct ?? null,
        quizTotal: quizSlots?.total ?? null,
        self,
        fill: prog?.fill ?? null,
        drag: prog?.drag ?? null,
        hasQuizQuestion: kp.questionIds.length > 0,
      },
      thresholds,
    )
    tiersByKp[kp.id] = tier
    if (tier.level === "weak") weakCount += 1

    // Pool Tab 2/3: chỉ điểm có ô trống mới vào pool (điểm chỉ đọc không có việc).
    if (kp.slotCount > 0 && prog) {
      if (prog.self === "known") {
        fillPool += 1
        if (prog.fill.firstTry === "correct") fillGreen += 1
        else if (prog.fill.firstTry === "incorrect") fillRed += 1
        if (prog.fill.status === "correct") fillEventual += 1
      } else if (prog.self === "unknown") {
        dragPool += 1
        if (prog.drag.firstTry === "correct") dragGreen += 1
        else if (prog.drag.firstTry === "incorrect") dragRed += 1
        if (prog.drag.status === "correct") dragEventual += 1
      }
    }
  }

  // Huy hiệu hạn nộp.
  let deadlineBadge: StudentRow["deadlineBadge"] = null
  if (s.openAttempt) {
    deadlineBadge = "Đang làm"
  } else if (latestAttempt?.completedAt) {
    deadlineBadge = s.dueAt
      ? new Date(latestAttempt.completedAt).getTime() <= new Date(s.dueAt).getTime()
        ? "Đúng hạn"
        : "Trễ"
      : null
  } else if (s.dueAt && now.getTime() > new Date(s.dueAt).getTime()) {
    deadlineBadge = "Quá hạn"
  }

  const submittedCount = s.submittedAttempts.length
  const retakeCount = Math.max(0, submittedCount - 1)
  const retakesText = s.openAttempt
    ? `Lượt ${submittedCount + 1} (đang làm)`
    : submittedCount > 0
      ? String(retakeCount)
      : "—"

  let quizAnswered = 0
  let quizTotal = lessonTotalSlots
  let quizState: StudentRow["quizState"] = "none"
  if (latestAttempt) {
    quizAnswered = latestAttempt.totalSlots
    quizTotal = latestAttempt.totalSlots
    quizState = "done"
  } else if (s.openAttempt) {
    quizAnswered = s.openAttempt.answeredSlots
    quizTotal = s.openAttempt.totalSlots
    quizState = "doing"
  }

  const firstScore10 = firstAttempt?.score10 ?? null
  const latestScore10 = latestAttempt?.score10 ?? null

  const helpReasons: string[] = []
  if (kps.length > 0 && weakCount * 3 >= kps.length) {
    helpReasons.push(`Có ${weakCount}/${kps.length} điểm ở mức Chưa tốt (≥ 1/3 bài)`)
  }
  if (submittedCount === 0 && s.dueAt && now.getTime() > new Date(s.dueAt).getTime()) {
    helpReasons.push("Quá hạn mà chưa nộp kiểm tra")
  }
  if (retakeCount >= 2 && firstScore10 != null && latestScore10 != null && latestScore10 <= firstScore10) {
    helpReasons.push(`Làm lại ${retakeCount} lần mà điểm không tăng`)
  }

  // Màn 4: so sánh mức từng điểm giữa lượt đầu và lượt gần nhất đã nộp.
  let levelUp = 0
  let levelSame = 0
  let levelDown = 0
  const persistentWeakKpNos: number[] = []
  if (firstAttempt && latestAttempt && firstAttempt.id !== latestAttempt.id) {
    kps.forEach((kp, idx) => {
      const first = attemptTierForKp(firstAttempt, kp.id, thresholds)
      const latest = attemptTierForKp(latestAttempt, kp.id, thresholds)
      if (first == null || latest == null) return
      const d = quizLevelRank(latest) - quizLevelRank(first)
      if (d > 0) levelUp += 1
      else if (d < 0) levelDown += 1
      else levelSame += 1
      if (latest === "weak") {
        const weakInEarlier = s.submittedAttempts
          .slice(0, -1)
          .some((a) => attemptTierForKp(a, kp.id, thresholds) === "weak")
        if (weakInEarlier) persistentWeakKpNos.push(idx + 1)
      }
    })
  }
  // Chỉ một lượt đã nộp: chưa xác định được điểm yếu kéo dài (cần ≥ 2 lượt).

  return {
    studentId: s.studentId,
    name: s.name,
    deadlineBadge,
    selfKnown,
    selfUnknown,
    selfAssessed: selfKnown + selfUnknown,
    selfTotal: kps.length,
    fillGreen,
    fillRed,
    fillPool,
    fillEventual,
    dragGreen,
    dragRed,
    dragPool,
    dragEventual,
    quizAnswered,
    quizTotal,
    quizState,
    retakesText,
    retakeCount,
    needsHelp: helpReasons.length > 0,
    helpReasons,
    tiersByKp,
    weakCount,
    firstScore10,
    latestScore10,
    lastActivityAt: s.lastActivityAt,
    levelUp,
    levelSame,
    levelDown,
    persistentWeakKpNos,
    hasQuizQuestion: kps.some((kp) => kp.questionIds.length > 0),
  }
}

// ================= Màn 2 — Điểm kiến thức =================

export interface KpStat {
  kpId: string
  content: string
  kpNo: number
  counts: Record<StatsLevel, number>
  weakRate: number
  needsReview: boolean
  sourceTag: string
  noQuizQuestion: boolean
  quizSlots: number
  fewQuestions: boolean
  firstMastered: number
  latestMastered: number
  mostMissed: {
    questionNo: number
    missRate: number
    wrongCount: number
    answeredCount: number
    commonWrong: string | null
  } | null
  overconfidentCount: number
  knownAssessed: number
  revealedCount: number
}

export function buildKpStats(
  students: RawStudentLesson[],
  rows: StudentRow[],
  kps: RawKp[],
  thresholds: StatsThresholds,
): KpStat[] {
  const classSize = students.length
  return kps.map((kp, idx) => {
    const counts: Record<StatsLevel, number> = {
      mastered: 0,
      ok: 0,
      weak: 0,
      unverified: 0,
      not_started: 0,
    }
    for (const row of rows) {
      const tier = row.tiersByKp[kp.id]
      if (tier) counts[tier.level] += 1
      else counts.not_started += 1
    }
    const weakRate = classSize === 0 ? 0 : counts.weak / classSize

    // Thành thạo lượt đầu -> gần nhất (theo lượt kiểm tra đã nộp).
    let firstMastered = 0
    let latestMastered = 0
    for (const s of students) {
      const first = s.submittedAttempts[0]
      const latest = s.submittedAttempts[s.submittedAttempts.length - 1]
      if (first && attemptTierForKp(first, kp.id, thresholds) === "mastered") firstMastered += 1
      if (latest && attemptTierForKp(latest, kp.id, thresholds) === "mastered") latestMastered += 1
    }

    // Câu sai nhiều nhất + đáp án sai phổ biến nhất (lượt gần nhất đã nộp).
    // Mẫu số mỗi câu = số lượt gần nhất có câu đó trong đề (đúng cả bài
    // lesson-mode lẫn bài sample-mode); tử số = số lượt trả lời sai câu đó.
    const rosterCount = new Map<string, number>()
    for (const s of students) {
      const latest = s.submittedAttempts[s.submittedAttempts.length - 1]
      if (!latest) continue
      for (const qid of new Set(latest.questionIds)) {
        rosterCount.set(qid, (rosterCount.get(qid) ?? 0) + 1)
      }
    }
    const perQuestion = new Map<
      string,
      {
        questionNo: number
        wrong: number
        wrongTexts: Map<string, number>
      }
    >()
    for (const s of students) {
      const latest = s.submittedAttempts[s.submittedAttempts.length - 1]
      if (!latest) continue
      const questionIds = new Set(kp.questionIds)
      for (const w of latest.wrongAnswers) {
        if (!questionIds.has(w.questionId)) continue
        const entry = perQuestion.get(w.questionId) ?? {
          questionNo: w.questionNo,
          wrong: 0,
          wrongTexts: new Map<string, number>(),
        }
        entry.wrong += 1
        const text = w.optionContent ?? w.studentAnswer ?? "—"
        entry.wrongTexts.set(text, (entry.wrongTexts.get(text) ?? 0) + 1)
        perQuestion.set(w.questionId, entry)
      }
    }
    let mostMissed: KpStat["mostMissed"] = null
    for (const [questionId, entry] of perQuestion) {
      const answered = rosterCount.get(questionId) ?? 0
      const missRate = answered === 0 ? 0 : entry.wrong / answered
      if (!mostMissed || missRate > mostMissed.missRate) {
        let commonWrong: string | null = null
        let best = 0
        for (const [text, count] of entry.wrongTexts) {
          if (count > best) {
            best = count
            commonWrong = text
          }
        }
        mostMissed = {
          questionNo: entry.questionNo,
          missRate,
          wrongCount: entry.wrong,
          answeredCount: answered,
          commonWrong,
        }
      }
    }

    let overconfidentCount = 0
    let knownAssessed = 0
    let revealedCount = 0
    for (const s of students) {
      const prog = s.progressByKp[kp.id]
      if (!prog) continue
      if (prog.self === "known") knownAssessed += 1
      // Chủ quan sai = đúng helper isOverconfident (tự nhận Biết nhưng sai
      // lần đầu; kể cả dữ liệu cũ chưa có firstTry mà thử > 1 lần).
      if (
        isOverconfident({
          selfAssessment: prog.self,
          fillFirstTry: prog.fill.firstTry,
          fillAttempts: prog.fill.attempts,
        })
      ) {
        overconfidentCount += 1
      }
      if (prog.fill.revealed || prog.drag.revealed) revealedCount += 1
    }

    const hasQuiz = kp.questionIds.length > 0
    const sourceTag = hasQuiz ? `Q · ${kp.quizSlotCount} ô` : kp.slotCount > 0 ? "F/D" : "S"
    return {
      kpId: kp.id,
      content: kp.content,
      kpNo: idx + 1,
      counts,
      weakRate,
      needsReview: weakRate >= 0.4,
      sourceTag,
      noQuizQuestion: !hasQuiz,
      quizSlots: kp.quizSlotCount,
      fewQuestions: hasQuiz && kp.quizSlotCount < 2,
      firstMastered,
      latestMastered,
      mostMissed,
      overconfidentCount,
      knownAssessed,
      revealedCount,
    }
  })
}

// ================= Màn 3 — Ma trận =================

export interface MatrixCell {
  level: StatsLevel
  source: TierSource
  quizCorrect: number | null
  quizTotal: number | null
  hatched: boolean
}

export function buildMatrix(
  rows: StudentRow[],
  kps: RawKp[],
): { orderedKps: RawKp[]; cells: Record<string, Record<string, MatrixCell>> } {
  // Sắp xếp theo độ khó: tỉ lệ Chưa tốt giảm dần, rồi Tạm ổn tăng dần, rồi thứ tự gốc.
  const weakRate = new Map<string, number>()
  const okRate = new Map<string, number>()
  for (const kp of kps) {
    let weak = 0
    let ok = 0
    for (const row of rows) {
      const tier = row.tiersByKp[kp.id]
      if (tier?.level === "weak") weak += 1
      if (tier?.level === "ok") ok += 1
    }
    weakRate.set(kp.id, rows.length === 0 ? 0 : weak / rows.length)
    okRate.set(kp.id, rows.length === 0 ? 0 : ok / rows.length)
  }
  const orderedKps = [...kps].sort((a, b) => {
    const dw = (weakRate.get(b.id) ?? 0) - (weakRate.get(a.id) ?? 0)
    if (dw !== 0) return dw
    const dok = (okRate.get(a.id) ?? 0) - (okRate.get(b.id) ?? 0)
    if (dok !== 0) return dok
    return a.order - b.order
  })
  const cells: Record<string, Record<string, MatrixCell>> = {}
  for (const row of rows) {
    const byKp: Record<string, MatrixCell> = {}
    for (const kp of kps) {
      const tier = row.tiersByKp[kp.id]
      byKp[kp.id] = {
        level: tier?.level ?? "not_started",
        source: tier?.source ?? null,
        quizCorrect: tier?.quizCorrect ?? null,
        quizTotal: tier?.quizTotal ?? null,
        hatched: kp.questionIds.length === 0,
      }
    }
    cells[row.studentId] = byKp
  }
  return { orderedKps, cells }
}

// ================= Màn 4 — Tiến bộ =================

export type Classification =
  | "improving"
  | "stable_good"
  | "stuck"
  | "abandoned"
  | "not_started"
  | "no_quiz"

export const CLASSIFICATION_LABEL: Record<Classification, string> = {
  improving: "Tiến bộ",
  stable_good: "Ổn định tốt",
  stuck: "Ôn lại nhưng chưa tiến bộ",
  abandoned: "Bỏ dở",
  not_started: "Chưa bắt đầu",
  no_quiz: "—",
}

export interface ProgressTableRow {
  studentId: string
  name: string
  classification: Classification
  scores10: number[]
  levelUp: number
  levelSame: number
  levelDown: number
  lastActivityAt: string | null
  note: string
  hasScores: boolean
}

export function classifyStudent(row: StudentRow, raw: RawStudentLesson): Classification {
  const submitted = raw.submittedAttempts.length
  const selfAny = row.selfAssessed > 0
  if (submitted === 0 && !raw.openAttempt && !selfAny) return "not_started"
  if (submitted === 0) return "abandoned" // đang làm dở (lượt mở hoặc mới tự đánh giá)
  if (!row.hasQuizQuestion) return "no_quiz"
  if (row.levelUp > row.levelDown) return "improving"
  if (row.levelUp === 0 && row.levelDown === 0 && row.weakCount === 0 && row.latestScore10 != null) {
    return "stable_good"
  }
  return "stuck"
}

export function buildProgressNote(row: StudentRow, raw: RawStudentLesson): string {
  if (raw.submittedAttempts.length === 0 && !raw.openAttempt && row.selfAssessed === 0) {
    return "Chưa bắt đầu học bài này."
  }
  const parts: string[] = []
  if (row.levelUp > 0) parts.push(`Tiến bộ ở ${row.levelUp} điểm.`)
  if (row.persistentWeakKpNos.length > 0) {
    parts.push(`Còn yếu kéo dài ở điểm ${row.persistentWeakKpNos.join(", ")}.`)
  }
  if (raw.submittedAttempts.length === 0) {
    parts.push(raw.openAttempt ? "Đang làm kiểm tra, chưa nộp." : "Chưa nộp kiểm tra.")
  } else if (row.retakeCount >= 2 && row.firstScore10 != null && row.latestScore10 != null && row.latestScore10 <= row.firstScore10) {
    parts.push(`Làm lại ${row.retakeCount} lần nhưng điểm chưa tăng.`)
  }
  if (row.helpReasons.includes("Quá hạn mà chưa nộp kiểm tra")) parts.push("Đã quá hạn nộp.")
  if (parts.length === 0) return "Đang học ổn định."
  return parts.join(" ")
}

export function buildProgressTable(
  rows: StudentRow[],
  raws: RawStudentLesson[],
): ProgressTableRow[] {
  const rawById = new Map(raws.map((r) => [r.studentId, r]))
  return rows.map((row) => {
    const raw = rawById.get(row.studentId)
    const classification = raw ? classifyStudent(row, raw) : "not_started"
    const scores10 = (raw?.submittedAttempts ?? [])
      .map((a) => a.score10)
      .filter((v): v is number => v != null)
    const hasScores = scores10.length > 0
    const noComparison = classification === "not_started" || classification === "abandoned"
    return {
      studentId: row.studentId,
      name: row.name,
      classification,
      scores10,
      levelUp: noComparison ? 0 : row.levelUp,
      levelSame: noComparison ? 0 : row.levelSame,
      levelDown: noComparison ? 0 : row.levelDown,
      lastActivityAt: row.lastActivityAt,
      note: raw ? buildProgressNote(row, raw) : "Chưa bắt đầu học bài này.",
      hasScores,
    }
  })
}

export interface LessonChartPoint {
  lessonId: string
  title: string
  firstAvg10: number | null
  latestAvg10: number | null
}

export function buildLessonChart(
  lessons: { lessonId: string; title: string; scores: { first10: number | null; latest10: number | null }[] }[],
): LessonChartPoint[] {
  return lessons.map((lesson) => {
    const firsts = lesson.scores.map((s) => s.first10).filter((v): v is number => v != null)
    const latests = lesson.scores.map((s) => s.latest10).filter((v): v is number => v != null)
    const avg = (arr: number[]) => (arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length)
    return {
      lessonId: lesson.lessonId,
      title: lesson.title,
      firstAvg10: avg(firsts),
      latestAvg10: avg(latests),
    }
  })
}

/** Streak: số ngày liên tiếp có hoạt động, tính tới hôm nay hoặc hôm qua. */
export function computeStreak(activityDays: string[], today: Date): number {
  const set = new Set(activityDays)
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  let cursor = new Date(today)
  // Hôm nay chưa có hoạt động thì tính từ hôm qua (học sinh vẫn đang trong chuỗi).
  if (!set.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (set.has(fmt(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}
