"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Monitor,
  MonitorOff,
  Play,
  Square,
  Check,
  X,
  Minus,
  GraduationCap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { TeacherNav } from "@/components/teacher/teacher-nav"
import { QuizStage } from "./quiz-stage"
import { StageFrame } from "./stage-frame"
import { TvStageTour } from "./tv-stage-tour"
import { useLiveQuiz } from "./use-live-quiz"
import { goToQuestion, revealCurrent, endQuizSession } from "@/app/actions/live-quiz"
import { cn } from "@/lib/utils"
import { stripOptionPrefix } from "@/lib/option-prefix"

const LEFT_REVEAL_MS = 1500
const LEFT_EDGE_PX = 24
const LEFT_PANEL_PX = 160

function NextQuestionPreview({
  indexLabel,
  content,
  options,
}: {
  indexLabel: string
  content: string
  options: { id: string; content: string }[]
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const inner = innerRef.current
    if (!box || !inner) return

    function fit() {
      if (!box || !inner) return
      const maxH = box.clientHeight
      const maxW = box.clientWidth
      if (maxH < 8 || maxW < 8) return
      let lo = 6
      let hi = 12
      let best = 6
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        inner.style.fontSize = `${mid}px`
        const overflow = inner.scrollHeight > maxH + 1 || inner.scrollWidth > maxW + 1
        if (overflow) {
          hi = mid
        } else {
          best = mid
          lo = mid
        }
      }
      inner.style.fontSize = `${best}px`
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [content, options, indexLabel])

  return (
    <div ref={boxRef} className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background p-1.5 shadow-inner">
      <div ref={innerRef} className="flex w-full flex-col gap-1 leading-tight">
        <span className="w-fit rounded-full bg-primary/15 px-1.5 py-px text-[0.85em] font-semibold text-primary">
          {indexLabel}
        </span>
        <p className="font-medium break-words text-foreground">{content}</p>
        {options.length > 0 && (
          <ul className="space-y-0.5 text-[0.85em] text-muted-foreground">
            {options.map((o, i) => (
              <li key={o.id} className="break-words">
                {["A", "B", "C", "D", "E", "F"][i] ?? i + 1}. {stripOptionPrefix(o.content)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function TeacherConsole({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const view = useLiveQuiz(sessionId)
  const [pending, startTransition] = useTransition()
  const [headerOpen, setHeaderOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(false)
  const [tvTourOpen, setTvTourOpen] = useState(false)
  const [tvOpen, setTvOpen] = useState(false)
  const tvPopupRef = useRef<Window | null>(null)
  const leftOpenRef = useRef(false)
  const leftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const correctStudents = view.answers.filter((a) => a.correct)
  const wrongStudents = view.answers.filter((a) => !a.correct)
  const answeredIds = useMemo(
    () => new Set(view.answers.map((a) => a.studentId)),
    [view.answers],
  )
  const unansweredStudents = view.joined.filter((s) => !answeredIds.has(s.studentId))
  const unansweredCount =
    view.joined.length > 0
      ? unansweredStudents.length
      : Math.max(0, view.joinedCount - view.answers.length)
  const followUpNames = [...wrongStudents, ...unansweredStudents]

  const autoRevealedFor = useRef<number>(-1)
  const sawTimeOnIndex = useRef<number>(-1)
  const applyReveal = view.applyReveal
  useEffect(() => {
    if (view.phase === "question" && view.remainingSec != null && view.remainingSec > 0) {
      sawTimeOnIndex.current = view.currentIndex
    }
    if (
      !pending &&
      view.phase === "question" &&
      view.remainingSec === 0 &&
      view.timeLimitSec != null &&
      view.question &&
      sawTimeOnIndex.current === view.currentIndex &&
      autoRevealedFor.current !== view.currentIndex
    ) {
      autoRevealedFor.current = view.currentIndex
      revealCurrent(sessionId, view.currentIndex)
        .then((res) => {
          if (!res.revealed) return
          applyReveal({
            correctOptionIds: res.correctOptionIds,
            correctText: res.correctText,
          })
        })
        .catch(() => {})
    }
  }, [pending, view.phase, view.remainingSec, view.currentIndex, view.timeLimitSec, view.question, sessionId, applyReveal])

  useEffect(() => {
    leftOpenRef.current = leftOpen
  }, [leftOpen])

  useEffect(() => {
    if (!tvOpen) return
    const id = window.setInterval(() => {
      const popup = tvPopupRef.current
      if (!popup || popup.closed) {
        tvPopupRef.current = null
        setTvOpen(false)
      }
    }, 800)
    return () => window.clearInterval(id)
  }, [tvOpen])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const x = e.clientX
      if (leftOpenRef.current) {
        if (x > LEFT_PANEL_PX) {
          if (leftTimer.current) {
            clearTimeout(leftTimer.current)
            leftTimer.current = null
          }
          leftOpenRef.current = false
          setLeftOpen(false)
        }
        return
      }
      if (x <= LEFT_EDGE_PX) {
        if (!leftTimer.current) {
          leftTimer.current = setTimeout(() => {
            leftTimer.current = null
            leftOpenRef.current = true
            setLeftOpen(true)
          }, LEFT_REVEAL_MS)
        }
      } else if (leftTimer.current) {
        clearTimeout(leftTimer.current)
        leftTimer.current = null
      }
    }
    window.addEventListener("mousemove", onMove)
    return () => {
      window.removeEventListener("mousemove", onMove)
      if (leftTimer.current) clearTimeout(leftTimer.current)
    }
  }, [])

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        const result = await fn()
        if (result && typeof result === "object") {
          if ("question" in result && "index" in result) {
            const payload = result as {
              index: number
              total: number
              question: NonNullable<typeof view.question>
              next: typeof view.teacherNext
              startedAt: number | null
              serverNow: number
            }
            view.applyQuestion(payload)
          } else if ("revealed" in result && result.revealed === true) {
            const payload = result as {
              revealed: true
              correctOptionIds: string[]
              correctText: string | null
            }
            view.applyReveal({
              correctOptionIds: payload.correctOptionIds,
              correctText: payload.correctText,
            })
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  const atStart = view.currentIndex <= 0
  const atEnd = view.currentIndex >= view.total - 1
  const notStarted = view.phase === "lobby" || view.currentIndex < 0

  if (view.phase === "ended") {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <h1 className="font-heading text-3xl font-bold">Phiên đã kết thúc</h1>
        <p className="text-muted-foreground">Cảm ơn bạn đã sử dụng chế độ trình chiếu.</p>
        <Button onClick={() => router.push("/teacher/classes")}>Về danh sách lớp</Button>
      </div>
    )
  }

  return (
    <>
    <div className="fixed inset-0 z-[80] flex overflow-hidden bg-background">
      <div
        className="absolute inset-x-0 top-0 z-[90]"
        onMouseEnter={() => setHeaderOpen(true)}
        onMouseLeave={() => setHeaderOpen(false)}
      >
        <div className="h-1.5 w-full bg-primary/40" />
        <header
          className={cn(
            "overflow-hidden border-b border-white/10 bg-background/10 backdrop-blur-[1px] transition-[max-height,opacity] duration-200",
            headerOpen ? "max-h-10 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="flex h-8 items-center justify-between px-3">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/80 text-primary-foreground">
                <GraduationCap className="h-3 w-3" />
              </span>
              <p className="font-heading text-sm font-bold leading-none text-foreground">EduSync</p>
            </div>
            <SignOutButton />
          </div>
        </header>
      </div>

      <aside
        className={cn(
          "pointer-events-none absolute top-0 bottom-12 left-0 z-[90] w-40 border-r border-border/50 bg-card pt-8 shadow-lg transition-transform duration-200",
          leftOpen ? "pointer-events-auto translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!leftOpen}
      >
        <div className="flex h-full flex-col gap-2 overflow-y-auto px-2 pb-3">
          <p className="px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            Menu
          </p>
          <TeacherNav />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 min-w-0 flex-1">
          <StageFrame>
            <QuizStage view={view} />
          </StageFrame>
        </div>

        <div className="relative z-[100] flex shrink-0 flex-wrap items-center justify-center gap-1.5 border-t bg-card px-3 py-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => run(() => goToQuestion(sessionId, view.currentIndex - 1))}
            disabled={pending || atStart || notStarted}
          >
            <ChevronLeft className="h-4 w-4" />
            Trước
          </Button>

          {view.phase === "question" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run(() => revealCurrent(sessionId, view.currentIndex))}
              disabled={pending}
            >
              <Eye className="h-4 w-4" />
              Đáp án
            </Button>
          )}

          {notStarted ? (
            <Button
              size="sm"
              onClick={() => run(() => goToQuestion(sessionId, 0))}
              disabled={pending || view.total === 0}
            >
              <Play className="h-4 w-4" />
              Bắt đầu
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => run(() => goToQuestion(sessionId, view.currentIndex + 1))}
              disabled={pending || atEnd}
            >
              Tiếp
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setTvTourOpen(true)}
          >
            <Monitor className="h-4 w-4" />
            TV
          </Button>

          {tvOpen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  tvPopupRef.current?.close()
                } catch {}
                tvPopupRef.current = null
                setTvOpen(false)
              }}
            >
              <MonitorOff className="h-4 w-4" />
              Tắt TV
            </Button>
          )}

          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("Kết thúc phiên trình chiếu?")) run(() => endQuizSession(sessionId))
            }}
            disabled={pending}
          >
            <Square className="h-4 w-4" />
            Kết thúc
          </Button>
        </div>
      </div>

      <aside className="flex w-36 shrink-0 flex-col border-l bg-card">
        <div className="flex min-h-0 flex-[2] flex-col overflow-hidden">
          <div className="border-b px-2 py-1.5">
            <p className="truncate text-[11px] font-medium text-muted-foreground">{view.className}</p>
            <p className="text-[10px] text-muted-foreground">
              {view.connected ? "Đã kết nối" : "Đang kết nối…"} · {view.joinedCount} HS
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1 px-1.5 py-1.5">
            <div className="flex flex-col items-center rounded-md bg-primary/10 py-1">
              <span className="flex items-center gap-0.5 text-sm font-bold text-primary">
                <Check className="h-3 w-3" />
                {correctStudents.length}
              </span>
              <span className="text-[9px] text-muted-foreground">Đúng</span>
            </div>
            <div className="flex flex-col items-center rounded-md bg-destructive/10 py-1">
              <span className="flex items-center gap-0.5 text-sm font-bold text-destructive">
                <X className="h-3 w-3" />
                {wrongStudents.length}
              </span>
              <span className="text-[9px] text-muted-foreground">Sai</span>
            </div>
            <div className="flex flex-col items-center rounded-md bg-muted py-1">
              <span className="flex items-center gap-0.5 text-sm font-bold text-muted-foreground">
                <Minus className="h-3 w-3" />
                {unansweredCount}
              </span>
              <span className="text-[9px] text-muted-foreground">Chưa</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">
              Sai / chưa trả lời ({followUpNames.length})
            </p>
            <ul className="flex flex-col gap-0.5">
              {wrongStudents.map((s) => (
                <li
                  key={`w-${s.studentId}`}
                  className="truncate rounded bg-destructive/5 px-1.5 py-0.5 text-[11px] text-foreground"
                  title={s.name}
                >
                  {s.name}
                </li>
              ))}
              {unansweredStudents.map((s) => (
                <li
                  key={`u-${s.studentId}`}
                  className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  title={s.name}
                >
                  {s.name}
                </li>
              ))}
              {followUpNames.length === 0 && (
                <li className="text-[11px] text-muted-foreground">
                  {view.answers.length > 0 ? "Tất cả đã đúng" : "Chưa có câu trả lời"}
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t bg-muted/70 p-1.5">
          <p className="mb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Câu tiếp theo
          </p>
          {view.teacherNext ? (
            <NextQuestionPreview
              indexLabel={`Câu ${view.currentIndex + 2}/${view.total}`}
              content={view.teacherNext.content}
              options={view.teacherNext.type === "SA" ? [] : view.teacherNext.options}
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background p-1.5 shadow-inner">
              <p className="text-[11px] text-muted-foreground">
                {atEnd ? "Đây là câu cuối cùng" : "—"}
              </p>
            </div>
          )}
        </div>
      </aside>

    </div>
    <TvStageTour
      open={tvTourOpen}
      onOpenChange={setTvTourOpen}
      sessionId={sessionId}
      onPopupChange={(popup) => {
        tvPopupRef.current = popup
        setTvOpen(!!popup && !popup.closed)
      }}
    />
    </>
  )
}
