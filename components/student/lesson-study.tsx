"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { ArrowLeft, Lock } from "lucide-react"
import type { KnowledgePointDto } from "@/types"
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
  // Tab đã mở khoá: nếu Tab 1 đã nộp trước đó → mở hết
  const [unlocked, setUnlocked] = useState<TabIndex>(tab1Locked ? 4 : 1)
  const [current, setCurrent] = useState<TabIndex>(tab1Locked ? 2 : 1)

  const tabs: { index: TabIndex; label: string }[] = [
    { index: 1, label: "Nội dung" },
    { index: 2, label: "Điền khuyết" },
    { index: 3, label: "Kéo thả" },
    { index: 4, label: "Kiểm tra" },
  ]

  const goTo = (index: TabIndex) => {
    if (index === 1 && tab1Locked) {
      toast.info("Tab 1 đã hoàn thành và được khoá lại")
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
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{lesson.chapterTitle}</p>
          <h1 className="truncate font-heading text-base font-bold text-foreground">
            {lesson.title}
          </h1>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {tabs.map((t) => {
          const active = current === t.index
          const locked = t.index > unlocked || (t.index === 1 && tab1Locked)
          return (
            <button
              key={t.index}
              type="button"
              onClick={() => goTo(t.index)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-2 text-xs font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : locked
                    ? "text-muted-foreground/50"
                    : "text-muted-foreground hover:bg-secondary",
              )}
              aria-current={active ? "page" : undefined}
            >
              {locked && <Lock className="h-3 w-3" aria-hidden="true" />}
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
