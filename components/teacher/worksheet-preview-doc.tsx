"use client"

import { QuestionStem } from "@/components/question/question-stem"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ParseResult, ValidationError } from "@/lib/worksheet-parser"

const TYPE_LABEL: Record<string, string> = { MC: "Trắc nghiệm", TF: "Đúng/Sai", SA: "Trả lời ngắn" }

export function highlightBlanks(content: string, terms: { text: string }[]) {
  if (terms.length === 0) return content
  const parts: (string | { blank: string })[] = [content]
  for (const t of terms) {
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      if (typeof p !== "string") continue
      const idx = p.indexOf(t.text)
      if (idx >= 0) {
        parts.splice(i, 1, p.slice(0, idx), { blank: t.text }, p.slice(idx + t.text.length))
        break
      }
    }
  }
  return parts.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span key={i} className="rounded bg-primary/15 px-1 font-semibold text-primary underline decoration-dotted">
        {p.blank}
      </span>
    ),
  )
}

export function PreviewDocument({
  parseResult,
  summary,
  highlightLine,
  errorLines,
  onSelectBlock,
}: {
  parseResult: ParseResult
  summary: { chapters: number; lessons: number; kps: number; questions: number }
  isValid?: boolean
  errors?: ValidationError[]
  highlightLine?: number
  errorLines?: Set<number>
  onSelectBlock?: (line: number) => void
}) {
  let qIndex = 0
  function blockTone(line: number) {
    const hasError = errorLines?.has(line)
    const active = highlightLine === line
    return cn(
      hasError && "border-destructive/50 bg-destructive/10 ring-1 ring-destructive/40",
      active && (hasError ? "ring-2 ring-destructive" : "ring-2 ring-primary"),
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{summary.chapters} chương</Badge>
        <Badge variant="secondary">{summary.lessons} bài</Badge>
        <Badge variant="secondary">{summary.kps} kiến thức</Badge>
        <Badge variant="secondary">{summary.questions} câu hỏi</Badge>
      </div>

      <div className="space-y-3">
        {parseResult.chapters.map((c, ci) => (
          <div key={ci} className="rounded-lg border">
            <div className="border-b bg-secondary/40 px-3 py-2 font-heading font-semibold text-foreground">
              {c.title}
            </div>
            <div className="divide-y">
              {c.lessons.map((l, li) => (
                <div key={li} className="px-3 py-2">
                  <p className="font-medium text-foreground">{l.title}</p>
                  <ul className="mt-2 space-y-2">
                    {l.knowledgePoints.map((kp, ki) => (
                      <li
                        key={ki}
                        id={`preview-line-${kp.line}`}
                        data-line={kp.line}
                        className={cn(
                          "cursor-pointer rounded-md bg-muted/40 p-2 text-sm",
                          blockTone(kp.line),
                        )}
                        onClick={() => onSelectBlock?.(kp.line)}
                      >
                        <p className="text-foreground">{highlightBlanks(kp.content, kp.underlinedTerms)}</p>
                        {kp.questions.length > 0 && (
                          <div className="mt-2 space-y-3">
                            {kp.questions.map((q, qi) => {
                              qIndex += 1
                              return (
                                <div
                                  key={qi}
                                  id={`preview-line-${q.line}`}
                                  data-line={q.line}
                                  className={cn(
                                    "rounded-md border bg-background p-2",
                                    blockTone(q.line),
                                  )}
                                  onClick={(ev) => {
                                    ev.stopPropagation()
                                    onSelectBlock?.(q.line)
                                  }}
                                >
                                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                    <Badge variant="outline" className="text-xs">
                                      Câu {qIndex}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {TYPE_LABEL[q.type] ?? q.type}
                                    </Badge>
                                  </div>
                                  <QuestionStem
                                    content={q.content}
                                    bodyHtml={q.bodyHtml}
                                    className="text-sm"
                                    maxHeightClass="max-h-64"
                                  />
                                  {q.options.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-sm">
                                      {q.options.map((o, oi) => (
                                        <li
                                          key={oi}
                                          className={o.isCorrect ? "font-medium text-primary" : "text-foreground"}
                                        >
                                          <QuestionStem
                                            content={o.content}
                                            bodyHtml={o.bodyHtml}
                                            className="text-sm"
                                            maxHeightClass="max-h-32"
                                          />
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                  {q.type === "SA" && q.correctAnswer ? (
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Đáp án: {q.correctAnswer}
                                    </p>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
