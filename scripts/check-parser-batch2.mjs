// Test batch 2 (sualogic.md mục 11) — parser:
// BUG-04: nhóm hoán đổi với nhãn lặp (câu gene cấu trúc) + cảnh báo
// BUG-06: dãy gạch dưới dài không thành ô rác, validate báo lỗi
// BUG-07: tách option MC/TF chứa mẫu giống nhãn ("B. là nhóm máu hiếm")
// BUG-09: gạch chân một phần phương án -> lỗi validate; bao trọn -> hợp lệ
// Kiểm chứng tổng hợp (spec mục 8): câu gene cấu trúc, đúng/đảo thứ tự, hoá/hòa.
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

const { extractBlanks, parseTextContent, validateDocument } = await import("../lib/worksheet-parser.ts")
const { gradeSlots } = await import("../lib/scoring.ts")

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

function docWithKp(kpLine, extra = "") {
  return parseTextContent(`{C}\n[B]\n${kpLine}\n${extra}`)
}
function firstKp(result) {
  return result.chapters[0].lessons[0].knowledgePoints[0]
}

// ---- BUG-04: câu gene cấu trúc, nhãn NGOÀI ô ----
{
  const raw =
    'Cấu trúc của một gene cấu trúc gồm 3 vùng là vùng __"điều hòa"__, vùng __"mã hóa"__, vùng __"kết thúc"__'
  const { underlinedTerms } = extractBlanks(raw)
  assertEq(
    underlinedTerms.map((t) => t.swapGroupId),
    ["g1", "g1", "g1"],
    "BUG-04: nhãn lặp 'vùng' phải gộp 3 ô thành 1 nhóm",
  )
  assert(
    gradeSlots(underlinedTerms, ["mã hóa", "điều hòa", "kết thúc"]).allCorrect,
    "BUG-04: điền đảo thứ tự (nhãn ngoài ô) vẫn đúng",
  )
  assert(
    gradeSlots(underlinedTerms, ["điều hòa", "mã hóa", "kết thúc"]).allCorrect,
    "BUG-04: điền đúng thứ tự vẫn đúng",
  )
}
// ---- BUG-04: nhãn TRONG ô ----
{
  const raw =
    'Cấu trúc của một gene cấu trúc gồm 3 vùng là __"vùng điều hòa"__, __"vùng mã hóa"__, __"vùng kết thúc"__'
  const { underlinedTerms } = extractBlanks(raw)
  assertEq(
    underlinedTerms.map((t) => t.swapGroupId),
    ["g1", "g1", "g1"],
    "BUG-04: nhãn trong ô (dấu nối thường) vẫn một nhóm",
  )
  assert(
    gradeSlots(underlinedTerms, ["vùng mã hóa", "vùng điều hòa", "vùng kết thúc"]).allCorrect,
    "BUG-04: điền đảo thứ tự (nhãn trong ô) vẫn đúng",
  )
}
// ---- BUG-04: không ngoặc kép -> không hoán đổi + có cảnh báo nhãn lặp ----
{
  const result = docWithKp(
    "- Cấu trúc của một gene cấu trúc gồm 3 vùng là vùng __điều hòa__, vùng __mã hóa__, vùng __kết thúc__",
  )
  const kp = firstKp(result)
  assertEq(
    kp.underlinedTerms.map((t) => t.swapGroupId),
    [null, null, null],
    "BUG-04: ô cố định (không ngoặc kép) không thành nhóm hoán đổi",
  )
  const v = validateDocument(result)
  assert(
    v.warnings.some((w) => /chưa bật hoán đổi/.test(w.message)),
    `BUG-04: phải cảnh báo danh sách chưa bật hoán đổi, got ${JSON.stringify(v.warnings)}`,
  )
}
// ---- BUG-04: nhóm nhờ nhãn lặp -> có cảnh báo rà soát ở validate ----
{
  const result = docWithKp(
    '- Cấu trúc của một gene cấu trúc gồm 3 vùng là vùng __"điều hòa"__, vùng __"mã hóa"__, vùng __"kết thúc"__',
  )
  const v = validateDocument(result)
  assert(
    v.warnings.some((w) => /nhãn lặp/.test(w.message) && /gộp nhờ nhãn lặp/.test(w.message)),
    `BUG-04: phải cảnh báo nhóm gộp nhờ nhãn lặp, got ${JSON.stringify(v.warnings)}`,
  )
}
// ---- BUG-04: "và" dạng NFD giữa hai ô vẫn gộp (NFC trước khi xét regex) ----
{
  const raw = '__"A"__ và __"B"__'.normalize("NFD")
  const { underlinedTerms } = extractBlanks(raw)
  assertEq(
    underlinedTerms.map((t) => t.swapGroupId),
    ["g1", "g1"],
    "BUG-04: 'và' NFD vẫn gộp nhóm",
  )
}
// ---- BUG-04: ca cũ giữ nguyên — chữ xen khác vẫn tách nhóm ----
{
  const { underlinedTerms } = extractBlanks('Bazơ __"timin"__ bổ sung với bazơ __"xitozin"__.')
  assertEq(
    underlinedTerms.map((t) => t.swapGroupId),
    [null, null],
    "BUG-04 đối chứng: 'bổ sung với bazơ' (4 từ) vẫn tách nhóm",
  )
}

// ---- BUG-06: dãy gạch dưới dài ----
{
  const { content, underlinedTerms } = extractBlanks("ADN có ________ là đơn phân và mạch ______ xoắn.")
  assertEq(underlinedTerms.length, 0, "BUG-06: ________ không tạo term rác")
  assert(content.includes("________"), "BUG-06: dãy gạch dưới giữ nguyên trong content để báo lỗi")
  const result = docWithKp("- ADN có ________ là đơn phân")
  const v = validateDocument(result)
  assert(!v.isValid, "BUG-06: tài liệu có ________ trong KP phải không hợp lệ")
  assert(
    v.errors.some((e) => /gạch dưới/.test(e.message) && /__đáp án__/.test(e.message)),
    `BUG-06: lỗi phải chỉ rõ và hướng dẫn viết __đáp án__, got ${JSON.stringify(v.errors)}`,
  )
}
{
  const { underlinedTerms } = extractBlanks("ADN có ____ là đơn phân.")
  assertEq(underlinedTerms.length, 0, "BUG-06: ____ (4 dấu) không tạo ô")
  const result = docWithKp("- ADN có _______.")
  const v = validateDocument(result)
  assert(!v.isValid, "BUG-06: _______. trong KP phải báo lỗi")
}
{
  // ________ trong ĐỀ câu hỏi là cách viết bình thường — được phép, không thành ô KP.
  const result = docWithKp(
    "- ADN cấu tạo theo nguyên tắc __đa phân__",
    "#\ncau: Điền vào chỗ trống: ADN có ________ là đơn phân\nA. nucleotide\n__B. nucleotide__\nC. axit amin\nD. glucose",
  )
  const kp = firstKp(result)
  assertEq(kp.underlinedTerms.length, 1, "BUG-06: ________ ở đề không thành ô điền khuyết")
  const v = validateDocument(result)
  assert(
    !v.errors.some((e) => /gạch dưới/.test(e.message)),
    `BUG-06: ________ ở đề câu hỏi không bị báo lỗi gạch dưới, got ${JSON.stringify(v.errors)}`,
  )
}

// ---- BUG-07: option chứa mẫu giống nhãn ----
function mcDoc(optionLines) {
  return docWithKp("- KP __x__", `#\ncau: Nhóm máu nào hiếm?\n${optionLines}`)
}
{
  const q = firstKp(
    mcDoc("A. Nhóm B. là nhóm máu hiếm\nB. Nhóm A\nC. Nhóm O\nD. Nhóm AB"),
  ).questions[0]
  assertEq(
    q.options.map((o) => o.content),
    ["A. Nhóm B. là nhóm máu hiếm", "B. Nhóm A", "C. Nhóm O", "D. Nhóm AB"],
    "BUG-07: mỗi option một dòng — A chứa 'B.' vẫn nguyên vẹn",
  )
}
{
  const q = firstKp(
    mcDoc("A. Nhóm B. là nhóm máu hiếm B. Nhóm A C. Nhóm O D. Nhóm AB"),
  ).questions[0]
  assertEq(
    q.options.map((o) => o.content),
    ["A. Nhóm B. là nhóm máu hiếm", "B. Nhóm A", "C. Nhóm O", "D. Nhóm AB"],
    "BUG-07: gộp một dòng — A chứa 'B.' vẫn nguyên vẹn",
  )
}
{
  // TF: ý chứa mẫu "b." trong nội dung
  const result = docWithKp(
    "- KP __x__",
    "##\ncau: Chọn đúng/sai:\na. Mạch b. là mạch khuôn\n__b. Mạch mới tổng hợp__\nc. Ý c\nd. Ý d",
  )
  const q = firstKp(result).questions[0]
  assertEq(q.options.length, 4, "BUG-07 TF: vẫn đủ 4 ý")
  assertEq(
    q.options[0].content,
    "a) Mạch b. là mạch khuôn",
    `BUG-07 TF: ý a nguyên vẹn, got ${JSON.stringify(q.options.map((o) => o.content))}`,
  )
}
{
  // Cảnh báo khi nội dung option chứa mẫu giống nhãn
  const result = mcDoc("A. Nhóm B. là nhóm máu hiếm\nB. Nhóm A\nC. Nhóm O\nD. Nhóm AB")
  const v = validateDocument(result)
  assert(
    v.warnings.some((w) => /giống nhãn/.test(w.message)),
    `BUG-07: phải cảnh báo option chứa mẫu giống nhãn, got ${JSON.stringify(v.warnings)}`,
  )
}

// ---- BUG-09: gạch chân một phần phương án -> lỗi; bao trọn -> hợp lệ ----
{
  const result = docWithKp(
    "- KP __x__",
    "#\ncau: ADN có cấu trúc?\nA. ADN có cấu trúc __xoắn kép__\nB. Một mạch\nC. Vòng\nD. Thẳng",
  )
  const q = firstKp(result).questions[0]
  assertEq(q.options[0].underlinePartial, true, "BUG-09: gạch một phần phải bị đánh dấu underlinePartial")
  const v = validateDocument(result)
  assert(!v.isValid, "BUG-09: gạch chân một phần phương án phải chặn validate")
  assert(
    v.errors.some((e) => /chỉ bao một phần/.test(e.message)),
    `BUG-09: thông báo lỗi phải nói rõ gạch chân một phần, got ${JSON.stringify(v.errors)}`,
  )
}
{
  const result = docWithKp(
    "- KP __x__",
    "#\ncau: ADN có cấu trúc?\n__A. ADN có cấu trúc xoắn kép__\nB. Một mạch\nC. Vòng\nD. Thẳng",
  )
  const q = firstKp(result).questions[0]
  assertEq(q.options[0].isCorrect, true, "BUG-09: gạch trọn phương án vẫn là đáp án đúng")
  assert(!q.options[0].underlinePartial, "BUG-09: gạch trọn phương án không phải underlinePartial")
  const v = validateDocument(result)
  assert(
    !v.errors.some((e) => /chỉ bao một phần/.test(e.message)),
    "BUG-09: gạch trọn phương án không bị báo lỗi",
  )
}
{
  // Gạch trọn phần nội dung sau nhãn (không gạch nhãn) cũng hợp lệ.
  const result = docWithKp(
    "- KP __x__",
    "#\ncau: ADN có cấu trúc?\nA. Một mạch\nB. __Xoắn kép__\nC. Vòng\nD. Thẳng",
  )
  const q = firstKp(result).questions[0]
  assertEq(q.options[1].isCorrect, true, "BUG-09: gạch nội dung sau nhãn vẫn là đáp án")
  assert(!q.options[1].underlinePartial, "BUG-09: gạch trọn nội dung sau nhãn không phải underlinePartial")
}

// ---- Kiểm chứng tổng hợp (spec mục 8) ----
{
  const raw =
    'Cấu trúc của một gene cấu trúc gồm 3 vùng là vùng __"điều hòa"__, vùng __"mã hóa"__, vùng __"kết thúc"__'
  const { underlinedTerms } = extractBlanks(raw)
  assert(gradeSlots(underlinedTerms, ["điều hòa", "mã hóa", "kết thúc"]).allCorrect, "TỔNG HỢP: đúng thứ tự")
  assert(gradeSlots(underlinedTerms, ["kết thúc", "mã hóa", "điều hòa"]).allCorrect, "TỔNG HỢP: đảo thứ tự")
  assert(gradeSlots(underlinedTerms, ["điều hoà", "mã hóa", "kết thúc"]).allCorrect, "TỔNG HỢP: điều hoà (dấu kiểu cũ)")
  assert(
    !gradeSlots(underlinedTerms, ["điều hòa", "mã hóa", "sai"]).allCorrect,
    "TỔNG HỢP: đáp án sai vẫn sai",
  )
}

console.log("parser batch2 OK")
