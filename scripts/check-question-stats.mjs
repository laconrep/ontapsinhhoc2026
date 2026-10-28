// Thống kê từng câu hỏi batch 2: kiểm thử tổng hợp (dữ liệu giả có đáp án biết trước).
// Số liệu v41 thật không có đáp án đầy đủ trong DTO đã lưu nên batch 2 không replay
// được bằng fixture — kiểm thật trên production sẽ dùng quiz_answers thật.
// Chạy: node --import ~/workspace/.epg/register-loader.mjs scripts/check-question-stats.mjs
import { buildQuestionStats } from "@/lib/lesson-stats"

let pass = 0
let fail = 0
function check(name, cond, extra) {
  if (cond) {
    pass++
  } else {
    fail++
    console.log(`FAIL: ${name}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ""}`)
  }
}
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

// Học sinh giả: id s1..s12, điểm lượt gần nhất 9,9,9,9,5,5,5,5,1,1,1,1.
// Mỗi em trả lời 3 câu (MC q1, TF q2 2 ý, SA q3) ở các mốc thời gian khác nhau.
const T0 = Date.parse("2026-10-28T10:00:00Z")
const iso = (ms) => new Date(ms).toISOString()
function mkStudent(id, score, answers) {
  return {
    studentId: id,
    submittedAttempts: [
      {
        id: `att-${id}`,
        score10: score,
        answers: answers.map(([qid, opt, correct, t]) => ({
          questionId: qid,
          optionId: opt,
          studentAnswer: opt,
          isCorrect: correct,
          answeredAt: iso(t),
        })),
      },
    ],
  }
}

// q1 (MC, đáp án A đúng): top 4 chọn A đúng; giữa 4: 2 A đúng, 1 B sai, 1 C sai;
// dưới 4: 1 A đúng, 3 B sai → A: 7/12 (58%), B: 4/12 (33%), C: 1/12 (8%), sai 5/12 (42%).
// q2 (TF, ý a đúng, ý b sai là đúng? — đặt: ý a đáp án Đúng, ý b đáp án Sai;
// mỗi em trả lời cả 2 ý): top 4: a đúng 4/4, b đúng 4/4; giữa: a 2/4, b 3/4;
// dưới: a 1/4, b 0/4 → a: 7/12 đúng, b: 7/12 đúng; slot sai: (5+5)/24 = 42%.
// q3 (SA): chỉ 3 em trả lời (thiếu dữ liệu) → difficulty null.
const students = []
const q1Choices = ["A", "A", "A", "A", "A", "A", "B", "C", "A", "B", "B", "B"]
const scores = [9, 9, 9, 9, 5, 5, 5, 5, 1, 1, 1, 1]
for (let i = 0; i < 12; i++) {
  const id = `s${i + 1}`
  const base = T0 + i * 1000
  const q1 = q1Choices[i]
  // Ý a: đúng với i thuộc {0,1,2,3, 4,5, 8}; ý b: đúng với {0,1,2,3, 4,5,6}.
  const aOk = [0, 1, 2, 3, 4, 5, 8].includes(i)
  const bOk = [0, 1, 2, 3, 4, 5, 6].includes(i)
  const answers = [
    ["q1", q1, q1 === "A", base],
    ["q2", "a", aOk, base + 10000 + i * 5000],
    ["q2", "b", bOk, base + 20000 + i * 5000],
  ]
  if (i < 3) answers.push(["q3", null, i === 0, base + 30000])
  students.push(mkStudent(id, scores[i], answers))
}
const questions = [
  {
    id: "q1",
    no: 1,
    type: "MC",
    kpId: "kp1",
    options: [
      { id: "A", content: "A. phương án A" },
      { id: "B", content: "B. phương án B" },
      { id: "C", content: "C. phương án C" },
    ],
  },
  {
    id: "q2",
    no: 2,
    type: "TF",
    kpId: "kp1",
    options: [
      { id: "a", content: "Ý a: phát biểu một" },
      { id: "b", content: "Ý b: phát biểu hai" },
    ],
  },
  { id: "q3", no: 3, type: "SA", kpId: null, options: [] },
]
const stats = buildQuestionStats(students, questions)
const [s1, s2, s3] = stats

// q1: tỉ lệ phương án + độ khó + phân biệt.
check("q1 answered", s1.answered === 12, s1.answered)
check("q1 missRate", approx(s1.missRate, 5 / 12), s1.missRate)
check("q1 A rate", approx(s1.options.find((o) => o.optionId === "A").rate, 7 / 12), s1.options)
check("q1 B rate", approx(s1.options.find((o) => o.optionId === "B").rate, 4 / 12), s1.options)
check("q1 C rate", approx(s1.options.find((o) => o.optionId === "C").rate, 1 / 12), s1.options)
check("q1 difficulty medium", s1.difficulty === "medium", s1.difficulty)
// Phân biệt q1: top 4 đều đúng (1.0), bottom 4: 1/4 đúng (0.25) → 0.75.
check("q1 discrimination", approx(s1.discrimination, 0.75), s1.discrimination)
// q2: tỉ lệ từng ý + slot sai.
check("q2 answered", s2.answered === 12, s2.answered)
check("q2 totalSlots", s2.totalSlots === 24, s2.totalSlots)
check("q2 missRate", approx(s2.missRate, 10 / 24), s2.missRate)
check("q2 a rate", approx(s2.options.find((o) => o.optionId === "a").rate, 7 / 12), s2.options)
check("q2 b rate", approx(s2.options.find((o) => o.optionId === "b").rate, 7 / 12), s2.options)
// Phân biệt q2: top 4: (2/2)=1.0; bottom 4: s9: a đúng,b sai=0.5; s10,s11,s12: 0 → 0.125 → 0.875.
check("q2 discrimination", approx(s2.discrimination, 0.88), s2.discrimination)
// q3: thiếu dữ liệu.
check("q3 answered", s3.answered === 3, s3.answered)
check("q3 difficulty null", s3.difficulty === null, s3.difficulty)
check("q3 discrimination null", s3.discrimination === null, s3.discrimination)
check("q3 options empty", s3.options.length === 0, s3.options)
// Thời gian: TF đóng góp 2 gap/em (câu 1→ý a: 10,15,…,65 giây; ý a→ý b: 10 giây
// cố định) → 24 gap: mười ba số 10 (12 gap ý→ý + gap đầu của em 0) rồi 15,20,…,65
// → trung vị là trung bình của gap thứ 12 và 13, đều bằng 10.
check("q2 medianSec", s2.medianSec === 10, s2.medianSec)
// Median riêng: 5 em, câu m là đáp án thứ 2 với gap 10,20,30,40,50 giây → trung vị 30.
const medStudents = [10, 20, 30, 40, 50].map((g, i) =>
  mkStudent(`m${i}`, 5, [
    ["mx", "X", true, T0 + i * 1000],
    ["m", "Y", true, T0 + i * 1000 + g * 1000],
  ]),
)
const medStats = buildQuestionStats(medStudents, [
  { id: "m", no: 1, type: "MC", kpId: null, options: [{ id: "Y", content: "Y" }] },
])
check("median 30", medStats[0].medianSec === 30, medStats[0].medianSec)
// q1 là câu đầu tiên của mọi em → không có gap → median null.
check("q1 medianSec null", s1.medianSec === null, s1.medianSec)
// §46: MC thật lưu id phương án ở studentAnswer, optionId null — vẫn phải đếm đúng.
const realMcStudents = [0, 1, 2, 3].map((i) =>
  mkStudent(`r${i}`, 5, [
    ["q4", null, i < 3, T0 + i * 1000],
  ]),
)
// Ghi đè studentAnswer thành id phương án (mkStudent đặt studentAnswer = opt = null).
for (const [i, s] of realMcStudents.entries()) s.submittedAttempts[0].answers[0].studentAnswer = i < 3 ? "X" : "Y"
const realMc = buildQuestionStats(realMcStudents, [
  { id: "q4", no: 4, type: "MC", kpId: null, options: [{ id: "X", content: "X" }, { id: "Y", content: "Y" }] },
])[0]
check("MC studentAnswer option rate", approx(realMc.options.find((o) => o.optionId === "X").rate, 3 / 4), realMc.options)
check("MC studentAnswer option count", realMc.options.find((o) => o.optionId === "X").count === 3, realMc.options)
// Câu không có đáp án nào: answered 0, không lỗi.
const empty = buildQuestionStats([], questions)
check("empty answered 0", empty.every((s) => s.answered === 0), empty.map((s) => s.answered))

console.log(`PASS ${pass} / FAIL ${fail}`)
process.exit(fail === 0 ? 0 : 1)
