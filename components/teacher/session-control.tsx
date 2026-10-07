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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Monitor, Presentation, Play, Trash2, Tv, CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"

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

  function openConfig(nextMode: "now" | "draft" = "now") {
    setMode(nextMode)
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
    <div className="flex flex-col gap-3">
      {activeSession ? (
        <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg shadow-primary/20 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-white/5" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
                </span>
                Đang chiếu
              </p>
              <h2 className="mt-3 font-heading text-xl font-bold text-balance sm:text-2xl">
                Quiz đang chạy trên lớp
              </h2>
              <p className="mt-1 text-sm text-primary-foreground/85">
                Học sinh vào ngay trên điện thoại. Mở điều khiển hoặc chiếu lên TV.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                size="lg"
                className="h-11 bg-white px-4 text-primary hover:bg-white/90"
                nativeButton={false}
                render={<a href={`/teacher/sessions/${activeSession.id}`} />}
              >
                <Monitor className="h-4 w-4" />
                Mở điều khiển
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-white/40 bg-white/10 px-4 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
                nativeButton={false}
                render={<a href={`/teacher/sessions/${activeSession.id}/present`} />}
              >
                <Tv className="h-4 w-4" />
                Mở TV
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/12 via-background to-background p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-6 top-0 text-primary/10">
            <Presentation className="h-36 w-36" aria-hidden="true" />
          </div>
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Trình chiếu quiz</p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground text-balance sm:text-2xl">
                Chiếu quiz cho cả lớp
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Học sinh vào ngay trên điện thoại khi bạn bắt đầu.
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              <Button size="lg" className="h-11 w-full px-5 sm:w-auto" onClick={() => openConfig("now")} disabled={pending}>
                <Play className="h-4 w-4" />
                Bắt đầu ngay
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 w-full px-5 sm:w-auto"
                onClick={() => openConfig("draft")}
                disabled={pending}
              >
                <CalendarClock className="h-4 w-4" />
                Lưu nháp cho tiết sau
              </Button>
            </div>
          </div>
        </div>
      )}

      {drafts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Phiên đã soạn ({drafts.length})
          </p>
          {drafts.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
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
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90dvh,640px)] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cấu hình phiên trình chiếu</DialogTitle>
            <DialogDescription>Chọn bài học và thời gian mặc định cho mỗi câu hỏi.</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto py-2">
          <div className="flex flex-col gap-4">
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
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                        lessonId === l.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{l.title}</span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            lessonId === l.id ? "text-primary-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {l.chapterTitle}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "ml-2 shrink-0 text-xs",
                          lessonId === l.id ? "text-primary-foreground/80" : "text-muted-foreground",
                        )}
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
              <p className="text-xs text-muted-foreground">Áp dụng cho các câu chưa đặt thời gian riêng khi soạn.</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Khi tạo phiên</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("now")}
                  className={cn(
                    "min-w-0 rounded-lg border p-3 text-left text-sm transition-colors",
                    mode === "now" ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block font-medium text-foreground">Bắt đầu ngay</span>
                  <span className="mt-0.5 block text-pretty text-xs text-muted-foreground">Mở điều khiển liền</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("draft")}
                  className={cn(
                    "min-w-0 rounded-lg border p-3 text-left text-sm transition-colors",
                    mode === "draft" ? "border-primary bg-primary/5" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="block font-medium text-foreground">Lưu nháp</span>
                  <span className="mt-0.5 block text-pretty text-xs text-muted-foreground">Dạy hôm sau</span>
                </button>
              </div>
            </div>
          </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Huỷ
            </Button>
            <Button
              onClick={handleStart}
              disabled={pending || !lessonId || (lessons?.length ?? 0) === 0}
              className="max-w-full whitespace-normal"
            >
              <Presentation className="h-4 w-4" />
              {pending ? "Đang xử lý…" : mode === "draft" ? "Lưu nháp" : "Bắt đầu chiếu"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
