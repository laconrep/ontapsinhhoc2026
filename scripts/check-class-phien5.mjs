// §38 (full): phiên 5 được viết lại cho hệ thống kê theo bài mới.
// Nhãn trạng thái / cờ at-risk cũ (class-stats-ui) KHÔNG còn — thay bằng
// nhãn 5 mức + thứ tự mức trong lib/lesson-stats.ts.
import { LEVEL_LABEL, quizLevelRank, levelFromRate, DEFAULT_THRESHOLDS } from "@/lib/lesson-stats"

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

assert(LEVEL_LABEL.mastered === "Thành thạo", "mastered label")
assert(LEVEL_LABEL.ok === "Khá", "ok label")
assert(LEVEL_LABEL.weak === "Chưa tốt", "weak label")
assert(LEVEL_LABEL.unverified === "Chưa kiểm chứng", "unverified label")
assert(LEVEL_LABEL.not_started === "Chưa làm", "not_started label")
assert(Object.keys(LEVEL_LABEL).length === 5, "đủ 5 mức")

assert(quizLevelRank("weak") < quizLevelRank("ok"), "weak < ok")
assert(quizLevelRank("ok") < quizLevelRank("mastered"), "ok < mastered")

// Ranh giới ngưỡng không bị lệch 1%.
const T = DEFAULT_THRESHOLDS
assert(levelFromRate(100, T) === "mastered", "100%")
assert(levelFromRate(0, T) === "weak", "0%")

console.log("phien 5 OK")
