import { NextResponse } from "next/server"
import { handleUpload } from "@vercel/blob/client"
import { getCurrentUser } from "@/lib/auth-helpers"
import { hitRateLimit } from "@/lib/rate-limit"
import { MAX_FILE_SIZE } from "@/lib/extract-file"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// §30 — Cấp token cho client tải file LỚN thẳng lên Blob (không qua
// function, nên không vướng giới hạn request ~4,5MB của Vercel).
// Chỉ giáo viên đã onboard mới được cấp; mỗi token dùng một lần cho một
// file .txt/.docx/.pdf tối đa 10MB. Server tải file từ Blob về ở route
// validate / ai/jobs rồi xoá object ngay (lib/blob-transport.ts).
// Thiếu BLOB_READ_WRITE_TOKEN -> 501 để client báo rõ "chưa cấu hình
// Blob" thay vì lỗi chung chung.

const TOKEN_LIMIT = 30
const TOKEN_WINDOW_MS = 60 * 60_000

const ALLOWED_CONTENT_TYPES = [
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })
  if (!user.isOnboarded) return NextResponse.json({ error: "Cần hoàn tất đăng ký" }, { status: 403 })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Tải file lớn qua Blob chưa được cấu hình" },
      { status: 501 },
    )
  }
  if (!(await hitRateLimit(`blob-token:${user.id}`, TOKEN_LIMIT, TOKEN_WINDOW_MS))) {
    return NextResponse.json(
      { error: "Tải file quá thường xuyên, vui lòng thử lại sau" },
      { status: 429 },
    )
  }

  try {
    const body = (await req.json()) as Parameters<typeof handleUpload>[0]["body"]
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_FILE_SIZE,
        addRandomSuffix: true,
      }),
    })
    return NextResponse.json(jsonResponse)
  } catch {
    return NextResponse.json(
      { error: "Không cấp được quyền tải lên Blob, hãy thử lại" },
      { status: 400 },
    )
  }
}
