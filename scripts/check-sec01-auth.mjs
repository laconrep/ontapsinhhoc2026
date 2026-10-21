// SEC-01 + SEC-08 (sualogic.md mục 12): chống tự cấp quyền giáo viên.
// Test ở mức code/cấu hình + hành vi của helper mã mời; hành vi API thật
// (sign-up/update-user) được kiểm chứng riêng trên app chạy thật.
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

// --- Hành vi helper mã mời giáo viên (lib/teacher-invite.ts) ---
process.env.TEACHER_INVITE_CODE = "MA-MOI-BI-MAT-123"
const invite = await import("../lib/teacher-invite.ts")
assert(invite.isTeacherInviteConfigured() === true, "env hợp lệ phải coi là đã cấu hình")
assert(invite.verifyTeacherInviteCode("MA-MOI-BI-MAT-123") === true, "mã đúng phải được chấp nhận")
assert(invite.verifyTeacherInviteCode("MA-MOI-BI-MAT-124") === false, "mã sai phải bị từ chối")
assert(invite.verifyTeacherInviteCode("") === false, "mã rỗng phải bị từ chối")
assert(invite.verifyTeacherInviteCode(undefined) === false, "thiếu mã phải bị từ chối")
assert(invite.verifyTeacherInviteCode("MA-MOI-BI-MAT-123 ") === false, "mã thừa khoảng trắng phải bị từ chối")

process.env.TEACHER_INVITE_CODE = "short"
assert(invite.isTeacherInviteConfigured() === false, "env ngắn hơn 8 ký tự phải coi như chưa cấu hình")
assert(invite.verifyTeacherInviteCode("short") === false, "chưa cấu hình đúng thì không mã nào qua được (fail-closed)")
delete process.env.TEACHER_INVITE_CODE
assert(invite.verifyTeacherInviteCode("MA-MOI-BI-MAT-123") === false, "không có env thì luôn từ chối")

const inviteSrc = readSrc("lib/teacher-invite.ts")
assert(inviteSrc.includes("timingSafeEqual"), "so sánh mã mời phải dùng timingSafeEqual")

// --- lib/auth.ts: role không còn input, hook ép student, mật khẩu >= 8 ---
const auth = readSrc("lib/auth.ts")
assert(/role:\s*{[^}]*input:\s*false/s.test(auth), "lib/auth.ts: role phải để input: false")
assert(!/role:\s*{[^}]*input:\s*true/s.test(auth), "lib/auth.ts: role còn input: true")
assert(auth.includes("databaseHooks") && auth.includes('role: "student"'), "lib/auth.ts: thiếu databaseHooks ép role=student")
assert(/minPasswordLength:\s*8/.test(auth), "lib/auth.ts: minPasswordLength phải là 8 (SEC-08)")
// Cookie sameSite:none CHỈ ở development (hiện trạng đã đúng — giữ nguyên).
assert(/NODE_ENV === "development"[\s\S]{0,200}sameSite: "none"/.test(auth), "lib/auth.ts: sameSite none phải nằm trong nhánh development")

// --- Form đăng ký không gửi role, không còn bộ chọn vai trò ---
const authForm = readSrc("components/auth/auth-form.tsx")
assert(!authForm.includes("signUp.email({ email, password, name, role })"), "auth-form còn gửi role khi signUp")
assert(authForm.includes("signUp.email({ email, password, name })"), "auth-form phải signUp không kèm role")

// --- completeOnboarding: whitelist + isOnboarded + mã mời ---
const onboarding = readSrc("app/actions/onboarding.ts")
assert(onboarding.includes("ROLE_WHITELIST"), "onboarding thiếu whitelist vai trò")
assert(onboarding.includes("current.isOnboarded"), "onboarding phải chặn khi đã onboard")
assert(onboarding.includes("verifyTeacherInviteCode"), "onboarding teacher phải kiểm mã mời")
assert(!/completeOnboarding\(role: UserRole\) \{\s*const userId/.test(onboarding), "onboarding còn bản cũ ghi thẳng role")

// --- UI onboarding có ô nhập mã mời khi chọn giáo viên ---
const obForm = readSrc("components/auth/onboarding-form.tsx")
assert(obForm.includes("Mã mời giáo viên"), "onboarding-form thiếu ô nhập mã mời giáo viên")
assert(obForm.includes("completeOnboarding(role"), "onboarding-form chưa gọi completeOnboarding kèm vai trò chọn")

console.log("PASS check-sec01-auth (SEC-01, SEC-08 mật khẩu)")
