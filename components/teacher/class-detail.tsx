"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import QRCode from "qrcode"
import { regenerateInviteCode, removeStudent } from "@/app/actions/classes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  ArrowLeft,
  Copy,
  RefreshCw,
  Users,
  Trash2,
  Check,
} from "lucide-react"

type Student = {
  id: string
  name: string
  email: string
  joinedAt: Date | string
}

type ClassDetailData = {
  id: string
  name: string
  subject: string
  inviteCode: string
  schoolYear: string
  students: Student[]
}

export function ClassDetail({ cls }: { cls: ClassDetailData }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [inviteCode, setInviteCode] = useState(cls.inviteCode)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Student | null>(null)

  useEffect(() => {
    QRCode.toDataURL(inviteCode, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""))
  }, [inviteCode])

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    toast.success("Đã sao chép mã mời")
    setTimeout(() => setCopied(false), 2000)
  }

  function handleRegenerate() {
    startTransition(async () => {
      try {
        const res = await regenerateInviteCode(cls.id)
        setInviteCode(res.inviteCode)
        toast.success("Đã tạo mã mời mới")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  function handleRemove() {
    if (!removeTarget) return
    startTransition(async () => {
      try {
        await removeStudent(cls.id, removeTarget.id)
        toast.success("Đã xoá học sinh khỏi lớp")
        setRemoveTarget(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
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
          render={<Link href="/teacher/classes" />}
        >
          <ArrowLeft className="h-4 w-4" />
          Tất cả lớp học
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground">{cls.name}</h1>
          <Badge variant="secondary">{cls.subject}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">Năm học {cls.schoolYear}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mã mời + QR */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-heading text-base">Mã mời lớp học</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl || "/placeholder.svg"}
                alt={`Mã QR mời tham gia lớp ${cls.name}`}
                className="rounded-lg border border-border"
                width={180}
                height={180}
              />
            ) : (
              <div className="h-[180px] w-[180px] animate-pulse rounded-lg bg-secondary" />
            )}
            <div className="flex items-center gap-2">
              <code className="rounded-lg bg-secondary px-4 py-2 font-mono text-xl font-bold tracking-widest text-foreground">
                {inviteCode}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyCode}
                aria-label="Sao chép mã mời"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleRegenerate}
              disabled={pending}
            >
              <RefreshCw className="h-4 w-4" />
              Tạo mã mới
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Học sinh nhập mã này để tham gia lớp. Tạo mã mới sẽ vô hiệu hoá mã cũ.
            </p>
          </CardContent>
        </Card>

        {/* Danh sách học sinh */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-base">
              Học sinh
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({cls.students.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cls.students.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Chưa có học sinh nào tham gia. Chia sẻ mã mời để bắt đầu.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {cls.students.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                        {s.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{s.name}</p>
                        <p className="text-sm text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setRemoveTarget(s)}
                      aria-label={`Xoá ${s.name} khỏi lớp`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xoá học sinh khỏi lớp?</DialogTitle>
            <DialogDescription>
              {removeTarget?.name} sẽ bị xoá khỏi lớp này. Học sinh có thể tham gia lại bằng mã
              mời.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={pending}>
              {pending ? "Đang xoá..." : "Xoá học sinh"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
