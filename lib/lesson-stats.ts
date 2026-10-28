import { isOverconfident } from "@/lib/scoring"

/**
 * §38 (full) — Lõi tính toán thống kê bài học, THUẦN TÚY (không chạm DB).
 *
 * Mọi số liệu giáo viên nhìn thấy trên 4 màn đều đi qua file này, nên mọi
 * quy tắc đều viết thành hàm thuần để kiểm thử được bằng script
 * scripts/check-class-stats-*.mjs mà không cần dựng app.
 *
 * Quy tắc tầng (tier) cho một (học sinh, điểm kiến thức), theo lượt hiện tại.
 * Thứ tự ưu tiên bằng chứng (khung tầng đã chốt 28/10, ĐIỀN THẮNG KÉO):
 *   (1) Có câu kiểm tra trong lượt kiểm tra gần nhất đã nộp -> theo trắc
 *       nghiệm: tỉ lệ ô đúng của ĐIỂM ĐÓ (không phải điểm toàn bài),
 *       ngưỡng theo lớp (mặc định 75/50); Thành thạo cần thêm ≥ 2 ô đúng
 *       (chặn trên tính theo ô — chỉ cắn điểm 1 ô); điểm 1 ô có bằng chứng
 *       kết hợp: Biết + điền đúng + trắc nghiệm đúng -> Thành thạo (vượt
 *       chặn), Biết + điền đúng + trắc nghiệm sai -> Khá (đệm); đệm chỉ
 *       cho 1 ô, trắc nghiệm nhiều ô dưới 50% vẫn Chưa tốt dù điền đúng.
 *       Ngoại lệ kéo lộ (nới lỏng 28/10): kết quả kéo sau lộ chỉ hạ mức
 *       trắc nghiệm — 100% (đủ ≥ 2 ô) -> Thành thạo, 50–99% -> Khá,
 *       < 50% -> Chưa tốt; điểm 1 ô đúng 100% sau lộ vẫn Khá (chặn).
 *   (2) Chưa có trắc nghiệm nhưng điểm đã chuyển (submission Biết ∧ tiến
 *       trình Chưa biết) -> điền thắng kéo: kéo đúng lần 1 (không lộ) thì
 *       điền kéo bằng nhau -> Khá (D) + cờ "đã chuyển"; các trường hợp
 *       còn lại (chưa kéo, kéo đang chờ, kéo đúng lần 2, kéo sai, kéo
 *       sau lộ) -> Chưa tốt (F, riêng kéo sau lộ nguồn D) + cờ "đã
 *       chuyển" khi kéo đã chốt.
 *   (3) Chưa có trắc nghiệm, điểm không chuyển -> theo bước chốt: điền
 *       đúng -> Khá (kèm cờ "sau gợi ý" nếu điền đúng sau gợi ý), điền
 *       sai đã chốt -> Chưa tốt; điền trống thì kéo quyết (đúng chưa lộ
 *       -> Khá, còn lại -> Chưa tốt).
 *   (4) Mới sai 1 lần, đang chờ làm lại (điền hoặc kéo) -> Chưa kiểm chứng
 *       (ô lần đầu vẫn đỏ ở Màn 1 qua fillRed/dragRed); ngoại lệ: điền cũ
 *       đã lộ mà vẫn sai -> Chưa tốt.
 *   (5) Chỉ tự nhận xét, chưa làm Tab 2/3 -> Chưa kiểm chứng (S).
 *   (6) Không có hoạt động nào -> Chưa làm.
 * Điểm không gắn câu kiểm tra nào luôn mang nhãn "Chưa có câu kiểm tra"
 * (ô ma trận gạch chéo), bất kể nguồn tầng nào.
 *
 * Pool Tab 2/3 và cột "chưa chốt": mẫu số lấy theo Tab 1 — pool Điền =
 * điểm Biết (theo submission Tab 1, fallback tiến trình khi chưa nộp) có
 * ô trống, pool Kéo = điểm Chưa biết (theo tiến trình hiện tại, gồm cả
 * điểm đã chuyển từ điền sang) có ô trống. Điểm chuyển suy ra từ
 * submission Biết ∧ tiến trình Chưa biết, không cần cờ riêng. Pool Kéo
 * chỉ "chốt" khi hết việc Tab 2 (mọi điểm Biết có ô trống đều điền đúng
 * hoặc đã chuyển; học sinh toàn Chưa biết thì chốt ngay); trước đó cột
 * Kéo chỉ hiện số tạm thời, không hiện "Không có".
 *
 * Lưu ý triển khai theo từng bước: code thống kê này đã xử lý trạng thái
 * chuyển (submission Biết ∧ tiến trình Chưa biết) nhưng luồng học Tab 2
 * mới (sai lần 2 khóa + chuyển sang kéo) triển khai sau; dữ liệu hiện tại
 * chưa có điểm chuyển, các nhánh chuyển chỉ chạy khi trạng thái đó xuất hiện.
 */

export type StatsLevel = "mastered" | "ok" | "weak" | "unverified" | "not_started"
export type TierSource = "Q" | "F" | "D" | "S" | null
export type StatsThresholds = { mastery: number; ok: number }

export const DEFAULT_THRESHOLDS: StatsThresholds = { mastery: 75, ok: 50 }

export const LEVEL_LABEL: Record<StatsLevel, string> = {
  mastered: "Thành thạo",
  ok: "Khá",
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

/**
 * Tầng theo trắc nghiệm: theo tỉ lệ, nhưng Thành thạo cần thêm ≥ 2 ô đúng
 * (chặn trên tính theo ô — chỉ cắn điểm 1 ô duy nhất, vì tỉ lệ ≥ 75% với
 * ≥ 2 ô luôn có ≥ 2 ô đúng).
 */
export function quizLevel(correct: number, total: number, t: StatsThresholds): StatsLevel {
  const band = levelFromRate((correct / total) * 100, t)
  if (band === "mastered" && correct < 2) return "ok"
  return band
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
  /** Điểm chuyển từ điền sang kéo: submission Tab 1 = Biết nhưng tiến
   *  trình hiện tại = Chưa biết (luồng Tab 2 mới đánh giá lại). */
  transferred?: boolean
}

export interface TierResult {
  level: StatsLevel
  source: TierSource
  quizCorrect: number | null
  quizTotal: number | null
  noQuizQuestion: boolean
  /** Cờ hiển thị: "sau gợi ý" (điền đúng sau gợi ý), "đã chuyển" (điểm
   *  chuyển từ điền sang và đã có kết quả kéo chốt — kèm cả khi kéo
   *  không gỡ được điền). Chỉ gắn ở tầng Tab 2/3 và trường hợp 1 ô có
   *  bằng chứng kết hợp/đệm; tầng trắc nghiệm nhiều ô không cờ. */
  flags: string[]
}

export function tierForKp(input: TierInput, t: StatsThresholds): TierResult {
  const noQuizQuestion = !input.hasQuizQuestion
  const fill = input.fill
  const drag = input.drag
  const transferred = input.transferred ?? false
  const base = {
    quizCorrect: null as number | null,
    quizTotal: null as number | null,
    noQuizQuestion,
  }
  // Kéo lộ = kết quả kéo sau khi đã lộ đáp án (đúng lần 3+ hoặc sai sau lộ).
  const tainted = drag?.status != null && drag.revealed
  // Kéo đúng lần 1 = đúng ngay lần thử đầu, chưa lộ (firstTry đúng; dữ liệu
  // cũ thiếu firstTry thì attempts == 1 coi như lần 1).
  const dragFirstTry =
    drag?.status === "correct" &&
    !drag.revealed &&
    (drag.firstTry === "correct" || (drag.firstTry == null && drag.attempts === 1))

  // (1) Trắc nghiệm đã nộp.
  if (input.quizTotal != null && input.quizTotal > 0) {
    const correct = input.quizCorrect ?? 0
    let level: StatsLevel
    let flags: string[] = []
    if (tainted) {
      // Lộ nới lỏng (chốt 28/10): trắc nghiệm gỡ lộ dần — 100% (đủ ≥ 2 ô)
      // -> Thành thạo, 50–99% -> Khá, < 50% -> Chưa tốt. Điểm 1 ô đúng
      // 100% sau lộ vẫn Khá vì chặn ≥ 2 ô (không có bằng chứng kết hợp
      // cho điểm chuyển/chép).
      if (correct === input.quizTotal && correct >= 2) level = "mastered"
      else if ((correct / input.quizTotal) * 100 >= t.ok) level = "ok"
      else level = "weak"
    } else {
      level = quizLevel(correct, input.quizTotal, t)
      // Điểm 1 ô có bằng chứng kết hợp / đệm (chỉ khi Biết + điền đúng).
      if (input.quizTotal === 1 && input.self === "known" && fill?.status === "correct") {
        level = correct === 1 ? "mastered" : "ok"
        flags = fill.firstTry === "incorrect" ? ["sau gợi ý"] : []
      }
    }
    return { level, source: "Q", quizCorrect: correct, quizTotal: input.quizTotal, noQuizQuestion, flags }
  }

  // (2) Tầng B, điểm đã chuyển: ĐIỀN THẮNG KÉO (chốt 28/10). Điền đã sai
  // chốt (F) đứng trước kéo, trừ kéo đúng lần 1 (không lộ) thì điền kéo
  // bằng nhau -> Khá. Kéo sau lộ nguồn D (lộ), còn lại nguồn F.
  if (transferred) {
    const dragTerminal = drag?.status === "correct" || (drag?.status === "incorrect" && drag.attempts !== 1)
    if (dragTerminal && dragFirstTry) {
      return { level: "ok", source: "D", ...base, flags: ["đã chuyển"] }
    }
    if (dragTerminal) {
      return { level: "weak", source: tainted ? "D" : "F", ...base, flags: ["đã chuyển"] }
    }
    // Chưa kéo, hoặc kéo đang chờ: điền chốt đứng -> Chưa tốt.
    return { level: "weak", source: "F", ...base, flags: [] }
  }

  // (3) Tầng B, điểm không chuyển: theo bước chốt — điền trước, kéo sau
  // khi điền trống. Điền đúng -> Khá, điền sai đã chốt -> Chưa tốt.
  const fillTerminal = fill?.status === "correct" || (fill?.status === "incorrect" && fill.attempts !== 1)
  if (fillTerminal && fill) {
    return {
      level: fill.status === "correct" ? "ok" : "weak",
      source: "F",
      ...base,
      flags: fill.status === "correct" && fill.firstTry === "incorrect" ? ["sau gợi ý"] : [],
    }
  }
  // Điền dữ liệu cũ đã lộ mà vẫn sai -> Chưa tốt (không rơi về chờ).
  if (fill?.status === "incorrect" && fill.revealed) {
    return { level: "weak", source: "F", ...base, flags: [] }
  }
  // Kéo đã chốt (điểm gốc Chưa biết, điền trống): đúng chưa lộ -> Khá,
  // đúng sau lộ hoặc sai -> Chưa tốt.
  const dragTerminal = drag?.status === "correct" || (drag?.status === "incorrect" && drag.attempts !== 1)
  if (dragTerminal && drag) {
    return {
      level: drag.status === "correct" && !drag.revealed ? "ok" : "weak",
      source: "D",
      ...base,
      flags: [],
    }
  }
  // (4) Đang chờ (mới sai 1 lần, chưa chốt) -> Chưa kiểm chứng.
  if (drag?.status === "incorrect" && drag.attempts === 1) {
    return { level: "unverified", source: "D", ...base, flags: [] }
  }
  if (fill?.status === "incorrect" && fill.attempts === 1) {
    return { level: "unverified", source: "F", ...base, flags: [] }
  }
  // (5) Chỉ tự nhận -> Chưa kiểm chứng (S); (6) chưa bắt đầu -> Chưa làm.
  if (input.self != null) {
    return { level: "unverified", source: "S", ...base, flags: [] }
  }
  return { level: "not_started", source: null, ...base, flags: [] }
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
  /** Số ô đúng của lượt (tính từ isCorrect của từng đáp án, kể cả câu chung của bài). */
  correctSlots: number
  durationMs: number | null
  quickAnswers: number // số câu trả lời cách câu trước < 5 giây
  /** Toàn bộ đáp án của lượt gần nhất (lượt cũ để rỗng — tránh phình DTO).
   *  Dùng cho thống kê từng câu (tỉ lệ phương án, độ khó/phân biệt, thời gian). */
  answers: {
    questionId: string
    optionId: string | null
    studentAnswer: string | null
    isCorrect: boolean
    answeredAt: string | null
  }[]
}

export interface RawStudentLesson {
  studentId: string
  name: string
  selfByKp: Record<string, "known" | "unknown">
  hasSubmission: boolean // đã nộp Tab 1 (khóa) hay chưa; không có submission thì pool Kéo chưa chốt
  progressByKp: Record<
    string,
    {
      self: "known" | "unknown" | null
      fill: TabState
      drag: TabState
    }
  >
  submittedAttempts: RawAttempt[] // đã nộp, xếp theo thời gian tăng dần
  openAttempt: { attemptNo: number; answeredSlots: number; answeredCorrect: number; totalSlots: number } | null
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
  // Tầng theo lượt kiểm tra chỉ có bằng chứng trắc nghiệm nên chỉ áp dụng
  // tỉ lệ + chặn ≥ 2 ô (không có đệm/bằng chứng kết hợp vì thiếu Tab 2/3
  // của lượt đó); Màn 4 so sánh các lượt bằng tầng này.
  return quizLevel(slots.correct, slots.total, t)
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
  /** Pool Kéo đã chốt chưa: hết việc Tab 2 thì true, còn chờ chuyển thì
   *  false (cột Kéo chỉ hiện số tạm thời). Học sinh toàn Chưa biết thì
   *  chốt ngay (chân không). */
  dragFinalized: boolean
  quizAnswered: number
  /** Số ô đúng của lượt gần nhất (đã nộp) hoặc của lượt đang làm (trên các câu đã trả lời). */
  quizCorrect: number
  quizTotal: number
  quizState: "done" | "doing" | "none"
  retakesText: string
  retakeCount: number
  needsHelp: boolean
  helpReasons: string[]
  tiersByKp: Record<string, TierResult>
  weakCount: number
  /** Số điểm tự nhận Biết nhưng sai lần đầu (đúng định nghĩa isOverconfident ở Màn 2). */
  overconfidentKpCount: number
  /** Cờ hiển thị ở Màn 1: làm rất nhanh / xem đáp án / chủ quan sai. */
  flags: string[]
  /** Điểm chuyển từ điền sang kéo (submission Biết, tiến trình Chưa biết). */
  inSessionTransferred: number
  /** Trong số điểm chuyển, số điểm cuối cùng lên Khá/Thành thạo. */
  inSessionLearned: number
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
  let overconfidentKpCount = 0
  let inSessionTransferred = 0
  let inSessionLearned = 0

  const latestAttempt = s.submittedAttempts[s.submittedAttempts.length - 1] ?? null
  const firstAttempt = s.submittedAttempts[0] ?? null

  for (const kp of kps) {
    const submissionSelf = s.selfByKp[kp.id] ?? null
    const self = submissionSelf ?? s.progressByKp[kp.id]?.self ?? null
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
        transferred: submissionSelf === "known" && prog?.self === "unknown",
      },
      thresholds,
    )
    tiersByKp[kp.id] = tier
    if (tier.level === "weak") weakCount += 1
    // Điểm chuyển trong buổi + chủ quan sai (cùng định nghĩa với Màn 2).
    if (submissionSelf === "known" && prog?.self === "unknown") {
      inSessionTransferred += 1
      if (tier.level === "ok" || tier.level === "mastered") inSessionLearned += 1
    }
    if (
      prog &&
      isOverconfident({
        selfAssessment: self,
        fillFirstTry: prog.fill.firstTry,
        fillAttempts: prog.fill.attempts,
      })
    ) {
      overconfidentKpCount += 1
    }

    // Pool Tab 2/3: chỉ điểm có ô trống mới vào pool (điểm chỉ đọc không có việc).
    // Hai cột CHỒNG nhau theo thiết kế: cột Điền tính lịch sử (mẫu số theo
    // Tab 1 — submission trước, fallback tiến trình khi chưa nộp), cột Kéo
    // tính việc hiện tại (tiến trình Chưa biết, gồm cả điểm chuyển từ điền
    // sang). Nhờ vậy điểm bị đánh giá lại (submission Biết, tiến trình
    // Chưa biết) vẫn giữ vạch đỏ ở cột Điền, đồng thời vào pool Kéo.
    const poolSelfKnown = (submissionSelf ?? prog?.self ?? null) === "known"
    if (kp.slotCount > 0 && prog) {
      if (poolSelfKnown) {
        fillPool += 1
        if (prog.fill.firstTry === "correct") fillGreen += 1
        else if (prog.fill.firstTry === "incorrect") fillRed += 1
        if (prog.fill.status === "correct") fillEventual += 1
      }
      if (prog.self === "unknown") {
        dragPool += 1
        if (prog.drag.firstTry === "correct") dragGreen += 1
        else if (prog.drag.firstTry === "incorrect") dragRed += 1
        if (prog.drag.status === "correct") dragEventual += 1
      }
    }
  }

  // Pool Kéo chốt khi hết việc Tab 2: mọi điểm Biết có ô trống (theo
  // submission) đều điền đúng hoặc đã chuyển sang Chưa biết. Chưa nộp
  // Tab 1 thì chưa chốt (Tab 2 còn chưa mở).
  const dragFinalized =
    s.hasSubmission &&
    kps.every((kp) => {
      if (kp.slotCount <= 0) return true
      if (s.selfByKp[kp.id] !== "known") return true
      const p = s.progressByKp[kp.id]
      return p?.fill.status === "correct" || p?.self === "unknown"
    })

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
  let quizCorrect = 0
  let quizTotal = lessonTotalSlots
  let quizState: StudentRow["quizState"] = "none"
  if (latestAttempt) {
    quizAnswered = latestAttempt.totalSlots
    quizCorrect = latestAttempt.correctSlots
    quizTotal = latestAttempt.totalSlots
    quizState = "done"
  } else if (s.openAttempt) {
    quizAnswered = s.openAttempt.answeredSlots
    quizCorrect = s.openAttempt.answeredCorrect
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

  // Cờ Màn 1: ngưỡng "làm rất nhanh" giống cờ chất lượng ở Màn 4 (< 10 giây/ô).
  let revealedKpCount = 0
  for (const kp of kps) {
    const p = s.progressByKp[kp.id]
    if (p && (p.fill.revealed || p.drag.revealed)) revealedKpCount += 1
  }
  const flags: string[] = []
  if (latestAttempt?.durationMs != null && latestAttempt.totalSlots > 0) {
    const avgSec = latestAttempt.durationMs / 1000 / latestAttempt.totalSlots
    if (avgSec < 10) flags.push("Làm rất nhanh")
  }
  if (revealedKpCount > 0) flags.push(`Xem đáp án ${revealedKpCount} điểm`)
  if (overconfidentKpCount > 0) flags.push(`Chủ quan sai ${overconfidentKpCount} điểm`)

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
    dragFinalized,
    quizAnswered,
    quizCorrect,
    quizTotal,
    quizState,
    retakesText,
    retakeCount,
    needsHelp: helpReasons.length > 0,
    helpReasons,
    tiersByKp,
    weakCount,
    overconfidentKpCount,
    flags,
    inSessionTransferred,
    inSessionLearned,
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
  /** Đúng lần đầu ở Tab 2/3 của điểm (total = số em đã thử lần đầu). */
  fillFirstTry: { correct: number; total: number }
  dragFirstTry: { correct: number; total: number }
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
      // Một học sinh chỉ tính 1 lần sai cho mỗi câu, dù câu TF sai nhiều ý:
      // nếu không, wrong đếm theo ý (28) trên số em làm bài (18) cho tỉ lệ
      // 156% — hiển thị vỡ. wrongTexts vẫn đếm theo từng ý để tìm đáp án
      // sai phổ biến (mức ý) cho đúng.
      const seenWrong = new Set<string>()
      for (const w of latest.wrongAnswers) {
        if (!questionIds.has(w.questionId)) continue
        const entry = perQuestion.get(w.questionId) ?? {
          questionNo: w.questionNo,
          wrong: 0,
          wrongTexts: new Map<string, number>(),
        }
        if (!seenWrong.has(w.questionId)) {
          seenWrong.add(w.questionId)
          entry.wrong += 1
        }
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
    let fillFirstCorrect = 0
    let fillFirstTotal = 0
    let dragFirstCorrect = 0
    let dragFirstTotal = 0
    for (const s of students) {
      const prog = s.progressByKp[kp.id]
      if (!prog) continue
      // Tự nhận lấy theo submission Tab 1 trước (fallback tiến trình khi
      // chưa nộp) — nhờ vậy điểm bị đánh giá lại vẫn tính vào số Biết và
      // cờ quá tự tin, không biến mất khỏi thống kê.
      const subSelf = s.selfByKp[kp.id] ?? prog.self ?? null
      if (subSelf === "known") knownAssessed += 1
      // Chủ quan sai = đúng helper isOverconfident (tự nhận Biết nhưng sai
      // lần đầu; kể cả dữ liệu cũ chưa có firstTry mà thử > 1 lần).
      if (
        isOverconfident({
          selfAssessment: subSelf,
          fillFirstTry: prog.fill.firstTry,
          fillAttempts: prog.fill.attempts,
        })
      ) {
        overconfidentCount += 1
      }
      if (prog.fill.revealed || prog.drag.revealed) revealedCount += 1
      if (prog.fill.firstTry === "correct") {
        fillFirstCorrect += 1
        fillFirstTotal += 1
      } else if (prog.fill.firstTry === "incorrect") {
        fillFirstTotal += 1
      }
      if (prog.drag.firstTry === "correct") {
        dragFirstCorrect += 1
        dragFirstTotal += 1
      } else if (prog.drag.firstTry === "incorrect") {
        dragFirstTotal += 1
      }
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
      fillFirstTry: { correct: fillFirstCorrect, total: fillFirstTotal },
      dragFirstTry: { correct: dragFirstCorrect, total: dragFirstTotal },
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
  flags: string[]
}

export function buildMatrix(
  rows: StudentRow[],
  kps: RawKp[],
): { orderedKps: RawKp[]; cells: Record<string, Record<string, MatrixCell>> } {
  // Sắp xếp theo độ khó: tỉ lệ Chưa tốt giảm dần, rồi Khá tăng dần, rồi thứ tự gốc.
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
        flags: tier?.flags ?? [],
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

// ================= Thống kê từng câu hỏi (batch 2) =================

export interface QuestionMeta {
  id: string
  no: number
  type: "MC" | "TF" | "SA"
  kpId: string | null
  options: { id: string; content: string }[]
}

export interface QuestionOptionRate {
  optionId: string
  label: string
  /** MC: số em chọn phương án; TF: số em trả lời ý này. */
  count: number
  /** MC: tỉ lệ chọn trong số em làm câu; TF: tỉ lệ đúng của ý. */
  rate: number
}

export interface QuestionStat {
  questionId: string
  questionNo: number
  type: "MC" | "TF" | "SA"
  kpId: string | null
  /** Số em có đáp án ở lượt gần nhất (TF: có ít nhất 1 ý). */
  answered: number
  /** Tổng số ô (slot) đã trả lời — MC/SA bằng answered, TF bằng số ý đã trả lời. */
  totalSlots: number
  /** Số ô đúng theo slot (TF tính theo ý, MC/SA tính theo câu). */
  correct: number
  missRate: number
  options: QuestionOptionRate[]
  /** Trung vị thời gian làm câu (giây), từ khoảng cách giữa các lần trả lời; null khi < 3 khoảng. */
  medianSec: number | null
  /** Độ khó theo tỉ lệ đúng: ≥ 0.8 Dễ, 0.3–0.8 Vừa, < 0.3 Khó; null khi answered < 5. */
  difficulty: "easy" | "medium" | "hard" | null
  /** Phân biệt: tỉ lệ đúng nhóm điểm cao trừ nhóm điểm thấp; null khi thiếu dữ liệu (answered < 10 hoặc < 10 em có điểm). */
  discrimination: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

export function buildQuestionStats(
  rawStudents: RawStudentLesson[],
  questions: QuestionMeta[],
): QuestionStat[] {
  // Lượt gần nhất đã nộp của mỗi em + điểm của lượt đó (để chia nhóm phân biệt).
  const latestByStudent = rawStudents.map((s) => {
    const latest = s.submittedAttempts[s.submittedAttempts.length - 1] ?? null
    return { score10: latest?.score10 ?? null, attempt: latest }
  })
  const scored = latestByStudent
    .map((x, i) => ({ score: x.score10, idx: i }))
    .filter((x): x is { score: number; idx: number } => x.score != null)
    .sort((a, b) => b.score - a.score)
  const third = Math.max(1, Math.ceil(scored.length / 3))
  const topIdx = new Set(scored.slice(0, third).map((x) => x.idx))
  const bottomIdx = new Set(scored.slice(-third).map((x) => x.idx))

  return questions.map((q) => {
    // Đáp án lượt gần nhất của từng em cho câu này (TF: nhiều dòng theo ý).
    const perStudent: { rows: NonNullable<RawAttempt["answers"]>; idx: number }[] = []
    latestByStudent.forEach((x, idx) => {
      const rows = (x.attempt?.answers ?? []).filter((a) => a.questionId === q.id)
      if (rows.length > 0) perStudent.push({ rows, idx })
    })
    const answered = perStudent.length
    // Tỉ lệ đúng theo ô (slot): TF tính theo ý, MC/SA tính theo câu.
    let correctSlots = 0
    let totalSlots = 0
    for (const s of perStudent) {
      for (const r of s.rows) {
        totalSlots += 1
        if (r.isCorrect) correctSlots += 1
      }
    }
    const missRate = totalSlots === 0 ? 0 : 1 - correctSlots / totalSlots
    // Tỉ lệ từng phương án (MC: đáp án chọn; TF: từng ý đúng/sai).
    const options: QuestionOptionRate[] = []
    if (q.type !== "SA") {
      for (const opt of q.options) {
        let optAnswered = 0
        let optCorrect = 0
        for (const s of perStudent) {
          for (const r of s.rows.filter((r) => r.optionId === opt.id)) {
            optAnswered += 1
            if (r.isCorrect) optCorrect += 1
          }
        }
        options.push({
          optionId: opt.id,
          label: opt.content,
          count: optAnswered,
          rate: optAnswered === 0 ? 0 : q.type === "TF" ? optCorrect / optAnswered : optAnswered / answered,
        })
      }
    }
    // Thời gian: khoảng cách giữa các lần trả lời liên tiếp của cùng em, gán cho câu trả lời sau.
    // Gap = 0 là hàng loạt lúc nộp bài cuối, không tính (cùng quy ước quickAnswers).
    const gaps: number[] = []
    for (const s of perStudent) {
      const all = [...(latestByStudent[s.idx]?.attempt?.answers ?? [])]
        .map((a) => ({ t: a.answeredAt ? new Date(a.answeredAt).getTime() : null, qid: a.questionId }))
        .filter((x): x is { t: number; qid: string } => x.t != null)
        .sort((a, b) => a.t - b.t)
      for (let i = 1; i < all.length; i++) {
        const gap = all[i]!.t - all[i - 1]!.t
        if (gap > 0 && all[i]!.qid === q.id) gaps.push(gap / 1000)
      }
    }
    const med = gaps.length >= 3 ? median(gaps) : null
    // Độ khó + phân biệt.
    const correctRate = totalSlots === 0 ? 0 : correctSlots / totalSlots
    const difficulty =
      answered < 5 ? null : correctRate >= 0.8 ? "easy" : correctRate < 0.3 ? "hard" : "medium"
    let discrimination: number | null = null
    if (answered >= 10 && scored.length >= 10 && topIdx.size >= 3 && bottomIdx.size >= 3) {
      const meanScore = (idxSet: Set<number>) => {
        let sum = 0
        let n = 0
        for (const s of perStudent) {
          if (!idxSet.has(s.idx)) continue
          sum += s.rows.filter((r) => r.isCorrect).length / s.rows.length
          n += 1
        }
        return n === 0 ? null : sum / n
      }
      const top = meanScore(topIdx)
      const bottom = meanScore(bottomIdx)
      if (top != null && bottom != null) discrimination = Math.round((top - bottom) * 100) / 100
    }
    return {
      questionId: q.id,
      questionNo: q.no,
      type: q.type,
      kpId: q.kpId,
      answered,
      totalSlots,
      correct: correctSlots,
      missRate,
      options,
      medianSec: med == null ? null : Math.round(med * 10) / 10,
      difficulty,
      discrimination,
    }
  })
}
