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

// §18: form file mới (1 file = 1 bài, [bài] để trống -> titleMissing +
// cảnh báo không chặn lưu) và chống trùng khi nạp cộng thêm
// (lib/append-dedupe dùng chung client/server).

const { parseTextContent, validateDocument } = await import("../lib/worksheet-parser.ts")
const { computeAppendPlan } = await import("../lib/append-dedupe.ts")

let pass = 0
let fail = 0
function check(name, cond) {
  if (cond) {
    pass++
    console.log(`  ok - ${name}`)
  } else {
    fail++
    console.log(`  FAIL - ${name}`)
  }
}

// ---------- Parser: tên bài ----------
const KP = "- ADN là đại phân tử cấu tạo theo nguyên tắc __đa phân__."
const blankDoc = parseTextContent(`[]\n${KP}`)
check("[] -> titleMissing = true", blankDoc.chapters[0].lessons[0].titleMissing === true)
check("[] -> title rong", blankDoc.chapters[0].lessons[0].title === "")
const blankSpaceDoc = parseTextContent(`[ ]\n${KP}`)
check("[ ] -> titleMissing = true", blankSpaceDoc.chapters[0].lessons[0].titleMissing === true)
const namedDoc = parseTextContent(`[ADN và ARN]\n${KP}`)
check("[Ten] -> khong titleMissing", namedDoc.chapters[0].lessons[0].titleMissing === undefined)
check("[Ten] -> title dung", namedDoc.chapters[0].lessons[0].title === "ADN và ARN")
check(
  "khong dong chuong -> chuong ngam dinh",
  blankDoc.chapters[0].title === "Chương chưa đặt tên",
)
const vBlank = validateDocument(blankDoc)
check("ten trong -> van hop le (khong loi)", vBlank.isValid === true)
check(
  "ten trong -> co canh bao nhap",
  vBlank.warnings.some((w) => /chưa có tên/i.test(w.message)),
)
const vNamed = validateDocument(namedDoc)
check(
  "ten day du -> khong canh bao ten",
  !vNamed.warnings.some((w) => /chưa có tên/i.test(w.message)),
)

// File cu 2 bai van tach duoc
const twoLessons = parseTextContent(`{Chuong 1}\n[Bai 1]\n${KP}\n[Bai 2]\n${KP}`)
check(
  "file 2 bai -> tach 2 bai",
  twoLessons.chapters[0].lessons.length === 2 &&
    twoLessons.chapters[0].lessons.every((l) => !l.titleMissing),
)

// ---------- Append dedupe ----------
function kp(content, questions = []) {
  return { content, underlinedTerms: [], questions, line: 1 }
}
function mc(content, opts) {
  return { type: "MC", content, options: opts.map((c) => ({ content: c, isCorrect: false })), line: 1 }
}
function sa(content, ans) {
  return { type: "SA", content, options: [], correctAnswer: ans, line: 1 }
}

const existingKps = [{ id: "kp1", content: "ADN có cấu trúc xoắn kép." }]
const existingQs = [
  {
    knowledgePointId: "kp1",
    type: "MC",
    content: "ADN có mấy mạch?",
    options: ["A. Một", "B. Hai"],
    correctAnswer: null,
  },
  {
    knowledgePointId: "kp1",
    type: "SA",
    content: "Đơn phân của ADN là gì?",
    options: [],
    correctAnswer: "nucleotide | nucleotit",
  },
]

// (a) KP trùng nội dung (khác hoa thường/khoảng trắng) -> gộp: 1 câu trùng + 1 câu mới
const planA = computeAppendPlan(existingKps, existingQs, [
  kp("  adn có cấu trúc   xoắn kép. ", [
    mc("ADN có mấy mạch?", ["A. Một", "B. Hai"]),
    mc("ADN nằm ở đâu?", ["A. Nhân", "B. Ribosome"]),
  ]),
])
check("a: KP trung -> targetKpId = kp1", planA.actions[0].targetKpId === "kp1")
check("a: addedKps = 0", planA.addedKps === 0)
check("a: addedQuestions = 1", planA.addedQuestions === 1)
check("a: skippedQuestions = 1", planA.skippedQuestions === 1)
check(
  "a: co canh bao gop KP",
  planA.warnings.some((w) => /đã có trong bài/i.test(w)),
)

// (b) KP mới nhưng câu trùng ở KP khác -> câu bị bỏ, KP vẫn tạo
const planB = computeAppendPlan(existingKps, existingQs, [
  kp("ARN có cấu trúc mạch đơn.", [mc("ADN có mấy mạch?", ["A. Một", "B. Hai"])]),
])
check("b: KP moi van tao", planB.addedKps === 1)
check("b: cau trung khac KP bi bo", planB.addedQuestions === 0 && planB.skippedQuestions === 1)

// (c) SA: tập đáp án chấp nhận trùng (khác thứ tự) -> trùng; khác đáp án -> không
const planC1 = computeAppendPlan(existingKps, existingQs, [
  kp("KP moi.", [sa("Đơn phân của ADN là gì?", "nucleotit | nucleotide")]),
])
check("c1: SA trung tap dap an -> bo", planC1.skippedQuestions === 1)
const planC2 = computeAppendPlan(existingKps, existingQs, [
  kp("KP moi.", [sa("Đơn phân của ADN là gì?", "nucleotide")]),
])
check("c2: SA khac dap an -> giu", planC2.addedQuestions === 1)

// (d) nạp lại nguyên file -> mọi câu trùng; trùng ngay trong cùng file nạp
const planD = computeAppendPlan(existingKps, existingQs, [
  kp("ADN có cấu trúc xoắn kép.", [
    mc("Câu mới hoàn toàn?", ["A. X", "B. Y"]),
    mc("Câu mới hoàn toàn?", ["A. X", "B. Y"]),
  ]),
])
check("d: trung trong cung file -> chi them 1", planD.addedQuestions === 1 && planD.skippedQuestions === 1)

console.log(`\ncheck-import-v18: ${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
