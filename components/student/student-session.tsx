"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { joinSession, sendSignal, type LiveSession } from "@/app/actions/sessions"
import type { RealtimeEvent } from "@/lib/realtime"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Radio, Hand, CheckCircle2, ArrowLeft } from "lucide-react"

type Status = LiveSession["status"]

export function StudentSession({
  sessionId,
  className,
  status: initialStatus,
}: {
  sessionId: string
  className: string
  status: Status
}) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [pending, startTransition] = useTransition()
  const [lastSignal, setLastSignal] = useState<string | null>(null)
  const joinedRef = useRef(false)

  // Tự tham gia khi mở trang
  useEffect(() => {
    if (joinedRef.current || status !== "active") return
    joinedRef.current = true
    joinSession(sessionId).catch(() => {
      /* ignore */
    })
  }, [sessionId, status])

  // Lắng nghe để biết khi phiên kết thúc
  useEffect(() => {
    if (status !== "active") return
    const es = new EventSource(`/api/sessions/${sessionId}/stream`)
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as RealtimeEvent
        if (ev.type === "session_ended") {
          setStatus("ended")
          toast.info("Giáo viên đã kết thúc phiên học")
        }
      } catch {
        /* ignore */
      }
    }
    return () => es.close()
  }, [sessionId, status])

  function signal(kind: "understood" | "need_help") {
    startTransition(async () => {
      try {
        await sendSignal(sessionId, kind)
        setLastSignal(kind)
        toast.success(kind === "understood" ? "Đã báo: Hiểu bài" : "Đã báo: Cần trợ giúp")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          nativeButton={false}
          render={<Link href="/student" />}
        >
          <ArrowLeft className="h-4 w-4" />
          Trang chủ
        </Button>
        <div className="flex items-center gap-2">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
            {status === "active" && (
              <span className="absolute right-0 top-0 h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
            )}
          </span>
          <h1 className="font-heading text-xl font-bold text-foreground">Phiên học trực tiếp</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{className}</p>
      </div>

      {status === "active" ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Bạn thấy bài học thế nào?</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button
              variant={lastSignal === "understood" ? "default" : "outline"}
              size="lg"
              className="h-auto flex-col gap-2 py-6"
              onClick={() => signal("understood")}
              disabled={pending}
            >
              <CheckCircle2 className="h-6 w-6" />
              Tôi hiểu bài
            </Button>
            <Button
              variant={lastSignal === "need_help" ? "destructive" : "outline"}
              size="lg"
              className="h-auto flex-col gap-2 py-6"
              onClick={() => signal("need_help")}
              disabled={pending}
            >
              <Hand className="h-6 w-6" />
              Cần trợ giúp
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Phiên học đã kết thúc.</p>
            <Button nativeButton={false} render={<Link href="/student" />}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Giáo viên có thể thấy phản hồi của bạn theo thời gian thực trên màn hình lớp.
      </p>
    </div>
  )
}
