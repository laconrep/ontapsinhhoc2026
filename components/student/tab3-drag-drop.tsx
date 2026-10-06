"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { getTab3Questions, submitTab3Question } from "@/app/actions/student-learn"
import { renderSlots } from "@/lib/slot-render"
import type { UnderlinedTerm } from "@/types"

type DragQuestion = {
  id: string
  knowledgePointId: string
  content: string
  terms: UnderlinedTerm[]
  chips: string[]
}

type SlotResult = { slotIndex: number; isCorrect: boolean; correctAnswer: string }

export function Tab3DragDrop({
  lessonId,
  onComplete,
}: {
  lessonId: string
  onComplete: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<DragQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [empty, setEmpty] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [error, setError] = useState(false)
  const [finished, setFinished] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    getTab3Questions(lessonId)
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
          Xuất sắc! Bạn đã nắm vững tất cả kiến thức. Tiến thẳng đến bài kiểm tra.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Chuyển sang bước Kiểm tra trong {countdown} giây...</p>
        <Button className="mt-4 min-h-11 w-full" onClick={onComplete}>
          Chuyển ngay
        </Button>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="font-heading font-semibold text-foreground">Hoàn thành kéo thả</p>
        <p className="mt-2 text-sm text-muted-foreground">Tiếp tục sang bước Kiểm tra.</p>
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
      <DragDropCard
        key={question.id}
        question={question}
        onCorrect={() => {
          if (isLast) {
            toast.success("Hoàn thành ôn tập kéo thả!")
            setFinished(true)
          } else {
            setIndex((i) => i + 1)
          }
        }}
      />
    </div>
  )
}

function DragDropCard({
  question,
  onCorrect,
}: {
  question: DragQuestion
  onCorrect: () => void
}) {
  const terms = useMemo(
    () => [...question.terms].sort((a, b) => a.slotIndex - b.slotIndex),
    [question.terms],
  )
  // placement: slotIndex -> chip text
  const [placement, setPlacement] = useState<Record<number, string | null>>({})
  const [results, setResults] = useState<Record<number, SlotResult>>({})
  const [graded, setGraded] = useState(false)
  const [pending, startTransition] = useTransition()

  const [selectedChip, setSelectedChip] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const usedChips = Object.values(placement).filter(Boolean) as string[]
  const availableChips = useMemo(() => {
    const remaining = [...question.chips]
    for (const used of usedChips) {
      const i = remaining.indexOf(used)
      if (i !== -1) remaining.splice(i, 1)
    }
    return remaining
  }, [question.chips, usedChips])

  const allFilled = terms.every((t) => placement[t.slotIndex])

  const grade = (finalPlacement: Record<number, string | null>) => {
    const answers: Record<number, string> = {}
    for (const t of terms) answers[t.slotIndex] = finalPlacement[t.slotIndex] ?? ""
    startTransition(async () => {
      try {
        const res = await submitTab3Question(question.knowledgePointId, answers)
        const map: Record<number, SlotResult> = {}
        for (const r of res.results) map[r.slotIndex] = r
        setResults(map)
        setGraded(true)
        if (res.allCorrect) {
          toast.success("Chính xác!")
        } else {
          toast.error("Chưa đúng rồi!")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Lỗi chấm bài")
      }
    })
  }

  const placeChip = (slotIndex: number, chip: string) => {
    if (graded && results[slotIndex]?.isCorrect) return
    const next = { ...placement }
    for (const k of Object.keys(next)) {
      if (next[Number(k)] === chip) next[Number(k)] = null
    }
    next[slotIndex] = chip
    setPlacement(next)
    setSelectedChip(null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const chip = e.active.data.current?.chip as string | undefined
    const overSlot = e.over?.data.current?.slotIndex as number | undefined
    if (chip == null || overSlot == null) return
    placeChip(overSlot, chip)
  }

  const handleSlotActivate = (slotIndex: number) => {
    if (graded && results[slotIndex]?.isCorrect) return
    if (selectedChip) {
      placeChip(slotIndex, selectedChip)
      return
    }
    if (placement[slotIndex]) {
      setPlacement((prev) => ({ ...prev, [slotIndex]: null }))
    }
  }

  const handleReset = () => {
    const next: Record<number, string | null> = {}
    for (const t of terms) {
      next[t.slotIndex] = graded && results[t.slotIndex]?.isCorrect ? placement[t.slotIndex] ?? null : null
    }
    setPlacement(next)
    setSelectedChip(null)
    if (!Object.values(results).some((r) => r?.isCorrect)) {
      setGraded(false)
      setResults({})
    }
  }

  const handleRetry = () => {
    setPlacement((prev) => {
      const next = { ...prev }
      for (const t of terms) {
        if (!results[t.slotIndex]?.isCorrect) next[t.slotIndex] = null
      }
      return next
    })
    setGraded(false)
    setResults({})
  }

  const allCorrect = graded && terms.every((t) => results[t.slotIndex]?.isCorrect)
  const parts = renderSlots(question.content, terms)

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="max-w-prose text-base leading-relaxed text-foreground">
          {parts.map((part, i) => {
            if (part.type === "text") return <span key={i}>{part.value}</span>
            const t = part.term
            return (
              <DropZone
                key={i}
                slotIndex={t.slotIndex}
                chip={placement[t.slotIndex] ?? null}
                result={results[t.slotIndex]}
                graded={graded}
                awaiting={Boolean(selectedChip) && !(graded && results[t.slotIndex]?.isCorrect)}
                onActivate={() => handleSlotActivate(t.slotIndex)}
              />
            )
          })}
        </p>

        {!graded && (
          <p className="mt-3 text-xs text-muted-foreground">
            Kéo thả, hoặc chạm thẻ rồi chạm ô trống. Bấm Kiểm tra khi đã điền đủ.
          </p>
        )}

        {graded && !allCorrect && (
          <div className="mt-3 rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
            {terms
              .filter((t) => !results[t.slotIndex]?.isCorrect)
              .map((t) => (
                <div key={t.slotIndex}>
                  ✗ Ô {t.slotIndex + 1}: đáp án đúng là <strong>{results[t.slotIndex]?.correctAnswer}</strong>
                </div>
              ))}
          </div>
        )}

        {!allCorrect && (
          <div className="mt-4 flex flex-wrap gap-2">
            {availableChips.map((chip, i) => (
              <Chip
                key={`chip-${i}-${chip}`}
                id={`chip-${i}-${chip}`}
                chip={chip}
                selected={selectedChip === chip}
                onSelect={() => setSelectedChip((cur) => (cur === chip ? null : chip))}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {!graded && (
            <>
              <Button
                className="min-h-11 flex-1"
                onClick={() => grade(placement)}
                disabled={!allFilled || pending}
              >
                {pending ? "Đang chấm..." : "Kiểm tra"}
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={handleReset}
                disabled={pending || usedChips.length === 0}
              >
                Đặt lại
              </Button>
            </>
          )}
          {graded && !allCorrect && (
            <Button className="min-h-11 flex-1" variant="outline" onClick={handleRetry} disabled={pending}>
              Thử lại
            </Button>
          )}
          {allCorrect && (
            <Button className="min-h-11 flex-1" onClick={onCorrect}>
              Câu tiếp theo
            </Button>
          )}
        </div>
      </div>
    </DndContext>
  )
}

function DropZone({
  slotIndex,
  chip,
  result,
  graded,
  awaiting,
  onActivate,
}: {
  slotIndex: number
  chip: string | null
  result?: SlotResult
  graded: boolean
  awaiting: boolean
  onActivate: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotIndex}`,
    data: { slotIndex },
  })
  const correct = graded && result?.isCorrect
  const wrong = graded && result && !result.isCorrect

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={chip ? `Ô ${slotIndex + 1}: ${chip}` : `Ô trống ${slotIndex + 1}`}
      onClick={onActivate}
      className={cn(
        "mx-1 inline-flex min-h-11 min-w-[80px] items-center justify-center rounded-md border-2 px-2 py-0.5 align-middle text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary",
        chip ? "border-solid" : "border-dashed",
        isOver && "border-primary bg-primary/10",
        awaiting && !chip && "border-primary",
        correct && "border-solid border-[color:var(--color-primary)] bg-primary/10 text-primary",
        wrong && "border-solid border-destructive bg-destructive/10 text-destructive",
        !graded && !isOver && !awaiting && "border-border",
      )}
    >
      {chip ?? "\u00A0\u00A0\u00A0"}
      {correct ? <Check className="ml-1 inline size-3.5 text-primary" aria-hidden="true" /> : null}
      {wrong ? <X className="ml-1 inline size-3.5 text-destructive" aria-hidden="true" /> : null}
    </button>
  )
}

function Chip({
  id,
  chip,
  selected,
  onSelect,
}: {
  id: string
  chip: string
  selected: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { chip },
  })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "min-h-11 touch-none select-none rounded-lg border bg-secondary px-4 py-2 text-sm text-foreground",
        selected ? "border-primary ring-2 ring-primary" : "border-border",
        isDragging && "opacity-50",
      )}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      {chip}
    </button>
  )
}
