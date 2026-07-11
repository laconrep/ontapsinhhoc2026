"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createKnowledgePoint,
  updateKnowledgePoint,
  deleteKnowledgePoint,
  updateLesson,
} from "@/app/actions/content"
import { QuestionEditor } from "@/components/teacher/question-editor"
import type { KnowledgePointDto, LessonDto, UnderlinedTerm } from "@/types"

type KP = KnowledgePointDto & { questionCount: number }

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  error: "Lỗi",
}

// Parse `content` and derive underlined terms from double-quoted segments.
// Convention: mỗi cụm trong dấu ngoặc kép "..." là một từ khoá cần điền.
function deriveTerms(content: string, previous: UnderlinedTerm[]): UnderlinedTerm[] {
  const matches = [...content.matchAll(/"([^"]+)"/g)].map((m) => m[1])
  return matches.map((text, i) => {
    const prev = previous.find((p) => p.text === text)
    return (
      prev ?? {
        text,
        slotIndex: i,
        allowSwap: false,
        swapGroupId: null,
        extraAccepted: [],
      }
    )
  })
}

export function LessonDetail({
  lesson,
  initialKnowledgePoints,
}: {
  lesson: LessonDto & { chapterTitle: string }
  initialKnowledgePoints: KP[]
}) {
  const [kps, setKps] = useState<KP[]>(initialKnowledgePoints)
  const [status, setStatus] = useState(lesson.status)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [kpDialog, setKpDialog] = useState<{ mode: "create" | "edit"; kp?: KP } | null>(null)
  const [content, setContent] = useState("")

  async function refresh() {
    const { getLessonDetail } = await import("@/app/actions/content")
    const data = await getLessonDetail(lesson.id)
    if (data) setKps(data.knowledgePoints)
  }

  function submitKp() {
    if (!content.trim()) return
    const terms = deriveTerms(content, kpDialog?.kp?.underlinedTerms ?? [])
    startTransition(async () => {
      try {
        if (kpDialog?.mode === "create") {
          await createKnowledgePoint(lesson.id, content, terms)
          toast.success("Đã thêm điểm kiến thức")
        } else if (kpDialog?.kp) {
          await updateKnowledgePoint(kpDialog.kp.id, content, terms)
          toast.success("Đã cập nhật điểm kiến thức")
        }
        setKpDialog(null)
        setContent("")
        await refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  function removeKp(id: string) {
    if (!confirm("Xoá điểm kiến thức này và toàn bộ câu hỏi bên trong?")) return
    startTransition(async () => {
      try {
        await deleteKnowledgePoint(id)
        toast.success("Đã xoá điểm kiến thức")
        await refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  function changeStatus(next: LessonDto["status"]) {
    startTransition(async () => {
      try {
        await updateLesson(lesson.id, { status: next })
        setStatus(next)
        toast.success("Đã cập nhật trạng thái bài giảng")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          nativeButton={false}
          render={<Link href="/teacher/lessons" />}
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại bài giảng
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{lesson.chapterTitle}</p>
            <h1 className="font-heading text-2xl font-bold text-foreground">{lesson.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trạng thái:</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary"
                aria-label="Đổi trạng thái"
              >
                {STATUS_LABEL[status]}
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["draft", "ready"] as const).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                    {STATUS_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Điểm kiến thức ({kps.length})
        </h2>
        <Button
          onClick={() => {
            setKpDialog({ mode: "create" })
            setContent("")
          }}
        >
          <Plus className="h-4 w-4" />
          Thêm điểm kiến thức
        </Button>
      </div>

      {kps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <FileText className="h-6 w-6 text-primary" />
          </span>
          <p className="font-medium text-foreground">Chưa có điểm kiến thức</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Thêm điểm kiến thức. Đặt các từ khoá quan trọng trong dấu ngoặc kép &quot; &quot; để tạo
            chỗ điền khuyết cho học sinh.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kps.map((kp, idx) => (
            <div key={kp.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {idx + 1}
                </span>
                <div className="flex-1 space-y-2">
                  <p className="text-foreground">{kp.content}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {kp.underlinedTerms.map((t) => (
                      <Badge key={t.slotIndex} variant="secondary" className="font-normal">
                        {t.text}
                        {t.allowSwap ? " ⇄" : ""}
                      </Badge>
                    ))}
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === kp.id ? null : kp.id)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {kp.questionCount} câu hỏi
                    </button>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Tuỳ chọn điểm kiến thức"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setKpDialog({ mode: "edit", kp })
                        setContent(kp.content)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Chỉnh sửa
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => removeKp(kp.id)}>
                      <Trash2 className="h-4 w-4" />
                      Xoá
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {expanded === kp.id && (
                <div className="border-t bg-secondary/30 px-4 py-4">
                  <QuestionEditor knowledgePointId={kp.id} onChanged={refresh} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={kpDialog !== null} onOpenChange={(v) => !v && setKpDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {kpDialog?.mode === "create" ? "Thêm điểm kiến thức" : "Chỉnh sửa điểm kiến thức"}
            </DialogTitle>
            <DialogDescription>
              Đặt từ khoá quan trọng trong dấu ngoặc kép, ví dụ: đơn phân là &quot;nucleotide&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="kp-content">Nội dung</Label>
            <Textarea
              id="kp-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='VD: ADN cấu tạo theo nguyên tắc "đa phân", đơn phân là "nucleotide"'
              rows={4}
              autoFocus
            />
            {content && (
              <p className="text-xs text-muted-foreground">
                Từ khoá điền khuyết:{" "}
                {deriveTerms(content, []).length > 0
                  ? deriveTerms(content, [])
                      .map((t) => t.text)
                      .join(", ")
                  : "chưa có (dùng dấu ngoặc kép)"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpDialog(null)}>
              Huỷ
            </Button>
            <Button onClick={submitKp} disabled={isPending}>
              {kpDialog?.mode === "create" ? "Thêm" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
