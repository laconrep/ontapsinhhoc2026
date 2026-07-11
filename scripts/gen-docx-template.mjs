import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

const U = (text) => new TextRun({ text, underline: {} })
const T = (text) => new TextRun({ text })

function p(children, opts = {}) {
  return new Paragraph({ children: Array.isArray(children) ? children : [T(children)], ...opts })
}

const doc = new Document({
  sections: [
    {
      children: [
        p("// HƯỚNG DẪN: Gạch chân từ để tạo ô điền khuyết cố định. Đặt từ trong \"dấu nháy kép\" để tạo ô hoán đổi. Các dòng bắt đầu bằng // sẽ được bỏ qua.", {
          heading: HeadingLevel.HEADING_3,
        }),
        p("{Chương I - Cơ sở vật chất di truyền}"),
        p("[ADN và ARN]"),
        p([
          T("- ADN là đại phân tử cấu tạo theo nguyên tắc "),
          U("đa phân"),
          T(", đơn phân là "),
          U("nucleotide"),
          T("."),
        ]),
        p("# ADN có cấu trúc không gian dạng gì?"),
        p("+ *Xoắn kép"),
        p("+ Mạch thẳng"),
        p("+ Vòng tròn"),
        p("+ Xoắn ba"),
        p("## Chọn đúng/sai cho các phát biểu sau về ADN:"),
        p("+ a) ADN có cấu trúc gồm hai mạch = Đúng"),
        p("+ b) Đơn phân của ADN là axit amin = Sai"),
        p("+ c) ADN có trong nhân tế bào = Đúng"),
        p("+ d) ADN chỉ có một mạch đơn = Sai"),
        p("### Đơn phân của ADN được gọi là gì? = nucleotide"),
        p([
          T("- Hai mạch của ADN liên kết theo nguyên tắc "),
          T("\"bổ sung\""),
          T(", trong đó A liên kết với "),
          T("\"T\""),
          T(" và G liên kết với "),
          T("\"X\""),
          T("."),
        ]),
      ],
    },
  ],
})

const outDir = path.join(process.cwd(), "public", "templates")
await mkdir(outDir, { recursive: true })
const buffer = await Packer.toBuffer(doc)
await writeFile(path.join(outDir, "mau-cau-hoi.docx"), buffer)
console.log("[v0] Đã tạo mau-cau-hoi.docx")
