import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-helpers"
import {
  bufferFromFormData,
  parseMediaArray,
  saveWorksheetBuffer,
  saveWorksheetFromText,
  type PersistOptions,
} from "@/lib/worksheet-import"
import { hitRateLimit } from "@/lib/rate-limit"
import { safeErrorMessage } from "@/lib/api-error"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// SEC-06: chặn body quá lớn TRƯỚC khi đọc formData + giới hạn tần suất
// upload theo user. Ngưỡng body của /save cao hơn 10MB vì ngoài đường
// file (file vẫn bị giới hạn cứng 10MB ở bufferFromFormData/extract),
// route còn nhận đường text + images/tables dạng JSON (base64 phình
// ~4/3 so với file gốc 10MB) khi giáo viên sửa bản nháp trước khi lưu.
const MAX_BODY_BYTES = 32 * 1024 * 1024
const UPLOAD_LIMIT = 10
const UPLOAD_WINDOW_MS = 60 * 60_000

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 })
  if (user.role !== "teacher") return NextResponse.json({ error: "Chỉ giáo viên được nạp file" }, { status: 403 })
  if (!user.isOnboarded) return NextResponse.json({ error: "Cần hoàn tất đăng ký" }, { status: 403 })

  const contentLength = Number(req.headers.get("content-length") ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Dữ liệu tải lên vượt quá giới hạn" }, { status: 413 })
  }
  if (!(await hitRateLimit(`worksheet-upload:${user.id}`, UPLOAD_LIMIT, UPLOAD_WINDOW_MS))) {
    return NextResponse.json(
      { error: "Tải file quá thường xuyên, vui lòng thử lại sau" },
      { status: 429 },
    )
  }

  try {
    const formData = await req.formData()
    // §18: đích đến do trang nạp bài chọn — ép chương / lưu tại lớp /
    // nạp cộng thêm vào bài có sẵn / các bài bị ép nháp (tên do AI đặt).
    const strField = (name: string): string | undefined => {
      const v = formData.get(name)
      return typeof v === "string" && v ? v : undefined
    }
    const options: PersistOptions = {
      targetChapterId: strField("targetChapterId"),
      classId: strField("classId"),
      intoLessonId: strField("intoLessonId"),
    }
    const rawDraftIdx = strField("draftLessonIndexes")
    if (rawDraftIdx) {
      try {
        const parsed = JSON.parse(rawDraftIdx) as unknown
        if (Array.isArray(parsed)) {
          options.draftLessonIndexes = parsed.filter(
            (x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 0,
          )
        }
      } catch {
        // JSON hỏng -> bỏ qua, không chặn lưu.
      }
    }
    const text = formData.get("text")
    if (typeof text === "string") {
      const rawName = formData.get("filename")
      const filename = typeof rawName === "string" && rawName ? rawName : "draft.txt"
      const images = parseMediaArray(formData.get("images"))
      const tables = parseMediaArray(formData.get("tables"))
      const result = await saveWorksheetFromText(user, text, filename, images, tables, options)
      return NextResponse.json(result)
    }
    const { buffer, filename } = await bufferFromFormData(formData)
    const result = await saveWorksheetBuffer(user, buffer, filename, options)
    return NextResponse.json(result)
  } catch (e) {
    // SEC-09: chỉ trả message nghiệp vụ đã biết; lỗi lạ -> thông báo chung.
    return NextResponse.json({ error: safeErrorMessage(e, "Lưu thất bại") }, { status: 400 })
  }
}
