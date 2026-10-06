"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getTab2Questions, submitTab2Question } from "@/app/actions/student-learn"
import { renderSlots } from "@/lib/slot-render"
import type { UnderlinedTerm } from "@/types"

type FillQuestion = {
  id: string
  knowledgePointId: string
  content: string
  terms: UnderlinedTerm[]
}

type SlotResult = { slotIndex: number; isCorrect: boolean; correctAnswer: string }

export function Tab2FillIn({
  lessonId,
  onComplete,
}: {
  lessonId: string
  onComplete: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<FillQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState(false)
  const [finished, setFinished] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    getTab2Questions(lessonId)
      .then((res) => {
        setQuestions(res.questions)
        setEmpty(res.empty)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setEmpty(false)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  useEffect(() => {
    if (!empty || loading || error) return
    if (countdown <= 0) {
      onComplete()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [empty, loading, error, countdown, onComplete])

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Đang tải câu hỏi...</p>
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading font-semibold text-foreground">Không tải được câu hỏi</p>
        <Button className="mt-4 min-h-11" onClick={load}>
          Thử lại
        </Button>
      </div>
    )
  }

  if (empty) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading font-semibold text-foreground text-balance">
          Bạn chưa tự tin với kiến thức nào. Bước Kéo thả sẽ giúp bạn ôn tập toàn bộ.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Chuyển sang bước Kéo thả trong {countdown} giây...</p>
        <Button className="mt-4 min-h-11 w-full" onClick={onComplete}>
          Chuyển ngay
        </Button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading font-semibold text-foreground">Hoàn thành điền khuyết</p>
        <p className="mt-2 text-sm text-muted-foreground">Tiếp tục sang bước Kéo thả.</p>
        <Button className="mt-4 min-h-11 w-full" onClick={onComplete}>
          Tiếp tục
        </Button>
      </div>
    )
  }

  const question = questions[index]
  const isLast = index === questions.length - 1

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">
        Câu {index + 1}/{questions.length}
      </p>
      <FillInCard
        key={question.id}
        question={question}
        onCorrect={() => {
          if (isLast) {
            toast.success("Hoàn thành điền khuyết!")
            setFinished(true)
          } else {
            setIndex((i) => i + 1)
          }
        }}
      />
    </div>
  )
}

function FillInCard({
  question,
  onCorrect,
}: {
  question: FillQuestion
  onCorrect: () => void
}) {
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, SlotResult>>({})
  const [graded, setGraded] = useState(false)
  const [wrongTries, setWrongTries] = useState(0)
  const [pending, startTransition] = useTransition()
  const inputsRef = useRef<Record<number, HTMLInputElement | null>>({})

  const terms = useMemo(
    () => [...question.terms].sort((a, b) => a.slotIndex - b.slotIndex),
    [question.terms],
  )

  const lockedCorrect = (slotIndex: number) => graded && results[slotIndex]?.isCorrect

  const setAnswer = (slotIndex: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [slotIndex]: value }))
  }

  const allFilled = terms.every((t) => (answers[t.slotIndex] ?? "").trim().length > 0)

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const res = await submitTab2Question(question.knowledgePointId, answers)
        const map: Record<number, SlotResult> = {}
        for (const r of res.results) map[r.slotIndex] = r
        setResults(map)
        setGraded(true)
        if (res.allCorrect) {
          setWrongTries(0)
          toast.success("Chính xác!")
        } else {
          setWrongTries((n) => n + 1)
          toast.error("Có ô chưa đúng, thử lại nhé")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi chấm bài")
      }
    })
  }

  const handleRetry = () => {
    // reset chỉ ô sai; ô đúng giữ nguyên (locked)
    setAnswers((prev) => {
      const next = { ...prev }
      for (const t of terms) {
        if (!results[t.slotIndex]?.isCorrect) next[t.slotIndex] = ""
      }
      return next
    })
    setGraded(false)
    setResults({})
  }

  const focusNext = (slotIndex: number) => {
    const ordered = terms.map((t) => t.slotIndex)
    const i = ordered.indexOf(slotIndex)
    const next = ordered[i + 1]
    if (next != null) inputsRef.current[next]?.focus()
    else if (allFilled) handleSubmit()
  }

  const allCorrect = graded && terms.every((t) => results[t.slotIndex]?.isCorrect)
  const parts = renderSlots(question.content, terms)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="max-w-prose text-base leading-relaxed text-foreground">
        {parts.map((part, i) => {
          if (part.type === "text") return <span key={i}>{part.value}</span>
          const t = part.term
          const res = results[t.slotIndex]
          const locked = lockedCorrect(t.slotIndex)
          const wrong = graded && res && !res.isCorrect
          return (
            <span key={i} className="mx-1 inline-flex items-center align-middle">
              <input
                ref={(el) => {
                  inputsRef.current[t.slotIndex] = el
                }}
                value={answers[t.slotIndex] ?? ""}
                onChange={(e) => setAnswer(t.slotIndex, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    focusNext(t.slotIndex)
                  }
                }}
                disabled={locked || pending}
                aria-label={`Ô trống ${t.slotIndex + 1}`}
                size={Math.max((answers[t.slotIndex] ?? "").length + 1, 10)}
                className={cn(
                  "inline-block rounded-md border-2 border-dashed px-2 py-0.5 text-center text-base outline-none",
                  "focus:border-primary focus:border-solid",
                  locked && "border-solid border-[color:var(--color-primary)] bg-primary/10 text-primary",
                  wrong && "border-solid border-destructive bg-destructive/10 text-destructive",
                  !graded && "border-border",
                )}
                style={{ fontSize: 16 }}
              />
              {locked ? <Check className="ml-0.5 inline size-3.5 text-primary" aria-hidden="true" /> : null}
              {wrong ? <X className="ml-0.5 inline size-3.5 text-destructive" aria-hidden="true" /> : null}
            </span>
          )
        })}
      </p>

      {/* hiển thị đáp án đúng cho ô sai */}
      {graded && !allCorrect && (
        <div className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
          {terms
            .filter((t) => !results[t.slotIndex]?.isCorrect)
            .map((t) => {
              const ans = results[t.slotIndex]?.correctAnswer ?? ""
              return (
                <div key={t.slotIndex}>
                  {wrongTries < 2
                    ? `✗ Ô ${t.slotIndex + 1} chưa đúng. Gợi ý: bắt đầu bằng "${ans.charAt(0)}"`
                    : `✗ Ô ${t.slotIndex + 1}: đáp án đúng là ${ans}`}
                </div>
              )
            })}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!graded && (
          <Button className="min-h-11 flex-1" onClick={handleSubmit} disabled={!allFilled || pending}>
            {pending ? "Đang chấm..." : "Kiểm tra"}
          </Button>
        )}
        {graded && !allCorrect && (
          <Button className="min-h-11 flex-1" variant="outline" onClick={handleRetry}>
            Thử lại ô sai
          </Button>
        )}
        {allCorrect && (
          <Button className="min-h-11 flex-1" onClick={onCorrect}>
            Câu tiếp theo
          </Button>
        )}
      </div>
    </div>
  )
}
