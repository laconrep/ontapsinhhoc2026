import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import { bufferFromFormData } from "@/lib/worksheet-import"
import { createAiJob, getAiJobForTeacher, listAiJobsForTeacher } from "@/lib/ai/jobs"
import {
  BLOB_JSON_BODY_LIMIT,
  fetchTransportBuffer,
  isAllowedUploadFilename,
} from "@/lib/blob-transport"
import { hitRateLimit } from "@/lib/rate-limit"
import { safeErrorMessage } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// AI-MCP (§15): tạo việc AI từ file GV upload (chế độ 2 của luồng nạp).
// Cùng ngưỡng chống lạm dụng với route worksheet: body tối đa 32MB và
// giới hạn 10 lượt tải/giờ theo tài khoản (dùng chung key rate limit).
// §30: file lớn (> 4MB) đi qua Blob — client tải thẳng lên Blob rồi chỉ
// gửi JSON { blobUrl, filename }; nhánh JSON có giới hạn riêng nhỏ và
// không chịu giới hạn request ~4,5MB của Vercel.
const MAX_BODY_BYTES = 32 * 1024 * 1024

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })
  if (!user.isOnboarded) return NextResponse.json({ error: "Cần hoàn tất đăng ký" }, { status: 403 })

  const contentType = req.headers.get("content-type") ?? ""
  const contentLength = Number(req.headers.get("content-length") ?? 0)
  const isBlobJson = contentType.includes("application/json")
  if (isBlobJson) {
    if (contentLength > BLOB_JSON_BODY_LIMIT) {
      return NextResponse.json({ error: "Dữ liệu tải lên vượt quá giới hạn" }, { status: 413 })
    }
  } else if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Dữ liệu tải lên vượt quá giới hạn" }, { status: 413 })
  }
  if (!(await hitRateLimit(`worksheet-upload:${user.id}`, 10, 60 * 60_000))) {
    return NextResponse.json({ error: "Tải file quá thường xuyên, vui lòng thử lại sau" }, { status: 429 })
  }

  try {
    if (isBlobJson) {
      const { blobUrl, filename } = (await req.json()) as {
        blobUrl?: unknown
        filename?: unknown
      }
      if (typeof blobUrl !== "string" || typeof filename !== "string") {
        return NextResponse.json({ error: "Thiếu đường dẫn file" }, { status: 400 })
      }
      if (!isAllowedUploadFilename(filename)) {
        return NextResponse.json({ error: "Chỉ chấp nhận file .txt, .docx hoặc .pdf" }, { status: 400 })
      }
      const buffer = await fetchTransportBuffer(blobUrl, filename)
      const { jobId } = await createAiJob(user, buffer, filename)
      return NextResponse.json({ jobId })
    }
    const formData = await req.formData()
    const { buffer, filename } = await bufferFromFormData(formData)
    const { jobId } = await createAiJob(user, buffer, filename)
    return NextResponse.json({ jobId })
  } catch (e) {
    return NextResponse.json({ error: safeErrorMessage(e, "Không tạo được việc AI") }, { status: 400 })
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên" }, { status: 403 })

  const id = new URL(req.url).searchParams.get("id")
  // §17: không có id -> danh sách việc gần đây của chính GV (cho khối
  // "việc AI trước đó" ở trang nạp bài: mở lại xem trước / theo dõi tiếp).
  if (!id) {
    const jobs = await listAiJobsForTeacher(user.id)
    return NextResponse.json({ jobs })
  }
  const job = await getAiJobForTeacher(user.id, id)
  if (!job) return NextResponse.json({ error: "Không tìm thấy việc" }, { status: 404 })

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    hasSolutions: job.hasSolutions,
    wantSolutions: job.wantSolutions,
    error: job.error,
    filename: job.filename,
    ...(job.status === "ready"
      ? {
          resultText: job.resultText,
          resultMeta: job.resultMeta,
          images: (job.images as string[] | null) ?? [],
          tables: (job.tables as string[] | null) ?? [],
        }
      : {}),
  })
}
