// Bổ sung thống kê batch 1 + ẩn danh AI: kiểm thử trên số liệu thật 20 HS v41
// (production 28/10, đã lưu) — replay qua code mới, đối chiếu DTO cũ.
// Chạy: node --import ~/workspace/.epg/register-loader.mjs scripts/check-stats-supplements.mjs
import { readFileSync } from "node:fs"
import { buildStudentRow, buildKpStats } from "@/lib/lesson-stats"
import { isOverconfident } from "@/lib/scoring"
import { anonymizeLessonStats } from "@/lib/ai/anonymize"

const EPG = `${process.env.HOME}/workspace/.epg`
const dto = JSON.parse(readFileSync(`${EPG}/stats-v41-dto.json`, "utf8"))
const detail = JSON.parse(readFileSync(`${EPG}/stats-lesson-detail.json`, "utf8"))

let pass = 0
let fail = 0
const advisories = []
function check(name, cond, extra) {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`FAIL ${name}${extra ? ` :: ${extra}` : ""}`)
  }
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ---- Dựng RawKp[] từ lesson detail (đối chiếu quizSlots với DTO cũ) ----
const questionsByKp = new Map()
for (const q of detail.questions) {
  if (!q.knowledgePointId) continue
  const arr = questionsByKp.get(q.knowledgePointId) ?? []
  arr.push(q)
  questionsByKp.set(q.knowledgePointId, arr)
}
const slotOf = (q) => (q.type === "TF" ? (q.options?.length ?? 1) : 1)
const kps = detail.kps.map((kp) => {
  const qs = questionsByKp.get(kp.id) ?? []
  return {
    id: kp.id,
    content: kp.content,
    order: kp.order,
    slotCount: (kp.underlinedTerms ?? []).length,
    questionIds: qs.map((q) => q.id),
    quizSlotCount: qs.reduce((a, q) => a + slotOf(q), 0),
  }
})
for (const saved of dto.kpStats) {
  const rebuilt = kps.find((k) => k.id === saved.kpId)
  check(`kp ${saved.kpNo} quizSlots khớp`, rebuilt?.quizSlotCount === saved.quizSlots, `dto=${saved.quizSlots} rebuilt=${rebuilt?.quizSlotCount}`)
}

// ---- Replay qua code mới ----
const thresholds = dto.thresholds
const lessonTotalSlots = 74
const now = new Date(dto.generatedAt)
const rows = dto.rawStudents.map((rs) => buildStudentRow(rs, kps, thresholds, lessonTotalSlots, now))
const kpStats = buildKpStats(dto.rawStudents, rows, kps, thresholds)
const rowById = new Map(rows.map((r) => [r.studentId, r]))
const kpById = new Map(kpStats.map((k) => [k.kpId, k]))

// ---- Hồi quy hàng học sinh (trừ quizCorrect: DTO cũ chưa có; trừ tiersByKp so riêng) ----
for (const saved of dto.students) {
  const r = rowById.get(saved.studentId)
  check(`hs ${saved.name} có hàng mới`, !!r)
  if (!r) continue
  for (const key of Object.keys(saved)) {
    if (key === "tiersByKp") continue
    check(`hs ${saved.name} giữ ${key}`, eq(r[key], saved[key]), `cũ=${JSON.stringify(saved[key])} mới=${JSON.stringify(r[key])}`)
  }
  for (const kpId of Object.keys(saved.tiersByKp)) {
    const oldT = saved.tiersByKp[kpId]
    const newT = r.tiersByKp[kpId]
    check(`hs ${saved.name} tầng ${kpId.slice(0, 8)}`, newT && newT.level === oldT.level && newT.source === oldT.source, `cũ=${oldT.level}/${oldT.source} mới=${newT?.level}/${newT?.source}`)
  }
  // Trường mới phải tồn tại.
  check(`hs ${saved.name} có trường mới`, typeof r.overconfidentKpCount === "number" && Array.isArray(r.flags) && typeof r.inSessionTransferred === "number" && typeof r.inSessionLearned === "number")
}

// ---- Hồi quy kpStats (trừ mostMissed: §43 sửa cách đếm TF, lệch là đúng) ----
for (const saved of dto.kpStats) {
  const k = kpById.get(saved.kpId)
  check(`kp ${saved.kpNo} có stat mới`, !!k)
  if (!k) continue
  for (const key of ["counts", "weakRate", "needsReview", "sourceTag", "noQuizQuestion", "fewQuestions", "firstMastered", "latestMastered", "overconfidentCount", "knownAssessed", "revealedCount"]) {
    check(`kp ${saved.kpNo} giữ ${key}`, eq(k[key], saved[key]), `cũ=${JSON.stringify(saved[key])} mới=${JSON.stringify(k[key])}`)
  }
  if (saved.mostMissed && k.mostMissed) {
    check(`kp ${saved.kpNo} mostMissed không vượt 100%`, k.mostMissed.missRate <= 1, `missRate=${k.mostMissed.missRate}`)
    if (saved.mostMissed.questionNo !== k.mostMissed.questionNo || saved.mostMissed.wrongCount !== k.mostMissed.wrongCount) {
      advisories.push(`kp ${saved.kpNo} mostMissed đổi do fix §43: cũ câu ${saved.mostMissed.questionNo} ${saved.mostMissed.wrongCount}/${saved.mostMissed.answeredCount} → mới câu ${k.mostMissed.questionNo} ${k.mostMissed.wrongCount}/${k.mostMissed.answeredCount}`)
    }
  }
  // Trường mới hợp lệ.
  check(`kp ${saved.kpNo} firstTry hợp lệ`, k.fillFirstTry.correct <= k.fillFirstTry.total && k.fillFirstTry.total <= 20 && k.dragFirstTry.correct <= k.dragFirstTry.total && k.dragFirstTry.total <= 20)
}

// ---- Đối chiếu trường mới với dữ liệu thô (tính độc lập) ----
for (const rs of dto.rawStudents) {
  const r = rowById.get(rs.studentId)
  let expOver = 0
  let expTransferred = 0
  let expRevealed = 0
  for (const kp of kps) {
    const prog = rs.progressByKp[kp.id]
    if (!prog) continue
    const subSelf = rs.selfByKp[kp.id] ?? prog.self ?? null
    if (isOverconfident({ selfAssessment: subSelf, fillFirstTry: prog.fill.firstTry, fillAttempts: prog.fill.attempts })) expOver++
    if (rs.selfByKp[kp.id] === "known" && prog.self === "unknown") expTransferred++
    if (prog.fill.revealed || prog.drag.revealed) expRevealed++
  }
  check(`hs ${rs.name} overconfident khớp`, r.overconfidentKpCount === expOver, `tính=${r.overconfidentKpCount} mong=${expOver}`)
  check(`hs ${rs.name} transferred khớp`, r.inSessionTransferred === expTransferred, `tính=${r.inSessionTransferred} mong=${expTransferred}`)
  check(`hs ${rs.name} learned ≤ transferred`, r.inSessionLearned <= r.inSessionTransferred)
  const latest = rs.submittedAttempts[rs.submittedAttempts.length - 1]
  const expQuick = latest && latest.durationMs != null && latest.totalSlots > 0 && latest.durationMs / 1000 / latest.totalSlots < 10
  check(`hs ${rs.name} cờ khớp`, r.flags.includes("Làm rất nhanh") === !!expQuick && (expRevealed > 0) === r.flags.some((f) => f.startsWith("Xem đáp án")) && (expOver > 0) === r.flags.some((f) => f.startsWith("Chủ quan sai")), `cờ=${JSON.stringify(r.flags)}`)
}

// ---- Ẩn danh ----
const anon = anonymizeLessonStats(dto)
check("ẩn danh: bỏ rawStudents", anon.rawStudents === undefined)
check("ẩn danh: tên thành mã HSxx", anon.students.every((s) => /^HS\d+$/.test(s.name) && /^HS\d+$/.test(s.studentId)))
const anonJson = JSON.stringify(anon)
const leaked = dto.students.map((s) => s.name).filter((n) => anonJson.includes(n))
check("ẩn danh: không lọt tên thật", leaked.length === 0, `lọt: ${leaked.join(", ")}`)
check("ẩn danh: overview/coverage giữ nguyên", eq(anon.overview, dto.overview) && eq(anon.coverage, dto.coverage))
check("ẩn danh: kpStats giữ nguyên", eq(anon.kpStats, dto.kpStats))
check("ẩn danh: matrixCells đổi khóa thành mã", Object.keys(anon.matrixCells).every((k) => /^HS\d+$/.test(k)))

// ---- Tổng hợp cho báo cáo ----
const coveragePct = Math.round((dto.coverage.attached / dto.coverage.total) * 100)
const latestScores = rows.map((r) => r.latestScore10).filter((v) => v != null)
const mean = latestScores.reduce((a, b) => a + b, 0) / latestScores.length
const std = Math.sqrt(latestScores.reduce((a, b) => a + (b - mean) * (b - mean), 0) / latestScores.length).toFixed(1)
const transferred = rows.reduce((a, r) => a + r.inSessionTransferred, 0)
const learned = rows.reduce((a, r) => a + r.inSessionLearned, 0)
const overdue = rows.filter((r) => r.deadlineBadge === "Quá hạn").length
const flagged = rows.filter((r) => r.flags.length > 0).length
console.log("\n--- TỔNG HỢP (số liệu v41, code mới) ---")
console.log(`Độ phủ: ${dto.coverage.attached}/${dto.coverage.total} = ${coveragePct}%`)
console.log(`Điểm dao động lượt gần nhất: ${Math.min(...latestScores)} – ${Math.max(...latestScores)} (lệch chuẩn ${std})`)
console.log(`Học trong buổi: ${learned}/${transferred} điểm chuyển đã lên Khá/Thành thạo`)
console.log(`Quá hạn: ${overdue} em; có cờ Màn 1: ${flagged} em`)
console.log("Câu sai nhiều nhất (ngưỡng ≥5 em, ≥30% mới gắn 'Nên xem lại'):")
for (const k of kpStats) {
  if (!k.mostMissed) continue
  const gate = k.mostMissed.answeredCount < 5 ? `Chưa đủ dữ liệu (${k.mostMissed.answeredCount}/5 em)` : `${Math.round(k.mostMissed.missRate * 100)}% sai (${k.mostMissed.wrongCount}/${k.mostMissed.answeredCount})${k.mostMissed.missRate >= 0.3 ? " · Nên xem lại câu hỏi" : ""}`
  console.log(`  Điểm ${k.kpNo}: câu ${k.mostMissed.questionNo} — ${gate}; điền đúng lần đầu ${k.fillFirstTry.correct}/${k.fillFirstTry.total}, kéo đúng lần đầu ${k.dragFirstTry.correct}/${k.dragFirstTry.total}`)
}
for (const a of advisories) console.log(`ADVISORY ${a}`)
console.log(`\nPASS ${pass} / FAIL ${fail}`)
process.exit(fail === 0 ? 0 : 1)
