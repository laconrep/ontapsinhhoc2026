import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import {
  getLiveQuizSnapshot,
  goToQuestion,
  revealCurrent,
  endQuizSession,
  joinQuiz,
  submitLiveAnswer,
  reportFullscreen,
} from "@/app/actions/live-quiz"

export const dynamic = "force-dynamic"

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function fromUnknown(e: unknown, fallback = "Có lỗi xảy ra") {
  if (e && typeof e === "object" && "digest" in e) {
    return jsonError("Phiên đăng nhập hết hạn", 401)
  }
  const message = e instanceof Error && e.message ? e.message : fallback
  return jsonError(message, 400)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return jsonError("Chưa đăng nhập", 401)
  try {
    const data = await getLiveQuizSnapshot(id)
    return NextResponse.json(
      { success: true, data },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (e) {
    return fromUnknown(e, "Không tải được phiên")
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return jsonError("Chưa đăng nhập", 401)

  let body: {
    action?: string
    index?: number
    questionId?: string
    answer?: string
    isFullscreen?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return jsonError("Payload không hợp lệ", 400)
  }

  try {
    if (body.action === "join") {
      if (user.role !== "student") return jsonError("Không có quyền", 403)
      await joinQuiz(id)
      return NextResponse.json({ success: true, data: { joined: true } })
    }
    if (body.action === "answer") {
      if (user.role !== "student") return jsonError("Không có quyền", 403)
      if (typeof body.questionId !== "string" || !body.questionId) {
        return jsonError("Thiếu câu hỏi", 400)
      }
      if (typeof body.answer !== "string") return jsonError("Thiếu câu trả lời", 400)
      const data = await submitLiveAnswer(id, body.questionId, body.answer)
      return NextResponse.json({ success: true, data })
    }
    if (body.action === "fullscreen") {
      if (user.role !== "student") return jsonError("Không có quyền", 403)
      await reportFullscreen(id, !!body.isFullscreen)
      return NextResponse.json({ success: true, data: { ok: true } })
    }

    if (user.role !== "teacher") return jsonError("Không có quyền", 403)
    if (body.action === "goto") {
      if (typeof body.index !== "number" || !Number.isFinite(body.index)) {
        return jsonError("Thiếu chỉ số câu", 400)
      }
      const data = await goToQuestion(id, body.index)
      return NextResponse.json({ success: true, data })
    }
    if (body.action === "reveal") {
      const data = await revealCurrent(id, typeof body.index === "number" ? body.index : undefined)
      return NextResponse.json({ success: true, data })
    }
    if (body.action === "end") {
      await endQuizSession(id)
      return NextResponse.json({ success: true, data: { ended: true } })
    }
    return jsonError("Hành động không hợp lệ", 400)
  } catch (e) {
    return fromUnknown(e)
  }
}
