import { equationHeightEmFromSrc, isSvgDataUri } from "@/lib/equation-size"

/**
 * SEC-02: allowlist HTML dùng CHUNG cho cả phía server (lib/sanitize.ts,
 * package sanitize-html) và phía hiển thị (components/question/question-stem.tsx,
 * package dompurify). Hai nơi phải giữ cùng danh sách này — chỉ sửa ở đây.
 *
 * Ngữ cảnh: bodyHtml của câu hỏi/đáp án chỉ cần ảnh công thức (data URI)
 * và bảng. Mọi thẻ/thuộc tính khác đều là bề mặt XSS.
 */
export const SANITIZE_ALLOWED_TAGS = [
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "br",
  "p",
  "u",
] as const

/** class duy nhất được phép trên <img>. */
export const SANITIZE_IMG_CLASSES = ["eq-inline", "eq-figure"] as const

/**
 * src duy nhất được phép cho <img>: data URI base64 của ảnh raster hoặc SVG.
 * Loại mọi dạng //host, http:, https:, javascript:, đường dẫn tương đối.
 * (SVG ở dạng base64 không tự chạy script khi nạp qua <img>.)
 */
export const DATA_IMAGE_SRC_RE =
  /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/

export function isAllowedImgSrc(src: string): boolean {
  return DATA_IMAGE_SRC_RE.test(src.trim())
}

/** colspan/rowspan chỉ nhận số nguyên dương ngắn. */
export function isAllowedSpanValue(v: string): boolean {
  return /^\d{1,3}$/.test(v.trim())
}

/**
 * Hậu xử lý một thẻ <img> ĐÃ qua sanitize (thuộc tính chỉ còn src/alt/class):
 * - src không hợp lệ -> trả null (bỏ cả thẻ).
 * - Ảnh SVG chưa có class -> eq-inline (giữ hành vi cũ).
 * - img.eq-inline: gắn style chiều cao do CHÍNH app tính từ nội dung SVG
 *   (số học, an toàn) — style không bao giờ lấy từ đầu vào người dùng.
 */
export function decorateImgTag(attrs: {
  src: string
  alt?: string
  class?: string
}): string | null {
  const src = attrs.src ?? ""
  if (!isAllowedImgSrc(src)) return null
  let cls = attrs.class ?? ""
  if (cls !== "eq-inline" && cls !== "eq-figure") {
    cls = isSvgDataUri(src) ? "eq-inline" : ""
  }
  const alt = (attrs.alt ?? "").replace(/[<>"']/g, "")
  let out = `<img src="${src}" alt="${alt}"`
  if (cls) out += ` class="${cls}"`
  if (cls === "eq-inline") {
    const h = equationHeightEmFromSrc(src)
    const hh = h != null ? String(h) : "4.5"
    out += ` style="--eq-h:${hh}em;height:${hh}em;width:auto"`
  }
  return out + ">"
}
