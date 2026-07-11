"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  createClass,
  updateClass,
  deleteClass,
} from "@/app/actions/classes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
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
import { Plus, Users, MoreVertical, Pencil, Trash2, ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

type ClassRow = {
  id: string
  name: string
  subject: string
  inviteCode: string
  schoolYear: string
  createdAt: Date | string
  studentCount: number
}

const emptyForm = { name: "", subject: "Sinh học", schoolYear: "2025-2026" }

export function ClassManager({ initialClasses }: { initialClasses: ClassRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRow | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null)

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  function openEdit(cls: ClassRow) {
    setEditing(cls)
    setForm({ name: cls.name, subject: cls.subject, schoolYear: cls.schoolYear })
    setFormOpen(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập tên lớp")
      return
    }
    startTransition(async () => {
      try {
        if (editing) {
          await updateClass(editing.id, form)
          toast.success("Đã cập nhật lớp học")
        } else {
          await createClass(form)
          toast.success("Đã tạo lớp học")
        }
        setFormOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    startTransition(async () => {
      try {
        await deleteClass(deleteTarget.id)
        toast.success("Đã xoá lớp học")
        setDeleteTarget(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Lớp học</h1>
          <p className="mt-1 text-muted-foreground">
            Quản lý các lớp và mã mời học sinh tham gia.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tạo lớp học
        </Button>
      </div>

      {initialClasses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Users className="h-6 w-6 text-primary" />
            </span>
            <p className="font-medium text-foreground">Chưa có lớp học nào</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tạo lớp học đầu tiên và chia sẻ mã mời để học sinh tham gia.
            </p>
            <Button onClick={openCreate} variant="outline" className="mt-2">
              <Plus className="h-4 w-4" />
              Tạo lớp học
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {initialClasses.map((cls) => (
            <Card key={cls.id} className="group relative">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Badge variant="secondary">{cls.subject}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label="Tuỳ chọn lớp học"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(cls)}>
                        <Pencil className="h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(cls)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Xoá lớp
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="mt-3 font-heading text-lg font-semibold text-foreground">
                  {cls.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Năm học {cls.schoolYear}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {cls.studentCount} học sinh
                  </span>
                  <code className="rounded bg-secondary px-2 py-1 font-mono text-sm font-semibold text-foreground">
                    {cls.inviteCode}
                  </code>
                </div>

                <Link
                  href={`/teacher/classes/${cls.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mt-4 w-full justify-between")}
                >
                  Xem chi tiết
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog tạo/sửa */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Chỉnh sửa lớp học" : "Tạo lớp học mới"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? "Cập nhật thông tin lớp học."
                  : "Điền thông tin để tạo lớp. Mã mời sẽ được sinh tự động."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Tên lớp</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="VD: Sinh 12A1"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Môn học</Label>
                <Input
                  id="subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolYear">Năm học</Label>
                <Input
                  id="schoolYear"
                  value={form.schoolYear}
                  onChange={(e) => setForm({ ...form, schoolYear: e.target.value })}
                  placeholder="VD: 2025-2026"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={pending}
              >
                Huỷ
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo lớp"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog xác nhận xoá */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá lớp học?</DialogTitle>
            <DialogDescription>
              Lớp {'"'}
              {deleteTarget?.name}
              {'"'} và toàn bộ dữ liệu liên quan sẽ bị xoá vĩnh viễn. Hành động này không thể
              hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Đang xoá..." : "Xoá lớp"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
