import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import { markAiJobConsumed } from "@/lib/ai/jobs"
import { clearImportDrafts } from "@/lib/import-drafts"
import { safeErrorMessage } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// AI-MCP (§17): GV đánh dấu một việc AI là đã xong — đã lưu bản xem
// trước vào hệ thống (importer tự gọi sau khi lưu thành công) hoặc chủ
// động ẩn việc khỏi danh sách chờ ở trang nạp bài.
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên" }, { status: 403 })

  try {
    const body = (await req.json()) as { jobId?: string }
    if (!body.jobId) {
      return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 })
    }
    const ok = await markAiJobConsumed(user.id, body.jobId)
    if (!ok) return NextResponse.json({ error: "Không tìm thấy việc" }, { status: 404 })
    // §21: việc AI đã xong -> thẻ đỏ giữ chỗ của nó (nếu có) cũng biến mất.
    await clearImportDrafts(user.id, undefined, body.jobId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: safeErrorMessage(e, "Không đánh dấu được việc") }, { status: 400 })
  }
}
