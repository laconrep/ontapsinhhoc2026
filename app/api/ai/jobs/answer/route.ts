import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import { answerSolutionChoice } from "@/lib/ai/jobs"
import { safeErrorMessage } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// AI-MCP (§15.1): GV trả lời popup "Bạn có muốn AI giải chi tiết không"
// cho một việc đang ở trạng thái needs_solution_choice.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên" }, { status: 403 })

  try {
    const body = (await req.json()) as { jobId?: string; wantSolutions?: boolean }
    if (!body.jobId || typeof body.wantSolutions !== "boolean") {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 })
    }
    const ok = await answerSolutionChoice(user.id, body.jobId, body.wantSolutions)
    if (!ok) return NextResponse.json({ error: "Việc không chờ câu trả lời này" }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: safeErrorMessage(e, "Không ghi được câu trả lời") }, { status: 400 })
  }
}
