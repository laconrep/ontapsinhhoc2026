"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
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
  onSourceChange?: (text: string) => void
  onRevalidated?: (payload: RevalidatedPreview) => void
}

function lineRange(text: string, line: number): { start: number; end: number } {
  const lines = text.split("\n")
  const idx = Math.max(1, Math.min(line, lines.length)) - 1
  let start = 0
  for (let i = 0; i < idx; i++) start += lines[i].length + 1
  return { start, end: start + (lines[idx]?.length ?? 0) }
}

export function ImportErrorFix({
  errors,
  sourceText,
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
    setChecking(false)
    const parseResult = parseTextContent(text)
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
    const { start, end } = lineRange(sourceText, e.line)
    ta.focus()
    ta.setSelectionRange(start, end)
    const lineCount = Math.max(sourceText.split("\n").length, 1)
    const lineHeight = ta.scrollHeight / lineCount
    ta.scrollTop = lineHeight * (e.line - 1)
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
          <div className="min-h-[420px] max-h-[70vh] overflow-hidden rounded-lg border">
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
              className="block h-full min-h-[420px] max-h-[70vh] w-full resize-none overflow-auto bg-transparent p-3 font-mono text-sm leading-5 whitespace-pre outline-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
