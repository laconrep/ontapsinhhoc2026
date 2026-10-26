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
import {
  bodyHtmlToEditable,
  editableToBodyHtml,
  editableToPlainText,
} from "@/lib/editable-html"
import type { QuestionDto } from "@/types"

type QType = "MC" | "TF" | "SA"

const TYPE_LABEL: Record<QType, string> = {
  MC: "Trắc nghiệm",
  TF: "Đúng/Sai",
  SA: "Trả lời ngắn",
}

// Ô nhập của một lựa chọn/ý: văn bản khả sửa (chữ + placeholder
// @@MEDIA-n@@ giữ vị trí ảnh/bảng) kèm danh sách media gốc. Khi lưu,
// content = văn bản thuần (đã bỏ placeholder), bodyHtml = HTML dựng lại
// từ văn bản + media — nhờ đó chữ giáo viên sửa luôn tới được chỗ render
// (QuestionStem ưu tiên bodyHtml), thay vì kẹt ở bản bodyHtml cũ như trước.
interface OptRow {
  editable: string
  media: string[]
  isCorrect: boolean
}

function defaultOptions(type: QType): OptRow[] {
  if (type === "MC")
    return [
      { editable: "", media: [], isCorrect: true },
      { editable: "", media: [], isCorrect: false },
      { editable: "", media: [], isCorrect: false },
      { editable: "", media: [], isCorrect: false },
    ]
  if (type === "TF")
    return [
      { editable: "", media: [], isCorrect: true },
      { editable: "", media: [], isCorrect: true },
      { editable: "", media: [], isCorrect: true },
      { editable: "", media: [], isCorrect: true },
    ]
  return [{ editable: "", media: [], isCorrect: true }]
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
  const [stemText, setStemText] = useState("")
  const [stemMedia, setStemMedia] = useState<string[]>([])
  const [options, setOptions] = useState<OptRow[]>(defaultOptions("MC"))

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && question) {
      const t = question.type as QType
      setType(t)
      if (question.bodyHtml) {
        const e = bodyHtmlToEditable(question.bodyHtml)
        setStemText(e.text)
        setStemMedia(e.media)
      } else {
        setStemText(question.content)
        setStemMedia([])
      }
      setOptions(
        (question.options ?? []).map((o) => {
          if (o.bodyHtml) {
            const e = bodyHtmlToEditable(o.bodyHtml)
            return { editable: e.text, media: e.media, isCorrect: o.isCorrect }
          }
          return { editable: o.content, media: [], isCorrect: o.isCorrect }
        }),
      )
    } else {
      setType("MC")
      setStemText("")
      setStemMedia([])
      setOptions(defaultOptions("MC"))
    }
  }, [open, mode, question])

  function onTypeChange(t: QType) {
    setType(t)
    setOptions(defaultOptions(t))
  }

  function submit() {
    const stemPlain = editableToPlainText(stemText, stemMedia)
    const stemHtml = editableToBodyHtml(stemText, stemMedia)
    if (!stemPlain.trim() && !stemHtml) {
      toast.error("Nhập nội dung câu hỏi")
      return
    }
    // Giữ lại lựa chọn có chữ hoặc có ảnh/bảng; lựa chọn trống hoàn toàn
    // mới bỏ (trừ TF giữ đủ 4 ý như trước). Trước đây lựa chọn chỉ có
    // ảnh (chữ thuần rỗng) đã bị lọc mất ở bước này.
    const cleanOpts = options
      .map((o) => ({
        content: editableToPlainText(o.editable, o.media),
        bodyHtml: editableToBodyHtml(o.editable, o.media),
        isCorrect: o.isCorrect,
      }))
      .filter((o) => o.content.trim() !== "" || o.bodyHtml != null || type === "TF")
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createQuestion({
            knowledgePointId: defaultKnowledgePointId,
            lessonId,
            type,
            content: stemPlain,
            bodyHtml: stemHtml,
            options: cleanOpts,
          })
          toast.success("Đã thêm câu hỏi")
        } else if (question) {
          await updateQuestion({
            id: question.id,
            content: stemPlain,
            bodyHtml: stemHtml,
            options: cleanOpts,
          })
          toast.success("Đã cập nhật câu hỏi")
        }
        onClose()
        onSaved?.()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  const stemPreviewHtml = editableToBodyHtml(stemText, stemMedia)
  const hasMedia = stemMedia.length > 0 || options.some((o) => o.media.length > 0)

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
              value={stemText}
              onChange={(e) => setStemText(e.target.value)}
              rows={6}
              placeholder="Nhập nội dung câu hỏi"
            />
            {hasMedia ? (
              <p className="text-xs text-muted-foreground">
                Ký hiệu @@MEDIA-1@@, @@MEDIA-2@@… là vị trí ảnh/bảng trong câu — giữ nguyên để
                giữ ảnh/bảng, xóa để bỏ ảnh/bảng đó. Khung xem trước bên dưới cập nhật theo chữ
                bạn gõ.
              </p>
            ) : null}
            {stemPreviewHtml ? (
              <div className="space-y-1 rounded-md border bg-muted/40 p-2">
                <p className="text-xs font-medium text-muted-foreground">Xem trước hình / bảng</p>
                <QuestionStem
                  content={editableToPlainText(stemText, stemMedia)}
                  bodyHtml={stemPreviewHtml}
                  className="text-sm"
                  maxHeightClass="max-h-48"
                />
              </div>
            ) : null}
          </div>

          {type === "MC" && (
            <div className="space-y-2">
              <Label>Các lựa chọn (chọn 1 đáp án đúng)</Label>
              {options.map((opt, i) => {
                const optPreviewHtml = editableToBodyHtml(opt.editable, opt.media)
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
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
                        value={opt.editable}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((o, j) => (j === i ? { ...o, editable: e.target.value } : o)),
                          )
                        }
                        placeholder={`Lựa chọn ${i + 1}`}
                      />
                    </div>
                    {optPreviewHtml ? (
                      <div className="ml-7 rounded-md border bg-muted/40 p-2">
                        <QuestionStem
                          content={editableToPlainText(opt.editable, opt.media)}
                          bodyHtml={optPreviewHtml}
                          className="text-xs"
                          maxHeightClass="max-h-24"
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {type === "TF" && (
            <div className="space-y-2">
              <Label>Các ý (đánh dấu Đúng/Sai cho từng ý)</Label>
              {options.map((opt, i) => {
                const optPreviewHtml = editableToBodyHtml(opt.editable, opt.media)
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Input
                        value={opt.editable}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((o, j) => (j === i ? { ...o, editable: e.target.value } : o)),
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
                    {optPreviewHtml ? (
                      <div className="rounded-md border bg-muted/40 p-2">
                        <QuestionStem
                          content={editableToPlainText(opt.editable, opt.media)}
                          bodyHtml={optPreviewHtml}
                          className="text-xs"
                          maxHeightClass="max-h-24"
                        />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}

          {type === "SA" && (
            <div className="space-y-2">
              <Label htmlFor="sa-answer">Đáp án đúng</Label>
              <Input
                id="sa-answer"
                value={options[0]?.editable ?? ""}
                onChange={(e) =>
                  setOptions([
                    {
                      editable: e.target.value,
                      media: options[0]?.media ?? [],
                      isCorrect: true,
                    },
                  ])
                }
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
