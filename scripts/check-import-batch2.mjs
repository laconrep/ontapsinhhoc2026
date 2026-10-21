// Test batch 2 (sualogic.md mục 11) — import / render / actions:
// BUG-01: chuẩn hóa + kiểm tra offset khi lưu KP; KP lệch offset bị loại khỏi Tab 2/3
// BUG-02: import giữ liên kết câu hỏi <-> KP, bọc transaction (đối chiếu nguồn)
// BUG-08: đáp án SA dạng "x | y"
// BUG-10: chấm SA bằng đáp án đầy đủ (đối chiếu nguồn)
// BUG-11: snapshot Tab 4 lưu stem (đã xác minh + đối chiếu nguồn)
// BUG-13: Enter khi đang gõ Telex/VNI (đối chiếu nguồn)
// BUG-15: validateOptions chặn option rỗng; updateQuestion giữ difficulty (đối chiếu nguồn)
import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync } from "node:fs"

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

const { splitSaAcceptedAnswers } = await import("../lib/worksheet-parser.ts")
const { gradeSA } = await import("../lib/scoring.ts")
const { prepareKpTermsForSave, slotRenderMismatch, renderClientSlots } = await import(
  "../lib/slot-render.ts"
)

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}
function assertEq(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
  }
}
function srcIncludes(file, needle, msg) {
  const src = readFileSync(resolve(root, file), "utf8")
  assert(src.includes(needle), `${msg} — thiếu "${needle}" trong ${file}`)
}
function srcExcludes(file, needle, msg) {
  const src = readFileSync(resolve(root, file), "utf8")
  assert(!src.includes(needle), `${msg} — vẫn còn "${needle}" trong ${file}`)
}

// ---- BUG-01: term NFD + content NFC (ca tái hiện của spec) ----
{
  const content = "ADN mã hóa thông tin di truyền." // NFC
  const nfcText = "mã hóa"
  const start = content.indexOf(nfcText)
  const storedTerm = {
    text: nfcText.normalize("NFD"), // DB lưu NFD
    slotIndex: 0,
    allowSwap: false,
    swapGroupId: null,
    extraAccepted: [],
    start,
    end: start + nfcText.length, // end tính theo bản NFC
  }
  assert(
    slotRenderMismatch(content, [storedTerm]),
    "BUG-01: term NFD + content NFC phải bị phát hiện lệch ô (loại khỏi getTab2/3)",
  )
  const parts = renderClientSlots(content, [storedTerm])
  assertEq(
    parts.filter((p) => p.type === "slot").length,
    0,
    "BUG-01: ô NFD không dựng được bằng legacy indexOf",
  )
  // Lưu lại qua prepareKpTermsForSave: chuẩn hóa NFC -> khớp, được sửa.
  const prepared = prepareKpTermsForSave(content, [storedTerm])
  assertEq(prepared.terms[0].text, nfcText, "BUG-01: term được chuẩn hóa về NFC khi lưu")
  assert(!slotRenderMismatch(prepared.content, prepared.terms), "BUG-01: sau khi lưu chuẩn, ô dựng đủ")
}
// ---- BUG-01: KP hợp lệ không bị ảnh hưởng; offset lệch hẳn -> từ chối lưu ----
{
  const content = "Đơn phân là nucleotide."
  const text = "nucleotide"
  const start = content.indexOf(text)
  const good = {
    text,
    slotIndex: 0,
    allowSwap: false,
    swapGroupId: null,
    extraAccepted: [],
    start,
    end: start + text.length,
  }
  const prepared = prepareKpTermsForSave(content, [good])
  assertEq(prepared.content, content, "BUG-01: KP hợp lệ giữ nguyên content")
  assert(!slotRenderMismatch(prepared.content, prepared.terms), "BUG-01: KP hợp lệ dựng đủ ô")

  let threw = false
  try {
    prepareKpTermsForSave(content, [{ ...good, start: 0, end: 3 }])
  } catch {
    threw = true
  }
  assert(threw, "BUG-01: offset lệch hẳn phải bị từ chối lưu (không tin client)")
}
// Đối chiếu nguồn: server actions dùng prepareKpTermsForSave + loại KP lệch.
srcIncludes("app/actions/content.ts", "prepareKpTermsForSave", "BUG-01/12: create/update KP phải kiểm tra offset phía server")
srcIncludes("app/actions/student-learn.ts", "slotRenderMismatch", "BUG-01: getTab2/3 phải loại KP lệch ô")
srcIncludes("app/actions/student-learn.ts", "getTab2Questions: loại KP vì số ô hiển thị khác số term", "BUG-01: loại KP ở Tab 2 phải ghi log kèm kpId")
srcIncludes("app/actions/student-learn.ts", "getTab3Questions: loại KP vì số ô hiển thị khác số term", "BUG-01: loại KP ở Tab 3 phải ghi log kèm kpId")
srcIncludes("components/student/tab2-fill-in.tsx", "slots.length === 0", "BUG-01: Tab 2 không render nút Kiểm tra khi 0 ô")
srcIncludes("components/student/tab3-drag-drop.tsx", "slots.length === 0", "BUG-01: Tab 3 không render nút Kiểm tra khi 0 ô")

// ---- BUG-02: import liên kết KP + transaction (đối chiếu nguồn) ----
srcIncludes("lib/worksheet-import.ts", "db.transaction", "BUG-02: persistParseResult phải bọc transaction")
srcIncludes("lib/worksheet-import.ts", ".returning({ id: knowledgePoints.id })", "BUG-02: insert KP phải lấy id")
srcIncludes("lib/worksheet-import.ts", "knowledgePointId: kpRow.id", "BUG-02: câu hỏi phải gán knowledgePointId của KP chứa nó")
srcExcludes("lib/worksheet-import.ts", "knowledgePointId: null", "BUG-02: không còn gán cứng knowledgePointId null")

// ---- BUG-08: SA nhiều đáp án ----
{
  const accepted = splitSaAcceptedAnswers("nucleotide | nucleotit")
  assertEq(accepted, ["nucleotide", "nucleotit"], "BUG-08: tách 'x | y' thành 2 đáp án")
  assert(gradeSA("nucleotide", accepted), "BUG-08: gõ vế 1 đúng")
  assert(gradeSA("nucleotit", accepted), "BUG-08: gõ vế 2 đúng")
  assert(!gradeSA("adenine", accepted), "BUG-08: đáp án khác vẫn sai")
  assertEq(splitSaAcceptedAnswers("nucleotide"), ["nucleotide"], "BUG-08: đáp án đơn giữ nguyên")
  assertEq(splitSaAcceptedAnswers(" x | x | "), ["x"], "BUG-08: bỏ rỗng + trùng")
  srcIncludes("lib/worksheet-import.ts", "splitSaAcceptedAnswers(pQ.correctAnswer)", "BUG-08: import SA phải tách đáp án theo |")
}

// ---- BUG-10: chấm SA đầy đủ, chỉ cắt khi lưu (đối chiếu nguồn) ----
srcIncludes(
  "app/actions/student-learn.ts",
  "const isCorrect = val.length > 0 ? gradeSA(val, accepted) : false",
  "BUG-10: submitQuiz phải chấm bằng đáp án đầy đủ",
)
srcExcludes("app/actions/student-learn.ts", "gradeSA(truncated", "BUG-10: không còn chấm bằng bản cắt 200 ký tự")

// ---- BUG-11: snapshot lưu stem (đối chiếu nguồn) ----
// Đã xác minh trong code: nhánh mở lại attempt lấy content từ DB hiện tại
// (live?.content) còn options từ snapshot -> GV sửa/xóa câu giữa chừng làm
// đề lệch/rỗng. Nay snapshot lưu stem và nhánh mở lại ưu tiên snap.stem.
srcIncludes("app/actions/student-learn.ts", "stem: q.content", "BUG-11: startQuiz phải lưu stem vào snapshot")
srcIncludes("app/actions/student-learn.ts", "snap?.stem ?? live?.content", "BUG-11: mở lại attempt phải ưu tiên stem trong snapshot")
srcIncludes("lib/db/schema.ts", "stem?: string", "BUG-11: kiểu snapshot phải có stem")

// ---- BUG-13: Enter khi IME đang composition (đối chiếu nguồn) ----
srcIncludes("components/student/tab2-fill-in.tsx", "e.nativeEvent.isComposing", "BUG-13: Tab 2 phải bỏ qua Enter khi đang gõ Telex/VNI")

// ---- BUG-15: option rỗng + giữ difficulty (đối chiếu nguồn) ----
srcIncludes("app/actions/questions.ts", "Lựa chọn không được để trống", "BUG-15: validateOptions phải chặn option rỗng")
srcIncludes("app/actions/questions.ts", "input.difficulty ?? q.difficulty", "BUG-15: updateQuestion phải giữ difficulty khi không gửi")

console.log("import batch2 OK")
