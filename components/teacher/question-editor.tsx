"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getQuestionsByKp, deleteQuestion } from "@/app/actions/questions"
import { QuestionStem } from "@/components/question/question-stem"
import { QuestionFormDialog } from "@/components/teacher/question-form-dialog"
import type { QuestionDto } from "@/types"

type QType = "MC" | "TF" | "SA"

const TYPE_LABEL: Record<QType, string> = {
  MC: "Trắc nghiệm",
  TF: "Đúng/Sai",
  SA: "Trả lời ngắn",
}

export function QuestionEditor({
  knowledgePointId,
  lessonId,
  onChanged,
}: {
  knowledgePointId: string
  lessonId: string
  onChanged?: () => void
}) {
  const [questions, setQuestions] = useState<QuestionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; q?: QuestionDto } | null>(null)

  async function load() {
    setLoading(true)
    try {
      setQuestions(await getQuestionsByKp(knowledgePointId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được câu hỏi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knowledgePointId])

  function remove(id: string) {
    if (!confirm("Xoá câu hỏi này?")) return
    startTransition(async () => {
      try {
        await deleteQuestion(id)
        toast.success("Đã xoá câu hỏi")
        await load()
        onChanged?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Câu hỏi</h3>
        <Button size="sm" variant="outline" onClick={() => setDialog({ mode: "create" })} disabled={isPending}>
          <Plus className="h-3.5 w-3.5" />
          Thêm câu hỏi
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải...
        </div>
      ) : questions.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Chưa có câu hỏi nào cho điểm kiến thức này.</p>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="rounded-md border bg-card px-3 py-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="shrink-0">
                  {TYPE_LABEL[q.type as QType] ?? q.type}
                </Badge>
                <div className="flex-1">
                  <QuestionStem
                    content={q.content}
                    bodyHtml={q.bodyHtml}
                    className="text-sm text-foreground"
                    maxHeightClass="max-h-32"
                  />
                  <div className="mt-1 space-y-0.5">
                    {q.type === "SA" ? (
                      <p className="text-xs text-muted-foreground">
                        Đáp án: <span className="font-medium text-foreground">{q.correctAnswer}</span>
                      </p>
                    ) : (
                      q.options?.map((o) => (
                        <div key={o.id} className="flex items-start gap-1 text-xs text-muted-foreground">
                          {o.isCorrect ? (
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                          ) : (
                            <X className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                          )}
                          {o.bodyHtml ? (
                            <QuestionStem
                              content={o.content}
                              bodyHtml={o.bodyHtml}
                              className="text-xs"
                              maxHeightClass="max-h-24"
                            />
                          ) : (
                            <span>{o.content}</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setDialog({ mode: "edit", q })}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Sửa câu hỏi"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(q.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Xoá câu hỏi"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuestionFormDialog
        open={dialog !== null}
        mode={dialog?.mode ?? "create"}
        question={dialog?.q}
        lessonId={lessonId}
        defaultKnowledgePointId={knowledgePointId}
        onClose={() => setDialog(null)}
        onSaved={() => {
          load()
          onChanged?.()
        }}
      />
    </div>
  )
}
