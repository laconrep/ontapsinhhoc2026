"use client"

import { useTransition } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { QuizStage } from "./quiz-stage"
import { useLiveQuiz } from "./use-live-quiz"
import { goToQuestion, revealCurrent, endQuizSession } from "@/app/actions/live-quiz"

export function TeacherConsole({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const view = useLiveQuiz(sessionId)
  const [pending, startTransition] = useTransition()

  const correctCount = view.answers.filter((a) => a.correct).length
  const wrongStudents = view.answers.filter((a) => !a.correct)
  const answeredCount = view.answers.length

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
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Hàng trên: sân khấu + panel kết quả */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          <QuizStage view={view} />
        </div>

        {/* Panel đúng/sai (góc phải) */}
        <aside className="flex w-72 shrink-0 flex-col border-l bg-card">
          <div className="border-b p-4">
            <p className="text-sm font-medium text-muted-foreground">{view.className}</p>
            <p className="text-xs text-muted-foreground">
              {view.connected ? "Đã kết nối" : "Đang kết nối…"} · {view.joinedCount} HS tham gia
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            <div className="flex flex-col items-center rounded-lg bg-primary/10 py-3">
              <span className="flex items-center gap-1 text-2xl font-bold text-primary">
                <Check className="h-5 w-5" />
                {correctCount}
              </span>
              <span className="text-xs text-muted-foreground">Đúng</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-destructive/10 py-3">
              <span className="flex items-center gap-1 text-2xl font-bold text-destructive">
                <X className="h-5 w-5" />
                {wrongStudents.length}
              </span>
              <span className="text-xs text-muted-foreground">Sai</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Học sinh trả lời sai ({wrongStudents.length})
            </p>
            <ul className="flex flex-col gap-1">
              {wrongStudents.map((s) => (
                <li
                  key={s.studentId}
                  className="rounded-md bg-destructive/5 px-2 py-1 text-sm text-foreground"
                >
                  {s.name}
                </li>
              ))}
              {wrongStudents.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {answeredCount > 0 ? "Chưa có ai trả lời sai" : "Chưa có câu trả lời"}
                </li>
              )}
            </ul>
          </div>
        </aside>
      </div>

      {/* Hàng dưới: câu kế tiếp + điều khiển */}
      <div className="flex shrink-0 items-stretch gap-4 border-t bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg bg-muted px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground">Câu hỏi tiếp theo</p>
          <p className="truncate text-sm text-foreground">
            {view.teacherNext ? view.teacherNext.content : atEnd ? "Đây là câu cuối cùng" : "—"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => run(() => goToQuestion(sessionId, view.currentIndex - 1))}
            disabled={pending || atStart || notStarted}
          >
            <ChevronLeft className="h-4 w-4" />
            Câu trước
          </Button>

          {view.phase === "question" && (
            <Button
              variant="secondary"
              onClick={() => run(() => revealCurrent(sessionId))}
              disabled={pending}
            >
              <Eye className="h-4 w-4" />
              Hiện đáp án
            </Button>
          )}

          {notStarted ? (
            <Button onClick={() => run(() => goToQuestion(sessionId, 0))} disabled={pending || view.total === 0}>
              <Play className="h-4 w-4" />
              Bắt đầu
            </Button>
          ) : (
            <Button
              onClick={() => run(() => goToQuestion(sessionId, view.currentIndex + 1))}
              disabled={pending || atEnd}
            >
              Câu tiếp theo
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            nativeButton={false}
            render={<a href={`/teacher/sessions/${sessionId}/present`} target="_blank" rel="noreferrer" />}
          >
            <Monitor className="h-4 w-4" />
            Màn hình trình chiếu
          </Button>

          <Button
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
    </div>
  )
}
