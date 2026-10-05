// Trạng thái in-memory cho phiên trình chiếu quiz (một tiến trình).
// Nguồn sự thật cho board GV và HS khi kết nối SSE. Câu trả lời của HS
// là ephemeral (chỉ trong RAM); lịch sử vẫn được ghi vào session_events.

export type LivePhase = "lobby" | "question" | "revealed" | "ended"

export interface LiveQuestion {
  id: string
  index: number
  type: "MC" | "TF" | "SA"
  content: string
  bodyHtml?: string | null
  knowledgePointContent: string
  // Lựa chọn hiển thị (không kèm cờ đúng/sai để tránh lộ đáp án cho HS)
  options: { id: string; content: string; bodyHtml?: string | null; order: number }[]
  timeLimitSec: number | null
}

export interface LiveAnswer {
  studentId: string
  name: string
  answer: string
  correct: boolean
  at: number
}

// Câu hỏi đầy đủ (kèm đáp án đúng) — chỉ dùng phía server để chấm, không gửi cho HS.
export interface LiveQuestionFull extends LiveQuestion {
  // với MC/TF: danh sách id option đúng; với SA: chuỗi đáp án đúng (đã chuẩn hóa)
  correctOptionIds: string[]
  correctText: string | null
}

export interface LiveSessionState {
  sessionId: string
  phase: LivePhase
  currentIndex: number
  total: number
  questionStartedAt: number | null
  questions: LiveQuestionFull[]
  // studentId -> tên, còn online?
  joined: Map<string, { name: string; online: boolean }>
  // câu trả lời cho câu hiện tại: studentId -> LiveAnswer
  answers: Map<string, LiveAnswer>
  // HS đang thoát fullscreen: studentId -> tên
  notFullscreen: Map<string, string>
}

/** Bỏ đáp án đúng — phiên bản an toàn để gửi cho HS. */
export function maskQuestion(q: LiveQuestionFull): LiveQuestion {
  return {
    id: q.id,
    index: q.index,
    type: q.type,
    content: q.content,
    bodyHtml: q.bodyHtml ?? null,
    knowledgePointContent: q.knowledgePointContent,
    options: q.options,
    timeLimitSec: q.timeLimitSec,
  }
}

/** Outline GV: bỏ bodyHtml (SVG base64) để snapshot không vượt giới hạn Server Action. */
export function slimQuestion(q: LiveQuestionFull): LiveQuestion {
  return {
    id: q.id,
    index: q.index,
    type: q.type,
    content: q.content,
    bodyHtml: null,
    knowledgePointContent: q.knowledgePointContent,
    options: q.options.map((o) => ({ ...o, bodyHtml: null })),
    timeLimitSec: q.timeLimitSec,
  }
}

const globalForLive = globalThis as unknown as {
  __edusyncLive?: Map<string, LiveSessionState>
}

const store: Map<string, LiveSessionState> =
  globalForLive.__edusyncLive ?? new Map()
if (!globalForLive.__edusyncLive) globalForLive.__edusyncLive = store

export function initLiveState(
  sessionId: string,
  questions: LiveQuestionFull[],
): LiveSessionState {
  const state: LiveSessionState = {
    sessionId,
    phase: "lobby",
    currentIndex: -1,
    total: questions.length,
    questionStartedAt: null,
    questions,
    joined: new Map(),
    answers: new Map(),
    notFullscreen: new Map(),
  }
  store.set(sessionId, state)
  return state
}

export function getLiveState(sessionId: string): LiveSessionState | null {
  return store.get(sessionId) ?? null
}

export function clearLiveState(sessionId: string): void {
  store.delete(sessionId)
}

/** Serialize để gửi cho client khi kết nối (snapshot). */
export function serializeState(state: LiveSessionState) {
  return {
    phase: state.phase,
    currentIndex: state.currentIndex,
    total: state.total,
    questionStartedAt: state.questionStartedAt,
    serverNow: Date.now(),
    joinedCount: [...state.joined.values()].filter((s) => s.online).length,
    joined: [...state.joined.entries()].map(([studentId, s]) => ({
      studentId,
      name: s.name,
      online: s.online,
    })),
    answers: [...state.answers.values()].map((a) => ({
      studentId: a.studentId,
      name: a.name,
      correct: a.correct,
    })),
    notFullscreen: [...state.notFullscreen.entries()].map(([studentId, name]) => ({
      studentId,
      name,
    })),
  }
}
