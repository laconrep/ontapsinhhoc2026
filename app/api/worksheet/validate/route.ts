import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import { bufferFromFormData, validateWorksheetBuffer } from "@/lib/worksheet-import"
import { MAX_FILE_SIZE } from "@/lib/extract-file"
import { hitRateLimit } from "@/lib/rate-limit"
import { safeErrorMessage } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// SEC-06: chặn body quá lớn TRƯỚC khi đọc formData (10MB file + dư lượng
// nhỏ cho khung multipart), và giới hạn tần suất upload theo user.
const MULTIPART_SLACK = 64 * 1024
const UPLOAD_LIMIT = 10
const UPLOAD_WINDOW_MS = 60 * 60_000

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (contentLength > MAX_FILE_SIZE + MULTIPART_SLACK) {
    return NextResponse.json({ error: "File vượt quá 10MB" }, { status: 413 })
  }
  if (!(await hitRateLimit(`worksheet-upload:${user.id}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS))) {
    return NextResponse.json(
      { error: "Tải file quá thường xuyên, vui lòng thử lại sau" },
      { status: 429 },
    )
  }

  try {
    const formData = await req.formData()
    const { buffer, filename } = await bufferFromFormData(formData)
    const preview = await validateWorksheetBuffer(buffer, filename)
    return NextResponse.json(preview)
  } catch (e) {
    // SEC-09: chỉ trả message nghiệp vụ đã biết; lỗi lạ -> thông báo chung.
    return NextResponse.json(
      { error: safeErrorMessage(e, "Không đọc được file") },
      { status: 400 },
    )
  }
}
