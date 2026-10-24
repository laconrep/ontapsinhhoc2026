// §23 (bãi bỏ SEC-01) + SEC-08 (sualogic.md mục 12, §23): không còn
// mã mời giáo viên lúc onboarding; các bất biến còn lại (role không
// input, hook ép student, mật khẩu >= 8) giữ nguyên.
import { register } from "node:module"
import { pathToFileURL } from "node:url"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readFileSync, existsSync } from "node:fs"

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

// --- §23: không còn cơ chế mã mời giáo viên ---
// lib/teacher-invite.ts đã bị xóa; onboarding không còn tham chiếu tới
// mã mời hay env TEACHER_INVITE_CODE.
assert(!existsSync(resolve(root, "lib/teacher-invite.ts")), "lib/teacher-invite.ts phải bị xóa (§23)")
const onboardingEarly = readSrc("app/actions/onboarding.ts")
assert(!onboardingEarly.includes("verifyTeacherInviteCode"), "onboarding §23: không còn kiểm mã mời")
assert(!onboardingEarly.includes("process.env.TEACHER_INVITE_CODE"), "onboarding §23: không còn đọc env TEACHER_INVITE_CODE")

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

// --- completeOnboarding: whitelist + isOnboarded, KHÔNG mã mời (§23) ---
const onboarding = readSrc("app/actions/onboarding.ts")
assert(onboarding.includes("ROLE_WHITELIST"), "onboarding thiếu whitelist vai trò")
assert(onboarding.includes("current.isOnboarded"), "onboarding phải chặn khi đã onboard")
assert(!/completeOnboarding\(role: UserRole\) \{\s*const userId/.test(onboarding), "onboarding còn bản cũ ghi thẳng role")

// --- UI onboarding KHÔNG còn ô nhập mã mời khi chọn giáo viên (§23) ---
const obForm = readSrc("components/auth/onboarding-form.tsx")
assert(!obForm.includes("Mã mời giáo viên"), "onboarding-form §23: còn ô nhập mã mời giáo viên")
assert(!obForm.includes("teacher-invite-code"), "onboarding-form §23: còn input mã mời giáo viên")
assert(obForm.includes("completeOnboarding(role"), "onboarding-form chưa gọi completeOnboarding kèm vai trò chọn")

console.log("PASS check-sec01-auth (§23, SEC-08 mật khẩu)")
