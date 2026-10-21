/**
 * SEC-09: chuẩn hoá lỗi trả về client cho các API route. Chỉ các thông
 * báo NGHIỆP VỤ đã biết (do chính code ném ra với nội dung thân thiện)
 * mới được trả nguyên văn; mọi lỗi lạ (SQL của Drizzle, lỗi thư viện...)
 * chỉ ghi console.error phía server và trả một thông báo chung, tránh
 * lộ cấu trúc DB/câu truy vấn ra ngoài.
 */

const KNOWN_BUSINESS_MESSAGES = new Set<string>([
  // Phiên live / live-quiz
  "Chưa đăng nhập",
  "Không có quyền",
  "Không tìm thấy phiên",
  "Không tìm thấy lớp học",
  "Bạn không thuộc lớp của phiên này",
  "Bạn không có quyền truy cập phiên này",
  "Bạn không có quyền truy cập lớp này",
  "Bạn không được phép vào phiên này. Vui lòng kiểm tra xem bạn có thuộc lớp không.",
  "Bài học chưa có câu hỏi trắc nghiệm để trình chiếu",
  "Bài học không còn câu hỏi để trình chiếu",
  "Bạn đã trả lời",
  "Chưa có câu hỏi",
  "Chỉ số câu hỏi không hợp lệ",
  "Chỉ xoá được phiên nháp",
  "Câu hỏi không khớp",
  "Câu trả lời quá dài",
  "Lựa chọn không hợp lệ",
  "Phiên học không tồn tại hoặc đã kết thúc",
  "Phiên không hoạt động",
  "Phiên nháp không hợp lệ",
  "Phiên này không còn ở trạng thái nháp",
  "Đã hết thời gian trả lời",
  "Đã hết thời gian",
  // Worksheet upload
  "Không tìm thấy file tải lên",
  "File vượt quá 10MB",
  "Loại file không hỗ trợ. Chỉ chấp nhận .txt, .docx, .pdf",
  "Tài liệu chưa hợp lệ, không thể lưu. Vui lòng kiểm tra lại.",
])

// Các lỗi bảo vệ upload (SEC-06) được ném với tiền tố này và nội dung
// thân thiện do chính code soạn.
const KNOWN_BUSINESS_PREFIXES = ["File tải lên bị từ chối:", "Hết thời gian xử lý file"]

export function isBusinessError(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (KNOWN_BUSINESS_MESSAGES.has(e.message)) return true
  return KNOWN_BUSINESS_PREFIXES.some((p) => e.message.startsWith(p))
}

/**
 * Trả message an toàn cho client: nghiệp vụ đã biết -> nguyên văn;
 * còn lại -> fallback chung + log chi tiết phía server.
 */
export function safeErrorMessage(e: unknown, fallback: string): string {
  if (isBusinessError(e)) return (e as Error).message
  console.error("API error (chi tiết chỉ ở server):", e)
  return fallback
}
