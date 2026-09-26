"use client"

import { useEffect, useMemo, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Monitor,
  Play,
  Square,
  Check,
  X,
  Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizStage } from "./quiz-stage"
import { useLiveQuiz } from "./use-live-quiz"
import { goToQuestion, revealCurrent, endQuizSession } from "@/app/actions/live-quiz"

export function TeacherConsole({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const view = useLiveQuiz(sessionId)
  const [pending, startTransition] = useTransition()

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
  useEffect(() => {
    if (
      view.phase === "question" &&
      view.remainingSec === 0 &&
      autoRevealedFor.current !== view.currentIndex
    ) {
      autoRevealedFor.current = view.currentIndex
      revealCurrent(sessionId).catch(() => {})
    }
  }, [view.phase, view.remainingSec, view.currentIndex, sessionId])

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn()
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="font-heading text-3xl font-bold">Phiên đã kết thúc</h1>
        <p className="text-muted-foreground">Cảm ơn bạn đã sử dụng chế độ trình chiếu.</p>
        <Button onClick={() => router.push("/teacher/classes")}>Về danh sách lớp</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      <div className="relative min-h-0 min-w-0 flex-1">
        <QuizStage view={view} />

        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-wrap items-center justify-center gap-1.5 bg-gradient-to-t from-background/80 to-transparent px-3 pb-3 pt-8">
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
              onClick={() => run(() => revealCurrent(sessionId))}
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
            nativeButton={false}
            render={<a href={`/teacher/sessions/${sessionId}/present`} target="_blank" rel="noreferrer" />}
          >
            <Monitor className="h-4 w-4" />
            TV
          </Button>

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
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border/60 bg-background p-1.5 shadow-inner">
            {view.teacherNext ? (
              <div className="flex h-full flex-col gap-1 overflow-hidden">
                <span className="w-fit rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold text-primary">
                  Câu {view.currentIndex + 2}/{view.total}
                </span>
                <p className="line-clamp-4 text-[11px] leading-snug font-medium text-foreground">
                  {view.teacherNext.content}
                </p>
                {view.teacherNext.type !== "SA" && view.teacherNext.options.length > 0 && (
                  <ul className="mt-auto space-y-0.5 overflow-hidden">
                    {view.teacherNext.options.slice(0, 4).map((o, i) => (
                      <li key={o.id} className="truncate text-[9px] text-muted-foreground">
                        {["A", "B", "C", "D"][i]}. {o.content}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {atEnd ? "Đây là câu cuối cùng" : "—"}
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}
