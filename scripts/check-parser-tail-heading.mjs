import { parseTextContent } from "@/lib/worksheet-parser"

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

function summarize(parsed) {
  const les = parsed.chapters[0]?.lessons[0]
  if (!les) return { kps: 0, questions: 0, solutions: [] }
  const kps = les.knowledgePoints
  const questions = [
    ...kps.flatMap((k) => k.questions),
    ...les.questions,
  ]
  return { kps: kps.length, questions: questions.length, solutions: questions.map((q) => q.solution ?? null) }
}

// Trường hợp 1: dòng "Đáp án B." trong lời giải KHÔNG được cắt file.
const text1 = `{Chương test}
[Bài test]
- Điểm kiến thức về __gene__ và __DNA__.
#
cau: Câu hỏi thứ nhất là gì?
__A. Đáp án đúng.__
B. Sai một.
C. Sai hai.
D. Sai ba.
Giải chi tiết: Dòng giải đầu tiên.
Đáp án B. Đây là dòng đáp án trong lời giải.
– Dòng tiếp theo bắt đầu bằng gạch ngang.
#
cau: Câu hỏi thứ hai là gì?
__A. Đúng.__
B. Sai.
- Điểm kiến thức thứ hai về __protein__.
#
cau: Câu hỏi thứ ba?
__A. Đúng.__
B. Sai.
`
{
  const s = summarize(parseTextContent(text1))
  check("Dap an trong loi giai: du 2 KP", s.kps === 2, `KPs=${s.kps}`)
  check("Dap an trong loi giai: du 3 cau", s.questions === 3, `Qs=${s.questions}`)
  check(
    "Dap an trong loi giai: loi giai giu du 3 dong",
    (s.solutions[0] ?? "").includes("Dòng giải đầu tiên") &&
      (s.solutions[0] ?? "").includes("Đáp án B.") &&
      (s.solutions[0] ?? "").includes("Dòng tiếp theo"),
    JSON.stringify(s.solutions[0]),
  )
}

// Trường hợp 2: dòng "– ..." trong lời giải là phần tiếp của lời giải,
// không phải điểm kiến thức mới.
const text2 = `{Chương test}
[Bài test]
- Điểm kiến thức về __gene__ và __DNA__.
#
cau: Câu hỏi thứ nhất là gì?
__A. Đáp án đúng.__
B. Sai một.
Giải chi tiết: Dòng giải đầu tiên.
– Dòng tiếp theo bắt đầu bằng gạch ngang.
#
cau: Câu hỏi thứ hai là gì?
__A. Đúng.__
B. Sai.
`
{
  const s = summarize(parseTextContent(text2))
  check("Gach ngang trong loi giai: van 1 KP", s.kps === 1, `KPs=${s.kps}`)
  check("Gach ngang trong loi giai: du 2 cau", s.questions === 2, `Qs=${s.questions}`)
  check(
    "Gach ngang trong loi giai: loi giai giu du 2 dong",
    (s.solutions[0] ?? "").includes("Dòng giải đầu tiên") &&
      (s.solutions[0] ?? "").includes("Dòng tiếp theo"),
    JSON.stringify(s.solutions[0]),
  )
}

// Trường hợp 3: tiêu đề cuối file THẬT vẫn cắt (không hồi quy).
const text3 = `{Chương test}
[Bài test]
- Điểm kiến thức về __gene__ và __DNA__.
#
cau: Câu hỏi thứ nhất là gì?
__A. Đáp án đúng.__
B. Sai một.
ĐÁP ÁN
1. A
2. B
`
{
  const s = summarize(parseTextContent(text3))
  check("Tieu de cuoi file that: van 1 KP 1 cau", s.kps === 1 && s.questions === 1, `KPs=${s.kps} Qs=${s.questions}`)
}

const text3b = `{Chương test}
[Bài test]
- Điểm kiến thức về __gene__ và __DNA__.
#
cau: Câu hỏi thứ nhất là gì?
__A. Đáp án đúng.__
B. Sai một.
HƯỚNG DẪN GIẢI CHI TIẾT
Giải 1: ...
`
{
  const s = summarize(parseTextContent(text3b))
  check("Tieu de HDG chi tiet: van 1 KP 1 cau", s.kps === 1 && s.questions === 1, `KPs=${s.kps} Qs=${s.questions}`)
}

// Trường hợp 4: "Đáp án:" (có dấu :) vẫn là đáp án SA, không cắt.
const text4 = `{Chương test}
[Bài test]
- Điểm kiến thức về __gene__.
###
cau: Trả lời ngắn là gì?
Đáp án: nucleotide
#
cau: Câu MC sau đó?
__A. Đúng.__
B. Sai.
`
{
  const s = summarize(parseTextContent(text4))
  check("Dap an SA + cau sau: du 2 cau", s.questions === 2, `Qs=${s.questions}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
