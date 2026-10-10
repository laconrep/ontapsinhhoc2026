"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getTab2Questions, submitTab2Question } from "@/app/actions/student-learn"
import type { ClientSlotPart } from "@/lib/slot-render"

type FillQuestion = {
  id: string
  knowledgePointId: string
  parts: ClientSlotPart[]
}

type SlotResult = { slotIndex: number; isCorrect: boolean; hint?: string; correctAnswer?: string }

type FillDraft = {
  kpId: string
  answers: Record<number, string>
  results: Record<number, SlotResult>
  graded: boolean
}

export function Tab2FillIn({
  lessonId,
  userId,
  onComplete,
}: {
  lessonId: string
  userId: string
  onComplete: () => void
}) {
  const storageKey = `edusync:tab2:${userId}:${lessonId}`
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<FillQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [empty, setEmpty] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [error, setError] = useState(false)
  const [finished, setFinished] = useState(false)
  const [restoredDraft, setRestoredDraft] = useState<FillDraft | null>(null)

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }

  const persistDraft = (draft: FillDraft) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft))
    } catch {
      /* ignore */
    }
  }

  const load = () => {
    setLoading(true)
    setError(false)
    getTab2Questions(lessonId)
      .then((res) => {
        setQuestions(res.questions)
        setEmpty(res.empty)
        setSkipped(res.skipped)
        if (res.empty || res.questions.length === 0) {
          clearDraft()
          setRestoredDraft(null)
          setIndex(0)
        } else {
          try {
            const raw = localStorage.getItem(storageKey)
            if (raw) {
              const draft = JSON.parse(raw) as FillDraft
              const i = res.questions.findIndex((q) => q.knowledgePointId === draft.kpId)
              if (i >= 0) {
                setIndex(i)
                setRestoredDraft(draft)
                toast.info(`Tiếp tục điền khuyết từ câu ${i + 1}/${res.questions.length}`)
              } else {
                setIndex(0)
                setRestoredDraft(null)
              }
            } else {
              setIndex(0)
              setRestoredDraft(null)
            }
          } catch {
            setIndex(0)
            setRestoredDraft(null)
          }
        }
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
          {skipped
            ? "Bạn chưa tự tin với kiến thức nào. Bước Kéo thả sẽ giúp bạn ôn tập toàn bộ."
            : "Bạn đã hoàn thành điền khuyết. Tiếp tục sang bước Kéo thả."}
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
  if (!question) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Đang tải câu hỏi...</p>
  }
  const isLast = index === questions.length - 1

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-muted-foreground">
        Câu {index + 1}/{questions.length}
      </p>
      <FillInCard
        key={question.id}
        question={question}
        restored={restoredDraft?.kpId === question.knowledgePointId ? restoredDraft : null}
        onDraftChange={(draft) => persistDraft({ ...draft, kpId: question.knowledgePointId })}
        onCorrect={() => {
          if (isLast) {
            clearDraft()
            toast.success("Hoàn thành điền khuyết!")
            setFinished(true)
          } else {
            clearDraft()
            setRestoredDraft(null)
            setIndex((i) => i + 1)
          }
        }}
      />
    </div>
  )
}

function slotIndexes(parts: ClientSlotPart[]): number[] {
  return parts.filter((p): p is Extract<ClientSlotPart, { type: "slot" }> => p.type === "slot").map((p) => p.slotIndex)
}

function FillInCard({
  question,
  restored,
  onDraftChange,
  onCorrect,
}: {
  question: FillQuestion
  restored: FillDraft | null
  onDraftChange: (draft: Omit<FillDraft, "kpId">) => void
  onCorrect: () => void
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(restored?.answers ?? {})
  const [results, setResults] = useState<Record<number, SlotResult>>(restored?.results ?? {})
  const [graded, setGraded] = useState(restored?.graded ?? false)
  const [pending, startTransition] = useTransition()
  const inputsRef = useRef<Record<number, HTMLInputElement | null>>({})

  const slots = useMemo(() => slotIndexes(question.parts), [question.parts])

  const lockedCorrect = (slotIndex: number) => graded && results[slotIndex]?.isCorrect

  const setAnswer = (slotIndex: number, value: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [slotIndex]: value }
      onDraftChange({ answers: next, results, graded })
      return next
    })
  }

  const allFilled = slots.every((s) => (answers[s] ?? "").trim().length > 0)

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const payload = slots.map((slotIndex) => ({
          slotIndex,
          value: answers[slotIndex] ?? answers[Number(slotIndex)] ?? "",
        }))
        const res = await submitTab2Question(question.knowledgePointId, payload)
        const map: Record<number, SlotResult> = {}
        for (const r of res.results) {
          const slotIndex = Number(r.slotIndex)
          map[slotIndex] = {
            slotIndex,
            isCorrect: r.isCorrect,
            hint: r.hint,
            correctAnswer: r.correctAnswer,
          }
        }
        setResults(map)
        setGraded(true)
        onDraftChange({ answers, results: map, graded: true })
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
    setAnswers((prev) => {
      const next = { ...prev }
      for (const s of slots) {
        if (!results[s]?.isCorrect) next[s] = ""
      }
      onDraftChange({ answers: next, results: {}, graded: false })
      return next
    })
    setGraded(false)
    setResults({})
  }

  const focusNext = (slotIndex: number) => {
    const i = slots.indexOf(slotIndex)
    const next = slots[i + 1]
    if (next != null) inputsRef.current[next]?.focus()
    else if (allFilled) handleSubmit()
  }

  const allCorrect = graded && slots.every((s) => results[s]?.isCorrect)
  const wrongSlots = slots.filter((s) => graded && results[s] && !results[s].isCorrect)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="max-w-prose text-base leading-relaxed text-foreground">
        {question.parts.map((part, i) => {
          if (part.type === "text") return <span key={i}>{part.value}</span>
          const slotIndex = part.slotIndex
          const res = results[slotIndex]
          const locked = lockedCorrect(slotIndex)
          const wrong = graded && res && !res.isCorrect
          return (
            <span key={i} className="mx-1 inline-flex items-center align-middle">
              <input
                ref={(el) => {
                  inputsRef.current[slotIndex] = el
                }}
                value={answers[slotIndex] ?? ""}
                onChange={(e) => setAnswer(slotIndex, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    focusNext(slotIndex)
                  }
                }}
                disabled={locked || pending}
                aria-label={`Ô trống ${slotIndex + 1}`}
                size={Math.max((answers[slotIndex] ?? "").length + 1, 10)}
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

      {graded && !allCorrect && wrongSlots.length > 0 && (
        <div className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
          {wrongSlots.map((s) => {
            const res = results[s]
            if (res?.correctAnswer) {
              return (
                <div key={s}>
                  ✗ Ô {s + 1}: đáp án đúng là {res.correctAnswer}
                </div>
              )
            }
            if (res?.hint) {
              return (
                <div key={s}>
                  ✗ Ô {s + 1} chưa đúng. Gợi ý: bắt đầu bằng &quot;{res.hint}&quot;
                </div>
              )
            }
            return <div key={s}>✗ Ô {s + 1} chưa đúng</div>
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
