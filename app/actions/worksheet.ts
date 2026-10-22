"use server"

import { requireRole } from "@/lib/auth-helpers"
import {
  bufferFromFormData,
  validateWorksheetBuffer,
  saveWorksheetBuffer,
  type WorksheetPreview,
  type SaveResult,
} from "@/lib/worksheet-import"

function toUserError(e: unknown, fallback: string): Error {
  if (e && typeof e === "object" && "digest" in e) throw e
  if (e instanceof Error && e.message && !/unexpected response/i.test(e.message)) {
    return new Error(e.message)
  }
  return new Error(fallback)
}

/** BƯỚC 2: Kiểm tra tài liệu — parse + validate, trả preview. Không lưu DB. */
export async function validateWorksheet(formData: FormData): Promise<WorksheetPreview> {
  await requireRole("teacher")
  try {
    const { buffer, filename } = await bufferFromFormData(formData)
    return await validateWorksheetBuffer(buffer, filename)
  } catch (e) {
    throw toUserError(e, "Không đọc được file. Thử file nhỏ hơn hoặc định dạng .txt/.docx/.pdf")
  }
}

/** §16: gắn từ nhiễu kéo thả của job AI vào các bài vừa lưu từ kết
 * quả của job (client gọi ngay sau khi lưu thành công). */
export async function applyAiDistractors(
  jobId: string,
  lessonIds: string[],
): Promise<{ updatedTerms: number }> {
  const user = await requireRole("teacher")
  const { applyDistractorsToLessons } = await import("@/lib/ai/jobs")
  return applyDistractorsToLessons(jobId, user.id, lessonIds)
}

/** BƯỚC 3: Lưu tài liệu — parse lại, ghi DB, đặt status='ready'. */
export async function saveWorksheet(formData: FormData): Promise<SaveResult> {
  const user = await requireRole("teacher")
  try {
    const { buffer, filename } = await bufferFromFormData(formData)
    return await saveWorksheetBuffer(user, buffer, filename)
  } catch (e) {
    throw toUserError(e, "Lưu thất bại. Kiểm tra kết nối hoặc thử lại.")
  }
}
