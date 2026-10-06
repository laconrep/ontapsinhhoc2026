"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, RotateCcw } from "lucide-react"
import type { KnowledgePointDto } from "@/types"
import type { StudyStage } from "@/app/actions/student-learn"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Stepper, type StepIndex } from "@/components/shared/stepper"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { resetLessonProgress } from "@/app/actions/student-learn"
import { Tab1SelfAssess } from "./tab1-self-assess"
import { Tab1Readonly } from "./tab1-readonly"
import { Tab2FillIn } from "./tab2-fill-in"
import { Tab3DragDrop } from "./tab3-drag-drop"
import { Tab4Quiz } from "./tab4-quiz"

function stageToStep(stage: StudyStage): StepIndex {
  if (stage === "tab1") return 1
  if (stage === "tab2") return 2
  if (stage === "tab3") return 3
  return 4
}

export function LessonStudy({
  lessonId,
  userId,
  lesson,
  knowledgePoints,
  savedAssessments,
  stage: initialStage,
  skippedTab2,
  quizQuestionCount,
}: {
  lessonId: string
  userId: string
  lesson: { id: string; title: string; chapterTitle: string }
  knowledgePoints: KnowledgePointDto[]
  savedAssessments: Record<string, "known" | "unknown">
  stage: StudyStage
  skippedTab2: boolean
  quizQuestionCount: number
}) {
  const [stage, setStage] = useState<StudyStage>(initialStage)
  const [assessments, setAssessments] = useState(savedAssessments)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [skip2, setSkip2] = useState(skippedTab2)
  const [resetting, startReset] = useTransition()

  const current = stageToStep(stage)
  const done = stage === "done"

  const handleReset = () => {
    startReset(async () => {
      try {
        await resetLessonProgress(lessonId)
        setStage("tab1")
        setSkip2(false)
        setResetOpen(false)
        toast.success("Đã mở lại bài học. Bạn có thể làm lại từ đầu!")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Không thể làm lại")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          href="/student/learn"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          aria-label="Quay lại danh sách bài"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{lesson.chapterTitle}</p>
          <h1 className="truncate text-base font-semibold text-foreground">
            {lesson.title}
          </h1>
        </div>
        {done && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-transparent"
            onClick={() => setResetOpen(true)}
            disabled={resetting}
          >
            <RotateCcw className="h-4 w-4" />
            {resetting ? "Đang mở..." : "Làm lại từ đầu"}
          </Button>
        )}
      </div>

      <Stepper
        current={current}
        skipped={{ 2: skip2 && current > 2 }}
        onReviewStep1={stage !== "tab1" ? () => setReviewOpen(true) : undefined}
      />

      {stage === "tab1" && (
        <Tab1SelfAssess
          lessonId={lessonId}
          knowledgePoints={knowledgePoints}
          savedAssessments={assessments}
          onSubmitted={(knownCount, nextAssessments) => {
            setAssessments(nextAssessments)
            setSkip2(knownCount === 0)
            setStage(knownCount > 0 ? "tab2" : "tab3")
          }}
        />
      )}
      {stage === "tab2" && (
        <Tab2FillIn lessonId={lessonId} onComplete={() => setStage("tab3")} />
      )}
      {stage === "tab3" && (
        <Tab3DragDrop lessonId={lessonId} onComplete={() => setStage("tab4")} />
      )}
      {(stage === "tab4" || stage === "done") && (
        <Tab4Quiz
          lessonId={lessonId}
          userId={userId}
          quizQuestionCount={quizQuestionCount}
          onFinished={() => setStage("done")}
          onReviewWrong={() => setResetOpen(true)}
        />
      )}

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Làm lại từ đầu?"
        description="Bạn sẽ làm lại từ bước Tự đánh giá. Tiến độ kiểm tra lần này được giữ trong thống kê."
        confirmLabel="Làm lại từ đầu"
        onConfirm={handleReset}
        pending={resetting}
      />

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xem lại kiến thức</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <Tab1Readonly knowledgePoints={knowledgePoints} assessments={assessments} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
