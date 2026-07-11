import { TrendingUp, TrendingDown, Minus, Repeat2, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LessonAttemptProgress } from "@/app/actions/student-stats"

export function QuizProgress({ items }: { items: LessonAttemptProgress[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center">
        <h2 className="font-heading text-base font-semibold text-foreground">Mức tiến bộ qua bài kiểm tra</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Chưa có lần làm bài kiểm tra nào. Hãy hoàn thành một bài học để theo dõi sự tiến bộ của em.
        </p>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold text-foreground">Mức tiến bộ qua bài kiểm tra</h2>
      <p className="-mt-1 text-sm text-muted-foreground leading-relaxed">
        Mỗi lần làm bài đều được lưu lại. So sánh điểm lần mới nhất với lần đầu để thấy sự tiến bộ.
      </p>

      <div className="flex flex-col gap-3">
        {items.map((it) => (
          <article key={it.lessonId} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{it.chapterTitle}</p>
                <h3 className="truncate font-heading text-sm font-bold text-foreground">{it.title}</h3>
              </div>
              <ImprovementBadge value={it.improvement} />
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <Stat label="Số lần" value={String(it.attempts)} icon={<Repeat2 className="h-3.5 w-3.5" />} />
              <Stat label="Lần đầu" value={it.firstScore.toFixed(1)} />
              <Stat label="Mới nhất" value={it.latestScore.toFixed(1)} highlight />
              <Stat label="Cao nhất" value={it.bestScore.toFixed(1)} icon={<Trophy className="h-3.5 w-3.5 text-primary" />} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  highlight,
  icon,
}: {
  label: string
  value: string
  highlight?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn("font-heading text-lg font-bold", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </span>
    </div>
  )
}

function ImprovementBadge({ value }: { value: number }) {
  if (value > 0) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
        <TrendingUp className="h-3.5 w-3.5" />+{value.toFixed(1)}
      </span>
    )
  }
  if (value < 0) {
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
        <TrendingDown className="h-3.5 w-3.5" />
        {value.toFixed(1)}
      </span>
    )
  }
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
      Giữ mức
    </span>
  )
}
