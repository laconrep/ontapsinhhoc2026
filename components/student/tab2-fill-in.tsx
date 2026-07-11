"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
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

  useEffect(() => {
    let active = true
    getTab2Questions(lessonId)
      .then((res) => {
        if (!active) return
        setQuestions(res.questions)
        setEmpty(res.empty)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setEmpty(true)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [lessonId])

  // Empty → đếm ngược sang Tab 3
  useEffect(() => {
    if (!empty || loading) return
    if (countdown <= 0) {
      onComplete()
      return
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [empty, loading, countdown, onComplete])

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Đang tải câu hỏi...</p>
  }

  if (empty) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading font-semibold text-foreground text-balance">
          Bạn chưa tự tin với kiến thức nào. Tab 3 sẽ giúp bạn ôn tập toàn bộ.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Chuyển sang Tab 3 trong {countdown} giây...</p>
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
            onComplete()
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
          toast.success("Chính xác!")
        } else {
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

  const allCorrect = graded && terms.every((t) => results[t.slotIndex]?.isCorrect)
  const parts = renderSlots(question.content, terms)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm leading-loose text-foreground">
        {parts.map((part, i) => {
          if (part.type === "text") return <span key={i}>{part.value}</span>
          const t = part.term
          const res = results[t.slotIndex]
          const locked = lockedCorrect(t.slotIndex)
          const wrong = graded && res && !res.isCorrect
          return (
            <input
              key={i}
              ref={(el) => {
                inputsRef.current[t.slotIndex] = el
              }}
              value={answers[t.slotIndex] ?? ""}
              onChange={(e) => setAnswer(t.slotIndex, e.target.value)}
              disabled={locked || pending}
              aria-label={`Ô trống ${t.slotIndex + 1}`}
              className={cn(
                "mx-1 inline-block min-w-[90px] rounded-md border-2 border-dashed px-2 py-0.5 text-center text-base outline-none",
                "focus:border-primary focus:border-solid",
                locked && "border-solid border-[color:var(--color-primary)] bg-primary/10 text-primary",
                wrong && "border-solid border-destructive bg-destructive/10 text-destructive",
                !graded && "border-border",
              )}
              style={{ fontSize: 16 }}
            />
          )
        })}
      </p>

      {/* hiển thị đáp án đúng cho ô sai */}
      {graded && !allCorrect && (
        <div className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
          {terms
            .filter((t) => !results[t.slotIndex]?.isCorrect)
            .map((t) => (
              <div key={t.slotIndex}>
                Ô {t.slotIndex + 1}: đáp án đúng là <strong>{results[t.slotIndex]?.correctAnswer}</strong>
              </div>
            ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {!graded && (
          <Button className="min-h-11 flex-1" onClick={handleSubmit} disabled={!allFilled || pending}>
            {pending ? "Đang chấm..." : "Nộp câu này"}
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
