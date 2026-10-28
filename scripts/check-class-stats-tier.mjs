// §38/§39/§40: kiểm thử lõi tính toán thống kê (thuần túy, không cần DB).
// Chạy: node --import ~/workspace/.epg/register-loader.mjs scripts/check-class-stats-tier.mjs
import {
  tierForKp,
  attemptTierForKp,
  buildStudentRow,
  buildKpStats,
  buildMatrix,
  buildProgressTable,
  computeStreak,
  DEFAULT_THRESHOLDS,
} from "@/lib/lesson-stats"

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
    console.log(`PASS ${name}`)
  } else {
    fail++
    console.log(`FAIL ${name}${extra ? ` :: ${extra}` : ""}`)
  }
}
const T = DEFAULT_THRESHOLDS // 75/50
const tab = (status, firstTry = null, attempts = 1, revealed = false) => ({
  status,
  firstTry,
  attempts,
  revealed,
})
const emptyTab = { status: null, firstTry: null, attempts: 0, revealed: false }

// ---- Tầng A: quiz quyết định, ngưỡng theo lớp ----
check("A: 8/10 ô = 80% -> Thành thạo", tierForKp({ quizCorrect: 8, quizTotal: 10, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T).level === "mastered")
check("A: 7/10 ô = 70% -> Khá", tierForKp({ quizCorrect: 7, quizTotal: 10, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T).level === "ok")
check("A: ngưỡng Thành thạo mới 75%: 3/4 ô = 75% -> Thành thạo", tierForKp({ quizCorrect: 3, quizTotal: 4, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T).level === "mastered")
check("A: chặn ≥ 2 ô: 1/1 ô đúng mà không có bằng chứng kết hợp -> Khá", tierForKp({ quizCorrect: 1, quizTotal: 1, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T).level === "ok")
check("A: kết hợp: Biết + điền đúng + trắc nghiệm 1/1 -> Thành thạo (vượt chặn)", tierForKp({ quizCorrect: 1, quizTotal: 1, self: "known", fill: tab("correct", "correct"), drag: emptyTab, hasQuizQuestion: true }, T).level === "mastered")
check("A: kết hợp sau gợi ý: Biết + điền đúng sau gợi ý + trắc nghiệm 1/1 -> Thành thạo + cờ", (() => {
  const r = tierForKp({ quizCorrect: 1, quizTotal: 1, self: "known", fill: tab("correct", "incorrect", 2), drag: emptyTab, hasQuizQuestion: true }, T)
  return r.level === "mastered" && r.flags.includes("sau gợi ý")
})())
check("A: đệm: Biết + điền đúng + trắc nghiệm 0/1 -> Khá", tierForKp({ quizCorrect: 0, quizTotal: 1, self: "known", fill: tab("correct", "correct"), drag: emptyTab, hasQuizQuestion: true }, T).level === "ok")
check("A: đệm chỉ cho 1 ô: Biết + điền đúng + trắc nghiệm 1/4 (25%) -> Chưa tốt", tierForKp({ quizCorrect: 1, quizTotal: 4, self: "known", fill: tab("correct", "correct"), drag: emptyTab, hasQuizQuestion: true }, T).level === "weak")
check("A: chưa biết + kéo đúng + trắc nghiệm 1/1 -> Khá (bị chặn)", tierForKp({ quizCorrect: 1, quizTotal: 1, self: "unknown", fill: emptyTab, drag: tab("correct", "correct"), hasQuizQuestion: true }, T).level === "ok")
check("A: chưa biết + kéo đúng + trắc nghiệm 0/1 -> Chưa tốt", tierForKp({ quizCorrect: 0, quizTotal: 1, self: "unknown", fill: emptyTab, drag: tab("correct", "correct"), hasQuizQuestion: true }, T).level === "weak")
check("A: chuyển + kéo đúng + trắc nghiệm 1/1 -> Khá (không vượt chặn vì điền đã sai)", tierForKp({ quizCorrect: 1, quizTotal: 1, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "correct"), hasQuizQuestion: true, transferred: true }, T).level === "ok")
check("A: chuyển + kéo đúng + trắc nghiệm 3/4 -> Thành thạo (trắc nghiệm thắng điền/kéo)", tierForKp({ quizCorrect: 3, quizTotal: 4, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "correct"), hasQuizQuestion: true, transferred: true }, T).level === "mastered")
check("A: chuyển + kéo đúng lần 2 + trắc nghiệm 3/4 -> Thành thạo (kéo lần 2 đúng + quiz 75%)", tierForKp({ quizCorrect: 3, quizTotal: 4, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "incorrect", 2), hasQuizQuestion: true, transferred: true }, T).level === "mastered")
check("A: chuyển + kéo đúng lần 2 + trắc nghiệm 1/1 -> Khá (chặn 1 ô)", tierForKp({ quizCorrect: 1, quizTotal: 1, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "incorrect", 2), hasQuizQuestion: true, transferred: true }, T).level === "ok")
check("A: lộ nới lỏng: kéo đúng sau lộ + trắc nghiệm 1/1 -> Khá (100% nhưng 1 ô nên bị chặn)", tierForKp({ quizCorrect: 1, quizTotal: 1, self: "unknown", fill: emptyTab, drag: tab("correct", "incorrect", 3, true), hasQuizQuestion: true }, T).level === "ok")
check("A: lộ nới lỏng: kéo sai sau lộ + trắc nghiệm 4/4 -> Thành thạo (100% gỡ lộ)", tierForKp({ quizCorrect: 4, quizTotal: 4, self: "unknown", fill: emptyTab, drag: tab("incorrect", "incorrect", 3, true), hasQuizQuestion: true }, T).level === "mastered")
check("A: lộ nới lỏng: kéo đúng sau lộ + trắc nghiệm 3/4 (75%) -> Khá (chưa gỡ hết lộ)", tierForKp({ quizCorrect: 3, quizTotal: 4, self: "unknown", fill: emptyTab, drag: tab("correct", "incorrect", 3, true), hasQuizQuestion: true }, T).level === "ok")
check("A: lộ nới lỏng: kéo đúng sau lộ + trắc nghiệm 1/2 (50%) -> Khá", tierForKp({ quizCorrect: 1, quizTotal: 2, self: "unknown", fill: emptyTab, drag: tab("correct", "incorrect", 3, true), hasQuizQuestion: true }, T).level === "ok")
check("A: lộ nới lỏng: kéo đúng sau lộ + trắc nghiệm 1/4 (25%) -> Chưa tốt", tierForKp({ quizCorrect: 1, quizTotal: 4, self: "unknown", fill: emptyTab, drag: tab("correct", "incorrect", 3, true), hasQuizQuestion: true }, T).level === "weak")
check("A: 4/10 ô = 40% -> Chưa tốt", tierForKp({ quizCorrect: 4, quizTotal: 10, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T).level === "weak")
check("A: ngưỡng lớp 90/60 đổi kết quả", tierForKp({ quizCorrect: 8, quizTotal: 10, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, { mastery: 90, ok: 60 }).level === "ok")
check("A: nguồn Q + đúng/tổng ô", (() => {
  const r = tierForKp({ quizCorrect: 3, quizTotal: 4, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T)
  return r.source === "Q" && r.quizCorrect === 3 && r.quizTotal === 4
})())
check("A: câu bỏ trống vẫn tính sai (ô 0 điểm)", (() => {
  // Lượt nộp cuối chấm câu chưa nộp là sai (submitQuiz) -> ô sai nằm trong mẫu số.
  const r = tierForKp({ quizCorrect: 0, quizTotal: 2, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: true }, T)
  return r.level === "weak"
})())

// ---- Tầng B: Tab 2/3 khi chưa có câu kiểm tra ----
check("B: điền đúng -> Khá (không thành Thành thạo khi chưa quiz)", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("correct", "correct"), drag: emptyTab, hasQuizQuestion: false }, T).level === "ok")
check("B: điền đúng sau nhiều lần -> Khá", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("correct", "incorrect", 3), drag: emptyTab, hasQuizQuestion: false }, T).level === "ok")
check("B: điền đúng sau gợi ý -> Khá + cờ sau gợi ý", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("correct", "incorrect", 2), drag: emptyTab, hasQuizQuestion: false }, T)
  return r.level === "ok" && r.flags.includes("sau gợi ý")
})())
check("B: điền sai đã chốt (2 lần), chưa xem đáp án -> Chưa tốt", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab, hasQuizQuestion: false }, T).level === "weak")
check("B: điền sai lần 1 đang chờ làm lại -> Chưa kiểm chứng (không còn Chưa tốt)", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 1), drag: emptyTab, hasQuizQuestion: false }, T).level === "unverified")
check("B: điền cũ đã lộ mà vẫn sai -> Chưa tốt", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 3, true), drag: emptyTab, hasQuizQuestion: false }, T).level === "weak")
check("B: kéo đúng -> Khá, nguồn D", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "unknown", fill: emptyTab, drag: tab("correct", "correct"), hasQuizQuestion: false }, T)
  return r.level === "ok" && r.source === "D"
})())
check("B: kéo sai lần 1 đang chờ làm lại -> Chưa kiểm chứng (đối xứng điền chờ)", tierForKp({ quizCorrect: null, quizTotal: null, self: "unknown", fill: emptyTab, drag: tab("incorrect", "incorrect", 1), hasQuizQuestion: false }, T).level === "unverified")
check("B: kéo sai đã chốt -> Chưa tốt", tierForKp({ quizCorrect: null, quizTotal: null, self: "unknown", fill: emptyTab, drag: tab("incorrect", "incorrect", 2), hasQuizQuestion: false }, T).level === "weak")
check("B: chuyển + kéo đúng lần 1 -> Khá + cờ đã chuyển (điền kéo bằng nhau)", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "correct"), hasQuizQuestion: false, transferred: true }, T)
  return r.level === "ok" && r.source === "D" && r.flags.includes("đã chuyển")
})())
check("B: chuyển + kéo đúng lần 2 -> Chưa tốt nguồn F + cờ đã chuyển (kéo thua điền)", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "incorrect", 2), hasQuizQuestion: false, transferred: true }, T)
  return r.level === "weak" && r.source === "F" && r.flags.includes("đã chuyển")
})())
check("B: chuyển + kéo đúng sau lộ -> Chưa tốt nguồn D + cờ đã chuyển (lộ, chưa quiz)", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("correct", "incorrect", 3, true), hasQuizQuestion: false, transferred: true }, T)
  return r.level === "weak" && r.source === "D" && r.flags.includes("đã chuyển")
})())
check("B: chuyển + kéo sai đã chốt -> Chưa tốt nguồn F + cờ đã chuyển", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("incorrect", "incorrect", 2), hasQuizQuestion: false, transferred: true }, T)
  return r.level === "weak" && r.source === "F" && r.flags.includes("đã chuyển")
})())
check("B: chuyển + kéo chờ -> Chưa tốt (điền chốt đứng, kéo chờ không xóa)", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: tab("incorrect", "incorrect", 1), hasQuizQuestion: false, transferred: true }, T).level === "weak")
check("B: chuyển + chưa kéo -> Chưa tốt", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab, hasQuizQuestion: false, transferred: true }, T).level === "weak")
check("B: nhãn Chưa có câu kiểm tra khi điểm không gắn câu", tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: tab("correct", "correct"), drag: emptyTab, hasQuizQuestion: false }, T).noQuizQuestion === true)

// ---- Tầng C: chỉ tự nhận xét / chưa làm ----
check("C: chỉ tự nhận Biết -> Chưa kiểm chứng, nguồn S", (() => {
  const r = tierForKp({ quizCorrect: null, quizTotal: null, self: "known", fill: emptyTab, drag: emptyTab, hasQuizQuestion: false }, T)
  return r.level === "unverified" && r.source === "S"
})())
check("C: không hoạt động nào -> Chưa làm", tierForKp({ quizCorrect: null, quizTotal: null, self: null, fill: emptyTab, drag: emptyTab, hasQuizQuestion: false }, T).level === "not_started")

// ---- Màn 1: thanh 2 màu theo điểm, tổng 5 mức = sĩ số ----
const kps = [
  { id: "kp1", content: "Điểm 1", order: 0, slotCount: 2, questionIds: ["q1"], quizSlotCount: 1 },
  { id: "kp2", content: "Điểm 2", order: 1, slotCount: 1, questionIds: [], quizSlotCount: 0 },
]
const now = new Date("2026-10-27T12:00:00+07:00")
function rawStudent(id, name, overrides) {
  return {
    studentId: id,
    name,
    selfByKp: {},
    hasSubmission: false,
    progressByKp: {},
    submittedAttempts: [],
    openAttempt: null,
    lastActivityAt: null,
    dueAt: null,
    activityDays: [],
    ...overrides,
  }
}
const s1 = rawStudent("hs1", "An", {
  selfByKp: { kp1: "known", kp2: "unknown" },
  hasSubmission: true,
  progressByKp: {
    kp1: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp2: { self: "unknown", fill: emptyTab, drag: tab("incorrect", "incorrect", 2) },
  },
  submittedAttempts: [
    { id: "a1", score10: 8, completedAt: "2026-10-27T10:00:00+07:00", slotsByKp: { kp1: { correct: 1, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
  ],
})
const s2 = rawStudent("hs2", "Bình", {
  selfByKp: { kp1: "known", kp2: "known" },
  hasSubmission: true,
  progressByKp: {
    kp1: { self: "known", fill: tab("incorrect", "incorrect", 1), drag: emptyTab },
    kp2: { self: "known", fill: emptyTab, drag: emptyTab },
  },
})
const row1 = buildStudentRow(s1, kps, T, 1, now)
const row2 = buildStudentRow(s2, kps, T, 1, now)
check("Màn 1: tự nhận Biết 1 / Chưa biết 1", row1.selfKnown === 1 && row1.selfUnknown === 1 && row1.selfAssessed === 2)
check("Màn 1: điền pool 1, xanh 1, cuối 1", row1.fillPool === 1 && row1.fillGreen === 1 && row1.fillEventual === 1)
check("Màn 1: kéo pool 1, đỏ 1, cuối 0", row1.dragPool === 1 && row1.dragRed === 1 && row1.dragEventual === 0)
check("Màn 1: HS chưa nộp -> kiểm tra 0/tổng, làm lại —", row2.quizAnswered === 0 && row2.quizTotal === 1 && row2.retakesText === "—")
check("Màn 1: HS đã nộp 1 lượt -> làm lại 0", row1.retakesText === "0")
check("Màn 1: tầng kp1 của An = Thành thạo (quiz 1/1 + Biết + điền đúng = kết hợp)", row1.tiersByKp.kp1.level === "mastered" && row1.tiersByKp.kp1.source === "Q")
check("Màn 1: tầng kp2 của An = Chưa tốt (kéo sai đã chốt, chưa xem đáp án)", row1.tiersByKp.kp2.level === "weak")
check("Màn 1: tầng kp2 của Bình = Chưa kiểm chứng (chỉ tự nhận, chưa làm)", row2.tiersByKp.kp2.level === "unverified")
check("Màn 1: An hết việc Tab 2 -> pool Kéo chốt", row1.dragFinalized === true)
check("Màn 1: Bình còn điền chờ -> pool Kéo chưa chốt", row2.dragFinalized === false)
check("Màn 1: tầng kp1 của Bình = Chưa kiểm chứng (điền sai lần 1 đang chờ)", row2.tiersByKp.kp1.level === "unverified" && row2.tiersByKp.kp1.source === "F")
check("Màn 1: điểm chờ không tính vào điểm yếu (Bình weakCount 0, không cần hỗ trợ vì yếu)", row2.weakCount === 0 && !row2.helpReasons.some((r) => r.includes("Chưa tốt")))

// Điểm chuyển: submission Biết nhưng tiến trình Chưa biết -> vẫn ở pool Điền
// (giữ vạch đỏ) đồng thời vào pool Kéo; tầng theo điền chốt đứng khi kéo chờ.
const s5 = rawStudent("hs5", "Em", {
  selfByKp: { kp1: "known", kp2: "unknown" },
  hasSubmission: true,
  progressByKp: {
    kp1: { self: "unknown", fill: tab("incorrect", "incorrect", 2), drag: tab("incorrect", "incorrect", 1) },
    kp2: { self: "unknown", fill: emptyTab, drag: emptyTab },
  },
})
const row5 = buildStudentRow(s5, kps, T, 1, now)
check("Chuyển: pool Điền vẫn 1 (submission Biết) + vạch đỏ 1 dù tiến trình đã Chưa biết", row5.fillPool === 1 && row5.fillRed === 1)
check("Chuyển: pool Kéo 2 = 1 chuyển (kp1) + 1 gốc (kp2), chồng với cột Điền", row5.dragPool === 2)
check("Chuyển: vạch đỏ kéo 1 từ lần kéo chờ của điểm chuyển", row5.dragRed === 1 && row5.dragEventual === 0)
check("Chuyển: tầng kp1 = Chưa tốt nguồn F (điền chốt đứng khi kéo chờ)", row5.tiersByKp.kp1.level === "weak" && row5.tiersByKp.kp1.source === "F")
check("Chuyển: đã rời Tab 2 -> pool Kéo chốt ngay dù kéo còn chờ", row5.dragFinalized === true)
const kpStats5 = buildKpStats([s1, s2, s5], [row1, row2, row5], kps, T)
check("Màn 2: điểm chuyển vẫn tính Biết + quá tự tin theo submission (kp1: Biết 3, chủ quan 2)", kpStats5[0].knownAssessed === 3 && kpStats5[0].overconfidentCount === 2)

const kpStats = buildKpStats([s1, s2], [row1, row2], kps, T)
check("Màn 2: 5 mức cộng lại = sĩ số 2", kpStats.every((k) => Object.values(k.counts).reduce((a, b) => a + b, 0) === 2))
check("Màn 2: kp2 không có câu kiểm tra -> badge + source F/D", kpStats[1].noQuizQuestion === true)
check("Màn 2: kp1 có 1 ô quiz -> gắn cờ Ít câu (< 2 ô)", kpStats[0].quizSlots === 1 && kpStats[0].fewQuestions === true)
check("Màn 2: chủ quan sai kp1 = 1/2 em tự nhận Biết", kpStats[0].overconfidentCount === 1 && kpStats[0].knownAssessed === 2)

const matrix = buildMatrix([row1, row2], kps)
check("Màn 3: tổng kết đếm đúng từ ô (An: Thành thạo 1, Chưa tốt 1)", (() => {
  const cells = matrix.cells.hs1
  const mastered = Object.values(cells).filter((c) => c.level === "mastered").length
  const weak = Object.values(cells).filter((c) => c.level === "weak").length
  return mastered === 1 && weak === 1
})())
check("Màn 3: ô quiz luôn có phân số đúng/tổng", matrix.cells.hs1.kp1.quizCorrect === 1 && matrix.cells.hs1.kp1.quizTotal === 1)
check("Màn 3: ô điểm không câu kiểm tra bị gạch chéo", matrix.cells.hs1.kp2.hatched === true)

// ---- Màn 4: ▲■▼, phân loại, streak ----
const s3 = rawStudent("hs3", "Chi", {
  selfByKp: { kp1: "known", kp2: "unknown" },
  hasSubmission: true,
  progressByKp: {
    kp1: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp2: { self: "unknown", fill: emptyTab, drag: tab("correct", "incorrect", 2) },
  },
  submittedAttempts: [
    { id: "a1", score10: 5, completedAt: "2026-10-26T10:00:00+07:00", slotsByKp: { kp1: { correct: 0, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
    { id: "a2", score10: 10, completedAt: "2026-10-27T10:00:00+07:00", slotsByKp: { kp1: { correct: 1, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
  ],
})
const row3 = buildStudentRow(s3, kps, T, 1, now)
check("Màn 4: ▲=1 ■=0 ▼=0 khi kp1 từ Chưa tốt lên Khá (lượt sau 1/1 bị chặn, không lên Thành thạo)", row3.levelUp === 1 && row3.levelSame === 0 && row3.levelDown === 0)
check("Màn 4: tầng theo lượt cũng chặn 1 ô: 1/1 -> Khá, 3/4 -> Thành thạo", (() => {
  const a1 = { slotsByKp: { kp1: { correct: 1, total: 1 } } }
  const a2 = { slotsByKp: { kp1: { correct: 3, total: 4 } } }
  return attemptTierForKp(a1, "kp1", T) === "ok" && attemptTierForKp(a2, "kp1", T) === "mastered"
})())
check("Màn 4: làm lại = 1 sau 2 lượt nộp", row3.retakesText === "1" && row3.retakeCount === 1)
const table = buildProgressTable([row1, row2, row3], [s1, s2, s3])
check("Màn 4: Chi phân loại Tiến bộ", table.find((r) => r.studentId === "hs3")?.classification === "improving")
check("Màn 4: Bình chưa nộp, chưa làm dở -> Bỏ dở (đã tự đánh giá)", table.find((r) => r.studentId === "hs2")?.classification === "abandoned")
check("Màn 4: Bỏ dở hiển thị — cho điểm và mức", (() => {
  const r = table.find((x) => x.studentId === "hs2")
  return r && r.levelUp === 0 && r.levelDown === 0 && r.hasScores === false
})())
check("Màn 4: điểm từng lượt theo thứ tự nộp", table.find((r) => r.studentId === "hs3")?.scores10.join(",") === "5,10")

// ---- Hạn nộp + cần hỗ trợ ----
const sLate = rawStudent("hs4", "Dũng", {
  dueAt: "2026-10-26T23:59:00+07:00",
  selfByKp: { kp1: "known", kp2: "known" },
  hasSubmission: true,
  progressByKp: {
    kp1: { self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab },
    kp2: { self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab },
  },
})
const rowLate = buildStudentRow(sLate, kps, T, 1, now)
check("Hạn: quá hạn chưa nộp -> Quá hạn + cần hỗ trợ", rowLate.deadlineBadge === "Quá hạn" && rowLate.needsHelp === true)
check("Hạn: ≥1/3 điểm Chưa tốt -> cần hỗ trợ (2/2)", rowLate.weakCount === 2 && rowLate.helpReasons.some((r) => r.includes("≥ 1/3")))

// ---- Streak ----
check("Streak: 3 ngày liên tiếp tới hôm qua", computeStreak(["2026-10-25", "2026-10-26", "2026-10-24"], new Date("2026-10-27T12:00:00+07:00")) === 3)
check("Streak: đứt quãng -> 1", computeStreak(["2026-10-26", "2026-10-24"], new Date("2026-10-27T12:00:00+07:00")) === 1)
check("Streak: hôm nay chưa học, hôm qua có -> vẫn tính", computeStreak(["2026-10-26"], new Date("2026-10-27T12:00:00+07:00")) === 1)

console.log(`\n${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
