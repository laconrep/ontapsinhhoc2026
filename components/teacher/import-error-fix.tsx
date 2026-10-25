"use client"

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PreviewDocument } from "@/components/teacher/worksheet-preview-doc"
import {
  blockRange,
  collectKpLines,
  collectMediaTokens,
  isKpBlock,
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
import type { AiResultMeta } from "@/lib/ai/types"

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
  /** §26: tổng byte ảnh raster từ lần validate — ảnh không đổi khi sửa
   * text nên số này vẫn đúng sau các lần kiểm tra lại. */
  totalImageBytes?: number
  /** §15: siêu dữ liệu truy vết khi bản xem trước đến từ việc AI. */
  aiMeta?: AiResultMeta | null
  onSourceChange?: (text: string) => void
  onRevalidated?: (payload: RevalidatedPreview) => void
}

function sliceBlock(text: string, range: LineRange): string {
  return text.split("\n").slice(range.startLine - 1, range.endLine).join("\n")
}

export function ImportErrorFix({
  errors,
  sourceText,
  parseResult,
  summary,
  images = [],
  tables = [],
  totalImageBytes,
  aiMeta,
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
  // Dòng bắt đầu của mọi điểm kiến thức theo lần parse gần nhất — dùng
  // để nhận diện khối điểm (kể cả dạng "1. ...", "a. ...") thay vì chỉ
  // trông vào tiền tố "-" ở dòng đầu khối.
  const kpLines = useMemo(() => collectKpLines(parseResult), [parseResult])
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
    // §25: bản xem trước từ AI (aiMeta có) giữ cách gán theo KP + chỉ
    // thị; bản thường tách trắc nghiệm ra cấp bài học như lúc validate.
    const nextParse = parseTextContent(text, aiMeta ? undefined : { questionScope: "lesson" })
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
    setIsKp(isKpBlock(block, message, kpLines, range.startLine))
    scrollToLine(line)
  }

  function selectError(i: number) {
    setActiveErrorIndex(i)
    const e = errors[i]
    if (!e?.line) return
    openBlock(e.line, e.message)
  }

  // §15.4: không còn khung danh sách lỗi riêng — di chuyển giữa các lỗi
  // bằng hai nút ở tiêu đề, lỗi được tô đỏ ngay trong bản xem trước.
  function stepError(dir: 1 | -1) {
    if (errors.length === 0) return
    const cur = activeErrorIndex ?? (dir === 1 ? -1 : 0)
    const next = (cur + dir + errors.length) % errors.length
    selectError(next)
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
  const blockErrors =
    activeRange != null
      ? errors.filter(
          (e) => e.line != null && e.line >= activeRange.startLine && e.line <= activeRange.endLine,
        )
      : []

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
          {errors.length > 0 ? (
            <span className="ml-auto flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => stepError(-1)}>
                Lỗi trước
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => stepError(1)}>
                Lỗi sau
              </Button>
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {aiMeta?.unmatchedSolutions && aiMeta.unmatchedSolutions.length > 0 ? (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              Có {aiMeta.unmatchedSolutions.length} lời giải trong tài liệu không gắn được vào câu
              nào — kiểm tra lại trước khi lưu:
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-foreground">
              {aiMeta.unmatchedSolutions.map((s, i) => (
                <li key={i}>
                  {s.text}
                  {s.reason ? <span className="text-muted-foreground"> ({s.reason})</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {errors.length > 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Khối nào có lỗi đã được tô đỏ ngay trong bản xem trước — bấm vào khối để sửa trực tiếp,
            sửa đúng thì khối hết đỏ.
          </p>
        ) : null}
        <div className="flex min-h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border bg-background">
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
                {blockErrors.length > 0 ? (
                  <ul className="mb-2 space-y-0.5 text-sm text-destructive">
                    {blockErrors.map((e, i) => (
                      <li key={i} className="flex gap-1.5">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{e.message}</span>
                      </li>
                    ))}
                  </ul>
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
                totalImageBytes={totalImageBytes}
                aiMeta={aiMeta}
              />
            </div>
        </div>
      </CardContent>
    </Card>
  )
}
