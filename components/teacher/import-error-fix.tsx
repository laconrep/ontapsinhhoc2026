"use client"

import { AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ValidationError } from "@/lib/worksheet-parser"

interface ImportErrorFixProps {
  errors: ValidationError[]
  sourceText: string
  onSourceChange?: (text: string) => void
}

export function ImportErrorFix({ errors, sourceText, onSourceChange }: ImportErrorFixProps) {
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
                    className="flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-destructive"
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
          <div className="min-h-[420px] max-h-[70vh] overflow-auto rounded-lg border">
            <textarea
              value={sourceText}
              onChange={(ev) => onSourceChange?.(ev.target.value)}
              spellCheck={false}
              className="h-full min-h-[420px] w-full resize-none bg-transparent p-3 font-mono text-sm whitespace-pre outline-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
