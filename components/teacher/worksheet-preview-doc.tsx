"use client"

import { QuestionStem } from "@/components/question/question-stem"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ParseResult, ValidationError } from "@/lib/worksheet-parser"

const TYPE_LABEL: Record<string, string> = { MC: "Trắc nghiệm", TF: "Đúng/Sai", SA: "Trả lời ngắn" }

type HighlightTerm = {
  text: string
  slotIndex?: number
  allowSwap?: boolean
  swapGroupId?: string | null
  start?: number
  end?: number
}

function offsetsValid(content: string, terms: HighlightTerm[]): boolean {
  return terms.every(
    (t) =>
      typeof t.start === "number" &&
      typeof t.end === "number" &&
      Number.isInteger(t.start) &&
      Number.isInteger(t.end) &&
      t.start >= 0 &&
      t.end <= content.length &&
      t.end >= t.start &&
      content.slice(t.start, t.end) === t.text,
  )
}

function groupBadgeMap(terms: HighlightTerm[]): Map<string, number> {
  const ids: string[] = []
  for (const t of terms) {
    if (!t.swapGroupId) continue
    if (!ids.includes(t.swapGroupId)) ids.push(t.swapGroupId)
  }
  const map = new Map<string, number>()
  ids.forEach((id, i) => map.set(id, i + 1))
  return map
}

export function highlightBlanks(content: string, terms: HighlightTerm[]) {
  if (terms.length === 0) return content
  const usable = terms.filter((t) => t.text)
  const groupNo = groupBadgeMap(usable)
  const blanks: { start: number; end: number; text: string; groupN?: number }[] = []

  if (offsetsValid(content, usable)) {
    const ordered = [...usable].sort(
      (a, b) => (a.start as number) - (b.start as number) || (a.slotIndex ?? 0) - (b.slotIndex ?? 0),
    )
    let seen = 0
    let overlap = false
    for (const t of ordered) {
      const start = t.start as number
      const end = t.end as number
      if (start < seen) {
        overlap = true
        break
      }
      blanks.push({
        start,
        end,
        text: t.text,
        groupN: t.swapGroupId ? groupNo.get(t.swapGroupId) : undefined,
      })
      seen = end
    }
    if (overlap) blanks.length = 0
  }

  if (blanks.length === 0) {
    const claimed: { start: number; end: number }[] = []
    const ordered = [...usable].sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0))
    for (const t of ordered) {
      let from = 0
      let idx = content.indexOf(t.text, from)
      while (idx !== -1) {
        const end = idx + t.text.length
        if (!claimed.some((c) => idx < c.end && end > c.start)) {
          claimed.push({ start: idx, end })
          blanks.push({
            start: idx,
            end,
            text: t.text,
            groupN: t.swapGroupId ? groupNo.get(t.swapGroupId) : undefined,
          })
          break
        }
        from = idx + 1
        idx = content.indexOf(t.text, from)
      }
    }
  }

  blanks.sort((a, b) => a.start - b.start)
  const nodes: (string | { blank: string; groupN?: number })[] = []
  let cursor = 0
  for (const b of blanks) {
    if (b.start > cursor) nodes.push(content.slice(cursor, b.start))
    nodes.push({ blank: b.text, groupN: b.groupN })
    cursor = b.end
  }
  if (cursor < content.length) nodes.push(content.slice(cursor))

  return nodes.map((p, i) =>
    typeof p === "string" ? (
      <span key={i}>{p}</span>
    ) : (
      <span
        key={i}
        className="rounded bg-primary/15 px-1 font-semibold text-primary underline decoration-dotted"
      >
        {p.blank}
        {p.groupN != null ? (
          <span className="ml-1 align-middle text-[10px] font-medium text-primary/80">Nhóm {p.groupN}</span>
        ) : null}
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
