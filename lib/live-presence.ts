// Nguồn thật duy nhất xuyên instance cho cột thống kê phiên live.
//
// Vấn đề: trạng thái live (joined/answers) trước đây chỉ nằm trong RAM của
// từng instance Vercel (lib/live-session-state.ts) và bus SSE cũng chỉ chạy
// trong 1 tiến trình (lib/realtime.ts). Bảng GV poll snapshot mỗi 2s, mỗi
// lần có thể trúng một instance khác nhau: instance lạnh trả joined rỗng,
// instance ấm nhưng chưa nhận bài mới trả answers cũ -> cột Đúng/Sai/Chưa
// nhảy lung tung, rõ nhất đúng lúc HS đang vào lớp.
//
// Sửa: snapshot lấy joined + answers từ DB thay vì RAM:
// - joined: hợp của (a) sự kiện student_joined trong session_events
//   (emit() đã ghi DB) và (b) HS đã nộp bài trong live_answers — vì HS
//   nộp bài là đã có mặt dù sự kiện join có lỡ mất khi ghi DB.
//   Không có cơ chế rời phiên (chưa từng set online:false ở đâu), nên mọi
//   HS trong danh sách đều tính online:true, đúng ngữ nghĩa RAM cũ.
// - answers: đúng câu hiện tại + đúng round hiện tại (round tăng mỗi lần
//   GV chuyển câu, nên lọc round để không lộ đáp án vòng cũ).
// Tên lấy từ bảng user; thiếu tên thì dùng "Học sinh" như fallback phía client.

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm"
import { db } from "@/lib/db/index"
import { liveAnswers, sessionEvents, user } from "@/lib/db/schema"

export interface LivePresenceStudent {
  studentId: string
  name: string
  online: boolean
}

export interface LivePresenceAnswer {
  studentId: string
  name: string
  correct: boolean
}

export interface LiveSnapshotPresence {
  joined: LivePresenceStudent[]
  joinedCount: number
  answers: LivePresenceAnswer[]
}

export async function loadLiveSnapshotPresence(
  sessionId: string,
  currentQuestionId: string | null,
  round: number,
): Promise<LiveSnapshotPresence> {
  const joinRows = await db
    .select({ studentId: sessionEvents.studentId, createdAt: sessionEvents.createdAt })
    .from(sessionEvents)
    .where(
      and(
        eq(sessionEvents.sessionId, sessionId),
        eq(sessionEvents.eventType, "student_joined"),
        isNotNull(sessionEvents.studentId),
      ),
    )
    .orderBy(asc(sessionEvents.createdAt), asc(sessionEvents.studentId))

  const answerRows = currentQuestionId
    ? await db
        .select({
          studentId: liveAnswers.studentId,
          isCorrect: liveAnswers.isCorrect,
          answeredAt: liveAnswers.answeredAt,
        })
        .from(liveAnswers)
        .where(
          and(
            eq(liveAnswers.sessionId, sessionId),
            eq(liveAnswers.questionId, currentQuestionId),
            eq(liveAnswers.round, round),
          ),
        )
        .orderBy(asc(liveAnswers.answeredAt), asc(liveAnswers.studentId))
    : []

  // HS đã nộp bài ở bất kỳ câu/vòng nào của phiên đều tính là đã vào lớp
  // (đúng ngữ nghĩa RAM cũ: submitLiveAnswer thêm HS vào joined và joined
  // tồn tại suốt phiên, không reset khi chuyển câu).
  const sessionAnswerRows = await db
    .select({ studentId: liveAnswers.studentId, answeredAt: liveAnswers.answeredAt })
    .from(liveAnswers)
    .where(eq(liveAnswers.sessionId, sessionId))
    .orderBy(asc(liveAnswers.answeredAt), asc(liveAnswers.studentId))

  const ids = new Set<string>()
  for (const r of joinRows) if (r.studentId) ids.add(r.studentId)
  for (const r of sessionAnswerRows) ids.add(r.studentId)

  const names = new Map<string, string>()
  if (ids.size > 0) {
    const rows = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [...ids]))
    for (const r of rows) names.set(r.id, r.name)
  }
  const nameOf = (id: string) => names.get(id) ?? "Học sinh"

  // Thứ tự ổn định: HS vào trước đứng trước; HS chỉ có bài nộp (không có
  // sự kiện join) xếp cuối theo thời gian nộp.
  const joinedIds = joinRows
    .map((r) => r.studentId as string)
    .filter((id, i, arr) => arr.indexOf(id) === i)
  const answerOnlyIds = sessionAnswerRows
    .map((r) => r.studentId)
    .filter((id, i, arr) => arr.indexOf(id) === i && !joinedIds.includes(id))
  const joined: LivePresenceStudent[] = [...joinedIds, ...answerOnlyIds].map((id) => ({
    studentId: id,
    name: nameOf(id),
    online: true,
  }))

  return {
    joined,
    joinedCount: joined.length,
    answers: answerRows.map((r) => ({
      studentId: r.studentId,
      name: nameOf(r.studentId),
      correct: r.isCorrect,
    })),
  }
}
