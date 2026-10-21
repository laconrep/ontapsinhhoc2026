import type { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { classStudents, sessions } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth-helpers"
import { subscribe, type RealtimeEvent } from "@/lib/realtime"

export const dynamic = "force-dynamic"

// SEC-11: tối đa 3 kết nối SSE đồng thời cho mỗi (user, phiên). Đếm trong
// bộ nhớ tiến trình — đủ cho mục này (nhiều instance thì mỗi instance có
// bộ đếm riêng, chấp nhận được ở quy mô hiện tại).
const MAX_STREAMS_PER_USER_SESSION = 3
const activeStreams = new Map<string, number>()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params
  const user = await getCurrentUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  // Kiểm tra quyền truy cập phiên
  const rows = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (rows.length === 0) return new Response("Not found", { status: 404 })
  const session = rows[0]

  const isTeacher = session.teacherId === user.id
  let hasAccess = isTeacher
  if (!hasAccess) {
    const member = await db
      .select({ classId: classStudents.classId })
      .from(classStudents)
      .where(and(eq(classStudents.classId, session.classId), eq(classStudents.studentId, user.id)))
      .limit(1)
    hasAccess = member.length > 0
  }
  if (!hasAccess) return new Response("Forbidden", { status: 403 })

  // SEC-11: chặn kết nối thừa trước khi tạo stream.
  const streamKey = `${user.id}:${sessionId}`
  const current = activeStreams.get(streamKey) ?? 0
  if (current >= MAX_STREAMS_PER_USER_SESSION) {
    return new Response("Too many connections", { status: 429 })
  }
  activeStreams.set(streamKey, current + 1)
  const releaseStream = () => {
    const n = (activeStreams.get(streamKey) ?? 1) - 1
    if (n <= 0) activeStreams.delete(streamKey)
    else activeStreams.set(streamKey, n)
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }
      // Sự kiện chào mừng để client biết đã kết nối
      controller.enqueue(encoder.encode(`event: connected\ndata: {}\n\n`))
      unsubscribe = subscribe(sessionId, send)
      // Heartbeat giữ kết nối sống (comment SSE)
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`))
      }, 25000)
    },
    cancel() {
      // Dọn dẹp khi client ngắt: huỷ subscribe, heartbeat và nhả slot kết nối.
      if (unsubscribe) unsubscribe()
      if (heartbeat) clearInterval(heartbeat)
      releaseStream()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
