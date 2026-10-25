/**
 * §26: lazy load cho ảnh bài học — trình duyệt chỉ tải ảnh khi học sinh
 * cuộn tới, thay vì tải hết ngay lúc mở bài. Hàm thuần trên chuỗi HTML
 * (không cần DOM) để dùng được cả phía render lẫn test.
 *
 * - Ảnh đã có loading= thì giữ nguyên (không ghi đè ý đồ khác).
 * - Ảnh công thức inline (class eq-inline, tí hon, nằm trong dòng chữ)
 *   thì KHÔNG lazy — chúng cần hiện cùng chữ, lazy chỉ gây nhấp nháy.
 */
export function addLazyLoading(html: string): string {
  return html.replace(/<img\b([^>]*?)>/gi, (tag, attrs: string) => {
    if (/\bloading\s*=/.test(attrs)) return tag
    if (/\bclass\s*=\s*"[^"]*eq-inline[^"]*"/.test(attrs)) return tag
    if (/\bclass\s*=\s*'[^']*eq-inline[^']*'/.test(attrs)) return tag
    const selfClose = /\/\s*$/.test(attrs)
    const clean = selfClose ? attrs.replace(/\/\s*$/, "") : attrs
    return `<img${clean} loading="lazy"${selfClose ? " /" : ""}>`
  })
}
