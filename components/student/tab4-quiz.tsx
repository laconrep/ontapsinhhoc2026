"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  startQuiz,
  submitQuiz,
  submitQuizQuestion,
  getOpenQuizState,
  getLatestQuizResult,
} from "@/app/actions/student-learn"
import { Award, BookOpenText, Check, ChevronDown, Lock, RotateCcw, X } from "lucide-react"
import type { QuizQuestionSubmitResult, QuizResultDto } from "@/types"
import { QuestionStem } from "@/components/question/question-stem"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"

type Draft = {
  quizId: string
  questions: QuizQuestion[]
  answers: Record<string, Answer>
  index: number
}

type QuizQuestion = {
  id: string
  type: "MC" | "TF" | "SA"
  content: string
  bodyHtml?: string | null
  knowledgePointId: string | null
  options: { id: string; content: string; bodyHtml?: string | null }[]
}

type Answer = string | Record<string, "D" | "S">

export function Tab4Quiz({
  lessonId,
  userId,
  quizQuestionCount = 0,
  onFinished,
  onReviewWrong,
}: {
  lessonId: string
  userId: string
  quizQuestionCount?: number
  onFinished?: () => void
  onReviewWrong?: () => void
}) {
  const storageKey = `edusync:tab4:${userId}:${lessonId}`
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro")
  const [loading, setLoading] = useState(true)
  const [quizId, setQuizId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [result, setResult] = useState<QuizResultDto | null>(null)
  /** §16: câu đã nộp riêng lẻ (khóa) — key là questionId. */
  const [submitted, setSubmitted] = useState<Record<string, QuizQuestionSubmitResult>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmQuestionOpen, setConfirmQuestionOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }

  const persistDraft = (
    next: Partial<{ quizId: string; questions: QuizQuestion[]; answers: Record<string, Answer>; index: number }>,
  ) => {
    const id = next.quizId ?? quizId
    const qs = next.questions ?? questions
    if (!id || qs.length === 0) return
    try {
      const draft: Draft = {
        quizId: id,
        questions: qs,
        answers: next.answers ?? answers,
        index: next.index ?? index,
      }
      localStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await getLatestQuizResult(lessonId)
        if (!active) return
        if (res) {
          setResult(res)
          setPhase("result")
          onFinished?.()
          clearDraft()
          setLoading(false)
          return
        }
        // §16: lượt làm đang mở trên máy chủ thắng bản nháp cục bộ —
        // khôi phục các câu ĐÃ nộp (khóa, kèm đúng/sai + hướng dẫn
        // giải) và tiếp tục ngay vị trí đã dừng.
        const open = await getOpenQuizState(lessonId).catch(() => null)
        if (!active) return
        if (open) {
          const started = await startQuiz(lessonId).catch(() => null)
          if (!active) return
          if (started && started.quizId === open.quizId) {
            const sub: Record<string, QuizQuestionSubmitResult> = {}
            for (const s of open.submitted) sub[s.questionId] = s
            setSubmitted(sub)
            setQuizId(started.quizId)
            setQuestions(started.questions)
            let draftAnswers: Record<string, Answer> = {}
            let draftIndex: number | undefined
            try {
              const raw = localStorage.getItem(storageKey)
              if (raw) {
                const draft = JSON.parse(raw) as Draft
                if (draft.quizId === started.quizId) {
                  draftAnswers = draft.answers ?? {}
                  draftIndex = draft.index
                }
              }
            } catch {
              /* ignore */
            }
            setAnswers(draftAnswers)
            const firstOpen = started.questions.findIndex((q) => !sub[q.id])
            const idx =
              typeof draftIndex === "number"
                ? Math.min(draftIndex, started.questions.length - 1)
                : firstOpen >= 0
                  ? firstOpen
                  : 0
            setIndex(Math.max(0, idx))
            setPhase("quiz")
            setLoading(false)
            return
          }
        }
        try {
          const raw = localStorage.getItem(storageKey)
          if (raw) {
            const draft = JSON.parse(raw) as Draft
            if (draft.quizId && Array.isArray(draft.questions) && draft.questions.length > 0) {
              setQuizId(draft.quizId)
              setQuestions(draft.questions)
              setAnswers(draft.answers ?? {})
              setIndex(Math.min(draft.index ?? 0, draft.questions.length - 1))
              setPhase("quiz")
            }
          }
        } catch {
          /* ignore */
        }
        setLoading(false)
      } catch {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, storageKey])

  const begin = () => {
    startTransition(async () => {
      try {
        const res = await startQuiz(lessonId)
        setQuizId(res.quizId)
        setQuestions(res.questions)
        setAnswers({})
        setSubmitted({})
        setIndex(0)
        setPhase("quiz")
        persistDraft({ quizId: res.quizId, questions: res.questions, answers: {}, index: 0 })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể bắt đầu bài kiểm tra")
      }
    })
  }

  const setAnswer = (questionId: string, value: Answer) => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: value }
      persistDraft({ answers: next })
      return next
    })
  }

  const goTo = (i: number) => {
    setIndex(i)
    persistDraft({ index: i })
  }

  const doSubmit = () => {
    if (!quizId) return
    setConfirmOpen(false)
    startTransition(async () => {
      try {
        const res = await submitQuiz(quizId, answers)
        clearDraft()
        setResult(res)
        setPhase("result")
        onFinished?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể nộp bài")
      }
    })
  }

  /** §16: số câu CHƯA nộp riêng lẻ (kể cả đã chọn đáp án nhưng chưa bấm "Nộp câu hỏi"). */
  const unsubmittedCount = questions.filter((q) => !submitted[q.id]).length

  const requestSubmit = () => {
    if (unsubmittedCount > 0) setConfirmOpen(true)
    else doSubmit()
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Đang tải...</p>
  }

  if (phase === "intro") {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading font-semibold text-foreground text-balance">
          Sẵn sàng làm bài kiểm tra tổng hợp?
        </p>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {quizQuestionCount > 0
            ? `${quizQuestionCount} câu · khoảng ${Math.max(1, Math.ceil(quizQuestionCount * 0.75))} phút. Điểm tối đa 10.`
            : "Bài gồm câu trắc nghiệm, đúng/sai và trả lời ngắn. Điểm tối đa 10."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          Mỗi câu nộp riêng bằng nút <span className="font-medium text-foreground">Nộp câu hỏi</span> —
          nộp xong biết ngay đúng/sai và không sửa lại được nữa. Em có thể dừng giữa chừng, lúc khác
          vào làm tiếp đúng vị trí đã dừng.
        </p>
        <Button className="mt-4 min-h-11 w-full" onClick={begin} disabled={pending}>
          {pending ? "Đang chuẩn bị..." : "Bắt đầu bài kiểm tra"}
        </Button>
      </div>
    )
  }

  if (phase === "result" && result) {
    return <QuizResult result={result} onRetry={begin} retrying={pending} onReviewWrong={onReviewWrong} />
  }

  const question = questions[index]
  const isLast = index === questions.length - 1
  const currentSubmitted = submitted[question.id]
  const submittedCount = Object.keys(submitted).length

  /** §16: nộp (khóa) câu hiện tại — chấm ngay phía máy chủ. */
  const submitCurrentQuestion = () => {
    if (!quizId) return
    setConfirmQuestionOpen(false)
    startTransition(async () => {
      try {
        const res = await submitQuizQuestion(
          quizId,
          question.id,
          (answers[question.id] ?? (question.type === "TF" ? {} : "")) as Answer,
        )
        setSubmitted((prev) => ({ ...prev, [question.id]: res }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể nộp câu hỏi")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Câu {index + 1}/{questions.length} · Đã nộp {submittedCount} câu
        </p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
          {question.type === "MC" ? "Trắc nghiệm" : question.type === "TF" ? "Đúng/Sai" : "Trả lời ngắn"}
        </span>
      </div>

      <ol className="flex flex-wrap gap-1" aria-label="Danh sách câu">
        {questions.map((q, i) => {
          const done = isAnswered(q, answers[q.id])
          const current = i === index
          const sub = submitted[q.id]
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={current ? "true" : undefined}
                aria-label={sub ? `Câu ${i + 1} (đã nộp, ${sub.isCorrect ? "đúng" : "sai"})` : `Câu ${i + 1}`}
                className={cn(
                  "flex size-10 items-center justify-center rounded-md text-xs font-semibold tabular-nums",
                  current && "bg-primary text-primary-foreground",
                  !current && sub && sub.isCorrect && "bg-primary/15 text-primary",
                  !current && sub && !sub.isCorrect && "bg-destructive/10 text-destructive",
                  !current && !sub && done && "bg-primary/15 text-primary",
                  !current && !sub && !done && "bg-secondary text-muted-foreground",
                )}
              >
                {sub && !current ? (
                  sub.isCorrect ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <X className="size-4" aria-hidden />
                  )
                ) : (
                  i + 1
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="rounded-xl border border-border bg-card p-4">
        <QuestionStem content={question.content} bodyHtml={question.bodyHtml} className="text-sm font-medium" />

        <div className="mt-4">
          {currentSubmitted ? (
            <LockedQuestionView question={question} result={currentSubmitted} />
          ) : (
            <>
              {question.type === "MC" && (
                <MCInput
                  question={question}
                  value={answers[question.id] as string | undefined}
                  onChange={(v) => setAnswer(question.id, v)}
                />
              )}
              {question.type === "TF" && (
                <TFInput
                  question={question}
                  value={(answers[question.id] as Record<string, "D" | "S">) ?? {}}
                  onChange={(v) => setAnswer(question.id, v)}
                />
              )}
              {question.type === "SA" && (
                <Input
                  value={(answers[question.id] as string) ?? ""}
                  onChange={(e) => setAnswer(question.id, e.target.value)}
                  placeholder="Nhập câu trả lời..."
                  className="text-base"
                  style={{ fontSize: 16 }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {index > 0 && (
          <Button variant="outline" className="min-h-11" onClick={() => goTo(index - 1)}>
            Trước
          </Button>
        )}
        {!currentSubmitted && (
          <Button
            className="min-h-11 flex-1"
            onClick={() => setConfirmQuestionOpen(true)}
            disabled={pending || !isAnswered(question, answers[question.id])}
          >
            <Lock className="size-4" aria-hidden />
            {pending ? "Đang nộp..." : "Nộp câu hỏi"}
          </Button>
        )}
        {!isLast && (
          <Button
            variant={currentSubmitted ? "default" : "outline"}
            className="min-h-11 flex-1"
            onClick={() => goTo(index + 1)}
          >
            Câu tiếp theo
          </Button>
        )}
        {isLast && !currentSubmitted && (
          <Button variant="outline" className="min-h-11 flex-1" onClick={requestSubmit} disabled={pending}>
            Nộp bài
          </Button>
        )}
        {isLast && currentSubmitted && (
          <Button className="min-h-11 flex-1" onClick={requestSubmit} disabled={pending}>
            {pending ? "Đang nộp..." : unsubmittedCount > 0 ? "Nộp bài" : "Xem kết quả"}
          </Button>
        )}
      </div>
      {submittedCount === questions.length && questions.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          Đã nộp hết các câu — bấm {isLast ? "“Xem kết quả”" : "“Nộp bài” ở câu cuối"} để xem tổng điểm.
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Nộp bài?"
        description={`Còn ${unsubmittedCount} câu chưa nộp — nộp bài sẽ khóa luôn các câu đó theo đáp án hiện tại (chưa trả lời thì tính sai).`}
        confirmLabel="Nộp luôn"
        onConfirm={doSubmit}
        pending={pending}
      />
      <ConfirmDialog
        open={confirmQuestionOpen}
        onOpenChange={setConfirmQuestionOpen}
        title="Nộp câu hỏi này?"
        description="Đã nộp thì không sửa lại được nữa. Đáp án đúng và hướng dẫn giải (nếu có) sẽ hiện ngay sau khi nộp."
        confirmLabel="Nộp câu hỏi"
        onConfirm={submitCurrentQuestion}
        pending={pending}
      />
    </div>
  )
}

/** §16: câu ĐÃ nộp — chỉ xem: đáp án của học sinh, đúng/sai, đáp án
 * đúng và hướng dẫn giải. Không có ô nhập nào sửa được nữa. */
function LockedQuestionView({
  question,
  result,
}: {
  question: QuizQuestion
  result: QuizQuestionSubmitResult
}) {
  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          result.isCorrect ? "text-primary" : "text-destructive",
        )}
        role="status"
      >
        {result.isCorrect ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <X className="size-4" aria-hidden />
        )}
        {result.isCorrect ? "Đúng — đã nộp, không sửa được nữa" : "Chưa đúng — đã nộp, không sửa được nữa"}
      </p>

      {question.type === "MC" && (
        <div className="flex flex-col gap-2">
          {question.options.map((o) => {
            const chosen = result.studentAnswer === o.content
            const correct = result.correctAnswer === o.content
            return (
              <div
                key={o.id}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  correct && "border-primary bg-primary/10 text-foreground",
                  chosen && !correct && "border-destructive bg-destructive/10 text-foreground",
                  !chosen && !correct && "border-border text-muted-foreground",
                )}
              >
                <span className="flex-1">{o.content}</span>
                {correct && (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Check className="size-3.5" aria-hidden /> Đáp án đúng
                  </span>
                )}
                {chosen && !correct && (
                  <span className="text-xs font-medium text-destructive">Bạn chọn</span>
                )}
                {chosen && correct && (
                  <span className="text-xs font-medium text-primary">Bạn chọn</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {question.type === "TF" && <TFDetail raw={result.studentAnswer} />}

      {question.type === "SA" && (
        <div className="flex flex-col gap-1 text-sm">
          <p>
            Bạn trả lời:{" "}
            <span className="font-medium text-foreground">{result.studentAnswer || "(bỏ trống)"}</span>
          </p>
          {!result.isCorrect && result.correctAnswer && (
            <p>
              Đáp án đúng: <span className="font-medium text-foreground">{result.correctAnswer}</span>
            </p>
          )}
        </div>
      )}

      {result.solution ? <SolutionGuide solution={result.solution} /> : null}
    </div>
  )
}

function isAnswered(q: QuizQuestion, a: Answer | undefined): boolean {
  if (a == null) return false
  if (q.type === "TF") {
    const map = a as Record<string, "D" | "S">
    return q.options.every((o) => map[o.id] === "D" || map[o.id] === "S")
  }
  return typeof a === "string" && a.trim().length > 0
}

function MCInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion
  value?: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {question.options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
            value === o.id
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border text-foreground hover:bg-secondary",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
              value === o.id ? "border-primary" : "border-muted-foreground",
            )}
          >
            {value === o.id && <span className="h-2 w-2 rounded-full bg-primary" />}
          </span>
          {o.bodyHtml ? (
            <QuestionStem content={o.content} bodyHtml={o.bodyHtml} className="text-sm" maxHeightClass="max-h-24" />
          ) : (
            o.content
          )}
        </button>
      ))}
    </div>
  )
}

function TFInput({
  question,
  value,
  onChange,
}: {
  question: QuizQuestion
  value: Record<string, "D" | "S">
  onChange: (v: Record<string, "D" | "S">) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {question.options.map((o) => {
        const chosen = value[o.id]
        const unanswered = chosen !== "D" && chosen !== "S"
        return (
          <div
            key={o.id}
            className={cn(
              "flex items-center gap-2 rounded-lg border p-2",
              unanswered ? "border-dashed border-muted-foreground/50 bg-secondary/40" : "border-border",
            )}
          >
            {o.bodyHtml ? (
              <QuestionStem
                content={o.content}
                bodyHtml={o.bodyHtml}
                className="text-sm text-foreground"
                maxHeightClass="max-h-24 flex-1"
              />
            ) : (
              <span className="flex-1 text-sm text-foreground">{o.content}</span>
            )}
            <div className="flex items-center gap-1">
              {unanswered && (
                <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">Chưa chọn</span>
              )}
              {(["D", "S"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange({ ...value, [o.id]: v })}
                  className={cn(
                    "min-h-9 min-w-11 rounded-md border px-2 text-sm font-medium transition-colors",
                    chosen === v
                      ? v === "D"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-destructive bg-destructive text-white"
                      : "border-border text-foreground hover:bg-secondary",
                  )}
                >
                  {v === "D" ? "Đúng" : "Sai"}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QuizResult({
  result,
  onRetry,
  retrying,
  onReviewWrong,
}: {
  result: QuizResultDto
  onRetry: () => void
  retrying: boolean
  onReviewWrong?: () => void
}) {
  const passed = result.percentage >= 50
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <div
          className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
            passed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
          )}
        >
          <Award className="h-8 w-8" />
        </div>
        <p className="mt-3 font-heading text-3xl font-bold tabular-nums text-foreground">
          {result.score.toFixed(1)}
          <span className="text-lg text-muted-foreground">/10</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Đúng {result.percentage}% số ý</p>
      </div>

      {result.details.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Chi tiết</h3>
          {result.details.map((d, i) => (
            <div
              key={d.questionId}
              className={cn(
                "rounded-lg border p-3 text-sm",
                d.isCorrect ? "border-primary/40 bg-primary/5" : "border-destructive/40 bg-destructive/5",
              )}
            >
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                {d.isCorrect ? (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                ) : (
                  <X className="size-4 text-destructive" aria-hidden="true" />
                )}
                Câu {i + 1} {d.isCorrect ? "đúng" : "sai"}
              </p>
              {d.questionType !== "TF" && (
                <>
                  <p className="mt-1 text-muted-foreground">
                    Bạn trả lời: <span className="text-foreground">{d.studentAnswer || "(bỏ trống)"}</span>
                  </p>
                  {!d.isCorrect && (
                    <p className="text-muted-foreground">
                      Đáp án đúng: <span className="text-foreground">{d.correctAnswer}</span>
                    </p>
                  )}
                </>
              )}
              {d.questionType === "TF" && <TFDetail raw={d.studentAnswer} />}
              {d.solution ? <SolutionGuide solution={d.solution} /> : null}
            </div>
          ))}
        </div>
      )}

      {onReviewWrong && (
        <Button variant="outline" className="min-h-11 w-full" onClick={onReviewWrong}>
          Ôn lại các điểm kiến thức làm sai
        </Button>
      )}
      <Button variant="outline" className="min-h-11 w-full" onClick={onRetry} disabled={retrying}>
        <RotateCcw className="h-4 w-4" />
        {retrying ? "Đang chuẩn bị..." : "Làm lại bài kiểm tra"}
      </Button>
    </div>
  )
}

/** §15.3: hướng dẫn giải của một câu — chỉ tồn tại trong kết quả SAU
 * khi nộp bài (đúng/sai đã hiện), mặc định thu gọn, bấm mới xem. */
function SolutionGuide({ solution }: { solution: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        <BookOpenText className="h-4 w-4" />
        Hướng dẫn giải
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="mt-1.5 rounded-md bg-background/70 p-2.5 text-sm whitespace-pre-wrap text-foreground">
          {solution}
        </div>
      ) : null}
    </div>
  )
}

function TFDetail({ raw }: { raw: string }) {
  let items: { content: string; value: string; isCorrect: boolean; correct: boolean }[] = []
  try {
    items = JSON.parse(raw)
  } catch {
    return null
  }
  return (
    <div className="mt-1 flex flex-col gap-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-center justify-between gap-2 text-xs">
          <span className="flex-1 text-muted-foreground">{it.content}</span>
          <span className={cn(it.isCorrect ? "text-primary" : "text-destructive")}>
            {it.value === "D" ? "Đúng" : it.value === "S" ? "Sai" : "Chưa chọn"} {it.isCorrect ? "✓" : "✗"}
          </span>
        </div>
      ))}
    </div>
  )
}
