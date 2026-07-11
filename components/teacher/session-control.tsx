"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { LiveSession } from "@/app/actions/sessions"
import {
  getLessonsForQuiz,
  startQuizSession,
  createDraftSession,
  activateDraftSession,
  deleteDraftSession,
  type QuizLessonOption,
  type DraftSessionDto,
} from "@/app/actions/live-quiz"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Radio, Monitor, Presentation, CalendarClock, Play, Trash2 } from "lucide-react"

export function SessionControl({
  classId,
  activeSession,
  drafts,
}: {
  classId: string
  activeSession: LiveSession | null
  drafts: DraftSessionDto[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [lessons, setLessons] = useState<QuizLessonOption[] | null>(null)
  const [lessonId, setLessonId] = useState<string>("")
  const [defaultTime, setDefaultTime] = useState(30)
  const [mode, setMode] = useState<"now" | "draft">("now")

  function openConfig() {
    setOpen(true)
    if (!lessons) {
      getLessonsForQuiz()
        .then((rows) => {
          setLessons(rows)
          if (rows.length > 0) setLessonId(rows[0].id)
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được danh sách bài"))
    }
  }

  function handleStart() {
    if (!lessonId) {
      toast.error("Vui lòng chọn một bài để trình chiếu")
      return
    }
    startTransition(async () => {
      try {
        if (mode === "draft") {
          await createDraftSession({ classId, lessonId, defaultTimeSec: defaultTime })
          toast.success("Đã lưu phiên nháp. Bấm 'Dạy ngay' khi muốn trình chiếu.")
          setOpen(false)
          router.refresh()
        } else {
          const { sessionId } = await startQuizSession({ classId, lessonId, defaultTimeSec: defaultTime })
          toast.success("Đã bắt đầu phiên trình chiếu")
          router.push(`/teacher/sessions/${sessionId}`)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  function handleActivate(id: string) {
    startTransition(async () => {
      try {
        const { sessionId } = await activateDraftSession(id)
        toast.success("Đã bắt đầu phiên trình chiếu")
        router.push(`/teacher/sessions/${sessionId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteDraftSession(id)
        toast.success("Đã xoá phiên nháp")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <Presentation className="h-4 w-4 text-primary" />
          Phiên trình chiếu quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {activeSession
              ? "Một phiên trình chiếu đang diễn ra. Mở màn hình điều khiển để chiếu câu hỏi cho cả lớp."
              : "Bắt đầu ngay hoặc soạn trước một phiên để hôm sau dạy. Khi trình chiếu có thể chiếu lên TV hoặc không."}
          </p>
          {activeSession ? (
            <Button nativeButton={false} render={<a href={`/teacher/sessions/${activeSession.id}`} />}>
              <Monitor className="h-4 w-4" />
              Mở màn hình điều khiển
            </Button>
          ) : (
            <Button onClick={openConfig} disabled={pending}>
              <Radio className="h-4 w-4" />
              Tạo phiên trình chiếu
            </Button>
          )}
        </div>

        {/* Danh sách phiên nháp đã soạn */}
        {drafts.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              Phiên đã soạn ({drafts.length})
            </p>
            {drafts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.lessonTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.chapterTitle} · {d.questionCount} câu · {d.defaultTimeSec}s/câu
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" onClick={() => handleActivate(d.id)} disabled={pending || Boolean(activeSession)}>
                    <Play className="h-3.5 w-3.5" />
                    Dạy ngay
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(d.id)}
                    disabled={pending}
                    aria-label="Xoá phiên nháp"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cấu hình phiên trình chiếu</DialogTitle>
            <DialogDescription>
              Chọn bài học và thời gian mặc định cho mỗi câu hỏi.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label>Bài học</Label>
              {lessons === null ? (
                <p className="text-sm text-muted-foreground">Đang tải danh sách bài…</p>
              ) : lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có bài nào sẵn sàng (cần bài có câu hỏi trắc nghiệm, đúng/sai hoặc trả lời ngắn).
                </p>
              ) : (
                <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border p-1">
                  {lessons.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLessonId(l.id)}
                      className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        lessonId === l.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{l.title}</span>
                        <span
                          className={`block truncate text-xs ${
                            lessonId === l.id ? "text-primary-foreground/80" : "text-muted-foreground"
                          }`}
                        >
                          {l.chapterTitle}
                        </span>
                      </span>
                      <span
                        className={`ml-2 shrink-0 text-xs ${
                          lessonId === l.id ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {l.questionCount} câu
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="defaultTime">Thời gian mặc định mỗi câu (giây)</Label>
              <Input
                id="defaultTime"
                type="number"
                min={5}
                max={600}
                value={defaultTime}
                onChange={(e) => setDefaultTime(Math.max(5, Number(e.target.value) || 30))}
              />
              <p className="text-xs text-muted-foreground">
                Áp dụng cho các câu chưa đặt thời gian riêng khi soạn.
              </p>
            </div>

            {/* Chọn chế độ: dạy ngay hoặc lưu nháp */}
            <div className="flex flex-col gap-2">
              <Label>Khi tạo phiên</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("now")}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    mode === "now" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="block font-medium text-foreground">Bắt đầu ngay</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Mở màn hình điều khiển liền</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("draft")}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                    mode === "draft" ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <span className="block font-medium text-foreground">Lưu nháp</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Để dạy vào hôm sau</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Hủy
            </Button>
            <Button
              onClick={handleStart}
              disabled={pending || !lessonId || (lessons?.length ?? 0) === 0}
            >
              <Presentation className="h-4 w-4" />
              {pending ? "Đang xử lý…" : mode === "draft" ? "Lưu nháp" : "Bắt đầu trình chiếu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
