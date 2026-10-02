"use client"

import { useEffect, useRef, useState, type MouseEvent } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PreviewDocument } from "@/components/teacher/worksheet-preview-doc"
import {
  blockRange,
  collectMediaTokens,
  spliceBlock,
  type LineRange,
} from "@/lib/worksheet-source-range"
import { applyKpWrap } from "@/lib/kp-blank-wrap"
import {
  attachBodyHtml,
  attachOptionBodyHtml,
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

function sliceBlock(text: string, range: LineRange): string {
  return text.split("\n").slice(range.startLine - 1, range.endLine).join("\n")
}

function isKpEditor(block: string, message?: string): boolean {
  const first = block.split("\n")[0]?.trim() ?? ""
  return first.startsWith("-") || (message != null && message.includes("Điểm kiến thức"))
}

export function ImportErrorFix({
  errors,
  sourceText,
  parseResult,
  summary,
  images = [],
  tables = [],
  onSourceChange,
  onRevalidated,
}: ImportErrorFixProps) {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null)
  const [highlightLine, setHighlightLine] = useState<number | undefined>()
  const [activeRange, setActiveRange] = useState<LineRange | null>(null)
  const [blockEdit, setBlockEdit] = useState("")
  const [tokenWarn, setTokenWarn] = useState(false)
  const [checking, setChecking] = useState(false)
  const [isKp, setIsKp] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorsRef = useRef(errors)
  const originalTokensRef = useRef<string[]>([])
  const latestTextRef = useRef(sourceText)
  const rangeRef = useRef<LineRange | null>(null)
  errorsRef.current = errors
  latestTextRef.current = sourceText

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
    applyRevalidate(latestTextRef.current)
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

  function openBlock(line: number, message?: string) {
    const text = latestTextRef.current
    const range = blockRange(text, line, message)
    const block = sliceBlock(text, range)
    originalTokensRef.current = collectMediaTokens(block)
    rangeRef.current = range
    setActiveRange(range)
    setBlockEdit(block)
    setTokenWarn(false)
    setIsKp(isKpEditor(block, message))
    scrollToLine(line)
  }

  function selectError(i: number) {
    setActiveErrorIndex(i)
    const e = errors[i]
    if (!e?.line) return
    openBlock(e.line, e.message)
  }

  function applyBlockEdit(edit: string) {
    const range = rangeRef.current
    if (!range) return
    const next = spliceBlock(latestTextRef.current, range.startLine, range.endLine, edit)
    const nextRange = { startLine: range.startLine, endLine: range.startLine + edit.split("\n").length - 1 }
    rangeRef.current = nextRange
    setActiveRange(nextRange)
    setBlockEdit(edit)
    const kept = collectMediaTokens(edit)
    setTokenWarn(originalTokensRef.current.some((tok) => !kept.includes(tok)))
    latestTextRef.current = next
    onSourceChange?.(next)
    scheduleRevalidate(next)
  }

  function closeEditor() {
    flushRevalidate()
    rangeRef.current = null
    setActiveRange(null)
    setBlockEdit("")
    setTokenWarn(false)
    setIsKp(false)
  }

  function wrapAtSelection(ev: MouseEvent<HTMLTextAreaElement>) {
    if (!isKp || !ev.ctrlKey) return
    const ta = textareaRef.current
    if (!ta) return
    const result = applyKpWrap(blockEdit, ta.selectionStart, ta.selectionEnd)
    if (result.text === blockEdit) return
    applyBlockEdit(result.text)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(result.start, result.end)
    })
  }

  const errorLines = new Set(errors.map((e) => e.line).filter((n): n is number => n != null))
  const editorHasError =
    activeRange != null &&
    errors.some((e) => e.line != null && e.line >= activeRange.startLine && e.line <= activeRange.endLine)

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {errors.length > 0 ? (
            <>
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cần sửa {errors.length} lỗi
              <Badge variant="destructive">{errors.length}</Badge>
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
        <div className="grid gap-3 md:grid-cols-10">
          <div
            className={`min-h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)] overflow-auto rounded-lg border p-2 md:col-span-4 ${
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
                        activeErrorIndex === i
                          ? "bg-destructive/20 ring-1 ring-destructive/40"
                          : "hover:bg-destructive/10"
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
          <div className="flex min-h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border bg-background md:col-span-6">
            {activeRange ? (
              <div
                className={`shrink-0 border-b p-3 ${
                  editorHasError ? "border-destructive/40 bg-destructive/5" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Sửa khối dòng {activeRange.startLine}
                    {activeRange.endLine !== activeRange.startLine ? `–${activeRange.endLine}` : ""}
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={closeEditor}>
                    Xong
                  </Button>
                </div>
                {isKp ? (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Click để gõ như Word. Giữ Ctrl rồi click từ để gạch chân (ô điền/kéo thả); giữ Ctrl rồi
                    bôi nhiều từ để tạo cụm. Thêm dấu ngoặc kép quanh từ đã gạch chân thì cụm từ này có thể
                    đổi chỗ vị trí điền khuyết.
                  </p>
                ) : null}
                {tokenWarn ? (
                  <p className="mb-2 text-xs text-destructive">Token ảnh/bảng bị xóa — preview có thể mất hình.</p>
                ) : null}
                <textarea
                  ref={textareaRef}
                  value={blockEdit}
                  onChange={(ev) => applyBlockEdit(ev.target.value)}
                  onMouseUp={isKp ? wrapAtSelection : undefined}
                  onBlur={() => flushRevalidate()}
                  spellCheck={false}
                  className={`block min-h-[120px] max-h-[28vh] w-full resize-y overflow-auto rounded-md border p-2 font-mono text-sm leading-5 whitespace-pre outline-none ${
                    editorHasError
                      ? "border-destructive bg-destructive/10 text-foreground"
                      : "border-border bg-transparent"
                  }`}
                />
              </div>
            ) : null}
            <div ref={previewRef} className="min-h-0 flex-1 overflow-auto p-3">
              <PreviewDocument
                parseResult={parseResult}
                summary={summary}
                isValid={errors.length === 0}
                errors={errors}
                highlightLine={highlightLine}
                errorLines={errorLines}
                onSelectBlock={(line) => openBlock(line)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
