// §38 (full): phiên 4 được viết lại cho hệ thống kê theo bài mới.
// Các helper tổng quan lớp cũ (quizBand, median, buildOverview,
// buildAssignmentStat, summarizeStudentQuiz) KHÔNG còn — mô hình tổng quan
// lớp đã được thay bằng thống kê theo bài (4 màn). Script này kiểm thử
// các cờ tương đương trong hệ mới: cần hỗ trợ, nên ôn lại cả lớp, ngưỡng.
import {
  buildStudentRow,
  buildKpStats,
  levelFromRate,
  DEFAULT_THRESHOLDS,
} from "@/lib/lesson-stats"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}
const T = DEFAULT_THRESHOLDS
const tab = (status, firstTry = null, attempts = 1, revealed = false) => ({
  status,
  firstTry,
  attempts,
  revealed,
})
const emptyTab = { status: null, firstTry: null, attempts: 0, revealed: false }
const now = new Date("2026-10-27T12:00:00+07:00")

// Ngưỡng xếp mức (thay quizBand): 75/50 mặc định, đổi theo lớp.
assert(levelFromRate(80, T) === "mastered", "80% -> Thành thạo")
assert(levelFromRate(79, T) === "mastered", "79% -> Thành thạo (ngưỡng mới 75)")
assert(levelFromRate(74, T) === "ok", "74% -> Khá")
assert(levelFromRate(50, T) === "ok", "50% -> Khá")
assert(levelFromRate(49, T) === "weak", "49% -> Chưa tốt")
assert(levelFromRate(85, { mastery: 90, ok: 60 }) === "ok", "ngưỡng lớp 90/60 đổi mức")
console.log("OK levelFromRate")

// Cần hỗ trợ (thay isAtRisk): ≥1/3 điểm Chưa tốt, quá hạn chưa nộp,
// làm lại ≥2 lần mà điểm không tăng.
const kps = [
  { id: "kp1", content: "Điểm 1", order: 0, slotCount: 1, questionIds: ["q1"], quizSlotCount: 1 },
  { id: "kp2", content: "Điểm 2", order: 1, slotCount: 1, questionIds: [], quizSlotCount: 0 },
  { id: "kp3", content: "Điểm 3", order: 2, slotCount: 1, questionIds: [], quizSlotCount: 0 },
]
function rawStudent(id, name, overrides) {
  return {
    studentId: id,
    name,
    selfByKp: {},
    progressByKp: {},
    submittedAttempts: [],
    openAttempt: null,
    lastActivityAt: null,
    dueAt: null,
    activityDays: [],
    ...overrides,
  }
}
const weakAll = rawStudent("hs1", "An", {
  selfByKp: { kp1: "known", kp2: "known", kp3: "known" },
  progressByKp: {
    kp1: { self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab },
    kp2: { self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab },
    kp3: { self: "known", fill: tab("incorrect", "incorrect", 2), drag: emptyTab },
  },
})
const rowWeak = buildStudentRow(weakAll, kps, T, 1, now)
assert(rowWeak.needsHelp === true, "3/3 điểm yếu -> cần hỗ trợ")
assert(rowWeak.helpReasons.some((r) => r.includes("≥ 1/3")), "lý do ghi ≥ 1/3")

const overdue = rawStudent("hs2", "Bình", {
  dueAt: "2026-10-26T23:59:00+07:00",
  selfByKp: { kp1: "known", kp2: "known", kp3: "known" },
  progressByKp: {
    kp1: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp2: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp3: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
  },
})
const rowOverdue = buildStudentRow(overdue, kps, T, 1, now)
assert(rowOverdue.needsHelp === true, "quá hạn chưa nộp -> cần hỗ trợ")
assert(rowOverdue.deadlineBadge === "Quá hạn", "huy hiệu Quá hạn")

const retaker = rawStudent("hs3", "Chi", {
  selfByKp: { kp1: "known", kp2: "known", kp3: "known" },
  progressByKp: {
    kp1: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp2: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp3: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
  },
  submittedAttempts: [
    { id: "a1", score10: 8, completedAt: "2026-10-25T10:00:00+07:00", slotsByKp: { kp1: { correct: 1, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
    { id: "a2", score10: 7, completedAt: "2026-10-26T10:00:00+07:00", slotsByKp: { kp1: { correct: 1, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
    { id: "a3", score10: 8, completedAt: "2026-10-27T10:00:00+07:00", slotsByKp: { kp1: { correct: 1, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
  ],
})
const rowRetaker = buildStudentRow(retaker, kps, T, 1, now)
assert(rowRetaker.retakeCount === 2, "3 lượt nộp -> làm lại 2")
assert(rowRetaker.needsHelp === true, "làm lại 2 lần mà điểm không tăng -> cần hỗ trợ")
console.log("OK needsHelp")

// Nên ôn lại cả lớp (thay isHardKp/isWeakKp): ≥40% Chưa tốt.
const stats = buildKpStats([weakAll], [rowWeak], kps, T)
assert(stats[0].weakRate === 1 && stats[0].needsReview === true, "100% yếu -> nên ôn lại")
const fine = rawStudent("hs4", "Dũng", {
  selfByKp: { kp1: "known", kp2: "known", kp3: "known" },
  progressByKp: {
    kp1: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp2: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
    kp3: { self: "known", fill: tab("correct", "correct"), drag: emptyTab },
  },
  submittedAttempts: [
    { id: "a1", score10: 10, completedAt: "2026-10-27T10:00:00+07:00", slotsByKp: { kp1: { correct: 1, total: 1 } }, questionIds: ["q1"], wrongAnswers: [], totalSlots: 1, durationMs: 60000, quickAnswers: 0 },
  ],
})
const rowFine = buildStudentRow(fine, kps, T, 1, now)
const statsFine = buildKpStats([fine], [rowFine], kps, T)
assert(statsFine[0].weakRate === 0 && statsFine[0].needsReview === false, "0% yếu -> không ôn lại")
console.log("OK needsReview")

console.log("phien 4 OK")
