import Link from "next/link"
import { ClipboardList } from "lucide-react"
import type { AssignedLessonDto } from "@/types"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatDueAt as formatDueAtTz } from "@/lib/format-date"

const STATUS_LABEL: Record<AssignedLessonDto["studentStatus"], string> = {
  not_started: "Chưa làm",
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  overdue: "Quá hạn",
}

const STATUS_CLASS: Record<AssignedLessonDto["studentStatus"], string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  completed: "bg-primary/15 text-primary",
  overdue: "bg-destructive/15 text-destructive",
}

const NEED_WORK = new Set<AssignedLessonDto["studentStatus"]>([
  "not_started",
  "in_progress",
  "overdue",
])

const STATUS_RANK: Record<AssignedLessonDto["studentStatus"], number> = {
  overdue: 0,
  in_progress: 1,
  not_started: 2,
  completed: 9,
}

export function assignmentStatusMeta(status: AssignedLessonDto["studentStatus"]) {
  return { label: STATUS_LABEL[status], className: STATUS_CLASS[status] }
}

export function formatDueAt(dueAt: string | null): string | null {
  return formatDueAtTz(dueAt)
}

function sortNeedWork(a: AssignedLessonDto, b: AssignedLessonDto) {
  const ra = STATUS_RANK[a.studentStatus]
  const rb = STATUS_RANK[b.studentStatus]
  if (ra !== rb) return ra - rb
  const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
  const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
  return da - db
}

export function AssignedWork({ items }: { items: AssignedLessonDto[] }) {
  const todo = items.filter((i) => NEED_WORK.has(i.studentStatus)).sort(sortNeedWork)
  if (todo.length === 0) return null

  return (
    <section aria-labelledby="assigned-work-heading" className="flex flex-col gap-3">
      <h2 id="assigned-work-heading" className="font-heading text-sm font-semibold text-foreground">
        Bài cần làm
      </h2>
      <ul className="flex flex-col gap-2">
        {todo.map((item) => {
          const status = assignmentStatusMeta(item.studentStatus)
          const due = formatDueAt(item.dueAt)
          return (
            <li key={item.lessonId}>
              <Link
                href={`/student/learn/${item.lessonId}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary",
                  item.studentStatus === "overdue" ? "border-destructive/40" : "border-border",
                )}
              >
                <ClipboardList
                  className={cn(
                    "h-4 w-4 shrink-0",
                    item.studentStatus === "overdue" ? "text-destructive" : "text-primary",
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-sm font-semibold text-foreground">{item.lessonTitle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.chapterTitle}
                    {due ? ` · Hạn ${due}` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className={status.className}>
                  {status.label}
                </Badge>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
