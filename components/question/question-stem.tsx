"use client"

import { cn } from "@/lib/utils"
import { equationHeightEmFromSrc, isSvgDataUri } from "@/lib/equation-size"

function sanitizeStemHtml(raw: string): string {
  let s = raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(src) && !src.startsWith("/")) return ""
    const alt = (tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").replace(/[<>"']/g, "")
    let cls = tag.match(/\bclass\s*=\s*["'](eq-inline|eq-figure)["']/i)?.[1] ?? ""
    if (!cls && isSvgDataUri(src)) cls = "eq-inline"
    const stored = tag.match(/\bstyle\s*=\s*["']height:([\d.]+)em;width:auto["']/i)?.[1]
    const recomputed = cls === "eq-inline" ? equationHeightEmFromSrc(src) : null
    const h = recomputed != null ? String(recomputed) : stored ?? (cls === "eq-inline" ? "4.5" : undefined)
    const extra =
      (cls ? ` class="${cls}"` : "") +
      (cls === "eq-inline" && h ? ` style="--eq-h:${h}em;height:${h}em;width:auto"` : "")
    return `<img src="${src}" alt="${alt}"${extra}>`
  })
  s = s.replace(/<(?!\/?(img|table|thead|tbody|tfoot|tr|th|td|caption|br|p|u)\b)[^>]+>/gi, "")
  s = s.replace(/<(table|thead|tbody|tfoot|tr|th|td|caption|br|p|u)(\s[^>]*)?>/gi, (_, name: string, attrs?: string) => {
    const tag = name.toLowerCase()
    if (!attrs) return `<${tag}>`
    if (tag !== "th" && tag !== "td") return `<${tag}>`
    const span: string[] = []
    const cs = attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)
    const rs = attrs.match(/\browspan\s*=\s*["']?(\d+)/i)
    if (cs) span.push(`colspan="${cs[1]}"`)
    if (rs) span.push(`rowspan="${rs[1]}"`)
    return span.length ? `<${tag} ${span.join(" ")}>` : `<${tag}>`
  })
  return s
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
