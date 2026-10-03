"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Check, X, Maximize, Clock, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLiveQuiz } from "./use-live-quiz"
import { joinQuiz, submitLiveAnswer, reportFullscreen } from "@/app/actions/live-quiz"
import { QuestionStem } from "@/components/question/question-stem"
import { StudentQuestionLayout } from "./student-question-layout"

const LETTERS = ["A", "B", "C", "D", "E", "F"]

export function StudentQuizView({ sessionId }: { sessionId: string }) {
  const view = useLiveQuiz(sessionId)
  const [joined, setJoined] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Trạng thái trả lời cục bộ theo từng câu
  const [mcChoice, setMcChoice] = useState<string | null>(null)
  const [tfChoices, setTfChoices] = useState<Record<string, boolean>>({})
  const [saText, setSaText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [answeredId, setAnsweredId] = useState<string | null>(null)
  const [myCorrect, setMyCorrect] = useState<boolean | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const currentQid = view.question?.id ?? null

  // Reset khi đổi câu hỏi
  useEffect(() => {
    setMcChoice(null)
    setTfChoices({})
    setSaText("")
    setAnsweredId(null)
    setMyCorrect(null)
    setSubmitting(false)
  }, [currentQid])

  // Báo trạng thái fullscreen cho server
  const report = useCallback(
    (fs: boolean) => {
      startTransition(async () => {
        try {
          await reportFullscreen(sessionId, fs)
        } catch {
          /* bỏ qua */
        }
      })
    },
    [sessionId],
  )

  const fsHandlerRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      report(fs)
    }
    fsHandlerRef.current = handler
    document.addEventListener("fullscreenchange", handler)
    return () => document.removeEventListener("fullscreenchange", handler)
  }, [report])

  async function handleJoin() {
    setJoinError(null)
    try {
      await document.documentElement.requestFullscreen?.().catch(() => {})
      await joinQuiz(sessionId)
      setJoined(true)
      report(!!document.fullscreenElement)
      void view.refresh()
    } catch (err) {
      // Không dùng toast đỏ gây kẹt — hiện màn thông báo thân thiện có nút thử lại/quay về.
      setJoinError(err instanceof Error ? err.message : "Không tham gia được phiên này")
    }
  }

  async function reenterFullscreen() {
    await document.documentElement.requestFullscreen?.().catch(() => {})
  }

  async function submit(answer: string) {
    if (!view.question) return
    setSubmitting(true)
    try {
      const res = await submitLiveAnswer(sessionId, view.question.id, answer)
      setAnsweredId(view.question.id)
      setMyCorrect(res.correct)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được")
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Màn thông báo khi không tham gia được (thay cho lỗi đỏ kẹt màn hình) ----
  if (joinError && !joined) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="font-heading text-xl font-bold text-balance">Chưa vào được phiên</h1>
        <p className="max-w-sm text-pretty text-muted-foreground">{joinError}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setJoinError(null)}>
            Thử lại
          </Button>
          <Button onClick={() => (window.location.href = "/student")}>Về trang chủ</Button>
        </div>
      </div>
    )
  }

  // ---- Màn chờ tham gia ----
  if (!joined) {
    const className = view.className || "Phiên trình chiếu"
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
        <div>
          <h1 className="font-heading text-2xl font-bold text-balance">{className}</h1>
          <p className="mt-2 text-muted-foreground">
            Nhấn để tham gia. Ứng dụng sẽ chuyển sang chế độ toàn màn hình để tập trung làm bài.
          </p>
        </div>
        <Button size="lg" onClick={handleJoin} disabled={view?.phase === "ended"}>
          <Maximize className="h-5 w-5" />
          Tham gia & vào toàn màn hình
        </Button>
      </div>
    )
  }

  if (view.phase === "ended") {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <h1 className="font-heading text-2xl font-bold">Phiên đã kết thúc</h1>
        <p className="text-muted-foreground">Cảm ơn em đã tham gia!</p>
      </div>
    )
  }

  const answered = answeredId === currentQid
  const q = view.question
  const canAnswer = view.phase === "question" && !answered
  const locked = !canAnswer

  // Safety check - không render quiz nếu không có câu hỏi khi đang trong phase question
  if (view.phase === "question" && !q) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="font-heading text-xl font-bold">Đang tải câu hỏi...</h1>
        <p className="text-muted-foreground">Vui lòng chờ giáo viên bắt đầu câu hỏi.</p>
      </div>
    )
  }

  return (
    <>
      {/* Nút fullscreen (chỉ hiện khi thoát fullscreen) */}
          {joined && !isFullscreen && (
        <button
          onClick={reenterFullscreen}
          className="fixed right-4 top-4 z-[90] rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 shadow-lg"
          title="Vào toàn màn hình"
          aria-label="Vào toàn màn hình"
        >
          <Maximize className="h-5 w-5" />
        </button>
      )}

      <div className="fixed inset-0 z-[80] mx-auto flex h-full min-h-0 max-w-2xl flex-col gap-3 bg-background p-4 pb-36">
        {/* Thanh trên: tiến độ + đồng hồ */}
        <div className="flex shrink-0 items-center justify-between">
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
          {view.currentIndex >= 0 ? `Câu ${view.currentIndex + 1}/${view.total}` : "Đang chờ"}
        </span>
        {view.phase === "question" && view.remainingSec != null && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold tabular-nums",
              view.remainingSec <= 5 ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
            )}
          >
            <Clock className="h-4 w-4" />
            {view.remainingSec}s
          </span>
        )}
      </div>

      {!q ? (
        <div className="flex flex-1 items-center justify-center text-center text-muted-foreground">
          <p>Chờ giáo viên bắt đầu câu hỏi…</p>
        </div>
      ) : (
        <>
          <StudentQuestionLayout
            key={q.id}
            questionId={q.id}
            stem={
              <QuestionStem
                content={q.content}
                bodyHtml={q.bodyHtml}
                className="text-balance font-heading font-bold leading-snug"
                maxHeightClass="max-h-none"
              />
            }
            options={
              <>
                {q.type === "MC" && (
                  <div className="relative z-20 flex flex-col gap-3 pointer-events-auto">
                    {q.options.map((o, i) => {
                      const isCorrect = view.revealed?.correctOptionIds.includes(o.id)
                      const isMine = mcChoice === o.id
                      return (
                        <button
                          key={o.id}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            if (locked) return
                            setMcChoice(o.id)
                          }}
                          className={cn(
                            "relative z-20 flex min-h-14 w-full cursor-pointer touch-manipulation items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg transition-colors disabled:cursor-not-allowed",
                            view.revealed && isCorrect
                              ? "border-primary bg-primary/10"
                              : view.revealed && isMine
                                ? "border-destructive bg-destructive/10"
                                : isMine
                                  ? "border-primary bg-primary/5"
                                  : "border-border bg-card",
                          )}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                            {LETTERS[i]}
                          </span>
                          <span>{o.content}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {q.type === "TF" && (
                  <div className="flex flex-col gap-3">
                    {q.options.map((o) => {
                      const picked = tfChoices[o.id]
                      const isCorrect = view.revealed?.correctOptionIds.includes(o.id)
                      return (
                        <div
                          key={o.id}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border-2 px-4 py-3",
                            view.revealed
                              ? isCorrect
                                ? "border-primary bg-primary/10"
                                : "border-border bg-card"
                              : "border-border bg-card",
                          )}
                        >
                          <span className="flex-1 text-base">{o.content}</span>
                          <div className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => setTfChoices((s) => ({ ...s, [o.id]: true }))}
                              className={cn(
                                "min-h-10 touch-manipulation rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed",
                                picked === true ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                              )}
                            >
                              Đúng
                            </button>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => setTfChoices((s) => ({ ...s, [o.id]: false }))}
                              className={cn(
                                "min-h-10 touch-manipulation rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed",
                                picked === false ? "bg-destructive text-primary-foreground" : "bg-secondary text-secondary-foreground",
                              )}
                            >
                              Sai
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {q.type === "SA" && (
                  <div className="flex flex-col gap-3">
                    <Input
                      value={saText}
                      onChange={(e) => setSaText(e.target.value)}
                      disabled={locked}
                      placeholder="Nhập câu trả lời…"
                      className="text-lg"
                    />
                    {view.revealed?.correctText && (
                      <p className="rounded-lg border-2 border-primary bg-primary/10 px-4 py-2 text-base">
                        Đáp án: <span className="font-semibold">{view.revealed.correctText}</span>
                      </p>
                    )}
                  </div>
                )}
              </>
            }
          />

          {answered && myCorrect != null && (
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-lg font-semibold",
                myCorrect ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
              )}
            >
              {myCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {myCorrect ? "Chính xác!" : "Chưa đúng"}
            </div>
          )}
        </>
      )}

      {q && !answered && view.phase === "revealed" && (
        <p className="fixed inset-x-0 bottom-0 z-[85] border-t bg-card p-4 text-center font-medium text-destructive">
          Đã hết giờ trả lời câu này
        </p>
      )}

      {q && !answered && view.phase === "question" && (
        <div className="fixed inset-x-0 bottom-0 z-[85] border-t bg-card p-3">
          <div className="mx-auto flex max-w-2xl">
            <Button
              className="h-12 w-full text-base"
              size="lg"
              disabled={
                submitting ||
                (q.type === "MC" && !mcChoice) ||
                (q.type === "TF" && Object.keys(tfChoices).length < q.options.length) ||
                (q.type === "SA" && !saText.trim())
              }
              onClick={() => {
                if (q.type === "MC") submit(mcChoice ?? "")
                else if (q.type === "SA") submit(saText.trim())
                else {
                  const picked = q.options.filter((o) => tfChoices[o.id]).map((o) => o.id)
                  submit(picked.join(","))
                }
              }}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Gửi câu trả lời"}
            </Button>
          </div>
        </div>
      )}

      {answered && view.phase === "question" && (
        <p className="fixed inset-x-0 bottom-0 z-[85] border-t bg-card p-4 text-center text-muted-foreground">
          Đã gửi câu trả lời. Chờ các bạn khác…
        </p>
      )}
      </div>
    </>
  )
}
