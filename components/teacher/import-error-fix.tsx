"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  attachBodyHtml,
  isCauHeading,
  parseTextContent,
  sourceTextToPreviewHtml,
  summarize,
  validateDocument,
  type ParseResult,
  type ValidationError,
} from "@/lib/worksheet-parser"

export interface RevalidatedPreview {
  errors: ValidationError[]
  isValid: boolean
  parseResult: ParseResult
  summary: { chapters: number; lessons: number; kps: number; questions: number }
  sourceText: string
}

interface ImportErrorFixProps {
  errors: ValidationError[]
  sourceText: string
  images?: string[]
  tables?: string[]
  onSourceChange?: (text: string) => void
  onRevalidated?: (payload: RevalidatedPreview) => void
}

function questionBlockRange(text: string, line: number): { startLine: number; endLine: number } {
  const lines = text.split("\n")
  if (lines.length === 0) return { startLine: 1, endLine: 1 }
  const idx = Math.max(1, Math.min(line, lines.length)) - 1
  const t = (i: number) => lines[i]?.trim() ?? ""
  const isQStart = (s: string) => /^#{1,3}(\s|$)/.test(s) || isCauHeading(s)
  const isNewBlock = (s: string) =>
    s.startsWith("#") ||
    s.startsWith("{") ||
    s.startsWith("[") ||
    s.startsWith("-") ||
    s.startsWith("+") ||
    s.startsWith("*") ||
    s.startsWith("//")

  let start = idx
  while (start > 0 && !isQStart(t(start))) start -= 1
  if (!isQStart(t(start))) start = idx

  let seenCau = isCauHeading(t(start))
  let end = idx
  for (let i = start + 1; i < lines.length; i++) {
    const s = t(i)
    if (s && isNewBlock(s)) break
    if (s && isCauHeading(s)) {
      if (seenCau) break
      seenCau = true
    }
    end = i
  }
  if (end < idx) end = idx
  return { startLine: start + 1, endLine: end + 1 }
}

function offsetRange(text: string, startLine: number, endLine: number): { start: number; end: number } {
  const lines = text.split("\n")
  let start = 0
  const from = Math.max(1, startLine) - 1
  const to = Math.max(from, Math.min(endLine, lines.length) - 1)
  for (let i = 0; i < from && i < lines.length; i++) start += lines[i].length + 1
  let end = start
  for (let i = from; i <= to && i < lines.length; i++) {
    end += lines[i].length
    if (i < to) end += 1
  }
  return { start, end }
}

export function ImportErrorFix({
  errors,
  sourceText,
  images = [],
  tables = [],
  onSourceChange,
  onRevalidated,
}: ImportErrorFixProps) {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorsRef = useRef(errors)
  errorsRef.current = errors

  function applyRevalidate(text: string) {
    const ta = textareaRef.current
    const selStart = ta?.selectionStart
    const selEnd = ta?.selectionEnd
    setChecking(false)
    const parseResult = parseTextContent(text)
    attachBodyHtml(parseResult, images, tables)
    const { isValid, errors: next } = validateDocument(parseResult)
    const summary = summarize(parseResult)
    setActiveErrorIndex((prev) => {
      if (prev == null) return null
      const prevLine = errorsRef.current[prev]?.line
      if (prevLine != null) {
        const idx = next.findIndex((e) => e.line === prevLine)
        if (idx >= 0) return idx
      }
      return next.length > 0 ? 0 : null
    })
    onRevalidated?.({ errors: next, isValid, parseResult, summary, sourceText: text })
    if (!isValid && ta && selStart != null) {
      requestAnimationFrame(() => {
        ta.setSelectionRange(selStart, selEnd ?? selStart)
      })
    }
  }

  function scheduleRevalidate(text: string) {
    setChecking(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      applyRevalidate(text)
    }, 1000)
  }

  function flushRevalidate() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    applyRevalidate(textareaRef.current?.value ?? sourceText)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function selectError(i: number) {
    setActiveErrorIndex(i)
    const e = errors[i]
    if (!e?.line) return
    const ta = textareaRef.current
    if (!ta) return
    const { startLine, endLine } = questionBlockRange(sourceText, e.line)
    const { start, end } = offsetRange(sourceText, startLine, endLine)
    ta.focus()
    ta.setSelectionRange(start, end)
    const lineCount = Math.max(sourceText.split("\n").length, 1)
    const lineHeight = ta.scrollHeight / lineCount
    ta.scrollTop = lineHeight * (startLine - 1)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Cần sửa {errors.length} lỗi
          {checking ? <Badge variant="secondary">Đang kiểm tra...</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-h-[420px] max-h-[70vh] overflow-auto rounded-lg border border-destructive/40 bg-destructive/5 p-2">
            <ul className="space-y-1 text-sm">
              {errors.map((e, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => selectError(i)}
                    className={`flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-destructive ${
                      activeErrorIndex === i ? "bg-destructive/15" : "hover:bg-destructive/10"
                    }`}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {e.line ? <strong>Dòng {e.line}: </strong> : null}
                      {e.message}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-[420px] max-h-[70vh] flex-col overflow-hidden rounded-lg border">
            <textarea
              ref={textareaRef}
              value={sourceText}
              onChange={(ev) => {
                const text = ev.target.value
                onSourceChange?.(text)
                scheduleRevalidate(text)
              }}
              onBlur={flushRevalidate}
              spellCheck={false}
              className={`block w-full resize-none overflow-auto bg-transparent p-3 font-mono text-sm leading-5 whitespace-pre outline-none ${
                images.length > 0 || tables.length > 0
                  ? "min-h-[200px] max-h-[35vh]"
                  : "h-full min-h-[420px] max-h-[70vh]"
              }`}
            />
            {images.length > 0 || tables.length > 0 ? (
              <div
                className="min-h-[180px] max-h-[35vh] overflow-auto border-t bg-muted/30 p-3 text-sm leading-relaxed [&_img]:mx-auto [&_img]:my-2 [&_img]:max-h-48 [&_img]:max-w-full [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1"
                dangerouslySetInnerHTML={{
                  __html: sourceTextToPreviewHtml(sourceText, images, tables),
                }}
              />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
