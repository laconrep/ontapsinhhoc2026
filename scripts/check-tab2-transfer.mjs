// §42: kiểm thử luật khóa điền khuyết ở lần sai thứ 2 (thuần túy, không cần DB).
// Chạy: node --import ~/workspace/.epg/register-loader.mjs scripts/check-tab2-transfer.mjs
import { isFillTransfer, REVEAL_FILL_AT } from "@/lib/slot-render"

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

// Luật khóa: chỉ sai + từ lần 2 trở đi mới chuyển.
check("sai lần 1 -> chưa chuyển", isFillTransfer(1, false) === false)
check("sai lần 2 -> chuyển", isFillTransfer(2, false) === true)
check("sai lần 3 -> vẫn chuyển (không tới được vì đã khóa ở 2)", isFillTransfer(3, false) === true)
check("đúng lần 1 -> không chuyển", isFillTransfer(1, true) === false)
check("đúng lần 2 (sau gợi ý) -> không chuyển", isFillTransfer(2, true) === false)
check("đúng lần 3 -> không chuyển", isFillTransfer(3, true) === false)
// Khóa ở 2 nên đường lộ đáp án cũ (lần 3) không bao giờ tới được.
check("ngưỡng lộ cũ (3) lớn hơn ngưỡng khóa (2)", REVEAL_FILL_AT > 2)

console.log(`\n${pass} pass, ${fail} fail`)
process.exit(fail > 0 ? 1 : 0)
