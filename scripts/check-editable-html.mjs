import {
  bodyHtmlToEditable,
  editableToBodyHtml,
  editableToPlainText,
  mediaPlaceholder,
} from "@/lib/editable-html"

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

const IMG1 = '<img src="data:image/svg+xml;base64,AAAA" alt="" class="eq-inline">'
const IMG2 = '<img src="https://x.public.blob.vercel-storage.com/f.png" alt="" class="eq-figure">'
const TBL = "<table><tr><td>A</td></tr></table>"

// 1. Không có bodyHtml
{
  const r = bodyHtmlToEditable(null)
  check("null -> text rong, media rong", r.text === "" && r.media.length === 0)
}

// 2. Round-trip: chữ + ảnh + bảng + xuống dòng
{
  const html = `B. ${IMG1}<br>\nDòng hai ${TBL}`
  const { text, media } = bodyHtmlToEditable(html)
  check("tach duoc 2 media theo thu tu", media.length === 2 && media[0] === IMG1 && media[1] === TBL, JSON.stringify(media))
  check(
    "editable co placeholder dung vi tri",
    text === `B. ${mediaPlaceholder(1)}\nDòng hai ${mediaPlaceholder(2)}`,
    JSON.stringify(text),
  )
  const rebuilt = editableToBodyHtml(text, media)
  check(
    "rebuild giu nguyen media + chu",
    rebuilt !== null && rebuilt.includes(IMG1) && rebuilt.includes(TBL) && rebuilt.includes("B.") && rebuilt.includes("Dòng hai"),
    rebuilt,
  )
  check("plain bo placeholder", editableToPlainText(text, media) === "B.\nDòng hai", editableToPlainText(text, media))
}

// 3. Giáo viên sửa chữ, giữ placeholder -> media còn nguyên
{
  const { text, media } = bodyHtmlToEditable(`Câu cũ ${IMG1}`)
  const edited = text.replace("Câu cũ", "Câu mới đã sửa")
  const rebuilt = editableToBodyHtml(edited, media)
  check(
    "sua chu giu media",
    rebuilt !== null && rebuilt.includes("Câu mới đã sửa") && rebuilt.includes(IMG1),
    rebuilt,
  )
  check("plain sau sua", editableToPlainText(edited, media) === "Câu mới đã sửa", editableToPlainText(edited, media))
}

// 4. Giáo viên xóa placeholder -> bodyHtml null, plain không còn ảnh
{
  const { text, media } = bodyHtmlToEditable(`Câu cũ ${IMG1}`)
  const edited = text.replace(` ${mediaPlaceholder(1)}`, "")
  check("xoa placeholder -> bodyHtml null", editableToBodyHtml(edited, media) === null)
  check("plain sau xoa", editableToPlainText(edited, media) === "Câu cũ", editableToPlainText(edited, media))
}

// 5. Placeholder lạ giữ nguyên dạng chữ
{
  const text = "Giữ @@MEDIA-99@@ nguyên"
  check("placeholder la -> bodyHtml null", editableToBodyHtml(text, [IMG1]) === null)
  check("plain giu placeholder la", editableToPlainText(text, [IMG1]) === text)
}

// 6. XSS: chữ giáo viên gõ được escape khi dựng lại
{
  const text = `hello <script>alert(1)</script> ${mediaPlaceholder(1)}`
  const rebuilt = editableToBodyHtml(text, [IMG1])
  check(
    "escape script khi rebuild",
    rebuilt !== null && !rebuilt.includes("<script>") && rebuilt.includes("&lt;script&gt;") && rebuilt.includes(IMG1),
    rebuilt,
  )
}

// 7. <br> các dạng + đóng thẻ block thành xuống dòng, không sinh dòng trống từ "<br>\n"
{
  const { text } = bodyHtmlToEditable(`Dòng 1<br/>Dòng 2<br>Dòng 3</p>Dòng 4`)
  check("br va dong the block -> xuong dong", text === "Dòng 1\nDòng 2\nDòng 3\nDòng 4", JSON.stringify(text))
}

// 8. Ảnh đứng một mình một dòng (đề chỉ có hình)
{
  const { text, media } = bodyHtmlToEditable(IMG2)
  check("anh mot minh -> text la placeholder", text === mediaPlaceholder(1) && media.length === 1, JSON.stringify(text))
  check("plain anh mot minh -> rong", editableToPlainText(text, media) === "")
  check("rebuild anh mot minh -> co img", (editableToBodyHtml(text, media) ?? "").includes(IMG2))
}

// 9. Thực thể HTML được giải mã
{
  const { text } = bodyHtmlToEditable("A &amp; B &lt; C")
  check("decode entities", text === "A & B < C", JSON.stringify(text))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
