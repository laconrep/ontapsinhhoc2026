// SEC-05 (sualogic.md mục 12): mã mời lớp 8 ký tự bằng CSPRNG, joinClass
// chấp nhận mã cũ 6 ký tự (chuyển tiếp) và giới hạn 5 lần sai / 10 phút.
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

function fail(msg) {
  console.error("THAT BAI:", msg)
  process.exit(1)
}
function assert(cond, msg) {
  if (!cond) fail(msg)
}
function readSrc(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const { generateInviteCode, isInviteCodeFormat, INVITE_CODE_CHARS, INVITE_CODE_LENGTH } = await import("../lib/invite-code.ts")

assert(INVITE_CODE_LENGTH === 8, "mã mới phải dài 8 ký tự")
assert(INVITE_CODE_CHARS.length === 32, "bảng ký tự phải giữ 32 ký tự như cũ")
const seen = new Set()
for (let i = 0; i < 5000; i++) {
  const code = generateInviteCode()
  assert(code.length === 8, `mã sinh ra không đủ 8 ký tự: ${code}`)
  assert([...code].every((c) => INVITE_CODE_CHARS.includes(c)), `mã chứa ký tự ngoài bảng: ${code}`)
  seen.add(code)
}
assert(seen.size > 4990, `mã sinh ra trùng quá nhiều: ${seen.size}/5000`)

assert(isInviteCodeFormat("ABCD2345") === true, "mã 8 ký tự hợp lệ bị từ chối")
assert(isInviteCodeFormat("ABC234") === true, "mã cũ 6 ký tự phải vẫn được chấp nhận (chuyển tiếp)")
assert(isInviteCodeFormat("ABC23") === false, "mã 5 ký tự phải bị từ chối")
assert(isInviteCodeFormat("ABCD23456") === false, "mã 9 ký tự phải bị từ chối")
assert(isInviteCodeFormat("ABC012") === false, "ký tự 0/1/O/I (dễ nhầm) phải bị từ chối")
assert(isInviteCodeFormat("abcd2345") === false, "joinClass chuẩn hoá chữ hoa trước khi kiểm tra; hàm format yêu cầu ký tự thuộc bảng")

const inviteSrc = readSrc("lib/invite-code.ts")
assert(inviteSrc.includes("randomInt"), "sinh mã phải dùng crypto.randomInt")
assert(!inviteSrc.includes("Math.random"), "sinh mã còn dùng Math.random")

const classes = readSrc("app/actions/classes.ts")
assert(!classes.includes("Math.random"), "classes.ts còn dùng Math.random")
assert(classes.includes("rotateInviteCode"), "thiếu action xoay mã rotateInviteCode")
assert(classes.includes('from "@/lib/invite-code"'), "classes.ts chưa dùng bộ sinh mã chung")

const studentClass = readSrc("app/actions/student-class.ts")
assert(studentClass.includes("peekRateLimit") && studentClass.includes("hitRateLimit"), "joinClass chưa gắn rate limit thử sai")
assert(studentClass.includes("JOIN_FAIL_LIMIT = 5") && studentClass.includes("10 * 60_000"), "joinClass phải giới hạn 5 lần sai / 10 phút")
assert(studentClass.includes("isInviteCodeFormat"), "joinClass chưa kiểm định dạng 6/8 ký tự")

console.log("PASS check-invite-code (SEC-05)")
