import { parseTextContent, attachBodyHtml, attachOptionBodyHtml } from "@/lib/worksheet-parser"

// §34b: dòng chỉ có token ảnh/bảng phải gắn vào câu hỏi HIỆN TẠI, không
// trôi sang câu sau, không biến mất, không lọt vào phương án cuối.
// (Gốc: công thức hiển thị oMathPara bị mammoth đẩy lên đầu đoạn sau,
// nên phân số của Q21 hiện trên đầu Q22; xem dbg-math-displace.mjs.)

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

const text = [
  "[Bài kiểm tra]",
  "#",
  "Câu 21. Chuỗi có tỉ lệ",
  "@@IMG0@@",
  "A. Đáp án một B. Đáp án hai C. Đáp án ba D. Đáp án bốn",
  "@@IMG1@@",
  "Câu 22. Đoạn gene này có",
  "A. Lựa chọn một",
  "@@IMG2@@",
  "B. Lựa chọn hai",
  "Câu 23. Câu có hai ảnh",
  "@@IMG3@@@@IMG4@@",
  "Câu 24. Câu cuối",
  "A. X B. Y",
].join("\n")

const images = ["<img src=\"IMG0\">", "<img src=\"IMG1\">", "<img src=\"IMG2\">", "<img src=\"IMG3\">", "<img src=\"IMG4\">"]
const result = parseTextContent(text, { questionScope: "lesson" })
attachBodyHtml(result, images, [])
attachOptionBodyHtml(result, images, [])
const qs = result.chapters[0].lessons[0].questions ?? []
// parseCauLine bóc tiền tố "Câu n." nên khớp theo thứ tự tài liệu.
const [q21, q22, q23, q24] = qs

check("đủ 4 câu", qs.length === 4, `Qs=${qs.length}`)
check("Q21 giữ IMG0 (giữa thân và phương án)", (q21?.bodyHtml ?? "").includes("IMG0"))
check("Q21 giữ IMG1 (hiển thị cuối sau phương án, qua closeQuestion)", (q21?.bodyHtml ?? "").includes("IMG1"))
check("Q21 phương án D không nuốt IMG1", !(q21?.options?.[3]?.bodyHtml ?? "").includes("IMG1"))
check("Q22 không rò IMG0/IMG1", !((q22?.bodyHtml ?? "").includes("IMG0") || (q22?.bodyHtml ?? "").includes("IMG1")))
check("Q22 phương án A giữ IMG2 (media giữa các dòng phương án -> phương án trước)", (q22?.options?.[0]?.bodyHtml ?? "").includes("IMG2"))
check("Q22 phương án B không nhận IMG2", !(q22?.options?.[1]?.bodyHtml ?? "").includes("IMG2"))
check("Q23 giữ cả IMG3+IMG4 (dòng nhiều token)", (q23?.bodyHtml ?? "").includes("IMG3") && (q23?.bodyHtml ?? "").includes("IMG4"))
check("Q24 không rò IMG3/IMG4", !((q24?.bodyHtml ?? "").includes("IMG3") || (q24?.bodyHtml ?? "").includes("IMG4")))
check("không lỗi parse", result.errors.length === 0, JSON.stringify(result.errors))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
