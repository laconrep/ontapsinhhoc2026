"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { noteActionSuccess, reloadIfStaleAction } from "@/lib/stale-action"
import {
  assignLessons,
  getAssignableLessons,
  removeAssignment,
  updateAssignment,
} from "@/app/actions/assignments"
import { createClassLesson, createLesson, getChapterOptions } from "@/app/actions/content"
import type { ClassAssignmentDto } from "@/types"
import { UnsavedDrafts } from "@/components/teacher/unsaved-drafts"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { EmptyState } from "@/components/shared/empty-state"
import { formatDateTime } from "@/lib/format-date"
import { BookOpen, BookPlus, FileUp, MoreHorizontal, Plus } from "lucide-react"

type AssignableLesson = { id: string; title: string; chapterTitle: string }

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function dueBadge(dueAt: string | null): { label: string; className: string } | null {
  if (!dueAt) return null
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return null
  const now = Date.now()
  const ms = due.getTime() - now
  const label = formatDateTime(due)
  if (ms < 0) return { label, className: "bg-destructive/15 text-destructive" }
  if (ms < 3 * 24 * 60 * 60 * 1000) return { label, className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" }
  return { label, className: "" }
}

export function ClassAssignments({
  classId,
  initial,
}: {
  classId: string
  initial: ClassAssignmentDto[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [assignOpen, setAssignOpen] = useState(false)
  const [lessons, setLessons] = useState<AssignableLesson[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dueAt, setDueAt] = useState("")
  const [note, setNote] = useState("")
  const [loadingLessons, setLoadingLessons] = useState(false)
  const [editTarget, setEditTarget] = useState<ClassAssignmentDto | null>(null)
  const [editDueAt, setEditDueAt] = useState("")
  const [editNote, setEditNote] = useState("")
  const [revokeTarget, setRevokeTarget] = useState<ClassAssignmentDto | null>(null)
  // Dialog "Tạo bài giảng": nút tắt 2 cách tạo bài như tab Bài giảng
  // (nạp từ file / tạo bài trống), tạo bài trống thì thuần như tab Bài giảng.
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<"choose" | "blank">("choose")
  const [chapters, setChapters] = useState<{ id: string; title: string }[]>([])
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [newChapterId, setNewChapterId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  // §18: tạo bài trống từ tab Lớp — lưu vào thư viện hay tại lớp.
  const [createTarget, setCreateTarget] = useState<"library" | "class">("library")

  function openCreate() {
    setCreateOpen(true)
    setCreateStep("choose")
    setCreateTarget("library")
    setNewTitle("")
    setNewChapterId("")
    setLoadingChapters(true)
    getChapterOptions()
      .then((rows) => {
        setChapters(rows)
        if (rows.length > 0) setNewChapterId(rows[0].id)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được danh sách chương"))
      .finally(() => setLoadingChapters(false))
  }

  function handleCreate() {
    if (!newTitle.trim()) {
      toast.error("Hãy nhập tên bài giảng")
      return
    }
    if (createTarget === "library" && !newChapterId) {
      toast.error("Hãy chọn chương để lưu vào thư viện")
      return
    }
    startTransition(async () => {
      try {
        if (createTarget === "class") {
          // §18: bài chỉ nằm trong lớp này, không vào thư viện.
          await createClassLesson(classId, newTitle)
          toast.success("Đã tạo bài tại lớp — mở bài trong danh sách để soạn nội dung")
        } else {
          await createLesson(newChapterId, newTitle)
          toast.success("Đã tạo bài giảng — bài nằm ở tab Bài giảng, giao cho lớp khi đã sẵn sàng")
        }
        setCreateOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  const grouped = useMemo(() => {
    const map = new Map<string, AssignableLesson[]>()
    for (const lesson of lessons) {
      const list = map.get(lesson.chapterTitle) ?? []
      list.push(lesson)
      map.set(lesson.chapterTitle, list)
    }
    return [...map.entries()]
  }, [lessons])

  function openAssign() {
    setAssignOpen(true)
    setSelected(new Set())
    setDueAt("")
    setNote("")
    setLoadingLessons(true)
    getAssignableLessons()
      .then(setLessons)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Không tải được bài giảng"))
      .finally(() => setLoadingLessons(false))
  }

  function toggleLesson(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleAssign() {
    const ids = [...selected]
    if (ids.length === 0) {
      toast.error("Chọn ít nhất một bài giảng")
      return
    }
    startTransition(async () => {
      try {
        const res = await assignLessons(classId, ids, dueAt || null, note || null)
        noteActionSuccess()
        toast.success(`Đã giao ${res.assigned} bài${res.skipped ? `, bỏ qua ${res.skipped}` : ""}`)
        setAssignOpen(false)
        router.refresh()
      } catch (err) {
        if (!reloadIfStaleAction(err)) {
          toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
        }
      }
    })
  }

  function openEdit(item: ClassAssignmentDto) {
    setEditTarget(item)
    setEditDueAt(toDatetimeLocal(item.dueAt))
    setEditNote(item.note ?? "")
  }

  function handleUpdate() {
    if (!editTarget) return
    startTransition(async () => {
      try {
        await updateAssignment(classId, editTarget.id, {
          dueAt: editDueAt || null,
          note: editNote || null,
        })
        toast.success("Đã cập nhật hạn nộp")
        setEditTarget(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  function handleRevoke() {
    if (!revokeTarget) return
    startTransition(async () => {
      try {
        await removeAssignment(classId, revokeTarget.id)
        toast.success("Đã thu hồi bài giao")
        setRevokeTarget(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold text-foreground">Bài tập đã giao</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={openCreate}>
            <BookPlus className="h-4 w-4" />
            Tạo bài giảng
          </Button>
          <Button size="sm" onClick={openAssign}>
            <Plus className="h-4 w-4" />
            Giao bài giảng
          </Button>
        </div>
      </div>

      {/* §21: việc nạp file bắt đầu từ lớp này nhưng chưa bấm Lưu. */}
      <UnsavedDrafts classId={classId} />

      {initial.length === 0 ? (
        <EmptyState
          className="rounded-xl border border-dashed border-border"
          icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
          title="Chưa giao bài nào"
          description="Nhấn Giao bài giảng để chọn nhiều bài cùng lúc."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initial.map((item) => {
            const badge = dueBadge(item.dueAt)
            return (
              <Card
                key={item.id}
                className={
                  item.lessonStatus === "draft"
                    ? "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30"
                    : undefined
                }
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="font-heading text-base leading-snug">{item.lessonTitle}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{item.chapterTitle}</p>
                    {/* §21: bài đã giao nhưng vẫn là nháp (vd lưu trước
                        §21) -> thẻ đỏ + dòng chữ đỏ như ở tab Bài giảng. */}
                    {item.lessonStatus === "draft" ? (
                      <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                        bài nháp chưa lưu
                      </p>
                    ) : null}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Tùy chọn bài giao"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(item)}>Sửa hạn</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setRevokeTarget(item)}>
                        Thu hồi
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-2">
                  {badge ? (
                    <Badge variant="secondary" className={badge.className}>
                      Hạn {badge.label}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Không hạn</Badge>
                  )}
                  {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Giao bài giảng</DialogTitle>
            <DialogDescription>Chọn nhiều bài ready, hạn nộp tuỳ chọn.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {loadingLessons ? (
              <p className="text-sm text-muted-foreground">Đang tải bài giảng...</p>
            ) : grouped.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bài giảng ready.</p>
            ) : (
              grouped.map(([chapter, items]) => (
                <div key={chapter}>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{chapter}</p>
                  <div className="space-y-1">
                    {items.map((lesson) => (
                      <label key={lesson.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={selected.has(lesson.id)}
                          onChange={() => toggleLesson(lesson.id)}
                        />
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lesson.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="assign-due">Hạn nộp</Label>
              <Input id="assign-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="assign-note">Ghi chú</Label>
              <Textarea id="assign-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleAssign} disabled={pending || selected.size === 0}>
              Giao {selected.size ? `(${selected.size})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo bài giảng</DialogTitle>
            <DialogDescription>
              {createStep === "choose"
                ? "Chọn cách tạo bài — giống hệt các cách tạo bài ở tab Bài giảng."
                : "Bài trống sẽ ở trạng thái Nháp. Chọn lưu vào thư viện hoặc chỉ tại lớp này."}
            </DialogDescription>
          </DialogHeader>
          {createStep === "choose" ? (
            <div className="grid gap-2">
              <Link
                href={`/teacher/lessons/import?assignToClass=${classId}`}
                className={buttonVariants({
                  variant: "outline",
                  className: "h-auto items-start justify-start gap-3 whitespace-normal px-4 py-3",
                })}
                onClick={() => setCreateOpen(false)}
              >
                <FileUp className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-left">
                  <span className="block font-medium">Nạp từ file</span>
                  <span className="block text-xs text-muted-foreground">
                    File worksheet .txt/.docx/.pdf. Hết lỗi mới lưu được; khi lưu bạn chọn
                    vào thư viện (giao luôn cho lớp này) hoặc chỉ tại lớp.
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setCreateStep("blank")}
                className={buttonVariants({
                  variant: "outline",
                  className: "h-auto items-start justify-start gap-3 whitespace-normal px-4 py-3",
                })}
              >
                <BookPlus className="mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-left">
                  <span className="block font-medium">Tạo bài trống</span>
                  <span className="block text-xs text-muted-foreground">
                    Đặt tên rồi chọn lưu vào thư viện hoặc chỉ tại lớp này — soạn nội dung
                    sau.
                  </span>
                </span>
              </button>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Huỷ
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-3">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Lưu bài vào</span>
              <div className="grid gap-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted/50">
                  <input
                    type="radio"
                    name="create-target"
                    className="mt-1 size-4 accent-primary"
                    checked={createTarget === "library"}
                    onChange={() => setCreateTarget("library")}
                  />
                  <span>
                    <span className="block text-sm font-medium">Thư viện (tab Bài giảng)</span>
                    <span className="block text-xs text-muted-foreground">
                      Dùng lại được cho lớp khác; giao cho lớp này khi bài sẵn sàng.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-3 hover:bg-muted/50">
                  <input
                    type="radio"
                    name="create-target"
                    className="mt-1 size-4 accent-primary"
                    checked={createTarget === "class"}
                    onChange={() => setCreateTarget("class")}
                  />
                  <span>
                    <span className="block text-sm font-medium">Chỉ tại lớp này</span>
                    <span className="block text-xs text-muted-foreground">
                      Bài không vào thư viện, không giao lại cho lớp khác được.
                    </span>
                  </span>
                </label>
              </div>
            </div>
            {createTarget === "library" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="create-chapter">Chương</Label>
                <select
                  id="create-chapter"
                  value={newChapterId}
                  onChange={(e) => setNewChapterId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={loadingChapters || chapters.length === 0}
                >
                  {chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
                {!loadingChapters && chapters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Chưa có chương nào. Hãy tạo chương ở tab Bài giảng trước, hoặc chọn lưu
                    tại lớp.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="create-title">Tên bài giảng</Label>
              <Input
                id="create-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="VD: ADN và ARN"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229)
                    handleCreate()
                }}
                autoFocus
              />
            </div>
          </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateStep("choose")}>
                  Quay lại
                </Button>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Huỷ
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={
                    pending ||
                    !newTitle.trim() ||
                    (createTarget === "library" && chapters.length === 0)
                  }
                >
                  Tạo bài giảng
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa hạn</DialogTitle>
            <DialogDescription>{editTarget?.lessonTitle}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-due">Hạn nộp</Label>
              <Input id="edit-due" type="datetime-local" value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-note">Ghi chú</Label>
              <Textarea id="edit-note" value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Huỷ
            </Button>
            <Button onClick={handleUpdate} disabled={pending}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thu hồi bài giao</DialogTitle>
            <DialogDescription>
              Thu hồi "{revokeTarget?.lessonTitle}" khỏi lớp. Học sinh sẽ không còn thấy bài này trong danh sách giao.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={pending}>
              Thu hồi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
