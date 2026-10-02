"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createQuestion, updateQuestion } from "@/app/actions/questions"
import { QuestionStem } from "@/components/question/question-stem"
import type { QuestionDto } from "@/types"

type QType = "MC" | "TF" | "SA"

const TYPE_LABEL: Record<QType, string> = {
  MC: "Trắc nghiệm",
  TF: "Đúng/Sai",
  SA: "Trả lời ngắn",
}

interface OptRow {
  content: string
  isCorrect: boolean
  bodyHtml?: string | null
}

function defaultOptions(type: QType): OptRow[] {
  if (type === "MC")
    return [
      { content: "", isCorrect: true },
      { content: "", isCorrect: false },
      { content: "", isCorrect: false },
      { content: "", isCorrect: false },
    ]
  if (type === "TF")
    return [
      { content: "", isCorrect: true },
      { content: "", isCorrect: true },
      { content: "", isCorrect: true },
      { content: "", isCorrect: true },
    ]
  return [{ content: "", isCorrect: true }]
}

export function QuestionFormDialog({
  open,
  mode,
  question,
  lessonId,
  defaultKnowledgePointId,
  onClose,
  onSaved,
}: {
  open: boolean
  mode: "create" | "edit"
  question?: QuestionDto
  lessonId: string
  defaultKnowledgePointId: string | null
  onClose: () => void
  onSaved?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState<QType>("MC")
  const [content, setContent] = useState("")
  const [options, setOptions] = useState<OptRow[]>(defaultOptions("MC"))

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && question) {
      const t = question.type as QType
      setType(t)
      setContent(question.content)
      setOptions(
        (question.options ?? []).map((o) => ({
          content: o.content,
          isCorrect: o.isCorrect,
          bodyHtml: o.bodyHtml,
        })),
      )
    } else {
      setType("MC")
      setContent("")
      setOptions(defaultOptions("MC"))
    }
  }, [open, mode, question])

  function onTypeChange(t: QType) {
    setType(t)
    setOptions(defaultOptions(t))
  }

  function submit() {
    if (!content.trim()) {
      toast.error("Nhập nội dung câu hỏi")
      return
    }
    const cleanOpts = options.filter((o) => o.content.trim() !== "" || type === "TF")
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createQuestion({
            knowledgePointId: defaultKnowledgePointId,
            lessonId,
            type,
            content,
            options: cleanOpts,
          })
          toast.success("Đã thêm câu hỏi")
        } else if (question) {
          await updateQuestion({ id: question.id, content, options: cleanOpts })
          toast.success("Đã cập nhật câu hỏi")
        }
        onClose()
        onSaved?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Thêm câu hỏi" : "Chỉnh sửa câu hỏi"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {mode === "create" && (
            <div className="space-y-2">
              <Label>Loại câu hỏi</Label>
              <div className="flex gap-2">
                {(["MC", "TF", "SA"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onTypeChange(t)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="q-content">Nội dung câu hỏi</Label>
            <Textarea
              id="q-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Nhập nội dung câu hỏi"
            />
            {question?.bodyHtml ? (
              <div className="space-y-1 rounded-md border bg-muted/40 p-2">
                <p className="text-xs font-medium text-muted-foreground">Xem trước hình / bảng</p>
                <QuestionStem
                  content={content}
                  bodyHtml={question.bodyHtml}
                  className="text-sm"
                  maxHeightClass="max-h-48"
                />
              </div>
            ) : null}
          </div>

          {type === "MC" && (
            <div className="space-y-2">
              <Label>Các lựa chọn (chọn 1 đáp án đúng)</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) => prev.map((o, j) => ({ ...o, isCorrect: j === i })))
                    }
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      opt.isCorrect ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    }`}
                    aria-label={`Đặt lựa chọn ${i + 1} là đáp án đúng`}
                  >
                    {opt.isCorrect && <Check className="h-3 w-3" />}
                  </button>
                  <Input
                    value={opt.content}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, j) => (j === i ? { ...o, content: e.target.value } : o)),
                      )
                    }
                    placeholder={`Lựa chọn ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          )}

          {type === "TF" && (
            <div className="space-y-2">
              <Label>Các ý (đánh dấu Đúng/Sai cho từng ý)</Label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt.content}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, j) => (j === i ? { ...o, content: e.target.value } : o)),
                      )
                    }
                    placeholder={`Ý ${String.fromCharCode(97 + i)})`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((prev) =>
                        prev.map((o, j) => (j === i ? { ...o, isCorrect: !o.isCorrect } : o)),
                      )
                    }
                    className={`shrink-0 rounded-md border px-3 py-2 text-xs font-medium ${
                      opt.isCorrect
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {opt.isCorrect ? "Đúng" : "Sai"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {type === "SA" && (
            <div className="space-y-2">
              <Label htmlFor="sa-answer">Đáp án đúng</Label>
              <Input
                id="sa-answer"
                value={options[0]?.content ?? ""}
                onChange={(e) => setOptions([{ content: e.target.value, isCorrect: true }])}
                placeholder="VD: nucleotide"
              />
              <p className="text-xs text-muted-foreground">
                Hệ thống sẽ so khớp đáp án của học sinh (không phân biệt hoa thường, dấu cách).
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Đang lưu..." : mode === "create" ? "Thêm câu hỏi" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
