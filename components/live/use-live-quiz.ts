"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"

export interface LiveQuestionView {
  id: string
  index: number
  type: "MC" | "TF" | "SA"
  content: string
  bodyHtml?: string | null
  knowledgePointContent: string
  options: { id: string; content: string; bodyHtml?: string | null; order: number }[]
  timeLimitSec: number | null
}

export interface AnswerTally {
  studentId: string
  name: string
  correct: boolean
}

export interface JoinedStudent {
  studentId: string
  name: string
  online: boolean
}

export interface RevealInfo {
  correctOptionIds: string[]
  correctText: string | null
}

type Snapshot = {
  className: string
  isTeacher: boolean
  phase: string
  currentIndex: number
  total: number
  questionStartedAt: number | null
  serverNow: number
  joinedCount: number
  joined?: JoinedStudent[]
  answers: AnswerTally[]
  notFullscreen: { studentId: string; name: string }[]
  question: LiveQuestionView | null
  revealed: RevealInfo | null
  teacherExtras: {
    current: RevealInfo | null
    next: LiveQuestionView | null
  } | null
}

export interface LiveQuizView {
  connected: boolean
  loading: boolean
  error: string | null
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
  joined: JoinedStudent[]
  showJoinBadge: boolean
  answers: AnswerTally[]
  notFullscreen: { studentId: string; name: string }[]
  teacherNext: LiveQuestionView | null
  teacherCurrentAnswer: RevealInfo | null
  refresh: () => Promise<void>
  applyQuestion: (payload: {
    index: number
    total: number
    question: LiveQuestionView
    next: LiveQuestionView | null
    startedAt: number | null
    serverNow: number
  }) => void
  applyReveal: (payload: RevealInfo) => void
}

/**
 * Hook kết nối SSE + đồng bộ trạng thái phiên trình chiếu quiz.
 * Dùng chung cho màn hình GV, màn hình trình chiếu (TV) và màn hình HS.
 */
type LiveQuizState = Omit<LiveQuizView, "remainingSec" | "refresh" | "applyQuestion" | "applyReveal">

export function useLiveQuiz(sessionId: string): LiveQuizView {
  const [state, setState] = useState<LiveQuizState>({
    connected: false,
    loading: true,
    error: null,
    phase: "lobby",
    className: "",
    isTeacher: false,
    currentIndex: -1,
    total: 0,
    question: null,
    revealed: null,
    timeLimitSec: null,
    joinedCount: 0,
    joined: [],
    showJoinBadge: false,
    answers: [],
    notFullscreen: [],
    teacherNext: null,
    teacherCurrentAnswer: null,
  })

  const clockOffsetRef = useRef(0)
  const questionStartedAtRef = useRef<number | null>(null)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)
  const joinBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshInFlight = useRef(false)
  const lastStartedAtRef = useRef(0)

  const flashJoinBadge = useCallback(() => {
    setState((s) => ({ ...s, showJoinBadge: true }))
    if (joinBadgeTimer.current) clearTimeout(joinBadgeTimer.current)
    joinBadgeTimer.current = setTimeout(() => {
      setState((s) => ({ ...s, showJoinBadge: false }))
    }, 3000)
  }, [])

  const applySnap = useCallback((snap: Snapshot) => {
    if (snap.error && snap.total === 0) {
      setState((s) => ({
        ...s,
        loading: false,
        error: snap.error,
        className: snap.className || s.className,
        isTeacher: snap.isTeacher,
      }))
      return
    }
    const started = snap.questionStartedAt ?? 0
    if (
      snap.phase !== "ended" &&
      lastStartedAtRef.current > 0 &&
      started < lastStartedAtRef.current
    ) {
      setState((s) => ({
        ...s,
        loading: false,
        error: snap.error ?? null,
        joinedCount: snap.joinedCount,
        joined: snap.joined ?? s.joined,
        answers: snap.answers,
        notFullscreen: snap.notFullscreen,
      }))
      return
    }
    if (started > 0) lastStartedAtRef.current = started
    clockOffsetRef.current = Date.now() - snap.serverNow
    questionStartedAtRef.current = snap.questionStartedAt
    const limit = snap.question?.timeLimitSec ?? null
    if (snap.phase === "question" && started && limit) {
      const serverNow = snap.serverNow
      const elapsed = (serverNow - started) / 1000
      setRemainingSec(Math.max(0, Math.ceil(limit - elapsed)))
    } else {
      setRemainingSec(snap.phase === "question" ? limit : null)
    }
    setState((s) => ({
      ...s,
      loading: false,
      error: snap.error ?? null,
      phase: snap.phase as LiveQuizView["phase"],
      className: snap.className,
      isTeacher: snap.isTeacher,
      currentIndex: snap.currentIndex,
      total: snap.total,
      question: snap.question,
      revealed: snap.revealed,
      timeLimitSec: limit,
      joinedCount: snap.joinedCount,
      joined: snap.joined ?? s.joined,
      answers: snap.answers,
      notFullscreen: snap.notFullscreen,
      teacherNext: snap.teacherExtras?.next ?? null,
      teacherCurrentAnswer: snap.teacherExtras?.current ?? null,
    }))
  }, [])

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    try {
      const snap = await api.get<Snapshot>(`/sessions/${sessionId}/live`)
      applySnap(snap)
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Không tải được phiên",
      }))
    } finally {
      refreshInFlight.current = false
    }
  }, [sessionId, applySnap])

  useEffect(() => {
    let cancelled = false
    api
      .get<Snapshot>(`/sessions/${sessionId}/live`)
      .then((snap) => {
        if (!cancelled) applySnap(snap)
      })
      .catch((err) => {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : "Không tải được phiên",
          }))
        }
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, applySnap])

  useEffect(() => {
    let es: EventSource | null = null
    let closed = false

    const open = () => {
      if (closed) return
      es = new EventSource(`/api/sessions/${sessionId}/stream`)
      es.addEventListener("connected", () => {
        setState((s) => ({ ...s, connected: true }))
        void refresh()
      })

      es.onmessage = (e) => {
        let ev: {
          type: string
          studentId?: string | null
          studentName?: string | null
          payload?: Record<string, unknown> | null
        }
        try {
          ev = JSON.parse(e.data)
        } catch {
          return
        }
        const p = ev.payload ?? {}
        switch (ev.type) {
          case "question_changed": {
            const startedAt = (p.startedAt as number) ?? Date.now()
            if (startedAt > 0) lastStartedAtRef.current = Math.max(lastStartedAtRef.current, startedAt)
            questionStartedAtRef.current = startedAt
            if (typeof p.serverNow === "number") clockOffsetRef.current = Date.now() - (p.serverNow as number)
            const q = p.question as LiveQuestionView | undefined
            const idx = (p.index as number) ?? -1
            if (!q) {
              void refresh()
              break
            }
            const limit = q.timeLimitSec ?? null
            setRemainingSec(limit)
            setState((s) => ({
              ...s,
              error: null,
              phase: "question",
              currentIndex: idx >= 0 ? idx : s.currentIndex,
              total: (p.total as number) ?? s.total,
              question: q,
              revealed: null,
              timeLimitSec: limit,
              answers: [],
              teacherCurrentAnswer: null,
              teacherNext: (p.next as LiveQuestionView | null | undefined) ?? null,
            }))
            break
          }
          case "revealed": {
            const revealIdx = typeof p.index === "number" ? (p.index as number) : null
            setState((s) => {
              if (revealIdx != null && s.currentIndex >= 0 && revealIdx !== s.currentIndex) return s
              return {
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
              }
            })
            break
          }
          case "student_joined": {
            setState((s) => {
              const id = ev.studentId
              const name = ev.studentName ?? "Học sinh"
              const rest = id ? s.joined.filter((j) => j.studentId !== id) : s.joined
              const joined = id ? [...rest, { studentId: id, name, online: true }] : s.joined
              return {
                ...s,
                joinedCount: (p.joinedCount as number) ?? joined.filter((j) => j.online).length,
                joined,
              }
            })
            flashJoinBadge()
            break
          }
          case "answer_submitted": {
            if (!ev.studentId) break
            setState((s) => {
              const rest = s.answers.filter((a) => a.studentId !== ev.studentId)
              const name = ev.studentName ?? "Học sinh"
              const joined = s.joined.some((j) => j.studentId === ev.studentId)
                ? s.joined
                : [...s.joined, { studentId: ev.studentId!, name, online: true }]
              return {
                ...s,
                joined,
                joinedCount: Math.max(s.joinedCount, joined.length),
                answers: [...rest, { studentId: ev.studentId!, name, correct: !!p.correct }],
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

      es.onerror = () => {
        setState((s) => ({ ...s, connected: false }))
      }
    }

    open()

    return () => {
      closed = true
      es?.close()
    }
  }, [sessionId, flashJoinBadge, refresh])

  useEffect(() => {
    const tick = () => {
      void refresh()
    }
    const iv = setInterval(tick, 2000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      clearInterval(iv)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [refresh])

  const applyQuestion = useCallback(
    (payload: {
      index: number
      total: number
      question: LiveQuestionView
      next: LiveQuestionView | null
      startedAt: number | null
      serverNow: number
    }) => {
      const startedAt = payload.startedAt ?? Date.now()
      if (startedAt > 0) lastStartedAtRef.current = Math.max(lastStartedAtRef.current, startedAt)
      questionStartedAtRef.current = startedAt
      clockOffsetRef.current = Date.now() - payload.serverNow
      const next = payload.next ?? null
      const limit = payload.question?.timeLimitSec ?? null
      setRemainingSec(limit)
      setState((s) => ({
        ...s,
        error: null,
        phase: "question",
        currentIndex: payload.index,
        total: payload.total,
        question: payload.question,
        revealed: null,
        timeLimitSec: limit,
        answers: [],
        teacherCurrentAnswer: null,
        teacherNext: next,
      }))
    },
    [],
  )

  const applyReveal = useCallback((payload: RevealInfo) => {
    setState((s) => ({
      ...s,
      phase: "revealed",
      revealed: payload,
      teacherCurrentAnswer: payload,
    }))
  }, [])

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
  }, [state.phase, state.timeLimitSec, state.currentIndex, state.question?.id])

  return { ...state, remainingSec, refresh, applyQuestion, applyReveal }
}
