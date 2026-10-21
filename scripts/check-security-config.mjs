// SEC-04/07/08/09/11 (sualogic.md mục 12): cấu hình next.config (origins
// theo env, header bảo mật + CSP Report-Only), lỗi API không lộ nội bộ,
// rate limit lưu DB, giới hạn kết nối SSE.
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
import { spawnSync } from "node:child_process"

// --- SEC-04: hành vi allowedOrigins theo env (chạy tiến trình con để nạp config mới) ---
function loadConfig(env) {
  const code = `
    const cfg = (await import("./next.config.mjs")).default
    const sa = cfg.experimental?.serverActions ?? {}
    console.log(JSON.stringify({ has: "allowedOrigins" in sa, origins: sa.allowedOrigins ?? null }))
  `
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: root, env: { ...process.env, ...env }, encoding: "utf8",
  })
  assert(r.status === 0, `không nạp được next.config với env ${JSON.stringify(env)}: ${r.stderr}`)
  return JSON.parse(r.stdout.trim().split("\n").pop())
}
const prodNoEnv = loadConfig({ NODE_ENV: "production", SERVER_ACTIONS_ALLOWED_ORIGINS: "" })
assert(prodNoEnv.has === false, "production không env: phải BỎ khóa allowedOrigins (về same-origin mặc định)")
const prodEnv = loadConfig({ NODE_ENV: "production", SERVER_ACTIONS_ALLOWED_ORIGINS: "app.example.edu.vn, school.edu.vn" })
assert(prodEnv.has === true && prodEnv.origins.join(",") === "app.example.edu.vn,school.edu.vn", "env SERVER_ACTIONS_ALLOWED_ORIGINS phải được dùng nguyên văn")
const devNoEnv = loadConfig({ NODE_ENV: "development", SERVER_ACTIONS_ALLOWED_ORIGINS: "" })
assert(devNoEnv.has === true && devNoEnv.origins.some((o) => o.includes("localhost")), "development không env: phải cho localhost")
const prodMonkey = JSON.stringify(prodNoEnv) + JSON.stringify(prodEnv)
assert(!prodMonkey.includes("monkeycode"), "production không được chứa wildcard monkeycode")

const cfgSrc = readSrc("next.config.mjs")
assert(cfgSrc.includes("SERVER_ACTIONS_ALLOWED_ORIGINS"), "next.config chưa đọc env allowedOrigins")
assert(/allowedDevOrigins[\s\S]{0,300}chỉ|CHỈ có tác dụng ở `next dev`|chỉ.*dev/i.test(cfgSrc), "allowedDevOrigins cần comment nói rõ chỉ tác dụng lúc dev")

// --- SEC-07: headers() đủ bộ trên mọi route ---
process.env.NODE_ENV = "production"
delete process.env.SERVER_ACTIONS_ALLOWED_ORIGINS
const cfg = (await import("../next.config.mjs")).default
assert(typeof cfg.headers === "function", "next.config thiếu headers()")
const rules = await cfg.headers()
assert(rules.length >= 1 && rules[0].source === "/:path*", "headers() phải áp cho mọi route")
const h = Object.fromEntries(rules[0].headers.map((x) => [x.key, x.value]))
assert(h["Content-Security-Policy-Report-Only"]?.includes("default-src 'self'"), "thiếu CSP Report-Only")
assert(h["Content-Security-Policy"] === undefined, "CSP chưa được bật thật — chỉ Report-Only ở giai đoạn này")
assert(h["Content-Security-Policy-Report-Only"].includes("img-src 'self' data:"), "CSP thiếu img-src data:")
assert(h["Content-Security-Policy-Report-Only"].includes("frame-ancestors 'none'"), "CSP thiếu frame-ancestors")
assert(h["Content-Security-Policy-Report-Only"].includes("object-src 'none'"), "CSP thiếu object-src 'none'")
assert(h["X-Frame-Options"] === "DENY", "thiếu X-Frame-Options DENY")
assert(h["Strict-Transport-Security"]?.includes("max-age=31536000"), "thiếu HSTS")
assert(h["X-Content-Type-Options"] === "nosniff", "thiếu nosniff")
assert(h["Referrer-Policy"] === "strict-origin-when-cross-origin", "thiếu Referrer-Policy")
assert(h["Permissions-Policy"]?.includes("camera=()") && h["Permissions-Policy"].includes("microphone=()") && h["Permissions-Policy"].includes("geolocation=()"), "Permissions-Policy chưa tắt camera/micro/geo")
assert(h["Permissions-Policy"].includes("fullscreen=(self)"), "Permissions-Policy phải GIỮ fullscreen=(self) cho màn hình live")

// --- SEC-09: safeErrorMessage ---
const { safeErrorMessage, isBusinessError } = await import("../lib/api-error.ts")
assert(safeErrorMessage(new Error("Không tìm thấy phiên"), "chung") === "Không tìm thấy phiên", "lỗi nghiệp vụ phải được trả nguyên văn")
assert(safeErrorMessage(new Error("File tải lên bị từ chối: tổng dung lượng giải nén vượt quá 50MB"), "chung").includes("bị từ chối"), "lỗi guard upload phải được trả nguyên văn")
const sqlErr = new Error('Failed query: select "password" from "user" where id = $1 -- params: abc')
const safe = safeErrorMessage(sqlErr, "Có lỗi xảy ra")
assert(safe === "Có lỗi xảy ra" && !safe.includes("select"), "lỗi SQL không được lộ ra client")
assert(isBusinessError(new Error("Đã hết thời gian")) === true, "thiếu message nghiệp vụ đã biết")
for (const rel of ["app/api/sessions/[id]/live/route.ts", "app/api/worksheet/validate/route.ts", "app/api/worksheet/save/route.ts"]) {
  const src = readSrc(rel)
  assert(src.includes("safeErrorMessage"), `${rel} chưa dùng safeErrorMessage`)
  assert(!src.includes("e.message ? e.message"), `${rel} còn trả thẳng e.message`)
}

// --- SEC-08: rate limit DB + assertGradeBurst async ---
const rl = readSrc("lib/rate-limit.ts")
assert(rl.includes("rate_limits") && rl.includes("export async function hitRateLimit"), "lib/rate-limit.ts thiếu hitRateLimit lưu DB")
const learn = readSrc("app/actions/student-learn.ts")
assert(learn.includes("async function assertGradeBurst"), "assertGradeBurst phải là async")
assert((learn.match(/await assertGradeBurst\(/g) ?? []).length === 2, "cả 2 điểm gọi assertGradeBurst phải await")
assert(learn.includes("GRADE_BURST_LIMIT = 10") && learn.includes("GRADE_BURST_WINDOW_MS = 60_000"), "ngưỡng burst phải giữ nguyên 10/60s")
assert(!learn.includes("new Map<string, number[]>()"), "student-learn còn bộ đếm trong bộ nhớ")
const dbIdx = readSrc("lib/db/index.ts")
assert(dbIdx.includes("CREATE TABLE IF NOT EXISTS rate_limits"), "ensureSchema chưa tạo bảng rate_limits")

// --- SEC-11: stream route giới hạn kết nối + dọn dẹp ---
const stream = readSrc("app/api/sessions/[id]/stream/route.ts")
assert(stream.includes("MAX_STREAMS_PER_USER_SESSION = 3"), "stream route chưa giới hạn 3 kết nối/user/phiên")
assert(stream.includes("status: 429"), "stream route chưa trả 429 khi thừa kết nối")
assert(stream.includes("releaseStream()"), "stream route chưa nhả slot khi client ngắt")

console.log("PASS check-security-config (SEC-04/07/08/09/11)")
