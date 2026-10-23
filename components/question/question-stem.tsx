"use client"

import DOMPurify from "dompurify"
import { cn } from "@/lib/utils"
import {
  SANITIZE_ALLOWED_TAGS,
  isAllowedImgSrc,
  isAllowedSpanValue,
  decorateImgTag,
} from "@/lib/sanitize-shared"

/**
 * SEC-02 (lớp hiển thị): lọc lại bodyHtml bằng DOMPurify với CÙNG allowlist
 * như phía server (lib/sanitize-shared.ts). Dữ liệu ghi vào DB đã được lọc
 * ở lib/sanitize.ts; đây là phòng thủ nhiều lớp cho dữ liệu cũ/chưa quét lại.
 * DOMPurify cần window — khi SSR (chưa có window) trả chuỗi rỗng, React
 * hydrate ở client sẽ render bản đã lọc.
 */
function sanitizeStemHtml(raw: string): string {
  if (typeof window === "undefined") return ""
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [...SANITIZE_ALLOWED_TAGS],
    ALLOWED_ATTR: ["src", "alt", "class", "colspan", "rowspan"],
    ALLOW_DATA_ATTR: false,
    FORBID_ATTR: ["style"],
  })
  // Hậu xử lý bằng DOM API (không regex trên HTML thô): bỏ img có src
  // không phải data URI ảnh hợp lệ, chuẩn hoá class eq-inline/eq-figure,
  // gắn style chiều cao do app tự tính — giống hệt lib/sanitize.ts.
  const tpl = document.createElement("template")
  tpl.innerHTML = clean
  tpl.content.querySelectorAll("img").forEach((img) => {
    const decorated = decorateImgTag({
      src: img.getAttribute("src") ?? "",
      alt: img.getAttribute("alt") ?? "",
      class: img.getAttribute("class") ?? "",
    })
    if (!decorated) {
      img.remove()
      return
    }
    const holder = document.createElement("template")
    holder.innerHTML = decorated
    img.replaceWith(holder.content.firstElementChild as Element)
  })
  tpl.content.querySelectorAll("th, td").forEach((cell) => {
    for (const attr of ["colspan", "rowspan"] as const) {
      const v = cell.getAttribute(attr)
      if (v != null && !isAllowedSpanValue(v)) cell.removeAttribute(attr)
    }
  })
  tpl.content.querySelectorAll("img").forEach((img) => {
    // Phòng thủ: DOMPurify đã chặn, nhưng khẳng định lại bất biến đầu ra.
    if (!isAllowedImgSrc(img.getAttribute("src") ?? "")) img.remove()
  })
  return tpl.innerHTML
}

/**
 * §19: khối ảnh/bảng của một ĐIỂM KIẾN THỨC — hiển thị KÈM dưới nội dung
 * chữ của điểm (khác QuestionStem ở chỗ không thay thế nội dung, vì nội
 * dung điểm còn mang các cụm gạch chân cần trình bày riêng). Dùng cùng
 * lớp lọc sanitize như thân câu hỏi.
 */
export function KpMedia({
  bodyHtml,
  className,
}: {
  bodyHtml?: string | null
  className?: string
}) {
  if (!bodyHtml) return null
  const html = sanitizeStemHtml(bodyHtml)
  if (!html) return null
  return (
    <div
      className={cn(
        "mt-2 leading-relaxed text-foreground [&_img]:max-w-full [&_img.eq-inline]:inline-block [&_img.eq-inline]:align-middle [&_img.eq-inline]:mx-1 [&_img.eq-inline]:my-0 [&_img.eq-inline]:h-[2.5em] [&_img.eq-inline]:w-auto [&_img:not(.eq-inline)]:mx-auto [&_img:not(.eq-inline)]:my-2 [&_img:not(.eq-inline)]:max-h-48 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function QuestionStem({
  content,
  bodyHtml,
  className,
  maxHeightClass = "max-h-[40vh]",
}: {
  content: string
  bodyHtml?: string | null
  className?: string
  maxHeightClass?: string
}) {
  const html = bodyHtml ? sanitizeStemHtml(bodyHtml) : null
  const scroll = Boolean(maxHeightClass && maxHeightClass !== "max-h-none")
  return (
    <div className={cn(maxHeightClass, scroll && "overflow-y-auto")}>
      {html ? (
        <div
          className={cn(
            "leading-relaxed text-foreground [&_img]:max-w-full [&_img.eq-inline]:inline-block [&_img.eq-inline]:align-middle [&_img.eq-inline]:mx-1 [&_img.eq-inline]:my-0 [&_img.eq-inline]:h-[2.5em] [&_img.eq-inline]:w-auto [&_img:not(.eq-inline)]:mx-auto [&_img:not(.eq-inline)]:my-2 [&_img:not(.eq-inline)]:max-h-48 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1",
            className,
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className={cn("whitespace-pre-wrap leading-relaxed text-foreground", className)}>{content}</p>
      )}
    </div>
  )
}
