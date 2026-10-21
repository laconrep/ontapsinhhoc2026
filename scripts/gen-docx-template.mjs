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
        p("// HUONG DAN: Gach chan tu de tao o dien khuyet co dinh. Gach chan kem ngoac kep (viet __\"tu\"__) de tao o hoan doi; ngoac kep thuong mot minh KHONG tao o trong. Gach chan dong lua chon dung (MC/TF). Cac dong bat dau bang // se duoc bo qua. Khong dung dau + va dau *.", {
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
        p("#"),
        p("cau: ADN có cấu trúc không gian dạng gì?"),
        p("A. Mạch thẳng"),
        p([U("B. Xoắn kép")]),
        p("C. Vòng tròn"),
        p("D. Xoắn ba"),
        p("##"),
        p("cau: Chọn đúng/sai về ADN:"),
        p("a. ADN có hai mạch"),
        p([U("b. Đơn phân của ADN là nucleotide")]),
        p("c. ADN chỉ có một mạch đơn"),
        p("d. ADN không có trong nhân"),
        p("###"),
        p("cau: Đơn phân của ADN được gọi là gì?"),
        p("dap an: nucleotide"),
        p([
          T("- Hai mạch của ADN liên kết theo nguyên tắc "),
          U("\"bổ sung\""),
          T(", trong đó A liên kết với "),
          U("\"T\""),
          T(" và G liên kết với "),
          U("\"X\""),
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
console.log("Da tao mau-cau-hoi.docx")
