"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { startQuiz, submitQuiz, getLatestQuizResult } from "@/app/actions/student-learn"
import { Award, Check, RotateCcw, X } from "lucide-react"
import type { QuizResultDto } from "@/types"
import { QuestionStem } from "@/components/question/question-stem"

type QuizQuestion = {
  id: string
  type: "MC" | "TF" | "SA"
  content: string
  bodyHtml?: string | null
  knowledgePointId: string | null
  options: { id: string; content: string; bodyHtml?: string | null }[]
}

type Answer = string | Record<string, "D" | "S">

export function Tab4Quiz({ lessonId }: { lessonId: string }) {
  const [phase, setPhase] = useState<"intro" | "quiz" | "result">("intro")
  const [loading, setLoading] = useState(true)
  const [quizId, setQuizId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [result, setResult] = useState<QuizResultDto | null>(null)
  const [pending, startTransition] = useTransition()

  // Kiểm tra kết quả cũ (HS quay lại Tab 4 đã làm)
  useEffect(() => {
    let active = true
    getLatestQuizResult(lessonId)
      .then((res) => {
        if (!active) return
        if (res) {
          setResult(res)
          setPhase("result")
        }
        setLoading(false)
      })
      .catch(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [lessonId])

  const begin = () => {
    startTransition(async () => {
      try {
        const res = await startQuiz(lessonId)
        setQuizId(res.quizId)
        setQuestions(res.questions)
        setAnswers({})
        setIndex(0)
        setPhase("quiz")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể bắt đầu bài kiểm tra")
      }
    })
  }

  const submit = () => {
    if (!quizId) return
    startTransition(async () => {
      try {
        const res = await submitQuiz(quizId, answers)
        setResult(res)
        setPhase("result")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể nộp bài")
      }
    })
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
          Bài gồm câu trắc nghiệm, đúng/sai và trả lời ngắn. Điểm tối đa 10.
        </p>
        <Button className="mt-4 min-h-11 w-full" onClick={begin} disabled={pending}>
          {pending ? "Đang chuẩn bị..." : "Bắt đầu bài kiểm tra"}
        </Button>
      </div>
    )
  }

  if (phase === "result" && result) {
    return <QuizResult result={result} onRetry={begin} retrying={pending} />
  }

  const question = questions[index]
  const isLast = index === questions.length - 1
  const answered = isAnswered(question, answers[question.id])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">
          Câu {index + 1}/{questions.length}
        </p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
          {question.type === "MC" ? "Trắc nghiệm" : question.type === "TF" ? "Đúng/Sai" : "Trả lời ngắn"}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <QuestionStem content={question.content} bodyHtml={question.bodyHtml} className="text-sm font-medium" />

        <div className="mt-4">
          {question.type === "MC" && (
            <MCInput
              question={question}
              value={answers[question.id] as string | undefined}
              onChange={(v) => setAnswers((a) => ({ ...a, [question.id]: v }))}
            />
          )}
          {question.type === "TF" && (
            <TFInput
              question={question}
              value={(answers[question.id] as Record<string, "D" | "S">) ?? {}}
              onChange={(v) => setAnswers((a) => ({ ...a, [question.id]: v }))}
            />
          )}
          {question.type === "SA" && (
            <Input
              value={(answers[question.id] as string) ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [question.id]: e.target.value }))}
              placeholder="Nhập câu trả lời..."
              className="text-base"
              style={{ fontSize: 16 }}
            />
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {index > 0 && (
          <Button variant="outline" className="min-h-11" onClick={() => setIndex((i) => i - 1)}>
            Trước
          </Button>
        )}
        {!isLast && (
          <Button
            className="min-h-11 flex-1"
            onClick={() => setIndex((i) => i + 1)}
            disabled={!answered}
          >
            Câu tiếp theo
          </Button>
        )}
        {isLast && (
          <Button className="min-h-11 flex-1" onClick={submit} disabled={pending}>
            {pending ? "Đang nộp..." : "Nộp bài"}
          </Button>
        )}
      </div>
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
      {question.options.map((o) => (
        <div key={o.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
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
          <div className="flex gap-1">
            {(["D", "S"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange({ ...value, [o.id]: v })}
                className={cn(
                  "min-h-9 min-w-11 rounded-md border px-2 text-sm font-medium transition-colors",
                  value[o.id] === v
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
      ))}
    </div>
  )
}

function QuizResult({
  result,
  onRetry,
  retrying,
}: {
  result: QuizResultDto
  onRetry: () => void
  retrying: boolean
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
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="min-h-11 w-full" onClick={onRetry} disabled={retrying}>
        <RotateCcw className="h-4 w-4" />
        {retrying ? "Đang chuẩn bị..." : "Làm lại bài kiểm tra"}
      </Button>
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
            {it.value === "D" ? "Đúng" : "Sai"} {it.isCorrect ? "✓" : "✗"}
          </span>
        </div>
      ))}
    </div>
  )
}
