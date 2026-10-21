import { timingSafeEqual } from "crypto"

/**
 * SEC-01 — cơ chế cấp quyền giáo viên TẠM THỜI (đã chốt triển khai ngay,
 * không chờ quyết định cơ chế chính thức):
 * người dùng chọn vai trò "teacher" lúc onboarding phải nhập mã mời khớp
 * biến môi trường TEACHER_INVITE_CODE. Cơ chế chính thức (admin duyệt /
 * mã mời dùng một lần / whitelist email) CHỜ chủ sản phẩm quyết định —
 * xem sualogic.md mục 12.
 *
 * Nếu env không đặt (hoặc ngắn hơn 8 ký tự): KHÔNG ai tự cấp được quyền
 * giáo viên qua onboarding (fail-closed).
 */
export const TEACHER_INVITE_MIN_LENGTH = 8

export function isTeacherInviteConfigured(): boolean {
  const code = process.env.TEACHER_INVITE_CODE
  return typeof code === "string" && code.length >= TEACHER_INVITE_MIN_LENGTH
}

/** So sánh mã mời theo thời gian hằng số; env chưa cấu hình -> luôn sai. */
export function verifyTeacherInviteCode(candidate: unknown): boolean {
  const expected = process.env.TEACHER_INVITE_CODE
  if (!isTeacherInviteConfigured() || typeof expected !== "string") return false
  if (typeof candidate !== "string" || candidate.length === 0) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
