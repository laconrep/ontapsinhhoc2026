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

// BUG-14: bảng alias thuật ngữ đã duyệt (gene/gen, ADN/DNA, ARN/RNA,
// mARN/mRNA) áp trong accepts (điền khuyết Tab 2 + kéo thả Tab 3 qua
// gradeSlots) và gradeSA (câu SA + live quiz). So khớp theo TỪ NGUYÊN
// VẸN, không theo chuỗi con; ngoài danh sách đã duyệt không tự suy.

const { gradeSlots, gradeSA, canonicalizeTermAliases, normalizeAnswer, TERM_ALIASES } =
  await import("../lib/scoring.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}
function assertEq(actual, expected, label) {
  if (actual !== expected)
    fail(`${label}\n  got:      ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
}

const term = (text, extra = {}) => ({
  text,
  slotIndex: 0,
  allowSwap: false,
  swapGroupId: null,
  extraAccepted: [],
  ...extra,
})
const fillOk = (text, answer) => gradeSlots([term(text)], { 0: answer }).allCorrect

// 0. Bảng alias đúng 4 cặp đã duyệt, khoá theo dạng sau normalizeAnswer.
assertEq(TERM_ALIASES.length, 4, "TERM_ALIASES phai co dung 4 cap da duyet")

// 1. Bốn cặp bằng nhau ở cả hai chiều — đường SA (gradeSA).
const pairs = [
  ["gene", "gen"],
  ["ADN", "DNA"],
  ["ARN", "RNA"],
  ["mARN", "mRNA"],
]
for (const [a, b] of pairs) {
  assert(gradeSA(b, [a]), `SA: hoc sinh "${b}" vs dap an "${a}" phai dung`)
  assert(gradeSA(a, [b]), `SA: hoc sinh "${a}" vs dap an "${b}" phai dung`)
  // Không phân biệt hoa/thường ở cả hai vế.
  assert(gradeSA(b.toLowerCase(), [a.toUpperCase()]), `SA hoa/thuong: "${b}" vs "${a}"`)
  assert(gradeSA(a.toUpperCase(), [b.toLowerCase()]), `SA hoa/thuong: "${a}" vs "${b}"`)
}

// 2. Bốn cặp bằng nhau ở cả hai chiều — đường điền khuyết (gradeSlots/accepts).
for (const [a, b] of pairs) {
  assert(fillOk(a, b), `Fill: o "${a}", hoc sinh dien "${b}" phai dung`)
  assert(fillOk(b, a), `Fill: o "${b}", hoc sinh dien "${a}" phai dung`)
}

// 3. Alias nằm trong câu nhiều từ (thay theo từng từ nguyên vẹn).
assert(
  gradeSA("quá trình phiên mã tạo mRNA", ["quá trình phiên mã tạo mARN"]),
  "SA nhieu tu: mARN trong cau dai phai khop mRNA",
)
assert(
  gradeSA("DNA tái bản bán bảo toàn", ["ADN tái bản bán bảo toàn"]),
  "SA nhieu tu: ADN dau cau phai khop DNA",
)
assert(fillOk("ADN polymerase", "DNA polymerase"), "Fill nhieu tu: ADN polymerase = DNA polymerase")
assert(fillOk("DNA polymerase", "ADN polymerase"), "Fill nhieu tu chieu nguoc")
// Alias trong extraAccepted/synonyms của ô cũng được công nhận.
assert(
  gradeSlots([term("x", { synonyms: ["mARN"] })], { 0: "mRNA" }).allCorrect,
  "Fill: synonyms mARN phai khop mRNA qua alias",
)

// 4. Nhóm hoán đổi + alias: học sinh vừa đảo vị trí vừa dùng alias vẫn đúng.
const swapTerms = [
  term("ADN", { slotIndex: 0, allowSwap: true, swapGroupId: "g1" }),
  term("ARN", { slotIndex: 1, allowSwap: true, swapGroupId: "g1" }),
]
assert(
  gradeSlots(swapTerms, { 0: "RNA", 1: "DNA" }).allCorrect,
  "Swap+alias: dao vi tri ADN/ARN va go DNA/RNA phai dung het",
)

// 5. KHÔNG được bằng — chuỗi con không tính là từ nguyên vẹn.
assert(!gradeSA("genetics", ["gen"]), "SA: 'genetics' khong duoc bang 'gen' (chuoi con)")
assert(!gradeSA("gen", ["genetics"]), "SA: 'gen' khong duoc bang 'genetics'")
assert(!gradeSA("genome", ["gen"]), "SA: 'genome' khong duoc bang 'gen'")
assert(!fillOk("gen", "genetics"), "Fill: 'genetics' khong duoc bang o 'gen'")
assert(!fillOk("genetics", "gen"), "Fill: 'gen' khong duoc bang o 'genetics'")
assert(!gradeSA("gen1", ["gen"]), "SA: 'gen1' khong duoc bang 'gen' (tu dinh so)")

// 6. KHÔNG được bằng — các chốt cũ giữ nguyên.
assert(!gradeSA("nuclêôtit", ["nucleotit"]), "SA: nucleotit ≠ nuclêôtit (khong boc dau)")
assert(!fillOk("nucleotit", "nuclêôtit"), "Fill: nucleotit ≠ nuclêôtit")
assert(!gradeSA("0.5", ["1/2"]), "SA: 1/2 ≠ 0.5")
assert(!fillOk("0.5", "1/2"), "Fill: dap an 1/2, hoc sinh 0.5 phai sai")
assert(!fillOk("1500", "1 500"), "Fill: '1 500' ≠ 1500")

// 7. KHÔNG tự suy cặp ngoài danh sách đã duyệt.
assert(!gradeSA("prôtêin", ["protein"]), "SA: protein/prôtêin ngoai alias — khong duoc bang")
assert(!gradeSA("protein", ["prôtêin"]), "SA chieu nguoc: protein/prôtêin van khac nhau")
assert(!gradeSA("enzim", ["enzyme"]), "SA: enzim/enzyme ngoai alias — khong duoc bang")

// 8. canonicalizeTermAliases là identity khi không có alias (chốt cũ an toàn).
assertEq(canonicalizeTermAliases(normalizeAnswer("nucleotit")), "nucleotit", "identity: nucleotit")
assertEq(canonicalizeTermAliases("genetics"), "genetics", "identity: genetics")
assertEq(canonicalizeTermAliases(normalizeAnswer("ADN")), "adn", "ADN -> dai dien adn? (kiem tra o duoi)")
assertEq(canonicalizeTermAliases(normalizeAnswer("DNA")), "adn", "DNA -> dai dien chung 'adn'")

console.log("check-alias: PASS")
