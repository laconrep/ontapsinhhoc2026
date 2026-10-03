"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  assignLessons,
  getAssignableLessons,
  removeAssignment,
  updateAssignment,
} from "@/app/actions/assignments"
import type { ClassAssignmentDto } from "@/types"
import { Button } from "@/components/ui/button"
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
import { BookOpen, MoreHorizontal, Plus } from "lucide-react"

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
  const label = due.toLocaleString("vi-VN")
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
        toast.success(`Đã giao ${res.assigned} bài${res.skipped ? `, bỏ qua ${res.skipped}` : ""}`)
        setAssignOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
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
        <Button size="sm" onClick={openAssign}>
          <Plus className="h-4 w-4" />
          Giao bài giảng
        </Button>
      </div>

      {initial.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Chưa giao bài nào. Nhấn Giao bài giảng để chọn nhiều bài cùng lúc.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {initial.map((item) => {
            const badge = dueBadge(item.dueAt)
            return (
              <Card key={item.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="font-heading text-base leading-snug">{item.lessonTitle}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{item.chapterTitle}</p>
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
