// Test phiên bổ sung (sualogic.md mục 10):
// 1) swap-group nhận và/hoặc có dấu + tổ hợp dấu phẩy, vẫn tách khi có chữ xen/ngắt câu
// 2) normalizeAnswer: vị trí dấu thanh kiểu cũ = kiểu mới (oa/oe/uy), giữ chốt không bỏ dấu
// 3) normalizeAnswer: ký hiệu — A - T, ->/→, chỉ số dưới/trên, 50 %, (DNA)
// 4) renderSlots legacy mất ô -> console.error "missing slots"
// 5) backfill-swap-groups: tính lại nhóm từ dữ liệu đã lưu
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

const { extractBlanks } = await import("../lib/worksheet-parser.ts")
const { normalizeAnswer, gradeSlots, gradeSA, canonicalizeTonePlacement } = await import(
  "../lib/scoring.ts"
)
const { renderSlots } = await import("../lib/slot-render.ts")
const { recomputeSwapGroupIds } = await import("./backfill-swap-groups.mjs")

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
const groupsOf = (raw) => extractBlanks(raw).underlinedTerms.map((t) => t.swapGroupId)

// ---- 1. Swap group ----
assertEq(groupsOf('__"đơn phân"__ và __"đa phân"__'), ["g1", "g1"], "và có dấu gộp nhóm")
assertEq(groupsOf('__"đơn phân"__ va __"đa phân"__'), ["g1", "g1"], "va không dấu vẫn gộp")
assertEq(groupsOf('__"A"__ hoặc __"T"__'), ["g1", "g1"], "hoặc có dấu gộp nhóm")
assertEq(groupsOf('__"A"__ HOẶC __"T"__'), ["g1", "g1"], "HOẶC hoa gộp nhóm")
assertEq(groupsOf('__"A"__, __"T"__ và __"G"__'), ["g1", "g1", "g1"], "A, T và G một nhóm")
assertEq(groupsOf('__"A"__, và __"T"__'), ["g1", "g1"], "tổ hợp phẩy + và gộp nhóm")
assertEq(groupsOf('__"A"__ và, __"T"__'), ["g1", "g1"], "tổ hợp và + phẩy gộp nhóm")
assertEq(groupsOf('__"A"__ và __"T"__ và __"G"__'), ["g1", "g1", "g1"], "chuỗi và gộp hết")
{
  const { underlinedTerms } = extractBlanks('__"đơn phân"__ và __"đa phân"__')
  const r = gradeSlots(underlinedTerms, ["đa phân", "đơn phân"])
  assert(r.allCorrect, "nhóm và: điền đảo thứ tự phải đúng")
}
assertEq(
  groupsOf('Bazơ __"timin"__ bổ sung với bazơ __"xitozin"__.'),
  [null, null],
  "chữ xen dài vẫn tách nhóm (ca phiên 2)",
)
assertEq(groupsOf('__"A"__; __"T"__'), [null, null], "dấu ; vẫn tách nhóm")
assertEq(groupsOf('__"A"__. __"T"__'), [null, null], "dấu . vẫn tách nhóm")

// ---- 2. Vị trí dấu thanh ----
const tonePairs = [
  ["hoá", "hóa"],
  ["thuỷ", "thủy"],
  ["hoà", "hòa"],
  ["khoẻ", "khỏe"],
  ["tuỳ", "tùy"],
  ["huỷ", "hủy"],
  ["oà", "òa"],
  ["hòan", "hoàn"], // kiểu sai ở âm tiết đóng cũng được đưa về một chuẩn
]
for (const [a, b] of tonePairs) {
  assertEq(normalizeAnswer(a), normalizeAnswer(b), `dấu thanh: ${a} = ${b}`)
}
assertEq(canonicalizeTonePlacement("hoá học"), "hóa học", "canonicalizeTonePlacement hoá học")
assertEq(normalizeAnswer("hoàn"), normalizeAnswer("hoàn"), "hoàn giữ nguyên")
assertEq(normalizeAnswer("hoán đổi"), "hoán đổi", "âm tiết đóng không bị di chuyển dấu")
assertEq(normalizeAnswer("huỳnh"), normalizeAnswer("huỳnh"), "huỳnh giữ nguyên")
assertEq(normalizeAnswer("quý"), normalizeAnswer("quý"), "quý giữ nguyên")
assert(normalizeAnswer("quý") !== normalizeAnswer("qúy"), "quý khác qúy (u thuộc âm đầu qu)")
assert(normalizeAnswer("ngoài") === normalizeAnswer("ngoài"), "ngoài (oai) giữ nguyên")
assert(
  normalizeAnswer("nucleotit") !== normalizeAnswer("nuclêôtit"),
  "CHỐT sualogic: không bỏ dấu — nucleotit khác nuclêôtit",
)
{
  const terms = [{ text: "hoá học", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  assert(gradeSlots(terms, ["hóa học"]).allCorrect, "gradeSlots: HS gõ hóa học, đáp án hoá học -> đúng")
  assert(gradeSA("thủy phân", ["thuỷ phân"]), "gradeSA: thủy phân = thuỷ phân")
}

// ---- 3. Ký hiệu & khoảng trắng ----
const symbolPairs = [
  ["A - T", "A-T"],
  ["5′→3′", "5'->3'"],
  ["5'→3'", "5'->3'"],
  ["CO₂", "CO2"],
  ["H₂O", "H2O"],
  ["50 %", "50%"],
  ["(DNA)", "DNA"],
  ["(DNA).", "DNA"],
  ["X¹⁰", "X10"],
]
for (const [a, b] of symbolPairs) {
  assertEq(normalizeAnswer(a), normalizeAnswer(b), `ký hiệu: ${a} = ${b}`)
  assert(gradeSA(a, [b]), `gradeSA ký hiệu: ${a} = ${b}`)
}
assert(normalizeAnswer("0,5") !== normalizeAnswer("0.5"), "CHỐT sualogic: normalize không đổi 0,5")
assert(gradeSA("0,5", ["0.5"]), "gradeSA số: 0,5 = 0.5")
assert(!gradeSA("1/2", ["0.5"]), "CHỐT sualogic: 1/2 khác 0.5")
assert(normalizeAnswer("1 500") !== normalizeAnswer("1500"), "1 500 vẫn khác 1500")

// ---- 4. renderSlots legacy mất ô -> error log ----
{
  const content = "ADN gồm đơn phân và đa phân."
  const terms = [
    { text: "đơn phân", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [], start: 999, end: 1007 },
    { text: "không tồn tại", slotIndex: 1, allowSwap: false, swapGroupId: null, extraAccepted: [], start: 1008, end: 1020 },
  ]
  const errors = []
  const origError = console.error
  const origWarn = console.warn
  console.error = (...a) => errors.push(a)
  console.warn = () => {}
  const parts = renderSlots(content, terms)
  console.error = origError
  console.warn = origWarn
  const slotIdx = parts.filter((p) => p.type === "slot").map((p) => p.term.slotIndex)
  assertEq(slotIdx, [0], "legacy vẫn mất ô không tìm thấy (hành vi render không đổi)")
  assert(
    errors.some((a) => String(a[0]).includes("missing slots") && JSON.stringify(a[1]?.missing) === "[1]"),
    `phải có console.error missing slots [1], got ${JSON.stringify(errors)}`,
  )
}

// ---- 5. Backfill swap groups ----
{
  const raw = '__"đơn phân"__ và __"đa phân"__'
  const { content, underlinedTerms } = extractBlanks(raw)
  const stale = underlinedTerms.map((t) => ({ ...t, swapGroupId: null })) // dữ liệu cũ: chưa gộp
  const r = recomputeSwapGroupIds(content, stale)
  assert(!r.unmatched, "backfill: offset hợp lệ")
  assert(r.changed, "backfill: phát hiện thay đổi")
  assertEq(r.terms.map((t) => t.swapGroupId), ["g1", "g1"], "backfill: gộp nhóm và")
  const again = recomputeSwapGroupIds(content, r.terms)
  assert(!again.changed, "backfill: chạy lại lần 2 không đổi nữa (idempotent)")
  const broken = recomputeSwapGroupIds(content, stale.map((t) => ({ ...t, start: 999, end: 1000 })))
  assert(broken.unmatched, "backfill: offset lệch -> needsReview, không đoán")
}

// ---- 6. BUG-05 (mục 11): toán tử + số trong accepts của điền khuyết ----
const opPairs = [
  ["A=T", "A = T"],
  ["G≡C", "G ≡ C"],
  ["A+T", "A + T"],
  ["A/T", "A / T"],
  ["n=23", "n = 23"],
  ["9:3:3:1", "9 : 3 : 3 : 1"],
  ["3:1", "3 : 1"],
  ["AaBb x aabb", "AaBb × aabb"],
  ["Aa × Aa", "Aa x Aa"],
]
for (const [a, b] of opPairs) {
  assertEq(normalizeAnswer(a), normalizeAnswer(b), `BUG-05 toán tử: ${a} = ${b}`)
  const terms = [{ text: b, slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  assert(gradeSlots(terms, [a]).allCorrect, `BUG-05 gradeSlots: gõ "${a}", đáp án "${b}" -> đúng`)
}
// Đối chứng x -> ×: chỉ đổi khi x đứng độc lập giữa hai token chữ/số.
assertEq(normalizeAnswer("xitozin"), "xitozin", "BUG-05 đối chứng: x trong từ không đổi")
assertEq(normalizeAnswer("gen x"), "gen x", "BUG-05 đối chứng: x cuối câu không đổi")
assertEq(normalizeAnswer("x quang"), "x quang", "BUG-05 đối chứng: x đầu câu không đổi")
assertEq(normalizeAnswer("ax b"), "ax b", "BUG-05 đối chứng: không có x độc lập")
// Số thuần trong accepts (điền khuyết): 0,5 = 0.5 — THAY ĐỔI quyết định cũ
// "0,5 chỉ ở gradeSA" (xem sualogic.md mục 11). Các chốt cũ vẫn giữ:
{
  const t05 = [{ text: "0,5", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  assert(gradeSlots(t05, ["0.5"]).allCorrect, "BUG-05: điền khuyết 0,5 = 0.5")
  assert(gradeSlots(t05, ["0,50"]).allCorrect, "BUG-05: điền khuyết 0,5 = 0,50")
  const tFrac = [{ text: "1/2", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  assert(!gradeSlots(tFrac, ["0.5"]).allCorrect, "BUG-05 CHỐT: 1/2 vẫn khác 0.5 ở điền khuyết")
  const t1500 = [{ text: "1 500", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  assert(!gradeSlots(t1500, ["1500"]).allCorrect, "BUG-05 CHỐT: '1 500' vẫn khác 1500 ở điền khuyết")
  const tNu = [{ text: "nuclêôtit", slotIndex: 0, allowSwap: false, swapGroupId: null, extraAccepted: [] }]
  assert(!gradeSlots(tNu, ["nucleotit"]).allCorrect, "BUG-05 CHỐT: nucleotit vẫn khác nuclêôtit")
}

console.log("bo sung OK")
