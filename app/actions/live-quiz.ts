"use server"

import { randomUUID } from "crypto"
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db, ensureSchema } from "@/lib/db"
import {
  classes,
  classStudents,
  chapters,
  knowledgePoints,
  lessons,
  questions,
  questionOptions,
  sessions,
  sessionEvents,
} from "@/lib/db/schema"
import { requireRole, getCurrentUser } from "@/lib/auth-helpers"
import { normalizeAnswer } from "@/lib/grading"
import { publish, type RealtimeEvent } from "@/lib/realtime"
import {
  initLiveState,
  getLiveState,
  clearLiveState,
  maskQuestion,
  serializeState,
  type LiveQuestionFull,
  type LiveSessionState,
} from "@/lib/live-session-state"

// ---- Emit: ghi DB (lịch sử) + phát realtime ----
async function emit(
  sessionId: string,
  type: string,
  opts: {
    studentId?: string | null
    studentName?: string | null
    questionId?: string | null
    payload?: Record<string, unknown> | null
  } = {},
) {
  const id = randomUUID()
  const createdAt = new Date()
  const event = {
    id,
    sessionId,
    studentId: opts.studentId ?? null,
    studentName: opts.studentName ?? null,
    questionId: opts.questionId ?? null,
    eventType: type,
    payload: opts.payload ?? null,
    createdAt,
  }
  // Ghi vào DB
  await db.insert(sessionEvents).values(event)
  // Phát event ngay đến tất cả subscriber (realtime in-memory)
  publish(sessionId, {
    id: event.id,
    type,
    studentId: event.studentId,
    studentName: event.studentName,
    questionId: event.questionId,
    payload: event.payload as Record<string, unknown> | undefined,
    createdAt: event.createdAt.toISOString(),
  })
}

// Phát realtime nhanh (không lưu DB) — dùng cho tín hiệu tần suất cao (fullscreen, tick).
function publishLight(sessionId: string, type: string, payload: Record<string, unknown>, studentId?: string, studentName?: string) {
  publish(sessionId, {
    id: randomUUID(),
    type,
    studentId: studentId ?? null,
    studentName: studentName ?? null,
    payload,
    createdAt: new Date().toISOString(),
  })
}

// ---- Nạp câu hỏi cho quiz từ một bài ----
async function loadQuizQuestions(lessonId: string, defaultTimeSec: number): Promise<LiveQuestionFull[]> {
  await ensureSchema()
  const rows = await db
    .select({
      id: questions.id,
      type: questions.type,
      content: questions.content,
      bodyHtml: questions.bodyHtml,
      timeLimitSec: questions.timeLimitSec,
      kpContent: knowledgePoints.content,
      kpOrder: knowledgePoints.order,
      createdAt: questions.createdAt,
    })
    .from(questions)
    .innerJoin(knowledgePoints, eq(knowledgePoints.id, questions.knowledgePointId))
    .where(and(eq(knowledgePoints.lessonId, lessonId), inArray(questions.type, ["MC", "TF", "SA"])))
    .orderBy(asc(knowledgePoints.order), asc(questions.createdAt))

  if (rows.length === 0) return []

  const opts = await db
    .select()
    .from(questionOptions)
    .where(inArray(questionOptions.questionId, rows.map((r) => r.id)))
    .orderBy(asc(questionOptions.order))

  return rows.map((r, index) => {
    const qOpts = opts.filter((o) => o.questionId === r.id)
    const correctOptionIds = qOpts.filter((o) => o.isCorrect).map((o) => o.id)
    const correctText = r.type === "SA" ? (qOpts.find((o) => o.isCorrect)?.content ?? null) : null
    return {
      id: r.id,
      index,
      type: r.type as "MC" | "TF" | "SA",
      content: r.content,
      bodyHtml: r.bodyHtml ?? null,
      knowledgePointContent: r.kpContent,
      options: qOpts.map((o) => ({ id: o.id, content: o.content, bodyHtml: o.bodyHtml ?? null, order: o.order })),
      timeLimitSec: r.timeLimitSec ?? defaultTimeSec,
      correctOptionIds,
      correctText,
    }
  })
}

// Khôi phục state in-memory từ DB nếu bị mất (server restart).
async function ensureLiveState(sessionId: string): Promise<LiveSessionState | null> {
  const existing = getLiveState(sessionId)
  if (existing) return existing

  const [s] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (!s || s.status !== "active") return null
  const snap = (s.resumeSnapshot as { lessonId?: string; defaultTimeSec?: number; currentIndex?: number; phase?: string } | null) ?? null
  if (!snap?.lessonId) return null

  try {
    const qs = await loadQuizQuestions(snap.lessonId, snap.defaultTimeSec ?? 30)
    if (!qs || qs.length === 0) return null
    const state = initLiveState(sessionId, qs)
    state.currentIndex = snap.currentIndex ?? -1
    state.phase = (snap.phase as LiveSessionState["phase"]) ?? "lobby"
    if (state.currentIndex >= 0 && state.phase === "question") state.questionStartedAt = Date.now()
    return state
  } catch (err) {
    console.error("[v0] ensureLiveState error loading questions:", err)
    return null
  }
}

async function persistSnapshot(sessionId: string, lessonId: string, defaultTimeSec: number, state: LiveSessionState) {
  await db
    .update(sessions)
    .set({
      resumeSnapshot: {
        lessonId,
        defaultTimeSec,
        currentIndex: state.currentIndex,
        phase: state.phase,
      },
      lastActivityAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
}

// ---- GV: danh sách bài có thể trình chiếu (đã sẵn sàng, có câu MC/TF/SA) ----
export interface QuizLessonOption {
  id: string
  title: string
  chapterTitle: string
  questionCount: number
}

export async function getLessonsForQuiz(): Promise<QuizLessonOption[]> {
  const teacher = await requireRole("teacher")
  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      chapterTitle: chapters.title,
      count: sql<number>`count(${questions.id})`,
    })
    .from(lessons)
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .innerJoin(knowledgePoints, eq(knowledgePoints.lessonId, lessons.id))
    .innerJoin(questions, and(eq(questions.knowledgePointId, knowledgePoints.id), inArray(questions.type, ["MC", "TF", "SA"])))
    .where(and(eq(lessons.teacherId, teacher.id), eq(lessons.status, "ready")))
    .groupBy(lessons.id, lessons.title, chapters.title, chapters.order, lessons.order)
    .orderBy(asc(chapters.order), asc(lessons.order))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    chapterTitle: r.chapterTitle,
    questionCount: Number(r.count),
  }))
}

// ---- GV: bắt đầu phiên trình chiếu quiz ----
export async function startQuizSession(input: {
  classId: string
  lessonId: string
  defaultTimeSec: number
}): Promise<{ sessionId: string }> {
  const teacher = await requireRole("teacher")
  const cls = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, input.classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (cls.length === 0) throw new Error("Không tìm thấy lớp học")

  const defaultTimeSec = Math.max(5, Math.min(600, Math.round(input.defaultTimeSec || 30)))
  const qs = await loadQuizQuestions(input.lessonId, defaultTimeSec)
  if (qs.length === 0) throw new Error("Bài học chưa có câu hỏi trắc nghiệm để trình chiếu")

  // Kết thúc phiên active cũ của lớp
  await db
    .update(sessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(sessions.classId, input.classId), eq(sessions.status, "active")))

  const sessionId = randomUUID()
  await db.insert(sessions).values({
    id: sessionId,
    classId: input.classId,
    teacherId: teacher.id,
    status: "active",
    resumeSnapshot: { lessonId: input.lessonId, defaultTimeSec, currentIndex: -1, phase: "lobby" },
  })
  initLiveState(sessionId, qs)
  revalidatePath(`/teacher/classes/${input.classId}`)
  return { sessionId }
}

// ---- GV: soạn phiên nháp (để dạy sau) ----
export async function createDraftSession(input: {
  classId: string
  lessonId: string
  defaultTimeSec: number
}): Promise<{ sessionId: string }> {
  const teacher = await requireRole("teacher")
  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, input.classId), eq(classes.teacherId, teacher.id)))
    .limit(1)
  if (!cls) throw new Error("Không tìm thấy lớp học")

  const defaultTimeSec = Math.max(5, Math.min(600, Math.round(input.defaultTimeSec || 30)))
  const qs = await loadQuizQuestions(input.lessonId, defaultTimeSec)
  if (qs.length === 0) throw new Error("Bài học chưa có câu hỏi trắc nghiệm để trình chiếu")

  const sessionId = randomUUID()
  // status='created' => HS KHÔNG thấy (chỉ query status='active'), GV có thể kích hoạt sau.
  await db.insert(sessions).values({
    id: sessionId,
    classId: input.classId,
    teacherId: teacher.id,
    status: "created",
    resumeSnapshot: { lessonId: input.lessonId, defaultTimeSec, currentIndex: -1, phase: "lobby" },
  })
  revalidatePath(`/teacher/classes/${input.classId}`)
  return { sessionId }
}

// ---- GV: danh sách phiên nháp của lớp ----
export interface DraftSessionDto {
  id: string
  lessonTitle: string
  chapterTitle: string
  questionCount: number
  defaultTimeSec: number
  createdAt: string
}

export async function getDraftSessions(classId: string): Promise<DraftSessionDto[]> {
  const teacher = await requireRole("teacher")
  const rows = await db
    .select({
      id: sessions.id,
      snapshot: sessions.resumeSnapshot,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.classId, classId),
        eq(sessions.teacherId, teacher.id),
        eq(sessions.status, "created"),
      ),
    )
    .orderBy(asc(sessions.createdAt))

  const drafts: DraftSessionDto[] = []
  for (const r of rows) {
    try {
      const snap = (r.snapshot as { lessonId?: string; defaultTimeSec?: number } | null) ?? null
      if (!snap?.lessonId) continue
      const [lesson] = await db
        .select({ title: lessons.title, chapterTitle: chapters.title })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(lessons.id, snap.lessonId))
        .limit(1)
      if (!lesson) continue
      const qs = await loadQuizQuestions(snap.lessonId, snap.defaultTimeSec ?? 30)
      if (!qs || qs.length === 0) continue
      drafts.push({
        id: r.id,
        lessonTitle: lesson.title,
        chapterTitle: lesson.chapterTitle,
        questionCount: qs.length,
        defaultTimeSec: snap.defaultTimeSec ?? 30,
        createdAt: r.createdAt.toISOString(),
      })
    } catch (err) {
      console.error("[v0] Error loading draft session:", err)
      continue
    }
  }
  return drafts
}

// ---- GV: kích hoạt phiên nháp thành phiên đang dạy ----
export async function activateDraftSession(sessionId: string): Promise<{ sessionId: string }> {
  const teacher = await requireRole("teacher")
  const [s] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teacherId, teacher.id)))
    .limit(1)
  if (!s) throw new Error("Không tìm thấy phiên")
  if (s.status !== "created") throw new Error("Phiên này không còn ở trạng thái nháp")

  const snap = (s.resumeSnapshot as { lessonId?: string; defaultTimeSec?: number } | null) ?? null
  if (!snap?.lessonId) throw new Error("Phiên nháp không hợp lệ")
  const qs = await loadQuizQuestions(snap.lessonId, snap.defaultTimeSec ?? 30)
  if (qs.length === 0) throw new Error("Bài học không còn câu hỏi để trình chiếu")

  // Kết thúc phiên active cũ của lớp
  await db
    .update(sessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(and(eq(sessions.classId, s.classId), eq(sessions.status, "active")))

  await db
    .update(sessions)
    .set({
      status: "active",
      resumeSnapshot: { lessonId: snap.lessonId, defaultTimeSec: snap.defaultTimeSec ?? 30, currentIndex: -1, phase: "lobby" },
      lastActivityAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
  initLiveState(sessionId, qs)
  revalidatePath(`/teacher/classes/${s.classId}`)
  return { sessionId }
}

// ---- GV: xoá phiên nháp ----
export async function deleteDraftSession(sessionId: string): Promise<void> {
  const teacher = await requireRole("teacher")
  const [s] = await db
    .select({ classId: sessions.classId, status: sessions.status })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.teacherId, teacher.id)))
    .limit(1)
  if (!s) throw new Error("Không tìm thấy phiên")
  if (s.status !== "created") throw new Error("Chỉ xoá được phiên nháp")
  await db.delete(sessions).where(eq(sessions.id, sessionId))
  revalidatePath(`/teacher/classes/${s.classId}`)
}

// ---- Snapshot cho client khi kết nối ----
export async function getLiveQuizSnapshot(sessionId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error("Chưa đăng nhập")
  const state = await ensureLiveState(sessionId)
  const [s] = await db
    .select({ classId: sessions.classId, className: classes.name, teacherId: sessions.teacherId, status: sessions.status })
    .from(sessions)
    .innerJoin(classes, eq(classes.id, sessions.classId))
    .where(eq(sessions.id, sessionId))
    .limit(1)
  if (!s) throw new Error("Không tìm thấy phiên")

  // state null = phiên không có câu hỏi hợp lệ (không phải "ended")
  // Chỉ trả về "ended" nếu session status là "completed"
  if (!state) {
    if (s.status === "ended") {
      return {
        sessionId,
        className: s.className,
        status: s.status,
        isTeacher: s.teacherId === user.id,
        phase: "ended" as const,
        currentIndex: -1,
        total: 0,
        questionStartedAt: null,
        serverNow: Date.now(),
        joinedCount: 0,
        joined: [],
        answers: [],
        notFullscreen: [],
        question: null,
        revealed: null,
        teacherExtras: null,
      }
    }
    // status khác "completed" nhưng state null = lỗi
    console.error("[v0] getLiveQuizSnapshot: state is null but status is", s.status)
    throw new Error("Phiên không thể tải. Vui lòng kiểm tra lại.")
  }

  const isTeacher = s.teacherId === user.id
  const current = state.currentIndex >= 0 ? state.questions[state.currentIndex] : null

  return {
    sessionId,
    className: s.className,
    status: s.status,
    isTeacher,
    ...serializeState(state),
    // câu hiện tại (HS: che đáp án; GV: kèm đáp án + câu kế tiếp)
    question: current ? maskQuestion(current) : null,
    revealed:
      state.phase === "revealed" && current
        ? { correctOptionIds: current.correctOptionIds, correctText: current.correctText }
        : null,
    teacherExtras:
      isTeacher
        ? {
            current: current ? { correctOptionIds: current.correctOptionIds, correctText: current.correctText } : null,
            next: state.currentIndex + 1 < state.total ? maskQuestion(state.questions[state.currentIndex + 1]) : null,
            // toàn bộ đề (đã che đáp án) để GV tính câu kế tiếp mà không phải hỏi lại server
            outline: state.questions.map(maskQuestion),
          }
        : null,
  }
}

async function requireOwner(sessionId: string) {
  const teacher = await requireRole("teacher")
  const [s] = await db.select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.teacherId, teacher.id))).limit(1)
  if (!s) throw new Error("Không tìm thấy phiên")
  return { teacher, session: s }
}

// ---- GV: chuyển tới câu hỏi thứ index ----
export async function goToQuestion(sessionId: string, index: number) {
  const { session } = await requireOwner(sessionId)
  const state = await ensureLiveState(sessionId)
  if (!state) throw new Error("Phiên không hoạt động")
  if (index < 0 || index >= state.total) throw new Error("Chỉ số câu hỏi không hợp lệ")

  state.currentIndex = index
  state.phase = "question"
  state.questionStartedAt = Date.now()
  state.answers.clear()

  const q = state.questions[index]
  const snap = (session.resumeSnapshot as { lessonId: string; defaultTimeSec: number }) ?? { lessonId: "", defaultTimeSec: 30 }
  await persistSnapshot(sessionId, snap.lessonId, snap.defaultTimeSec, state)
  
  const question = maskQuestion(q)
  const startedAt = state.questionStartedAt
  const serverNow = Date.now()
  await emit(sessionId, "question_changed", {
    questionId: q.id,
    payload: {
      index,
      total: state.total,
      question,
      startedAt,
      serverNow,
    },
  })
  return {
    index,
    total: state.total,
    question,
    next: index + 1 < state.total ? maskQuestion(state.questions[index + 1]) : null,
    startedAt,
    serverNow,
  }
}

// ---- GV: hiện đáp án câu hiện tại ----
export async function revealCurrent(sessionId: string) {
  const { session } = await requireOwner(sessionId)
  const state = await ensureLiveState(sessionId)
  if (!state || state.currentIndex < 0) throw new Error("Chưa có câu hỏi")
  state.phase = "revealed"
  const q = state.questions[state.currentIndex]
  const snap = (session.resumeSnapshot as { lessonId: string; defaultTimeSec: number }) ?? { lessonId: "", defaultTimeSec: 30 }
  await persistSnapshot(sessionId, snap.lessonId, snap.defaultTimeSec, state)
  const revealed = { correctOptionIds: q.correctOptionIds, correctText: q.correctText }
  await emit(sessionId, "revealed", {
    questionId: q.id,
    payload: { index: state.currentIndex, ...revealed },
  })
  return { revealed: true as const, ...revealed }
}

// ---- GV: kết thúc phiên ----
export async function endQuizSession(sessionId: string): Promise<void> {
  const { session } = await requireOwner(sessionId)
  await db.update(sessions).set({ status: "ended", endedAt: new Date() }).where(eq(sessions.id, sessionId))
  const state = getLiveState(sessionId)
  if (state) state.phase = "ended"
  await emit(sessionId, "session_ended", {})
  clearLiveState(sessionId)
  revalidatePath(`/teacher/classes/${session.classId}`)
}

// ---- HS: tham gia ----
export async function joinQuiz(sessionId: string): Promise<void> {
  const student = await requireRole("student")
  const state = await ensureLiveState(sessionId)
  if (!state) {
    console.error("[v0] joinQuiz: ensureLiveState returned null for", sessionId)
    throw new Error("Phiên học không tồn tại hoặc đã kết thúc")
  }
  // xác thực thuộc lớp
  const [ok] = await db
  .select({ studentId: classStudents.studentId })
  .from(sessions)
  .innerJoin(classStudents, eq(classStudents.classId, sessions.classId))
  .where(and(eq(sessions.id, sessionId), eq(classStudents.studentId, student.id)))
  .limit(1)
  if (!ok) throw new Error("Bạn không được phép vào phiên này. Vui lòng kiểm tra xem bạn có thuộc lớp không.")

  state.joined.set(student.id, { name: student.name, online: true })
  const joinedCount = [...state.joined.values()].filter((s) => s.online).length
  await emit(sessionId, "student_joined", {
    studentId: student.id,
    studentName: student.name,
    payload: { joinedCount },
  })
}

// ---- HS: gửi câu trả lời ----
export async function submitLiveAnswer(
  sessionId: string,
  questionId: string,
  answer: string,
): Promise<{ correct: boolean }> {
  const student = await requireRole("student")
  const state = await ensureLiveState(sessionId)
  if (!state) throw new Error("Phiên không hoạt động")
  if (state.phase !== "question") throw new Error("Đã hết thời gian trả lời")
  const q = state.questions[state.currentIndex]
  if (!q || q.id !== questionId) throw new Error("Câu hỏi không khớp")
  if (state.answers.has(student.id)) throw new Error("Bạn đã trả lời câu này")

  const correct = gradeLiveAnswer(q, answer)
  state.answers.set(student.id, { studentId: student.id, name: student.name, answer, correct, at: Date.now() })
  if (!state.joined.has(student.id)) state.joined.set(student.id, { name: student.name, online: true })

  await emit(sessionId, "answer_submitted", {
    studentId: student.id,
    studentName: student.name,
    questionId,
    payload: { correct, index: state.currentIndex },
  })
  return { correct }
}

// ---- HS: báo trạng thái fullscreen ----
export async function reportFullscreen(sessionId: string, isFullscreen: boolean): Promise<void> {
  const student = await requireRole("student")
  const state = getLiveState(sessionId)
  if (!state) return
  if (isFullscreen) state.notFullscreen.delete(student.id)
  else state.notFullscreen.set(student.id, student.name)
  publishLight(sessionId, "fullscreen_changed", { isFullscreen }, student.id, student.name)
}

function gradeLiveAnswer(q: LiveQuestionFull, answer: string): boolean {
  if (q.type === "MC") return q.correctOptionIds.includes(answer)
  if (q.type === "SA") return !!q.correctText && normalizeAnswer(answer) === normalizeAnswer(q.correctText)
  if (q.type === "TF") {
    const picked = (answer ? answer.split(",").filter(Boolean) : []).sort()
    const correct = [...q.correctOptionIds].sort()
    return picked.length === correct.length && picked.every((v, i) => v === correct[i])
  }
  return false
}
