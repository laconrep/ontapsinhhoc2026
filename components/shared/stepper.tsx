"use client"

import { Check, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

export const STUDY_STEPS = [
  { index: 1 as const, label: "Tự đánh giá" },
  { index: 2 as const, label: "Điền khuyết" },
  { index: 3 as const, label: "Kéo thả" },
  { index: 4 as const, label: "Kiểm tra" },
]

export type StepIndex = 1 | 2 | 3 | 4

export function Stepper({
  current,
  skipped,
  onReviewStep1,
}: {
  current: StepIndex
  skipped?: Partial<Record<StepIndex, boolean>>
  onReviewStep1?: () => void
}) {
  return (
    <ol
      className="flex items-start gap-1 overflow-x-auto pb-1"
      aria-label="Các bước học"
    >
      {STUDY_STEPS.map((step, i) => {
        const done = step.index < current
        const active = step.index === current
        const locked = step.index > current
        const isSkipped = Boolean(skipped?.[step.index])
        const reviewable = step.index === 1 && current > 1 && onReviewStep1
        return (
          <li key={step.index} className="flex min-w-0 flex-1 items-start">
            {i > 0 ? (
              <span
                className={cn(
                  "mt-5 h-px min-w-2 flex-1",
                  done || active ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              disabled={!reviewable && !active}
              aria-current={active ? "step" : undefined}
              aria-disabled={locked || (done && !reviewable) || undefined}
              onClick={() => {
                if (reviewable) onReviewStep1()
              }}
              className={cn(
                "flex min-h-11 min-w-11 flex-col items-center gap-1 px-1",
                (locked || (done && !reviewable)) && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-sm font-semibold",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-background text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
                  locked && "bg-muted text-muted-foreground",
                  isSkipped && !active && "bg-muted text-muted-foreground line-through",
                )}
              >
                {done && !isSkipped ? <Check className="size-4" aria-hidden="true" /> : null}
                {locked ? <Lock className="size-4" aria-hidden="true" /> : null}
                {active || (isSkipped && !done && !locked) ? step.index : null}
                {done && isSkipped ? step.index : null}
              </span>
              <span
                className={cn(
                  "max-w-[4.5rem] text-center text-xs leading-tight",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                  isSkipped && "line-through",
                )}
              >
                {reviewable ? "Xem lại" : isSkipped ? "Bỏ qua" : step.label}
              </span>
            </button>
            {i < STUDY_STEPS.length - 1 ? (
              <span
                className={cn(
                  "mt-5 h-px min-w-2 flex-1",
                  done ? "bg-primary" : "bg-border",
                )}
                aria-hidden="true"
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
