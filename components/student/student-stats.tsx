"use client"

import type { StudentStatsDto, BadgeType } from "@/types"
import { cn } from "@/lib/utils"
import { StatCard } from "@/components/shared/stat-card"
import { Flame, BookOpenCheck, Award, Trophy, Zap, Star, GraduationCap, Target } from "lucide-react"

const BADGE_META: Record<BadgeType, { label: string; icon: typeof Flame; description: string }> = {
  first_lesson: { label: "Khởi đầu", icon: Star, description: "Hoàn thành hoạt động học đầu tiên" },
  streak_3: { label: "3 ngày liên tục", icon: Flame, description: "Duy trì chuỗi học 3 ngày" },
  streak_7: { label: "7 ngày liên tục", icon: Flame, description: "Duy trì chuỗi học 7 ngày" },
  streak_30: { label: "30 ngày liên tục", icon: Trophy, description: "Duy trì chuỗi học 30 ngày" },
  perfect_quiz: { label: "Điểm tuyệt đối", icon: Target, description: "Đạt điểm tối đa một bài kiểm tra" },
  all_mastered_chapter: { label: "Thông thạo", icon: GraduationCap, description: "Nắm vững toàn bộ một bài học" },
  speed_demon: { label: "Thần tốc", icon: Zap, description: "Hoàn thành bài kiểm tra cực nhanh" },
}

const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

function dayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00")
  return DAY_LABELS[d.getDay()]
}

export function StudentStats({ stats }: { stats: StudentStatsDto }) {
  const maxActivity = Math.max(1, ...stats.weeklyProgress.map((w) => w.activityCount))

  return (
    <div className="flex flex-col gap-6">
      {/* Chỉ số tổng quan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="ngày liên tục"
          value={stats.streak}
          icon={<Flame className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          label="kiến thức đã ôn"
          value={stats.totalReviewed}
          icon={<BookOpenCheck className="h-5 w-5" aria-hidden="true" />}
        />
        <StatCard
          label="huy hiệu"
          value={stats.badges.length}
          icon={<Award className="h-5 w-5" aria-hidden="true" />}
        />
      </div>

      {/* Biểu đồ hoạt động tuần */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Hoạt động 7 ngày qua</h2>
        <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 140 }}>
          {stats.weeklyProgress.map((w) => {
            const heightPct = (w.activityCount / maxActivity) * 100
            return (
              <div key={w.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      w.activityCount > 0 ? "bg-primary" : "bg-secondary",
                    )}
                    style={{ height: `${Math.max(heightPct, w.activityCount > 0 ? 8 : 4)}%` }}
                    title={`${w.activityCount} hoạt động`}
                    aria-label={`${dayLabel(w.date)}: ${w.activityCount} hoạt động`}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{dayLabel(w.date)}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Huy hiệu */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Huy hiệu</h2>
        {stats.badges.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Chưa có huy hiệu. Hãy học đều đặn để mở khoá huy hiệu đầu tiên!
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.badges.map((b) => {
              const meta = BADGE_META[b.type]
              const Icon = meta.icon
              return (
                <div
                  key={b.id}
                  className="flex flex-col items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-center"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-semibold text-foreground text-balance">{meta.label}</p>
                  <p className="text-xs leading-tight text-muted-foreground text-pretty">{meta.description}</p>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Tiến độ theo bài */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Tiến độ theo bài học</h2>
        {stats.lessonProgress.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Chưa có bài học nào được ghi nhận tiến độ.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-4">
            {stats.lessonProgress.map((l) => (
              <li key={l.lessonId} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{l.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {l.masteredPercent}% thông thạo
                  </span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  {/* known (nền nhạt) */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary/40"
                    style={{ width: `${l.knownPercent}%` }}
                  />
                  {/* mastered (đậm) */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={{ width: `${l.masteredPercent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
