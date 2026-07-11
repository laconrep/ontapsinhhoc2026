"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ArrowLeft, Lock, RotateCcw } from "lucide-react"
import type { KnowledgePointDto } from "@/types"
import { Button } from "@/components/ui/button"
import { resetLessonProgress } from "@/app/actions/student-learn"
import { Tab1SelfAssess } from "./tab1-self-assess"
import { Tab2FillIn } from "./tab2-fill-in"
import { Tab3DragDrop } from "./tab3-drag-drop"
import { Tab4Quiz } from "./tab4-quiz"

type TabIndex = 1 | 2 | 3 | 4

export function LessonStudy({
  lessonId,
  lesson,
  knowledgePoints,
  tab1Locked,
  savedAssessments,
}: {
  lessonId: string
  lesson: { id: string; title: string; chapterTitle: string }
  knowledgePoints: KnowledgePointDto[]
  tab1Locked: boolean
  savedAssessments: Record<string, "known" | "unknown">
}) {
  // Khoá tab 1 (đã hoàn thành bài) — quản lý cục bộ để "Làm lại từ đầu" mở lại ngay
  const [locked, setLocked] = useState(tab1Locked)
  // Tab đã mở khoá: nếu Tab 1 đã nộp trước đó → mở hết
  const [unlocked, setUnlocked] = useState<TabIndex>(tab1Locked ? 4 : 1)
  const [current, setCurrent] = useState<TabIndex>(tab1Locked ? 2 : 1)
  const [resetting, startReset] = useTransition()

  const handleReset = () => {
    startReset(async () => {
      try {
        await resetLessonProgress(lessonId)
        setLocked(false)
        setUnlocked(1)
        setCurrent(1)
        toast.success("Đã mở lại bài học. Em có thể làm lại từ đầu!")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể làm lại")
      }
    })
  }

  const tabs: { index: TabIndex; label: string }[] = [
    { index: 1, label: "Nội dung" },
    { index: 2, label: "Điền khuyết" },
    { index: 3, label: "Kéo thả" },
    { index: 4, label: "Kiểm tra" },
  ]

  const goTo = (index: TabIndex) => {
    if (index === 1 && locked) {
      toast.info("Tab Nội dung đã hoàn thành. Nhấn \"Làm lại từ đầu\" để mở lại.")
      return
    }
    if (index > unlocked) {
      toast.info("Hãy hoàn thành bước trước đó")
      return
    }
    setCurrent(index)
  }

  const advanceTo = (index: TabIndex) => {
    setUnlocked((u) => (index > u ? index : u))
    setCurrent(index)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          href="/student/learn"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          aria-label="Quay lại danh sách bài"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{lesson.chapterTitle}</p>
          <h1 className="truncate font-heading text-base font-bold text-foreground">
            {lesson.title}
          </h1>
        </div>
        {locked && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-transparent"
            onClick={handleReset}
            disabled={resetting}
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? "Đang mở..." : "Làm lại từ đầu"}
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => {
          const active = current === t.index
          const tabLocked = t.index > unlocked || (t.index === 1 && locked)
          return (
            <button
              key={t.index}
              type="button"
              onClick={() => goTo(t.index)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : tabLocked
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground hover:bg-secondary",
              )}
              aria-current={active ? "page" : undefined}
            >
              {tabLocked && <Lock className="h-3 w-3" aria-hidden="true" />}
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {current === 1 && (
        <Tab1SelfAssess
          lessonId={lessonId}
          knowledgePoints={knowledgePoints}
          savedAssessments={savedAssessments}
          onSubmitted={(knownCount) => advanceTo(knownCount > 0 ? 2 : 3)}
        />
      )}
      {current === 2 && (
        <Tab2FillIn
          lessonId={lessonId}
          onComplete={() => advanceTo(3)}
        />
      )}
      {current === 3 && (
        <Tab3DragDrop
          lessonId={lessonId}
          onComplete={() => advanceTo(4)}
        />
      )}
      {current === 4 && <Tab4Quiz lessonId={lessonId} />}
    </div>
  )
}
