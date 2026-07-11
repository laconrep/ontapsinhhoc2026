"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getLiveQuizSnapshot } from "@/app/actions/live-quiz"

export interface LiveQuestionView {
  id: string
  index: number
  type: "MC" | "TF" | "SA"
  content: string
  knowledgePointContent: string
  options: { id: string; content: string; order: number }[]
  timeLimitSec: number | null
}

export interface AnswerTally {
  studentId: string
  name: string
  correct: boolean
}

export interface RevealInfo {
  correctOptionIds: string[]
  correctText: string | null
}

export interface LiveQuizView {
  connected: boolean
  loading: boolean
  phase: "lobby" | "question" | "revealed" | "ended"
  className: string
  isTeacher: boolean
  currentIndex: number
  total: number
  question: LiveQuestionView | null
  revealed: RevealInfo | null
  remainingSec: number | null
  timeLimitSec: number | null
  joinedCount: number
  showJoinBadge: boolean
  answers: AnswerTally[]
  notFullscreen: { studentId: string; name: string }[]
  teacherNext: LiveQuestionView | null
  teacherCurrentAnswer: RevealInfo | null
}

/**
 * Hook kết nối SSE + đồng bộ trạng thái phiên trình chiếu quiz.
 * Dùng chung cho màn hình GV, màn hình trình chiếu (TV) và màn hình HS.
 */
export function useLiveQuiz(sessionId: string): LiveQuizView {
  const [state, setState] = useState<Omit<LiveQuizView, "remainingSec">>({
    connected: false,
    loading: true,
    phase: "lobby",
    className: "",
    isTeacher: false,
    currentIndex: -1,
    total: 0,
    question: null,
    revealed: null,
    timeLimitSec: null,
    joinedCount: 0,
    showJoinBadge: false,
    answers: [],
    notFullscreen: [],
    teacherNext: null,
    teacherCurrentAnswer: null,
  })

  // Đồng bộ đồng hồ: offset = giờ_local - giờ_server
  const clockOffsetRef = useRef(0)
  const questionStartedAtRef = useRef<number | null>(null)
  // toàn bộ đề (đã che đáp án) — chỉ GV có, dùng để tính câu kế tiếp
  const outlineRef = useRef<LiveQuestionView[]>([])
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const joinBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flashJoinBadge = useCallback(() => {
    setState((s) => ({ ...s, showJoinBadge: true }))
    if (joinBadgeTimer.current) clearTimeout(joinBadgeTimer.current)
    joinBadgeTimer.current = setTimeout(() => {
      setState((s) => ({ ...s, showJoinBadge: false }))
    }, 3000)
  }, [])

  // Nạp snapshot ban đầu
  useEffect(() => {
    let cancelled = false
    getLiveQuizSnapshot(sessionId)
      .then((snap) => {
        if (cancelled) return
        clockOffsetRef.current = Date.now() - snap.serverNow
        questionStartedAtRef.current = snap.questionStartedAt
        outlineRef.current = (snap.teacherExtras?.outline as LiveQuestionView[]) ?? []
        setState((s) => ({
          ...s,
          loading: false,
          phase: snap.phase as LiveQuizView["phase"],
          className: snap.className,
          isTeacher: snap.isTeacher,
          currentIndex: snap.currentIndex,
          total: snap.total,
          question: snap.question,
          revealed: snap.revealed,
          timeLimitSec: snap.question?.timeLimitSec ?? null,
          joinedCount: snap.joinedCount,
          answers: snap.answers,
          notFullscreen: snap.notFullscreen,
          teacherNext: snap.teacherExtras?.next ?? null,
          teacherCurrentAnswer: snap.teacherExtras?.current ?? null,
        }))
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Kết nối SSE
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${sessionId}/stream`)
    es.addEventListener("connected", () => setState((s) => ({ ...s, connected: true })))

    es.onmessage = (e) => {
      let ev: { type: string; studentId?: string | null; studentName?: string | null; payload?: Record<string, unknown> | null }
      try {
        ev = JSON.parse(e.data)
      } catch {
        return
      }
      const p = ev.payload ?? {}
      switch (ev.type) {
        case "question_changed": {
          questionStartedAtRef.current = (p.startedAt as number) ?? Date.now()
          if (typeof p.serverNow === "number") clockOffsetRef.current = Date.now() - (p.serverNow as number)
          const q = p.question as LiveQuestionView
          const idx = (p.index as number) ?? -1
          const next = idx >= 0 && idx + 1 < outlineRef.current.length ? outlineRef.current[idx + 1] : null
          setState((s) => ({
            ...s,
            phase: "question",
            currentIndex: idx >= 0 ? idx : s.currentIndex,
            total: (p.total as number) ?? s.total,
            question: q,
            revealed: null,
            timeLimitSec: q?.timeLimitSec ?? null,
            answers: [],
            teacherCurrentAnswer: null,
            teacherNext: next,
          }))
          break
        }
        case "revealed": {
          setState((s) => ({
            ...s,
            phase: "revealed",
            revealed: {
              correctOptionIds: (p.correctOptionIds as string[]) ?? [],
              correctText: (p.correctText as string | null) ?? null,
            },
            teacherCurrentAnswer: {
              correctOptionIds: (p.correctOptionIds as string[]) ?? [],
              correctText: (p.correctText as string | null) ?? null,
            },
          }))
          break
        }
        case "student_joined": {
          setState((s) => ({ ...s, joinedCount: (p.joinedCount as number) ?? s.joinedCount + 1 }))
          flashJoinBadge()
          break
        }
        case "answer_submitted": {
          if (!ev.studentId) break
          setState((s) => {
            const rest = s.answers.filter((a) => a.studentId !== ev.studentId)
            return {
              ...s,
              answers: [...rest, { studentId: ev.studentId!, name: ev.studentName ?? "Học sinh", correct: !!p.correct }],
            }
          })
          break
        }
        case "fullscreen_changed": {
          if (!ev.studentId) break
          setState((s) => {
            const rest = s.notFullscreen.filter((n) => n.studentId !== ev.studentId)
            return {
              ...s,
              notFullscreen: p.isFullscreen
                ? rest
                : [...rest, { studentId: ev.studentId!, name: ev.studentName ?? "Học sinh" }],
            }
          })
          break
        }
        case "session_ended": {
          setState((s) => ({ ...s, phase: "ended" }))
          break
        }
      }
    }

    es.onerror = () => setState((s) => ({ ...s, connected: false }))
    return () => es.close()
  }, [sessionId, flashJoinBadge])

  // Đồng hồ đếm ngược cục bộ
  useEffect(() => {
    const tick = () => {
      const startedAt = questionStartedAtRef.current
      const limit = state.timeLimitSec
      if (state.phase !== "question" || !startedAt || !limit) {
        setRemainingSec(state.phase === "question" && limit ? limit : null)
        return
      }
      const serverNow = Date.now() - clockOffsetRef.current
      const elapsed = (serverNow - startedAt) / 1000
      setRemainingSec(Math.max(0, Math.ceil(limit - elapsed)))
    }
    tick()
    const iv = setInterval(tick, 250)
    return () => clearInterval(iv)
  }, [state.phase, state.timeLimitSec])

  return { ...state, remainingSec }
}
