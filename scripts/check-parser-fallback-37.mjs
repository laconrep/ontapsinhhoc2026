import { parseTextContent, validateDocument } from "@/lib/worksheet-parser"

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

// §37: file hoàn toàn không có mốc {...} / [...] vẫn là 1 bài (thiếu tên),
// thay vì 0 bài + toàn bộ dòng báo lỗi mồ côi.
const unmarked = `PHẦN V – DI TRUYỀN HỌC
BÀI 4 – ĐỘT BIẾN GENE.
- Đột biến gene là những biến đổi trong cấu trúc của __gene__.
- Thể đột biến là những cá thể mang đột biến đã biểu hiện.
Dòng lý thuyết thường sau điểm kiến thức.
`
{
  const pr = parseTextContent(unmarked, { questionScope: "lesson" })
  const v = validateDocument(pr)
  const les = pr.chapters[0]?.lessons[0]
  check("unmarked: 1 chapter", pr.chapters.length === 1, `chapters=${pr.chapters.length}`)
  check("unmarked: chapter title fallback", pr.chapters[0]?.title === "Chương chưa đặt tên", pr.chapters[0]?.title)
  check("unmarked: 1 lesson", pr.chapters[0]?.lessons.length === 1)
  check("unmarked: lesson titleMissing", les?.titleMissing === true, `titleMissing=${les?.titleMissing}`)
  check("unmarked: no orphan-KP errors", !pr.errors.some((e) => e.message.includes("phải nằm trong một bài")), JSON.stringify(pr.errors))
  check("unmarked: leading plain lines become KPs", (les?.knowledgePoints.length ?? 0) >= 4, `kps=${les?.knowledgePoints.length}`)
  check("unmarked: first KP is the heading line", les?.knowledgePoints[0]?.content === "PHẦN V – DI TRUYỀN HỌC", les?.knowledgePoints[0]?.content)
  check("unmarked: titleMissing is warning not error", v.warnings.some((w) => w.message.includes("Bài chưa có tên trong file")), JSON.stringify(v.warnings.slice(0, 2)))
  check("unmarked: no validate errors from theory", v.errors.length === 0, JSON.stringify(v.errors))
}

// §37: câu hỏi không có mốc # vẫn báo lỗi như cũ (ranh giới định dạng giữ nguyên).
const unmarkedQ = `Tiêu đề bài viết tay
- Điểm kiến thức về __gene__.
Câu 1. Câu hỏi không có mốc là gì?
A. Phương án một.
B. Phương án hai.
`
{
  const pr = parseTextContent(unmarkedQ, { questionScope: "lesson" })
  check("unmarkedQ: still 1 lesson", pr.chapters[0]?.lessons.length === 1)
  check(
    "unmarkedQ: Cau-without-# still errors",
    pr.errors.some((e) => e.message.includes("phải nằm sau mốc #/##/###")),
    JSON.stringify(pr.errors),
  )
}

// §37: file có mốc [...] không đổi hành vi (không mở bài thiếu tên thừa).
const marked = `[Bài có tên]
- Điểm kiến thức về __gene__.
`
{
  const pr = parseTextContent(marked, { questionScope: "lesson" })
  check("marked: 1 lesson, no titleMissing", pr.chapters[0]?.lessons.length === 1 && pr.chapters[0].lessons[0].titleMissing !== true)
  check("marked: lesson keeps its title", pr.chapters[0]?.lessons[0].title === "Bài có tên")
  check("marked: no extra lessons", pr.chapters.flatMap((c) => c.lessons).length === 1)
}

// §37: file có mốc chương {...} nhưng không có [...] giữ nguyên hành vi cũ
// (nội dung trước bài đầu tiên vẫn báo lỗi mồ côi — trường hợp này cần GV thêm [...]).
const chapterOnly = `{Chương có tên}
- Điểm kiến thức mồ côi.
[Bài sau]
- Điểm kiến thức về __gene__.
`
{
  const pr = parseTextContent(chapterOnly, { questionScope: "lesson" })
  check(
    "chapterOnly: orphan before first lesson still errors",
    pr.errors.some((e) => e.message.includes("phải nằm trong một bài")),
    JSON.stringify(pr.errors),
  )
  check("chapterOnly: no fallback lesson added", pr.chapters.flatMap((c) => c.lessons).length === 1)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
