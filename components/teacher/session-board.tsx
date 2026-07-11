"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { endSession, type LiveSession } from "@/app/actions/sessions"
import type { RealtimeEvent } from "@/lib/realtime"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radio, Hand, CheckCircle2, Users, Square, Wifi, WifiOff } from "lucide-react"

type Status = LiveSession["status"]

export function SessionBoard({
  sessionId,
  className,
  status: initialStatus,
  initialEvents,
}: {
  sessionId: string
  className: string
  status: Status
  initialEvents: RealtimeEvent[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [events, setEvents] = useState<RealtimeEvent[]>(initialEvents)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<Status>(initialStatus)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status !== "active") return
    const es = new EventSource(`/api/sessions/${sessionId}/stream`)
    es.addEventListener("connected", () => setConnected(true))
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as RealtimeEvent
        setEvents((prev) => (prev.some((p) => p.id === ev.id) ? prev : [...prev, ev]))
        if (ev.type === "session_ended") setStatus("ended")
      } catch {
        /* ignore */
      }
    }
    es.onerror = () => setConnected(false)
    return () => es.close()
  }, [sessionId, status])

  // Danh sách học sinh đã tham gia (dedup theo studentId)
  const joined = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of events) {
      if (e.type === "student_joined" && e.studentId) {
        map.set(e.studentId, e.studentName ?? "Học sinh")
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [events])

  // Trạng thái tín hiệu mới nhất mỗi học sinh
  const signals = useMemo(() => {
    const map = new Map<string, { name: string; signal: string; at: string }>()
    for (const e of events) {
      if (e.type.startsWith("signal_") && e.studentId) {
        map.set(e.studentId, {
          name: e.studentName ?? "Học sinh",
          signal: e.type.replace("signal_", ""),
          at: e.createdAt,
        })
      }
    }
    return map
  }, [events])

  const needHelp = Array.from(signals.values()).filter((s) => s.signal === "need_help")
  const understood = Array.from(signals.values()).filter((s) => s.signal === "understood")

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [events])

  function handleEnd() {
    startTransition(async () => {
      try {
        await endSession(sessionId)
        toast.success("Đã kết thúc phiên học")
        setStatus("ended")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Màn hình lớp</h1>
          </div>
          <p className="mt-1 text-muted-foreground">{className}</p>
        </div>
        <div className="flex items-center gap-3">
          {status === "active" ? (
            <Badge variant="secondary" className="gap-1">
              {connected ? (
                <Wifi className="h-3 w-3 text-primary" />
              ) : (
                <WifiOff className="h-3 w-3 text-muted-foreground" />
              )}
              {connected ? "Trực tuyến" : "Đang kết nối..."}
            </Badge>
          ) : (
            <Badge variant="outline">Đã kết thúc</Badge>
          )}
          {status === "active" && (
            <Button variant="destructive" onClick={handleEnd} disabled={pending}>
              <Square className="h-4 w-4" />
              {pending ? "Đang kết thúc..." : "Kết thúc phiên"}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Đã tham gia" value={joined.length} tone="default" />
        <StatCard icon={Hand} label="Cần trợ giúp" value={needHelp.length} tone="warn" />
        <StatCard icon={CheckCircle2} label="Đã hiểu bài" value={understood.length} tone="ok" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Học sinh */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Học sinh trong phiên</CardTitle>
          </CardHeader>
          <CardContent>
            {joined.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Chưa có học sinh nào tham gia. Yêu cầu học sinh mở EduSync và bấm "Tham gia".
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {joined.map((s) => {
                  const sig = signals.get(s.id)
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                          {s.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="text-sm font-medium text-foreground">{s.name}</span>
                      </div>
                      {sig?.signal === "need_help" && (
                        <Hand className="h-4 w-4 text-destructive" aria-label="Cần trợ giúp" />
                      )}
                      {sig?.signal === "understood" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" aria-label="Đã hiểu bài" />
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Bảng tin realtime */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Hoạt động trực tiếp</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={feedRef} className="max-h-72 space-y-2 overflow-y-auto">
              {events.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có hoạt động.
                </p>
              ) : (
                events.map((e) => <FeedItem key={e.id} event={e} />)
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType
  label: string
  value: number
  tone: "default" | "warn" | "ok"
}) {
  const toneClass =
    tone === "warn"
      ? "text-destructive"
      : tone === "ok"
        ? "text-primary"
        : "text-foreground"
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
          <Icon className={`h-5 w-5 ${toneClass}`} />
        </span>
        <div>
          <p className={`font-heading text-2xl font-bold ${toneClass}`}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function FeedItem({ event }: { event: RealtimeEvent }) {
  const time = new Date(event.createdAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const name = event.studentName ?? "Hệ thống"
  let text = ""
  switch (event.type) {
    case "student_joined":
      text = "đã tham gia phiên"
      break
    case "signal_need_help":
      text = "cần trợ giúp"
      break
    case "signal_understood":
      text = "đã hiểu bài"
      break
    case "signal_reaction":
      text = "gửi một biểu cảm"
      break
    case "session_ended":
      text = "Phiên học đã kết thúc"
      break
    default:
      text = event.type
  }
  return (
    <div className="flex items-start gap-2 rounded-md bg-secondary/50 px-3 py-2 text-sm">
      <span className="mt-0.5 font-mono text-xs text-muted-foreground">{time}</span>
      <span className="text-foreground">
        {event.type === "session_ended" ? (
          text
        ) : (
          <>
            <span className="font-medium">{name}</span> {text}
          </>
        )}
      </span>
    </div>
  )
}
