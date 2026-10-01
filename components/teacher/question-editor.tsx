"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  getQuestionsByKp,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "@/app/actions/questions"
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
  return [{ content: "", isCorrect: true }] // SA
}

export function QuestionEditor({
  knowledgePointId,
  onChanged,
}: {
  knowledgePointId: string
  onChanged?: () => void
}) {
  const [questions, setQuestions] = useState<QuestionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; q?: QuestionDto } | null>(null)
  const [type, setType] = useState<QType>("MC")
  const [content, setContent] = useState("")
  const [options, setOptions] = useState<OptRow[]>(defaultOptions("MC"))

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

  function openCreate() {
    setType("MC")
    setContent("")
    setOptions(defaultOptions("MC"))
    setDialog({ mode: "create" })
  }

  function openEdit(q: QuestionDto) {
    const t = q.type as QType
    setType(t)
    setContent(q.content)
    setOptions(
      (q.options ?? []).map((o) => ({ content: o.content, isCorrect: o.isCorrect, bodyHtml: o.bodyHtml })),
    )
    setDialog({ mode: "edit", q })
  }

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
        if (dialog?.mode === "create") {
          await createQuestion({ knowledgePointId, type, content, options: cleanOpts })
          toast.success("Đã thêm câu hỏi")
        } else if (dialog?.q) {
          await updateQuestion({ id: dialog.q.id, content, options: cleanOpts })
          toast.success("Đã cập nhật câu hỏi")
        }
        setDialog(null)
        await load()
        onChanged?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

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
        <Button size="sm" variant="outline" onClick={openCreate}>
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
                        <div
                          key={o.id}
                          className="flex items-start gap-1 text-xs text-muted-foreground"
                        >
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
                    onClick={() => openEdit(q)}
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

      <Dialog open={dialog !== null} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "create" ? "Thêm câu hỏi" : "Chỉnh sửa câu hỏi"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {dialog?.mode === "create" && (
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
              {dialog?.q?.bodyHtml ? (
                <div className="space-y-1 rounded-md border bg-muted/40 p-2">
                  <p className="text-xs font-medium text-muted-foreground">Xem trước hình / bảng</p>
                  <QuestionStem
                    content={content}
                    bodyHtml={dialog.q.bodyHtml}
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
            <Button variant="outline" onClick={() => setDialog(null)}>
              Huỷ
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending ? "Đang lưu..." : dialog?.mode === "create" ? "Thêm câu hỏi" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
