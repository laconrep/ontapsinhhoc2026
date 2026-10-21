// SEC-03 (sualogic.md mục 12): bốn hàm đọc phiên/lớp phải qua helper
// kiểm quyền dùng chung lib/session-access.ts, nhất quán với stream route.
// (Hành vi API với DB thật được kiểm chứng riêng trên app chạy thật.)
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

// --- Helper dùng chung có đúng quy tắc của stream/route.ts ---
const helper = readSrc("lib/session-access.ts")
assert(helper.includes("sessions.teacherId"), "helper không kiểm chủ phiên theo sessions.teacherId")
assert(helper.includes("classStudents"), "helper không kiểm thành viên lớp qua classStudents")
assert(helper.includes("export async function assertSessionAccess"), "thiếu assertSessionAccess")
assert(helper.includes("export async function assertClassAccess"), "thiếu assertClassAccess")

const stream = readSrc("app/api/sessions/[id]/stream/route.ts")
assert(stream.includes("session.teacherId === user.id"), "stream route đổi quy tắc? (mẫu đối chiếu)")
assert(stream.includes("classStudents.classId"), "stream route đổi quy tắc? (mẫu đối chiếu)")

// --- Bốn hàm đều áp helper + bắt buộc đăng nhập ---
const sessions = readSrc("app/actions/sessions.ts")
for (const fn of ["getSession", "getActiveSessionForClass", "getSessionEvents"]) {
  const body = sessions.slice(sessions.indexOf(`export async function ${fn}`))
  const snippet = body.slice(0, 500)
  assert(snippet.includes('throw new Error("Chưa đăng nhập")'), `${fn} chưa chặn chưa đăng nhập`)
}
assert(sessions.includes("await assertSessionAccess(sessionId, user)"), "sessions.ts chưa dùng assertSessionAccess")
assert(sessions.includes("await assertClassAccess(classId, user)"), "getActiveSessionForClass chưa dùng assertClassAccess")
const evIdx = sessions.indexOf("export async function getSessionEvents")
assert(sessions.slice(evIdx, evIdx + 400).includes("assertSessionAccess"), "getSessionEvents chưa kiểm quyền")

const liveQuiz = readSrc("app/actions/live-quiz.ts")
const snapIdx = liveQuiz.indexOf("export async function getLiveQuizSnapshot")
assert(liveQuiz.slice(snapIdx, snapIdx + 600).includes("assertSessionAccess"), "getLiveQuizSnapshot chưa dùng assertSessionAccess")

// --- Mô phỏng quy tắc truy cập (cùng logic helper) trên dữ liệu giả ---
function canAccess(session, memberships, userId) {
  if (!session) return false
  if (session.teacherId === userId) return true
  return memberships.some((m) => m.classId === session.classId && m.studentId === userId)
}
const ses = { classId: "lopA", teacherId: "gv1" }
const members = [{ classId: "lopA", studentId: "hs1" }, { classId: "lopB", studentId: "hs2" }]
assert(canAccess(ses, members, "gv1") === true, "chủ phiên phải vào được")
assert(canAccess(ses, members, "hs1") === true, "học sinh đúng lớp phải vào được")
assert(canAccess(ses, members, "hs2") === false, "học sinh lớp khác phải bị từ chối")
assert(canAccess(ses, members, "nguoi-la") === false, "người lạ phải bị từ chối")
assert(canAccess(null, members, "gv1") === false, "phiên không tồn tại phải bị từ chối")

console.log("PASS check-session-access (SEC-03)")
