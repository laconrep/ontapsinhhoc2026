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

// BUG-12 (chính sách reset ĐÃ CHỐT): updateKnowledgePoint reset tiến độ
// học sinh của KP khi "chữ ký nội dung chấm" (kpGradingSignature) thay
// đổi. Định nghĩa chữ ký — xem lib/scoring.ts: tập đáp án chấp nhận đã
// normalize của từng ô + phân hoạch nhóm hoán đổi, sắp xếp ở mọi cấp
// nên thứ tự mảng/tên nhóm không ảnh hưởng; sửa định dạng đã được
// normalizeAnswer gộp cũng không ảnh hưởng.

const { kpGradingSignature } = await import("../lib/scoring.ts")

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}

let seq = 0
const term = (text, extra = {}) => ({
  text,
  slotIndex: seq++,
  allowSwap: false,
  swapGroupId: null,
  extraAccepted: [],
  ...extra,
})
const sig = (terms) => kpGradingSignature(terms)

// 1. Cùng nội dung -> cùng chữ ký, kể cả khi thứ tự term trong mảng đổi
//    (thứ tự mảng không ảnh hưởng chấm: gradeSlots gom theo
//    swapGroupId/slotIndex và sắp xếp kết quả theo slotIndex).
seq = 0
const a1 = term("ADN")
const a2 = term("ARN", { synonyms: ["RNA"] })
const base = [a1, a2]
assert(sig(base) === sig([a2, a1]), "Doi thu tu mang term: chu ky phai GIONG")
assert(sig(base) === sig(base.map((t) => ({ ...t }))), "Copy y het: chu ky phai GIONG")
assert(sig([]) === sig([]), "KP khong o trong: chu ky on dinh")

// 2. Đặt lại tên swapGroupId mà giữ nguyên phân hoạch -> cùng chữ ký.
seq = 0
const g1 = [
  term("vùng mã hoá", { allowSwap: true, swapGroupId: "g1" }),
  term("vùng điều hoà", { allowSwap: true, swapGroupId: "g1" }),
]
seq = 0
const g2 = [
  term("vùng mã hoá", { allowSwap: true, swapGroupId: "nhom-khac-123" }),
  term("vùng điều hoà", { allowSwap: true, swapGroupId: "nhom-khac-123" }),
]
assert(sig(g1) === sig(g2), "Doi ten swapGroupId, giu phan hoach: chu ky phai GIONG")

// 3. Đổi đáp án/text của một ô -> khác chữ ký.
seq = 0
const c1 = [term("ADN"), term("ARN")]
seq = 0
const c2 = [term("ADN"), term("mARN")]
assert(sig(c1) !== sig(c2), "Doi text mot o: chu ky phai KHAC")
seq = 0
const c3 = [term("ADN", { extraAccepted: ["DNA"] }), term("ARN")]
assert(sig(c1) !== sig(c3), "Them extraAccepted cho mot o: chu ky phai KHAC")
seq = 0
const c4 = [term("ADN"), term("ARN", { synonyms: ["RNA"] })]
assert(sig(c1) !== sig(c4), "Them synonyms cho mot o: chu ky phai KHAC")

// 4. Thêm/bớt ô -> khác chữ ký.
seq = 0
const d1 = [term("ADN")]
seq = 0
const d2 = [term("ADN"), term("ARN")]
assert(sig(d1) !== sig(d2), "Them o: chu ky phai KHAC")
assert(sig(d2) !== sig(d1), "Bot o: chu ky phai KHAC")

// 5. Chuyển ô vào/ra nhóm hoán đổi -> khác chữ ký (cách chấm đổi).
seq = 0
const e1 = [term("ADN"), term("ARN")]
seq = 0
const e2 = [
  term("ADN", { allowSwap: true, swapGroupId: "g" }),
  term("ARN", { allowSwap: true, swapGroupId: "g" }),
]
assert(sig(e1) !== sig(e2), "Gop hai o thanh nhom hoan doi: chu ky phai KHAC")

// 6. Nhóm hoán đổi có thêm term trùng nhãn (tình huống BUG-04) -> khác.
seq = 0
const f1 = [term("vùng", { allowSwap: true, swapGroupId: "g" })]
seq = 0
const f2 = [
  term("vùng", { allowSwap: true, swapGroupId: "g" }),
  term("vùng", { allowSwap: true, swapGroupId: "g" }),
]
assert(sig(f1) !== sig(f2), "Nhom co them term trung nhan: chu ky phai KHAC")

// 7. Sửa thuần định dạng (normalizeAnswer đã gộp) -> cùng chữ ký, không reset.
seq = 0
const h1 = [term("ADN"), term("điều hoà")]
seq = 0
const h2 = [term("adn"), term("điều hòa")]
assert(sig(h1) === sig(h2), "Hoa/thuong + vi tri dau thanh: chu ky phai GIONG (khong reset)")

// 8. Đối chiếu nguồn: updateKnowledgePoint chỉ reset khi chữ ký đổi,
//    reset cả student_progress lẫn spaced_repetition, và có log.
const src = readFileSync(resolve(root, "app/actions/content.ts"), "utf8")
const fnStart = src.indexOf("export async function updateKnowledgePoint")
assert(fnStart >= 0, "Khong tim thay updateKnowledgePoint trong content.ts")
const fnBody = src.slice(fnStart, src.indexOf("export async function", fnStart + 10))
assert(fnBody.includes("kpGradingSignature"), "updateKnowledgePoint phai dung kpGradingSignature")
assert(
  /gradingChanged[\s\S]*studentProgress/.test(fnBody) && fnBody.includes("fillStatus: null"),
  "Khi chu ky doi phai reset studentProgress (fillStatus: null...)",
)
assert(fnBody.includes("spacedRepetition"), "Khi chu ky doi phai xoa spaced_repetition cua KP")
assert(fnBody.includes("console.info"), "Phai log so hang bi reset (console.info)")
const updIdx = fnBody.indexOf(".update(knowledgePoints)")
const resetIdx = fnBody.indexOf("fillStatus: null")
assert(updIdx >= 0 && resetIdx > updIdx, "Reset chi chay trong nhanh gradingChanged sau khi cap nhat KP")

console.log("check-kp-reset: PASS")
