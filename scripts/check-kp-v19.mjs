import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const rootUrl = pathToFileURL(root.endsWith("/") ? root : root + "/").href

const loader = `
export async function resolve(specifier, context, nextResolve) {
  let spec = specifier
  if (spec.startsWith("@/")) spec = ${JSON.stringify(rootUrl)} + spec.slice(2)
  try {
    return await nextResolve(spec, context)
  } catch (err) {
    if (typeof spec === "string" && !spec.endsWith(".ts") && (spec.startsWith(".") || spec.startsWith("file:"))) {
      return nextResolve(spec + ".ts", context)
    }
    throw err
  }
}
`

register("data:text/javascript," + encodeURIComponent(loader), import.meta.url)

// §19: (1) ảnh/bảng trong điểm kiến thức (trước đây mã @@TBL@@ in
// nguyên văn); (2) MỖI DÒNG LÀ MỘT ĐIỂM KIẾN THỨC — dòng tiếp nối
// không còn gộp vào điểm trước; điểm không gạch chân chỉ còn là
// cảnh báo (điểm chỉ-đọc), không chặn tài liệu.

const { parseTextContent, validateDocument, attachBodyHtml } = await import("../lib/worksheet-parser.ts")
const { renderAiResult } = await import("../lib/ai/render.ts")
const { verifyAiResult } = await import("../lib/ai/verify.ts")
const { prepareKpTermsForSave } = await import("../lib/slot-render.ts")

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok - ${name}`) }
  else { fail++; console.log(`  FAIL - ${name}`) }
}

const HEAD = "{Chuong 1}\n[Bai 1]\n"

// ---------- Luật mỗi dòng một điểm ----------
{
  const doc = parseTextContent(`${HEAD}- ADN là __phân tử__ mang thông tin di truyền.\nNó gồm hai mạch __xoắn__ song song.\nDòng thứ ba không gạch chân.`)
  const kps = doc.chapters[0].lessons[0].knowledgePoints
  check("3 dòng -> 3 điểm kiến thức", kps.length === 3)
  check("dòng 2 thành điểm riêng, giữ gạch chân của chính nó",
    kps[1]?.content.includes("hai mạch") && kps[1]?.underlinedTerms.map((t) => t.text).join() === "xoắn")
  check("dòng 1 không bị dính dòng 2", !kps[0]?.content.includes("hai mạch"))
  const v = validateDocument(doc)
  check("điểm không gạch chân chỉ là cảnh báo, tài liệu vẫn hợp lệ",
    v.isValid === true && v.warnings.some((w) => /ít nhất 1 từ gạch chân/.test(w.message)))
  check("không còn lỗi 'phải có ít nhất 1 từ gạch chân' ở mức lỗi",
    !v.errors.some((e) => /ít nhất 1 từ gạch chân/.test(e.message)))
}

// ---------- Ảnh/bảng trong điểm kiến thức ----------
{
  const tables = ["<table><tr><td>Kết quả thí nghiệm</td></tr></table>"]
  const images = ['<img src="data:image/png;base64,AAAA" alt="">']
  const doc = parseTextContent(`${HEAD}- Tiến hành: @@TBL0@@ Quan sát thấy __enzyme__ được tổng hợp.`)
  attachBodyHtml(doc, images, tables)
  const kp = doc.chapters[0].lessons[0].knowledgePoints[0]
  check("bảng trong KP -> bodyHtml chứa <table>", (kp.bodyHtml ?? "").includes("<table"))
  check("nội dung KP không còn mã @@", !kp.content.includes("@@"))
  const term = kp.underlinedTerms[0]
  check("offset cụm gạch chân sau token vẫn khớp nội dung",
    term && kp.content.slice(term.start, term.end) === term.text)
  let threw = false
  try { prepareKpTermsForSave(kp.content, kp.underlinedTerms) } catch { threw = true }
  check("prepareKpTermsForSave không ném lỗi sau khi gắn bảng", !threw)
}
{
  // Token đứng một mình một dòng sau dòng KP -> thuộc về điểm đó.
  const tables = ["<table><tr><td>Bảng số liệu</td></tr></table>"]
  const doc = parseTextContent(`${HEAD}- Quan sát bảng số liệu sau về __gene__.\n@@TBL0@@\n- Điểm tiếp theo về __protein__.`)
  attachBodyHtml(doc, [], tables)
  const kps = doc.chapters[0].lessons[0].knowledgePoints
  check("token một mình một dòng gắn vào điểm trước nó", (kps[0]?.bodyHtml ?? "").includes("<table") && kps.length === 2)
  check("điểm chứa token vẫn giữ nội dung chữ sạch", kps[0]?.content === "Quan sát bảng số liệu sau về gene.")
}

// ---------- AI: chặn KP nhiều dòng ở cổng dựng ----------
{
  const bad = renderAiResult({
    chapters: [{ title: "C", lessons: [{ title: "B", knowledgePoints: [
      { content: "Dòng một.\nDòng hai.", underlines: [], questions: [] },
    ] }] }],
  })
  check("AI nộp KP 2 dòng -> bị chặn ở render", bad.problems.some((p) => /MỘT dòng duy nhất/.test(p)))
  const good = renderAiResult({
    chapters: [{ title: "C", lessons: [{ title: "B", knowledgePoints: [
      { content: "Dòng một.", underlines: [], questions: [] },
      { content: "Dòng hai.", underlines: [], questions: [] },
    ] }] }],
  })
  check("AI nộp 2 điểm đơn dòng -> dựng được", typeof good.text === "string" && good.text.includes("- Dòng một.") && good.text.includes("- Dòng hai."))
}

// ---------- AI: KP chứa token vẫn qua đối chiếu nguyên văn ----------
{
  const source = `${HEAD}- Tiến hành: @@TBL0@@ Quan sát thấy enzyme được tổng hợp khi có lactose, còn gene và protein thì không đổi.`
  const result = {
    chapters: [{ title: "Chuong 1", lessons: [{ title: "Bai 1", knowledgePoints: [
      {
        content: "Tiến hành: @@TBL0@@ Quan sát thấy enzyme được tổng hợp khi có lactose, còn gene và protein thì không đổi.",
        underlines: [{ text: "lactose", distractors: ["enzyme", "gene", "protein"] }],
        questions: [],
      },
    ] }] }],
    filledAnswers: [],
    unmatchedSolutions: [],
  }
  const rendered = renderAiResult(result)
  const parsed = parseTextContent(rendered.text)
  attachBodyHtml(parsed, [], ["<table><tr><td>x</td></tr></table>"])
  const problems = verifyAiResult(source, result, parsed)
  check("verify: KP có token + gạch chân đạt 0 vấn đề", problems.length === 0)
  const kp = parsed.chapters[0].lessons[0].knowledgePoints[0]
  check("bản dựng AI: token thành bodyHtml, chữ sạch", (kp.bodyHtml ?? "").includes("<table") && !kp.content.includes("@@"))
}

console.log(`check-kp-v19: ${pass} pass, ${fail} fail`)
if (fail > 0) process.exit(1)
