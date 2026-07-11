"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Check, Library, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { QuestionBankItem } from "@/app/actions/questions"

type QType = "MC" | "TF" | "SA" | "FILL" | "DRAG"

const TYPE_LABEL: Record<string, string> = {
  MC: "Trắc nghiệm",
  TF: "Đúng/Sai",
  SA: "Trả lời ngắn",
  FILL: "Điền khuyết",
  DRAG: "Kéo thả",
}

export function QuestionBank({ items }: { items: QuestionBankItem[] }) {
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<QType | "all">("all")
  const [lessonFilter, setLessonFilter] = useState<string>("all")

  const lessons = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) map.set(it.lessonId, it.lessonTitle)
    return [...map.entries()].map(([id, title]) => ({ id, title }))
  }, [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (typeFilter !== "all" && it.type !== typeFilter) return false
      if (lessonFilter !== "all" && it.lessonId !== lessonFilter) return false
      if (q && !it.content.toLowerCase().includes(q) && !it.knowledgePointContent.toLowerCase().includes(q))
        return false
      return true
    })
  }, [items, query, typeFilter, lessonFilter])

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const it of items) c[it.type] = (c[it.type] ?? 0) + 1
    return c
  }, [items])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Ngân hàng câu hỏi</h1>
        <p className="mt-1 text-muted-foreground">
          Toàn bộ {items.length} câu hỏi trong các bài giảng của bạn.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Library className="h-6 w-6 text-primary" />
          </span>
          <p className="font-medium text-foreground">Chưa có câu hỏi nào</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Thêm câu hỏi trong từng điểm kiến thức ở mục Bài giảng.
          </p>
          <Button variant="outline" nativeButton={false} render={<Link href="/teacher/lessons" />}>
            Đến Bài giảng
          </Button>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm câu hỏi..."
                className="pl-9"
              />
            </div>
            <select
              value={lessonFilter}
              onChange={(e) => setLessonFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              aria-label="Lọc theo bài giảng"
            >
              <option value="all">Tất cả bài giảng</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </div>

          {/* Type chips */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`rounded-full border px-3 py-1 text-sm ${
                typeFilter === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              Tất cả ({items.length})
            </button>
            {(Object.keys(typeCounts) as QType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  typeFilter === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {TYPE_LABEL[t]} ({typeCounts[t]})
              </button>
            ))}
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không tìm thấy câu hỏi phù hợp.
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((it) => (
                <li key={it.id} className="rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0">
                      {TYPE_LABEL[it.type]}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">{it.content}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{it.chapterTitle}</span>
                        <span aria-hidden="true">•</span>
                        <Link
                          href={`/teacher/lessons/${it.lessonId}`}
                          className="text-primary hover:underline"
                        >
                          {it.lessonTitle}
                        </Link>
                        {it.correctAnswer && (
                          <>
                            <span aria-hidden="true">•</span>
                            <span className="inline-flex items-center gap-1">
                              <Check className="h-3 w-3 text-primary" />
                              {it.correctAnswer}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
