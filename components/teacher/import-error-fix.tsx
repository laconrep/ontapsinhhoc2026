"use client"

import { useRef, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ValidationError } from "@/lib/worksheet-parser"

interface ImportErrorFixProps {
  errors: ValidationError[]
  sourceText: string
  onSourceChange?: (text: string) => void
}

function lineRange(text: string, line: number): { start: number; end: number } {
  const lines = text.split("\n")
  const idx = Math.max(1, Math.min(line, lines.length)) - 1
  let start = 0
  for (let i = 0; i < idx; i++) start += lines[i].length + 1
  return { start, end: start + (lines[idx]?.length ?? 0) }
}

export function ImportErrorFix({ errors, sourceText, onSourceChange }: ImportErrorFixProps) {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
              onChange={(ev) => onSourceChange?.(ev.target.value)}
              spellCheck={false}
              className="block h-full min-h-[420px] max-h-[70vh] w-full resize-none overflow-auto bg-transparent p-3 font-mono text-sm leading-5 whitespace-pre outline-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
