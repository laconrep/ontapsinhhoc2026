import sanitizeHtml from "sanitize-html"
import {
  SANITIZE_ALLOWED_TAGS,
  SANITIZE_IMG_CLASSES,
  isAllowedImgSrc,
  isAllowedSpanValue,
  decorateImgTag,
} from "@/lib/sanitize-shared"

export { isAllowedImgSrc } from "@/lib/sanitize-shared"

/**
 * SEC-02: lọc HTML phía SERVER lúc ghi (createQuestion/updateQuestion,
 * đường import worksheet). Dùng sanitize-html với allowlist chặt dùng chung
 * ở lib/sanitize-shared.ts. KHÔNG lọc bằng regex nữa.
 *
 * Trả về null khi đầu vào null/undefined/rỗng sau lọc mà gốc cũng rỗng;
 * giữ nguyên null để không đổi ngữ nghĩa cột bodyHtml nullable.
 */
export function sanitizeBodyHtml(raw: string | null | undefined): string | null {
  if (raw == null) return null
  if (!raw.trim()) return null

  const clean = sanitizeHtml(raw, {
    allowedTags: [...SANITIZE_ALLOWED_TAGS],
    allowedAttributes: {
      img: ["src", "alt", "class"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedClasses: {
      img: [...SANITIZE_IMG_CLASSES],
    },
    // Không cho bất kỳ scheme nào (http/https/javascript/...), ngoại trừ
    // scheme "data" trên <img> — và src data: còn bị kiểm chặt hơn bằng
    // isAllowedImgSrc + exclusiveFilter bên dưới (chỉ data:image/*;base64).
    allowedSchemes: [],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
    transformTags: {
      th: (_tag, attribs) => ({
        tagName: "th",
        attribs: pickSpanAttribs(attribs),
      }),
      td: (_tag, attribs) => ({
        tagName: "td",
        attribs: pickSpanAttribs(attribs),
      }),
    },
    exclusiveFilter: (frame) => {
      // Bỏ hẳn <img> có src không phải data URI ảnh hợp lệ.
      return frame.tag === "img" && !isAllowedImgSrc(frame.attribs.src ?? "")
    },
  })

  // Hậu xử lý: viết lại thẻ <img> theo đúng định dạng app dùng (class
  // eq-inline/eq-figure + style chiều cao do app tự tính). Sau sanitize,
  // thuộc tính img chỉ còn src/alt/class nên regex ở đây an toàn.
  const out = clean.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc="([^"]*)"/i)?.[1] ?? ""
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? ""
    const cls = tag.match(/\bclass="([^"]*)"/i)?.[1] ?? ""
    return decorateImgTag({ src, alt, class: cls }) ?? ""
  })
  return out.trim() ? out : null
}

function pickSpanAttribs(attribs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  if (attribs.colspan && isAllowedSpanValue(attribs.colspan)) {
    out.colspan = attribs.colspan.trim()
  }
  if (attribs.rowspan && isAllowedSpanValue(attribs.rowspan)) {
    out.rowspan = attribs.rowspan.trim()
  }
  return out
}
