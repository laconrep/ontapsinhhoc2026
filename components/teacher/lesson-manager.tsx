"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  BookOpen,
  ChevronDown,
  FolderPlus,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
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
  createChapter,
  updateChapter,
  deleteChapter,
  createLesson,
  updateLesson,
  deleteLesson,
} from "@/app/actions/content"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import type { ChapterDto } from "@/types"

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  processing: "Đang xử lý",
  ready: "Sẵn sàng",
  error: "Lỗi",
}
const STATUS_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  draft: "secondary",
  processing: "outline",
  ready: "default",
  error: "destructive",
}

export function LessonManager({ initialChapters }: { initialChapters: ChapterDto[] }) {
  const [chapters, setChapters] = useState<ChapterDto[]>(initialChapters)
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(initialChapters.map((c) => [c.id, true])),
  )
  const [isPending, startTransition] = useTransition()

  // dialog state
  const [chapterDialog, setChapterDialog] = useState<{ mode: "create" | "edit"; id?: string } | null>(
    null,
  )
  const [chapterTitle, setChapterTitle] = useState("")
  const [lessonDialog, setLessonDialog] = useState<{
    mode: "create" | "edit"
    chapterId: string
    id?: string
  } | null>(null)
  const [lessonTitle, setLessonTitle] = useState("")
  const [confirmState, setConfirmState] = useState<
    { kind: "chapter" | "lesson"; id: string } | null
  >(null)

  async function refresh() {
    const { getChaptersWithLessons } = await import("@/app/actions/content")
    setChapters(await getChaptersWithLessons())
  }

  function submitChapter() {
    if (!chapterTitle.trim()) return
    startTransition(async () => {
      try {
        if (chapterDialog?.mode === "create") {
          await createChapter(chapterTitle)
          toast.success("Đã tạo chương")
        } else if (chapterDialog?.id) {
          await updateChapter(chapterDialog.id, chapterTitle)
          toast.success("Đã cập nhật chương")
        }
        setChapterDialog(null)
        setChapterTitle("")
        await refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  function submitLesson() {
    if (!lessonTitle.trim() || !lessonDialog) return
    startTransition(async () => {
      try {
        if (lessonDialog.mode === "create") {
          await createLesson(lessonDialog.chapterId, lessonTitle)
          toast.success("Đã tạo bài giảng")
        } else if (lessonDialog.id) {
          await updateLesson(lessonDialog.id, { title: lessonTitle })
          toast.success("Đã cập nhật bài giảng")
        }
        setLessonDialog(null)
        setLessonTitle("")
        setOpen((o) => ({ ...o, [lessonDialog.chapterId]: true }))
        await refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  function removeChapter(id: string) {
    setConfirmState({ kind: "chapter", id })
  }

  function removeLesson(id: string) {
    setConfirmState({ kind: "lesson", id })
  }

  function runConfirmedAction() {
    if (!confirmState) return
    const { kind, id } = confirmState
    setConfirmState(null)
    startTransition(async () => {
      try {
        if (kind === "chapter") {
          await deleteChapter(id)
          toast.success("Đã xoá chương")
        } else {
          await deleteLesson(id)
          toast.success("Đã xoá bài giảng")
        }
        await refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Bài giảng</h1>
          <p className="mt-1 text-muted-foreground">Quản lý chương, bài giảng và điểm kiến thức.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/teacher/lessons/import" className={buttonVariants({ variant: "outline" })}>
            <Upload className="h-4 w-4" />
            Nạp từ file
          </Link>
          <Button
            onClick={() => {
              setChapterDialog({ mode: "create" })
              setChapterTitle("")
            }}
          >
            <FolderPlus className="h-4 w-4" />
            Thêm chương
          </Button>
        </div>
      </div>

      {chapters.length === 0 ? (
        <EmptyState
          className="rounded-lg border border-dashed"
          icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
          title="Chưa có chương nào"
          description="Tạo chương đầu tiên để bắt đầu thêm bài giảng và điểm kiến thức."
        />
      ) : (
        <div className="space-y-3">
          {chapters.map((chapter) => (
            <div key={chapter.id} className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [chapter.id]: !o[chapter.id] }))}
                  className="flex flex-1 items-center gap-2 text-left"
                  aria-expanded={open[chapter.id] ?? false}
                >
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      open[chapter.id] ? "" : "-rotate-90"
                    }`}
                  />
                  <span className="font-heading font-semibold text-foreground">{chapter.title}</span>
                  <Badge variant="secondary">{chapter.lessons.length} bài</Badge>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLessonDialog({ mode: "create", chapterId: chapter.id })
                    setLessonTitle("")
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Bài giảng
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Tuỳ chọn chương"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setChapterDialog({ mode: "edit", id: chapter.id })
                        setChapterTitle(chapter.title)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Đổi tên
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => removeChapter(chapter.id)}>
                      <Trash2 className="h-4 w-4" />
                      Xoá chương
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {open[chapter.id] && (
                <div className="border-t">
                  {chapter.lessons.length === 0 ? (
                    <EmptyState
                      className="px-6 py-6"
                      title="Chưa có bài giảng"
                      description='Nhấn "Bài giảng" để thêm.'
                    />
                  ) : (
                    <ul className="divide-y">
                      {chapter.lessons.map((lesson) => (
                        <li
                          key={lesson.id}
                          className="flex items-center gap-3 px-6 py-3 hover:bg-secondary/40"
                        >
                          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <Link
                            href={`/teacher/lessons/${lesson.id}`}
                            className="flex-1 font-medium text-foreground hover:underline"
                          >
                            {lesson.title}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {lesson.knowledgePointCount ?? 0} KT
                          </span>
                          <Badge variant={STATUS_VARIANT[lesson.status]}>
                            {STATUS_LABEL[lesson.status]}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              aria-label="Tuỳ chọn bài giảng"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setLessonDialog({
                                    mode: "edit",
                                    chapterId: chapter.id,
                                    id: lesson.id,
                                  })
                                  setLessonTitle(lesson.title)
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Đổi tên
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => removeLesson(lesson.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Xoá bài giảng
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Chapter dialog */}
      <Dialog open={chapterDialog !== null} onOpenChange={(v) => !v && setChapterDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {chapterDialog?.mode === "create" ? "Thêm chương mới" : "Đổi tên chương"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="chapter-title">Tên chương</Label>
            <Input
              id="chapter-title"
              value={chapterTitle}
              onChange={(e) => setChapterTitle(e.target.value)}
              placeholder="VD: Cơ sở phân tử của sự sống"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229)
                  submitChapter()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChapterDialog(null)}>
              Huỷ
            </Button>
            <Button onClick={submitChapter} disabled={isPending}>
              {chapterDialog?.mode === "create" ? "Tạo chương" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson dialog */}
      <Dialog open={lessonDialog !== null} onOpenChange={(v) => !v && setLessonDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {lessonDialog?.mode === "create" ? "Thêm bài giảng mới" : "Đổi tên bài giảng"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lesson-title">Tên bài giảng</Label>
            <Input
              id="lesson-title"
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              placeholder="VD: ADN và ARN"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229)
                  submitLesson()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonDialog(null)}>
              Huỷ
            </Button>
            <Button onClick={submitLesson} disabled={isPending}>
              {lessonDialog?.mode === "create" ? "Tạo bài giảng" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null)
        }}
        title={confirmState?.kind === "chapter" ? "Xoá chương?" : "Xoá bài giảng?"}
        description={
          confirmState?.kind === "chapter"
            ? "Toàn bộ bài giảng bên trong chương này cũng sẽ bị xoá."
            : "Bài giảng này sẽ bị xoá khỏi chương."
        }
        confirmLabel={confirmState?.kind === "chapter" ? "Xoá chương" : "Xoá bài giảng"}
        destructive
        pending={isPending}
        onConfirm={runConfirmedAction}
      />
    </div>
  )
}
