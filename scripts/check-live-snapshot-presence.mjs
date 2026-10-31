// Kiểm chứng sửa lỗi cột Đúng/Sai/Chưa phiên live nhảy lung tung.
//
// Chạy: DATABASE_URL=postgresql://ontap@127.0.0.1:54329/ontap \
//   node --import ~/workspace/.epg/register-loader.mjs scripts/check-live-snapshot-presence.mjs
// Không có DATABASE_URL -> chỉ chạy phần thuần túy (guard phía client), bỏ qua phần DB.
import { loadLiveSnapshotPresence } from "@/lib/live-presence"
import { staleSnapshotAnswers } from "@/components/live/use-live-quiz"
import { pool } from "@/lib/db/index"

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

// ---- Phần thuần túy: snapshot cũ không ghi đè answers của câu khác ----
const snapAns = [{ studentId: "cu", correct: true }]
const curAns = [{ studentId: "moi", correct: false }]
check(
  "guard: snapshot câu 0, đang hiển thị câu 1 -> giữ answers hiện tại",
  staleSnapshotAnswers(0, 1, snapAns, curAns) === curAns,
)
check(
  "guard: snapshot câu 1, đang hiển thị câu 1 -> nhận answers snapshot",
  staleSnapshotAnswers(1, 1, snapAns, curAns) === snapAns,
)
check(
  "guard: snapshot lobby (-1), đang hiển thị câu 0 -> giữ answers hiện tại",
  staleSnapshotAnswers(-1, 0, snapAns, curAns) === curAns,
)

if (!process.env.DATABASE_URL) {
  console.log("Khong co DATABASE_URL — bo qua phan DB")
  console.log(`RESULT pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
}

// ---- Phần DB: helper lấy joined + answers xuyên instance ----
const S = "11111111-1111-4111-8111-111111111111"
const Q1 = "22222222-2222-4222-8222-222222222222"
const Q2 = "33333333-3333-4333-8333-333333333333"
await pool.query(`CREATE TABLE IF NOT EXISTS "user" ("id" text PRIMARY KEY, "name" text NOT NULL)`)
await pool.query(
  `CREATE TABLE IF NOT EXISTS "session_events" ("id" uuid PRIMARY KEY, "sessionId" uuid NOT NULL, "studentId" text, "eventType" varchar(50) NOT NULL, "questionId" uuid, "payload" jsonb, "createdAt" timestamp NOT NULL DEFAULT now())`,
)
await pool.query(
  `CREATE TABLE IF NOT EXISTS "live_answers" ("sessionId" uuid NOT NULL, "questionId" uuid NOT NULL, "studentId" text NOT NULL, "round" integer NOT NULL DEFAULT 1, "answer" text, "isCorrect" boolean NOT NULL, "answeredAt" timestamp NOT NULL DEFAULT now(), "responseMs" integer, PRIMARY KEY ("sessionId", "questionId", "studentId", "round"))`,
)
try {
  await pool.query(`DELETE FROM "live_answers" WHERE "sessionId" = $1`, [S])
  await pool.query(`DELETE FROM "session_events" WHERE "sessionId" = $1`, [S])
  await pool.query(`DELETE FROM "user" WHERE "id" IN ('hs-a', 'hs-b', 'hs-d')`)
  await pool.query(
    `INSERT INTO "user" ("id", "name") VALUES ('hs-a', 'An'), ('hs-b', 'Bình'), ('hs-d', 'Dũng')`,
  )
  // Vào lớp: A, B, A lặp lại, C (không có dòng user -> fallback tên).
  await pool.query(
    `INSERT INTO "session_events" ("id", "sessionId", "studentId", "eventType", "createdAt") VALUES
      ('a0000000-0000-4000-8000-000000000001', $1, 'hs-a', 'student_joined', '2026-10-31 10:00:00'),
      ('a0000000-0000-4000-8000-000000000002', $1, 'hs-b', 'student_joined', '2026-10-31 10:00:01'),
      ('a0000000-0000-4000-8000-000000000003', $1, 'hs-a', 'student_joined', '2026-10-31 10:00:02'),
      ('a0000000-0000-4000-8000-000000000004', $1, 'hs-c', 'student_joined', '2026-10-31 10:00:03'),
      ('a0000000-0000-4000-8000-000000000005', $1, NULL, 'question_changed', '2026-10-31 10:00:04')`,
    [S],
  )
  // Đáp án: vòng 2 câu hiện tại (A đúng, D chỉ nộp bài không join -> sai);
  // vòng 1 và câu khác phải bị loại.
  await pool.query(
    `INSERT INTO "live_answers" ("sessionId", "questionId", "studentId", "round", "isCorrect", "answeredAt") VALUES
      ($1, $2, 'hs-a', 2, true, '2026-10-31 10:01:00'),
      ($1, $2, 'hs-d', 2, false, '2026-10-31 10:01:01'),
      ($1, $2, 'hs-b', 1, true, '2026-10-31 09:01:00'),
      ($1, $2, 'hs-a', 1, false, '2026-10-31 09:01:01'),
      ($1, $3, 'hs-b', 2, true, '2026-10-31 10:01:02')`,
    [S, Q1, Q2],
  )

  const p = await loadLiveSnapshotPresence(S, Q1, 2)
  const joinedIds = p.joined.map((j) => j.studentId)
  check("DB: joined đúng thứ tự vào lớp + HS chỉ nộp bài xếp cuối", JSON.stringify(joinedIds) === JSON.stringify(["hs-a", "hs-b", "hs-c", "hs-d"]), joinedIds.join(","))
  check("DB: joinedCount = 4", p.joinedCount === 4, String(p.joinedCount))
  check("DB: mọi HS đều online:true", p.joined.every((j) => j.online === true))
  check(
    "DB: tên từ bảng user, thiếu dòng user -> 'Học sinh'",
    JSON.stringify(p.joined.map((j) => j.name)) === JSON.stringify(["An", "Bình", "Học sinh", "Dũng"]),
    p.joined.map((j) => j.name).join(","),
  )
  check(
    "DB: answers chỉ vòng hiện tại + câu hiện tại",
    JSON.stringify(p.answers.map((a) => [a.studentId, a.correct])) === JSON.stringify([["hs-a", true], ["hs-d", false]]),
    JSON.stringify(p.answers),
  )
  check("DB: tên answers lấy từ user", p.answers[0].name === "An" && p.answers[1].name === "Dũng")

  const lobby = await loadLiveSnapshotPresence(S, null, 1)
  check("DB: lobby (chưa có câu) -> answers rỗng nhưng joined vẫn đủ", lobby.answers.length === 0 && lobby.joined.length === 4)

  const empty = await loadLiveSnapshotPresence("99999999-9999-4999-8999-999999999999", Q1, 1)
  check("DB: phiên lạ -> joined và answers đều rỗng", empty.joined.length === 0 && empty.answers.length === 0)
} finally {
  await pool.query(`DELETE FROM "live_answers" WHERE "sessionId" = $1`, [S])
  await pool.query(`DELETE FROM "session_events" WHERE "sessionId" = $1`, [S])
  await pool.query(`DELETE FROM "user" WHERE "id" IN ('hs-a', 'hs-b', 'hs-d')`)
  await pool.end()
}

console.log(`RESULT pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
