import type { NextRequest } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { classStudents, sessions } from "@/lib/db/schema"
import { getCurrentUser } from "@/lib/auth-helpers"
import { subscribe, type RealtimeEvent } from "@/lib/realtime"

export const dynamic = "force-dynamic"

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
      if (unsubscribe) unsubscribe()
      if (heartbeat) clearInterval(heartbeat)
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
