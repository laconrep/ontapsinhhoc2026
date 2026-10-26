import { MAX_FILE_SIZE } from "@/lib/extract-file"
import { isBlobPublicUrl } from "@/lib/blob-media"

/**
 * §30 — Vận chuyển file lớn qua Vercel Blob.
 *
 * Vấn đề: Vercel giới hạn mỗi request tới serverless function ở ~4,5MB,
 * nên file docx 4,55MB (Bài 2) bị gateway trả 413 TRƯỚC KHI code của app
 * chạy — dù app cho phép tới 10MB và giao diện ghi "tối đa 10MB". Cách
 * sửa: file trên ngưỡng dưới đây được client tải THẲNG lên Blob (không
 * qua function), rồi chỉ gửi URL Blob (vài trăm byte JSON) cho server;
 * server tải file từ Blob về, trích xuất như thường, rồi XOÁ object
 * Blob ngay (chỉ là phương tiện vận chuyển, không phải nơi lưu trữ).
 *
 * Ngưỡng 4MB (dưới 4,5MB, chừa dư lượng cho khung multipart): file nhỏ
 * hơn giữ nguyên đường multipart cũ (ít bộ phận chuyển động hơn); file
 * lớn hơn đi qua Blob. Giới hạn thật của app vẫn là 10MB (MAX_FILE_SIZE),
 * kiểm tra ở cả 3 nơi: cấp token, tải từ Blob về, và đọc buffer.
 */

/** File trên ngưỡng này đi qua Blob thay vì multipart trực tiếp. */
export const BLOB_TRANSPORT_THRESHOLD = 4 * 1024 * 1024

/** Body JSON { blobUrl, filename } tối đa — chỉ là URL + tên file. */
export const BLOB_JSON_BODY_LIMIT = 64 * 1024

const ALLOWED_EXT = /\.(txt|docx|pdf)$/i

/** True khi filename có đuôi mà luồng nạp chấp nhận. */
export function isAllowedUploadFilename(filename: string): boolean {
  return ALLOWED_EXT.test(filename.trim())
}

/**
 * Kiểm tra URL Blob vận chuyển: bắt buộc https + host Blob public của
 * Vercel (cùng allowlist với ảnh trong bài — lib/blob-media.ts). Không
 * chấp nhận URL ngoài, tránh server bị lừa tải file từ host lạ (SSRF).
 */
export function isTransportBlobUrl(url: string): boolean {
  return isBlobPublicUrl(url)
}

type BlobDelFn = (url: string | string[]) => Promise<unknown>

/**
 * Tải file vận chuyển từ Blob về thành buffer, rồi xoá object Blob.
 * Xoá là best-effort (lỗi xoá chỉ log, không làm hỏng việc nạp — object
 * mồ côi tối đa 10MB sẽ nằm lại store cho tới khi dọn tay).
 * Ném lỗi nghiệp vụ rõ ràng khi URL/host/sai, đuôi file, hay quá 10MB.
 */
export async function fetchTransportBuffer(
  blobUrl: string,
  filename: string,
): Promise<Buffer> {
  if (!isTransportBlobUrl(blobUrl)) {
    throw new Error("Đường dẫn Blob không hợp lệ")
  }
  if (!isAllowedUploadFilename(filename)) {
    throw new Error("Chỉ chấp nhận file .txt, .docx hoặc .pdf")
  }
  let res: Response
  try {
    res = await fetch(blobUrl, { method: "GET" })
  } catch {
    throw new Error("Không tải được file từ Blob, hãy thử lại")
  }
  if (!res.ok) {
    throw new Error("Không tải được file từ Blob, hãy thử lại")
  }
  const len = Number(res.headers.get("content-length") ?? 0)
  if (len > MAX_FILE_SIZE) {
    throw new Error("File vượt quá 10MB")
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_FILE_SIZE) {
    throw new Error("File vượt quá 10MB")
  }
  // Vận chuyển xong là xoá — best-effort.
  try {
    const { del } = (await import("@vercel/blob")) as unknown as { del: BlobDelFn }
    await del(blobUrl)
  } catch (e) {
    console.warn("§30: không xoá được object Blob vận chuyển:", e)
  }
  return buf
}
