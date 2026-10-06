"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, X, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { saveTab1Progress, submitTab1 } from "@/app/actions/student-learn"
import { cleanContentDisplay } from "@/lib/content-display"
import type { KnowledgePointDto } from "@/types"

type Assessment = "known" | "unknown"

export function Tab1SelfAssess({
  lessonId,
  knowledgePoints,
  savedAssessments,
  onSubmitted,
}: {
  lessonId: string
  knowledgePoints: KnowledgePointDto[]
  savedAssessments: Record<string, Assessment>
  onSubmitted: (knownCount: number) => void
}) {
  const storageKey = `edusync:tab1:${lessonId}`
  const [assessments, setAssessments] = useState<Record<string, Assessment>>(savedAssessments)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [summary, setSummary] = useState<{ knownCount: number; total: number } | null>(null)
  const [pending, startTransition] = useTransition()

  // Restore từ localStorage nếu có (ưu tiên hơn dữ liệu server khi HS chưa nộp)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, Assessment>
        setAssessments((prev) => {
          const merged = { ...prev, ...parsed }
          const count = Object.keys(merged).length
          if (count > 0) {
            toast.info(`Tiếp tục đánh giá? Bạn đã đánh giá ${count}/${knowledgePoints.length} kiến thức.`)
          }
          return merged
        })
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const assessedCount = Object.keys(assessments).length
  const total = knowledgePoints.length
  const allAssessed = assessedCount === total && total > 0

  const choose = (kpId: string, value: Assessment) => {
    setAssessments((prev) => {
      const next = { ...prev, [kpId]: value }
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
    // lưu server ngay [SIM-04]
    startTransition(async () => {
      try {
        await saveTab1Progress(kpId, value)
      } catch {
        /* im lặng — đã lưu localStorage */
      }
    })
  }

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const res = await submitTab1(lessonId, assessments)
        setSummary(res)
        try {
          localStorage.removeItem(storageKey)
        } catch {
          /* ignore */
        }
        setConfirmOpen(false)
        setTimeout(() => onSubmitted(res.knownCount), 3000)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể nộp bài")
      }
    })
  }

  if (summary) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-6 w-6" />
        </div>
        <p className="mt-3 font-heading font-semibold text-foreground text-balance">
          {summary.knownCount > 0
            ? `Bạn tự tin với ${summary.knownCount}/${summary.total} kiến thức. Bước Điền khuyết sẽ kiểm tra ${summary.knownCount} kiến thức đó.`
            : "Bạn chưa tự tin với kiến thức nào. Bước Kéo thả sẽ giúp bạn ôn tập toàn bộ."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Đang chuyển bước tiếp theo...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pb-20">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Đọc từng kiến thức và tự đánh giá bạn đã nắm được hay chưa. Bạn có thể đổi lựa chọn trước khi nộp.
      </p>

      {knowledgePoints.map((kp, i) => (
        <KPCard
          key={kp.id}
          index={i + 1}
          content={kp.content}
          value={assessments[kp.id]}
          onChoose={(v) => choose(kp.id, v)}
        />
      ))}

      {/* Bottom progress bar */}
      <div className="fixed inset-x-0 bottom-[56px] z-30 border-t border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Đã đánh giá {assessedCount}/{total} kiến thức
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${total > 0 ? (assessedCount / total) * 100 : 0}%` }}
            />
          </div>
          {allAssessed && (
            <Button
              className="mt-3 min-h-11 w-full"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
            >
              Hoàn thành tự đánh giá
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận nộp</DialogTitle>
            <DialogDescription>
              Bạn không thể quay lại bước Tự đánh giá sau khi nộp. Tiếp tục?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Quay lại
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Đang nộp..." : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KPCard({
  index,
  content,
  value,
  onChoose,
}: {
  index: number
  content: string
  value?: Assessment
  onChoose: (v: Assessment) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = content.length > 120

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "max-w-prose text-base leading-relaxed text-foreground",
              isLong && !expanded && "line-clamp-3",
            )}
          >
            {cleanContentDisplay(content)}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 flex items-center gap-1 text-xs font-medium text-primary"
            >
              {expanded ? (
                <>
                  Thu gọn <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Xem thêm <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onChoose("known")}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
            value === "known"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-foreground hover:bg-secondary",
          )}
        >
          <Check className="h-4 w-4" /> Tôi đã biết
        </button>
        <button
          type="button"
          onClick={() => onChoose("unknown")}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
            value === "unknown"
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-foreground hover:bg-secondary",
          )}
        >
          <X className="h-4 w-4" /> Chưa biết
        </button>
      </div>
    </div>
  )
}
