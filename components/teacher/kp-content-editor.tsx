"use client"

import { useMemo, useRef, type MouseEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { applyKpWrap } from "@/lib/kp-blank-wrap"
import { extractBlanks, unusedPlainQuotes } from "@/lib/worksheet-parser"
import { highlightBlanks } from "@/components/teacher/worksheet-preview-doc"

export function KpContentEditor({
  value,
  onChange,
  autoFocus,
}: {
  value: string
  onChange: (raw: string) => void
  autoFocus?: boolean
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preview = useMemo(() => extractBlanks(value), [value])
  const unusedQuotes = useMemo(() => unusedPlainQuotes(value), [value])
  const duplicateWarnings = useMemo(() => {
    const seen = new Set<string>()
    const msgs: string[] = []
    for (const t of preview.underlinedTerms) {
      if (!t.text || seen.has(t.text)) continue
      seen.add(t.text)
      let n = 0
      let from = 0
      while (from <= preview.content.length) {
        const idx = preview.content.indexOf(t.text, from)
        if (idx < 0) break
        n += 1
        from = idx + t.text.length
      }
      if (n > 1) msgs.push(`Chữ "${t.text}" xuất hiện ${n} lần; ô trống theo vị trí bạn đánh dấu.`)
    }
    return msgs
  }, [preview])

  function wrapAtSelection(ev: MouseEvent<HTMLTextAreaElement>) {
    if (!ev.ctrlKey) return
    const ta = textareaRef.current
    if (!ta) return
    const result = applyKpWrap(value, ta.selectionStart, ta.selectionEnd)
    if (result.text === value) return
    onChange(result.text)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(result.start, result.end)
    })
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        id="kp-content"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseUp={wrapAtSelection}
        placeholder='VD: ADN cấu tạo theo nguyên tắc __đa phân__, đơn phân là __"nucleotide"__'
        rows={6}
        autoFocus={autoFocus}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Giữ Ctrl + click để gạch chân; dùng __&quot;từ&quot;__ để cho phép hoán đổi vị trí.
      </p>
      {value.trim() ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground">
          {highlightBlanks(preview.content, preview.underlinedTerms)}
        </div>
      ) : null}
      {value.trim() && preview.underlinedTerms.length === 0 ? (
        <p className="text-xs text-destructive">Điểm kiến thức cần ít nhất 1 ô trống (__từ__ hoặc __&quot;từ&quot;__).</p>
      ) : null}
      {unusedQuotes.length > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Ngoặc kép thường không tạo ô trống (cần __&quot;từ&quot;__): {unusedQuotes.slice(0, 3).join(", ")}
        </p>
      ) : null}
      {duplicateWarnings.map((msg) => (
        <p key={msg} className="text-xs text-muted-foreground">
          {msg}
        </p>
      ))}
    </div>
  )
}
