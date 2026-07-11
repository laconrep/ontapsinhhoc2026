"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { startSession, type LiveSession } from "@/app/actions/sessions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radio, Monitor } from "lucide-react"

export function SessionControl({
  classId,
  activeSession,
}: {
  classId: string
  activeSession: LiveSession | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function handleStart() {
    startTransition(async () => {
      try {
        const s = await startSession(classId)
        toast.success("Đã bắt đầu phiên học")
        router.push(`/teacher/sessions/${s.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base">
          <Radio className="h-4 w-4 text-primary" />
          Phiên học trực tiếp
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {activeSession
            ? "Một phiên học đang diễn ra. Mở màn hình lớp để theo dõi học sinh theo thời gian thực."
            : "Bắt đầu phiên học để theo dõi hoạt động của học sinh trực tiếp trên màn hình lớp."}
        </p>
        {activeSession ? (
          <Button
            nativeButton={false}
            render={<a href={`/teacher/sessions/${activeSession.id}`} />}
          >
            <Monitor className="h-4 w-4" />
            Mở màn hình lớp
          </Button>
        ) : (
          <Button onClick={handleStart} disabled={pending}>
            <Radio className="h-4 w-4" />
            {pending ? "Đang bắt đầu..." : "Bắt đầu phiên học"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
