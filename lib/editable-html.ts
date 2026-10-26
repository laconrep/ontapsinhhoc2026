/**
 * Cầu nối giữa `bodyHtml` (HTML render kèm ảnh/bảng, hiển thị qua
 * QuestionStem) và ô nhập chữ của hộp sửa câu hỏi.
 *
 * Vấn đề gốc (dual-copy): lúc nhập, parser tách media khỏi `content` —
 * `content` chỉ còn chữ, ảnh/bảng nằm trong `bodyHtml`. Hộp sửa trước đây
 * chỉ sửa `content` và không gửi `bodyHtml`, nên server giữ nguyên
 * `bodyHtml` cũ; mọi chỗ render qua QuestionStem (ưu tiên `bodyHtml`)
 * vẫn hiện bản cũ dù giáo viên đã sửa chữ — kể cả với học sinh ở lượt
 * làm bài mới. Hộp sửa mới sửa trên "văn bản khả sửa": chữ kèm placeholder
 * `@@MEDIA-n@@` đánh dấu vị trí ảnh/bảng, và khi lưu dựng lại `bodyHtml`
 * từ văn bản đó + các phần tử media cũ (theo đúng thứ tự placeholder).
 *
 * An toàn: văn bản giáo viên gõ luôn được escape khi dựng lại HTML;
 * phần tử media chỉ lấy từ `bodyHtml` đã qua sanitize lúc nhập, và phía
 * server vẫn sanitize lại một lần nữa khi ghi (updateQuestion).
 */

export function mediaPlaceholder(index: number): string {
  return `@@MEDIA-${index}@@`
}

const PLACEHOLDER_RE = /@@MEDIA-(\d+)@@/g

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Tách `bodyHtml` thành văn bản khả sửa + danh sách phần tử media theo
 * thứ tự xuất hiện. Văn bản trắng thuần giữa các thẻ bị bỏ (HTML vốn
 * không giữ chúng), các thẻ block/xuống dòng thành `\n`.
 */
export function bodyHtmlToEditable(bodyHtml: string | null | undefined): {
  text: string
  media: string[]
} {
  if (!bodyHtml) return { text: "", media: [] }
  const media: string[] = []
  let out = ""
  // Một lượt quét duy nhất, giữ đúng thứ tự: bảng, ảnh, xuống dòng,
  // đóng thẻ block, thẻ khác (bỏ), đoạn chữ.
  const re =
    /(<table\b[^>]*>[\s\S]*?<\/table>)|(<img\b[^>]*>)|(<br\s*\/?>)|(<\/(?:p|div|tr|li|ul|ol|h[1-6])>)|(<[^>]+>)|([^<]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(bodyHtml)) !== null) {
    if (m[1] !== undefined) {
      media.push(m[1])
      out += mediaPlaceholder(media.length)
    } else if (m[2] !== undefined) {
      media.push(m[2])
      out += mediaPlaceholder(media.length)
    } else if (m[3] !== undefined || m[4] !== undefined) {
      out += "\n"
    } else if (m[5] !== undefined) {
      // Thẻ còn lại (b, i, span, td...) — bỏ thẻ, giữ chữ bên trong
      // (chữ sẽ tới ở lượt match đoạn chữ kế tiếp).
    } else if (m[6] !== undefined) {
      // Đoạn chữ thuần: bỏ đoạn chỉ gồm khoảng trắng (vốn là \n nối
      // dòng của parser, không phải nội dung).
      if (m[6].trim() !== "") out += decodeEntities(m[6])
    }
  }
  // Gọn như stripRichTokens lúc nhập: trim từng dòng, bỏ dòng rỗng.
  const text = out
    .split("\n")
    .map((ln) => ln.trim())
    .filter((ln) => ln.length > 0)
    .join("\n")
  return { text, media }
}

function substitutePlaceholders(
  text: string,
  media: string[],
  replace: (index: number, raw: string) => string,
): string {
  return text.replace(PLACEHOLDER_RE, (raw, num) => {
    const idx = Number(num)
    if (Number.isInteger(idx) && idx >= 1 && idx <= media.length) {
      return replace(idx, raw)
    }
    return raw
  })
}

/**
 * Dựng lại `bodyHtml` từ văn bản khả sửa + media cũ. Trả về null khi
 * văn bản không còn placeholder media nào (khi đó render sẽ dùng
 * `content` thuần như câu hỏi không ảnh/bảng).
 */
export function editableToBodyHtml(text: string, media: string[]): string | null {
  let usedMedia = false
  const withMedia = substitutePlaceholders(escapeHtml(text), media, (idx) => {
    usedMedia = true
    return media[idx - 1]
  })
  if (!usedMedia) return null
  return withMedia
    .split("\n")
    .map((ln) => ln.trim())
    .filter((ln) => ln.length > 0)
    .join("<br>\n")
}

/**
 * Văn bản thuần để lưu vào `content`: bỏ placeholder media đã biết,
 * giữ nguyên placeholder lạ dưới dạng chữ (giáo viên tự gõ), trim từng
 * dòng và bỏ dòng rỗng — cùng ngữ nghĩa với `content` lúc nhập.
 */
export function editableToPlainText(text: string, media: string[]): string {
  const stripped = substitutePlaceholders(text, media, () => "")
  return stripped
    .split("\n")
    .map((ln) => ln.trim())
    .filter((ln) => ln.length > 0)
    .join("\n")
}
