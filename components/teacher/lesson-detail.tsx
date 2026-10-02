"use client"

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FileText,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { deleteQuestion, moveQuestion, type LessonQuestionItem } from "@/app/actions/questions"
import { QuestionFormDialog } from "@/components/teacher/question-form-dialog"
import { KpContentEditor } from "@/components/teacher/kp-content-editor"
import { QuestionStem } from "@/components/question/question-stem"
import { extractBlanks } from "@/lib/worksheet-parser"
import { renderMarkedContent } from "@/lib/kp-render"
import { cn } from "@/lib/utils"
import type { KnowledgePointDto, LessonDto, QuestionDto } from "@/types"

type KP = KnowledgePointDto & { questionCount: number }

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  error: "Lỗi",
}

const TYPE_LABEL: Record<string, string> = {
  MC: "Trắc nghiệm",
  TF: "Đúng/Sai",
  SA: "Trả lời ngắn",
  FILL: "Điền khuyết",
  DRAG: "Kéo thả",
}

const assignCollisionDetection: CollisionDetection = ({
  droppableContainers,
  pointerCoordinates,
}) => {
  if (!pointerCoordinates) return []
  const { x, y } = pointerCoordinates
  const hits: { id: string; data: { droppableContainer: (typeof droppableContainers)[number]; value: number } }[] = []
  for (const container of droppableContainers) {
    const node = container.node.current
    if (!node || container.disabled) continue
    const r = node.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
    hits.push({
      id: String(container.id),
      data: { droppableContainer: container, value: r.width * r.height },
    })
  }
  hits.sort((a, b) => a.data.value - b.data.value)
  const kpHits = hits.filter((h) => h.id.startsWith("kp:"))
  return kpHits.length > 0 ? kpHits : hits
}

function isUnassignedQuestion(
  q: { knowledgePointId?: string | null },
  kpIds: Set<string>,
) {
  const kpId = q.knowledgePointId
  return !kpId || !kpIds.has(kpId)
}

function toQuestionDto(q: LessonQuestionItem): QuestionDto {
  return {
    id: q.id,
    lessonId: q.lessonId,
    knowledgePointId: q.knowledgePointId,
    type: q.type,
    content: q.content,
    bodyHtml: q.bodyHtml,
    options: q.options,
    correctAnswer: q.correctAnswer,
  }
}

function QuestionBody({ q }: { q: LessonQuestionItem }) {
  return (
    <div className="min-w-0 flex-1">
      <QuestionStem
        content={q.content}
        bodyHtml={q.bodyHtml}
        className="text-sm text-foreground"
        maxHeightClass="max-h-24"
      />
      <div className="mt-1 space-y-0.5">
        {q.type === "SA" ? (
          <p className="text-xs text-muted-foreground">
            Đáp án: <span className="font-medium text-foreground">{q.correctAnswer}</span>
          </p>
        ) : (
          q.options.map((o) => (
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
                  maxHeightClass="max-h-16"
                />
              ) : (
                <span>{o.content}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function DraggableQuestionCard({
  q,
  draggable,
  kpLabel,
  onEdit,
  onDelete,
}: {
  q: LessonQuestionItem
  draggable: boolean
  kpLabel?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: q.id,
    disabled: !draggable,
  })
  return (
    <li
      ref={setNodeRef}
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        draggable && "cursor-grab touch-none",
        isDragging && "opacity-40",
      )}
      {...(draggable ? { ...listeners, ...attributes } : {})}
    >
      <div className="flex items-start gap-2">
        {draggable ? (
          <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">
            <GripVertical className="h-4 w-4" />
          </span>
        ) : null}
        <Badge variant="outline" className="shrink-0">
          {TYPE_LABEL[q.type] ?? q.type}
        </Badge>
        <QuestionBody q={q} />
        <div className="flex shrink-0 flex-col items-end gap-1">
          {kpLabel ? (
            <Badge variant="secondary" className="font-normal">
              {kpLabel}
            </Badge>
          ) : null}
          <div
            className="flex gap-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onEdit}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Sửa câu hỏi"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Xoá câu hỏi"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function KpPanelDroppable({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "kp-panel" })
  return (
    <div
      ref={setNodeRef}
      className={cn("min-h-full space-y-3 rounded-md", isOver && "ring-2 ring-primary/40")}
    >
      {children}
    </div>
  )
}

function PoolDropzone({
  isUnassignedTab,
  children,
}: {
  isUnassignedTab: boolean
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-full space-y-2 rounded-md p-1",
        isUnassignedTab && isOver && "ring-2 ring-primary",
      )}
    >
      {children}
    </div>
  )
}

function KpDroppable({
  kp,
  idx,
  count,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddQuestion,
  children,
}: {
  kp: KP
  idx: number
  count: number
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddQuestion: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `kp:${kp.id}` })
  return (
    <div
      ref={setNodeRef}
      className={cn("overflow-hidden rounded-lg border bg-card", isOver && "ring-2 ring-primary")}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="line-clamp-2 text-foreground">{kp.content}</p>
            <div className="flex flex-wrap items-center gap-2">
              {kp.underlinedTerms.slice(0, 4).map((t) => (
                <Badge key={t.slotIndex} variant="secondary" className="font-normal">
                  {t.text}
                  {t.allowSwap ? " ⇄" : ""}
                </Badge>
              ))}
              <Badge variant="outline">{count} câu hỏi</Badge>
            </div>
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Tuỳ chọn điểm kiến thức"
          >
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAddQuestion}>
              <Plus className="h-4 w-4" />
              Thêm câu hỏi
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Chỉnh sửa
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Xoá
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && <div className="border-t bg-secondary/30 px-4 py-3">{children}</div>}
    </div>
  )
}

export function LessonDetail({
  lesson,
  initialKnowledgePoints,
  initialQuestions,
}: {
  lesson: LessonDto & { chapterTitle: string }
  initialKnowledgePoints: KP[]
  initialQuestions: LessonQuestionItem[]
}) {
  const [kps, setKps] = useState<KP[]>(initialKnowledgePoints)
  const [questions, setQuestions] = useState<LessonQuestionItem[]>(initialQuestions)
  const [status, setStatus] = useState(lesson.status)
  useEffect(() => {
    setKps(initialKnowledgePoints)
    setQuestions(initialQuestions)
    setStatus(lesson.status)
  }, [initialKnowledgePoints, initialQuestions, lesson.status])
  const [expandedKpId, setExpandedKpId] = useState<string | null>(null)
  const [poolTab, setPoolTab] = useState<"unassigned" | "all">("unassigned")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [hoverKpId, setHoverKpId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [kpDialog, setKpDialog] = useState<{ mode: "create" | "edit"; kp?: KP } | null>(null)
  const [rawContent, setRawContent] = useState("")
  const [qDialog, setQDialog] = useState<{
    mode: "create" | "edit"
    q?: QuestionDto
    kpId: string | null
  } | null>(null)

  const [overlayMounted, setOverlayMounted] = useState(false)
  useEffect(() => {
    setOverlayMounted(true)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const kpIds = useMemo(() => new Set(kps.map((kp) => kp.id)), [kps])
  const unassigned = useMemo(
    () => questions.filter((q) => isUnassignedQuestion(q, kpIds)),
    [questions, kpIds],
  )
  const kpLabelById = useMemo(() => {
    const map = new Map<string, string>()
    kps.forEach((kp, i) => map.set(kp.id, `KP ${i + 1}`))
    return map
  }, [kps])
  const questionsByKp = useMemo(() => {
    const map = new Map<string, LessonQuestionItem[]>()
    for (const q of questions) {
      const kid = q.knowledgePointId
      if (!kid || !kpIds.has(kid)) continue
      const list = map.get(kid) ?? []
      list.push(q)
      map.set(kid, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.order - b.order)
    return map
  }, [questions, kpIds])
  const activeQuestion = questions.find((q) => q.id === activeId) ?? null

  async function refresh() {
    const [{ getLessonDetail }, { getLessonQuestions }] = await Promise.all([
      import("@/app/actions/content"),
      import("@/app/actions/questions"),
    ])
    const [data, qs] = await Promise.all([getLessonDetail(lesson.id), getLessonQuestions(lesson.id)])
    if (data) setKps(data.knowledgePoints)
    setQuestions(qs)
  }

  function submitKp() {
    if (!rawContent.trim()) return
    const { content, underlinedTerms } = extractBlanks(rawContent)
    if (underlinedTerms.length === 0) {
      toast.error("Điểm kiến thức cần ít nhất 1 ô trống (gạch chân hoặc ngoặc kép).")
      return
    }
    startTransition(async () => {
      try {
        if (kpDialog?.mode === "create") {
          await createKnowledgePoint(lesson.id, content, underlinedTerms)
          toast.success("Đã thêm điểm kiến thức")
        } else if (kpDialog?.kp) {
          await updateKnowledgePoint(kpDialog.kp.id, content, underlinedTerms)
          toast.success("Đã cập nhật điểm kiến thức")
        }
        setKpDialog(null)
        setRawContent("")
        await refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  function removeKp(id: string) {
    if (!confirm("Xoá điểm kiến thức này? Các câu hỏi trong đó sẽ trở về khung câu hỏi (không bị xoá).")) return
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

  function removeQuestion(id: string) {
    if (!confirm("Xoá câu hỏi này?")) return
    startTransition(async () => {
      try {
        await deleteQuestion(id)
        toast.success("Đã xoá câu hỏi")
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

  function onDragStart(ev: DragStartEvent) {
    setActiveId(String(ev.active.id))
  }

  function onDragOver(ev: DragOverEvent) {
    const overId = ev.over?.id ? String(ev.over.id) : ""
    if (overId.startsWith("kp:")) setHoverKpId(overId.slice(3))
  }

  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null)
    const overId = ev.over?.id ? String(ev.over.id) : ""
    const qid = String(ev.active.id)
    const kpId = overId.startsWith("kp:") ? overId.slice(3) : hoverKpId
    setHoverKpId(null)
    if (!kpId) return
    const prev = questions
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, knowledgePointId: kpId } : q)))
    startTransition(async () => {
      try {
        await moveQuestion(qid, kpId)
        await refresh()
      } catch (e) {
        setQuestions(prev)
        toast.error(e instanceof Error ? e.message : "Không gán được câu hỏi")
      }
    })
  }

  const poolList = poolTab === "unassigned" ? unassigned : questions

  return (
    <div className="flex h-[calc(100svh-5.5rem)] flex-col gap-4 overflow-hidden md:h-[calc(100svh-2.5rem)]">
      <div className="shrink-0">
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

      <DndContext
        sensors={sensors}
        collisionDetection={assignCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        autoScroll={false}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null)
          setHoverKpId(null)
        }}
      >
        <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
          <section className="flex min-h-0 flex-col rounded-lg border bg-card">
            <div className="shrink-0 space-y-3 border-b p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold text-foreground">Bộ câu hỏi</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setQDialog({ mode: "create", kpId: null })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Thêm câu hỏi
                </Button>
              </div>
              <div className="flex gap-1 rounded-md border p-1">
                <button
                  type="button"
                  onClick={() => setPoolTab("unassigned")}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-sm font-medium",
                    poolTab === "unassigned" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Chưa gán ({unassigned.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPoolTab("all")}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-sm font-medium",
                    poolTab === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Tổng câu hỏi ({questions.length})
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              <PoolDropzone isUnassignedTab={poolTab === "unassigned"}>
                {poolList.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {poolTab === "unassigned" ? "Không còn câu chưa gán." : "Chưa có câu hỏi."}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {poolList.map((q) => (
                      <DraggableQuestionCard
                        key={q.id}
                        q={q}
                        draggable={isUnassignedQuestion(q, kpIds)}
                        kpLabel={
                          poolTab === "all" && !isUnassignedQuestion(q, kpIds) && q.knowledgePointId
                            ? kpLabelById.get(q.knowledgePointId)
                            : undefined
                        }
                        onEdit={() => setQDialog({ mode: "edit", q: toQuestionDto(q), kpId: q.knowledgePointId })}
                        onDelete={() => removeQuestion(q.id)}
                      />
                    ))}
                  </ul>
                )}
              </PoolDropzone>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-lg border bg-card">
            <div className="flex shrink-0 items-center justify-between border-b p-4">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Điểm kiến thức ({kps.length})
              </h2>
              <Button
                size="sm"
                onClick={() => {
                  setKpDialog({ mode: "create" })
                  setRawContent("")
                }}
              >
                <Plus className="h-4 w-4" />
                Thêm điểm kiến thức
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {kps.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                    <FileText className="h-6 w-6 text-primary" />
                  </span>
                  <p className="font-medium text-foreground">Chưa có điểm kiến thức</p>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Thêm điểm kiến thức rồi kéo câu hỏi từ khung trái thả vào đây.
                  </p>
                </div>
              ) : (
                <KpPanelDroppable>
                  {kps.map((kp, idx) => {
                    const assigned = questionsByKp.get(kp.id) ?? []
                    return (
                      <KpDroppable
                        key={kp.id}
                        kp={kp}
                        idx={idx}
                        count={assigned.length}
                        expanded={expandedKpId === kp.id}
                        onToggle={() => setExpandedKpId(expandedKpId === kp.id ? null : kp.id)}
                        onEdit={() => {
                          setKpDialog({ mode: "edit", kp })
                          setRawContent(renderMarkedContent(kp.content, kp.underlinedTerms))
                        }}
                        onDelete={() => removeKp(kp.id)}
                        onAddQuestion={() => setQDialog({ mode: "create", kpId: kp.id })}
                      >
                        {assigned.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Chưa gán câu hỏi. Kéo từ khung trái thả vào đây.</p>
                        ) : (
                          <ul className="space-y-2">
                            {assigned.map((q) => (
                              <DraggableQuestionCard
                                key={q.id}
                                q={q}
                                draggable={false}
                                onEdit={() =>
                                  setQDialog({ mode: "edit", q: toQuestionDto(q), kpId: q.knowledgePointId })
                                }
                                onDelete={() => removeQuestion(q.id)}
                              />
                            ))}
                          </ul>
                        )}
                      </KpDroppable>
                    )
                  })}
                </KpPanelDroppable>
              )}
            </div>
          </section>
        </div>
        {overlayMounted
          ? createPortal(
              <DragOverlay dropAnimation={null} zIndex={80}>
                {activeQuestion ? (
                  <div className="pointer-events-none w-[min(28rem,90vw)] cursor-grabbing rounded-md border bg-card px-3 py-2 shadow-lg">
                    <p className="line-clamp-2 text-sm">{activeQuestion.content}</p>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )
          : null}
      </DndContext>

      <Dialog open={kpDialog !== null} onOpenChange={(v) => !v && setKpDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {kpDialog?.mode === "create" ? "Thêm điểm kiến thức" : "Chỉnh sửa điểm kiến thức"}
            </DialogTitle>
            <DialogDescription>
              Giữ Ctrl + click để gạch chân; thêm ngoặc kép để cho phép hoán đổi vị trí.
            </DialogDescription>
          </DialogHeader>
          <KpContentEditor value={rawContent} onChange={setRawContent} autoFocus />
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

      <QuestionFormDialog
        open={qDialog !== null}
        mode={qDialog?.mode ?? "create"}
        question={qDialog?.q}
        lessonId={lesson.id}
        defaultKnowledgePointId={qDialog?.kpId ?? null}
        onClose={() => setQDialog(null)}
        onSaved={refresh}
      />
    </div>
  )
}
