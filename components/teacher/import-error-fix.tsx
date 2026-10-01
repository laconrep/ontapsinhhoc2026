"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PreviewDocument } from "@/components/teacher/worksheet-preview-doc"
import {
  attachBodyHtml,
  attachOptionBodyHtml,
  isCauHeading,
  parseTextContent,
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
  parseResult: ParseResult
  summary: { chapters: number; lessons: number; kps: number; questions: number }
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
  parseResult,
  summary,
  images = [],
  tables = [],
  onSourceChange: _onSourceChange,
  onRevalidated,
}: ImportErrorFixProps) {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null)
  const [highlightLine, setHighlightLine] = useState<number | undefined>()
  const [checking, setChecking] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorsRef = useRef(errors)
  errorsRef.current = errors

  function applyRevalidate(text: string) {
    setChecking(false)
    const nextParse = parseTextContent(text)
    attachBodyHtml(nextParse, images, tables)
    attachOptionBodyHtml(nextParse, images, tables)
    const { isValid, errors: next } = validateDocument(nextParse)
    const nextSummary = summarize(nextParse)
    setActiveErrorIndex((prev) => {
      if (prev == null) return null
      const prevLine = errorsRef.current[prev]?.line
      if (prevLine != null) {
        const idx = next.findIndex((e) => e.line === prevLine)
        if (idx >= 0) return idx
      }
      return next.length > 0 ? 0 : null
    })
    onRevalidated?.({ errors: next, isValid, parseResult: nextParse, summary: nextSummary, sourceText: text })
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
    applyRevalidate(sourceText)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function scrollToLine(line: number) {
    setHighlightLine(line)
    requestAnimationFrame(() => {
      const root = previewRef.current
      const el = root?.querySelector(`#preview-line-${line}`) as HTMLElement | null
      el?.scrollIntoView({ block: "start", behavior: "smooth" })
    })
  }

  function selectError(i: number) {
    setActiveErrorIndex(i)
    const e = errors[i]
    if (!e?.line) return
    scrollToLine(e.line)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {errors.length > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cần sửa {errors.length} lỗi
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Hết lỗi, có thể lưu
            </>
          )}
          {checking ? <Badge variant="secondary">Đang kiểm tra...</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div
            className={`min-h-[420px] max-h-[70vh] overflow-auto rounded-lg border p-2 ${
              errors.length > 0 ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5"
            }`}
          >
            {errors.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-foreground">Hết lỗi, có thể lưu</p>
            ) : (
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
            )}
          </div>
          <div
            ref={previewRef}
            className="min-h-[420px] max-h-[70vh] overflow-auto rounded-lg border bg-background p-3"
          >
            <PreviewDocument
              parseResult={parseResult}
              summary={summary}
              isValid={errors.length === 0}
              errors={errors}
              highlightLine={highlightLine}
              onSelectBlock={scrollToLine}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
