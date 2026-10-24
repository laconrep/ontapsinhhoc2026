"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileText, X } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DraftRow = {
  id: string
  kind: "ai" | "upload"
  jobId: string | null
  classId: string | null
  filename: string
  createdAt: string
  jobStatus: string | null
  jobProgress: number | null
  jobError: string | null
}

/**
 * §21: thẻ đỏ giữ chỗ cho việc nạp file chưa bấm Lưu.
 * classId = null -> việc bắt đầu từ đường nạp thường (tab Bài giảng);
 * classId có giá trị -> việc bắt đầu từ tab Lớp đó.
 * Bấm "Mở tiếp" -> trang nạp mở lại đúng bản xem trước đang dở;
 * bấm X -> bỏ việc (việc AI thì consume luôn job).
 */
export function UnsavedDrafts({ classId }: { classId: string | null }) {
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null)

  const load = useCallback(async () => {
    try {
      const url = classId ? `/api/import-drafts?classId=${classId}` : "/api/import-drafts"
      const res = await fetch(url)
      if (!res.ok) return
      const data = (await res.json()) as { drafts?: DraftRow[] }
      setDrafts(data.drafts ?? [])
    } catch {
      // Thẻ đỏ là phụ trợ — lỗi tải thì ẩn luôn, không chặn trang.
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  async function dismiss(id: string) {
    try {
      await fetch("/api/import-drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
    } catch {
      // Bỏ qua — tải lại danh sách sẽ cho trạng thái đúng.
    }
    setDrafts((prev) => (prev ?? []).filter((d) => d.id !== id))
  }

  if (!drafts || drafts.length === 0) return null

  function resumeHref(d: DraftRow): string | null {
    const ctx = classId ? `&assignToClass=${classId}` : ""
    if (d.kind === "ai") {
      if (!d.jobId || d.jobStatus === "failed") return null
      return `/teacher/lessons/import?resumeJob=${d.jobId}${ctx}`
    }
    return `/teacher/lessons/import?resumeDraft=${d.id}${ctx}`
  }

  function statusText(d: DraftRow): string {
    if (d.kind === "ai") {
      if (d.jobStatus === "ready") return "Đã xử lý xong — chưa lưu"
      if (d.jobStatus === "failed") return `Thất bại${d.jobError ? `: ${d.jobError}` : ""}`
      if (d.jobStatus === "needs_solution_choice") return "Đang chờ bạn trả lời câu hỏi của AI"
      return `Đang xử lý (${d.jobProgress ?? 0}%)`
    }
    return "Chưa lưu"
  }

  return (
    <Card className="border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-red-700 dark:text-red-400">Bài nháp chưa lưu</CardTitle>
        <p className="text-sm text-red-600/90 dark:text-red-400/90">
          {classId
            ? "Việc nạp file bắt đầu từ lớp này nhưng chưa bấm Lưu — bấm Mở tiếp để sửa rồi lưu."
            : "Việc nạp file chưa bấm Lưu — bấm Mở tiếp để sửa rồi lưu."}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {drafts.map((d) => {
          const href = resumeHref(d)
          return (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-card px-4 py-3 dark:border-red-900"
            >
              <FileText className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{d.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(d.createdAt).toLocaleString("vi-VN")} · {statusText(d)}
                </p>
                <p className="text-xs font-medium text-red-600 dark:text-red-400">bài nháp chưa lưu</p>
              </div>
              {href ? (
                <Link href={href} className={buttonVariants({ size: "sm" })}>
                  Mở tiếp
                </Link>
              ) : null}
              <Button size="sm" variant="ghost" onClick={() => void dismiss(d.id)} aria-label="Bỏ việc này">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
