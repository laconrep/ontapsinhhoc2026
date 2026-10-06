"use client"

import { useMemo, useState } from "react"
import type { AssignmentStatRow, ClassOverviewStats, ClassStatsDto, StudentStatRow } from "@/types"
import { cn } from "@/lib/utils"
import { atRiskRowClass, formatActivityAt, studentStatusLabel } from "@/lib/class-stats-ui"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Brain,
  ClipboardList,
  LayoutDashboard,
  Minus,
  Users,
} from "lucide-react"

type Tab = "overview" | "students" | "knowledge"
type StudentSortKey = "name" | "progress" | "quizAvg" | "status"

function StatBar({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "primary" | "destructive" | "accent"
}) {
  const barColor =
    tone === "primary" ? "bg-primary" : tone === "destructive" ? "bg-destructive" : "bg-chart-2"
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  )
}

function TrendArrow({ trend }: { trend?: number }) {
  if (trend == null || trend === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
        0
      </span>
    )
  }
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-primary">
        <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
        {trend}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-destructive">
      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
      {trend}
    </span>
  )
}

function OverviewCards({ overview }: { overview: ClassOverviewStats }) {
  const cards = [
    { label: "Hoàn thành", value: `${overview.completionRate}%` },
    { label: "Nắm vững", value: `${overview.masteryRate}%` },
    { label: "Quiz TB", value: `${overview.avgQuiz}%` },
    { label: "Trung vị", value: `${overview.medianQuiz}%` },
    { label: "Cần chú ý", value: String(overview.atRiskCount) },
    { label: "Tuần này", value: String(overview.weeklyActivity) },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-border bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">{c.label}</p>
          <p className="mt-1 font-heading text-xl font-bold tabular-nums text-foreground">{c.value}</p>
        </div>
      ))}
    </div>
  )
}

function AssignmentCards({ rows }: { rows: AssignmentStatRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa giao bài nào cho lớp này.</p>
  }
  return (
    <ul className="flex flex-col gap-4">
      {rows.map((a) => (
        <li key={a.assignmentId} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground">{a.lessonTitle}</p>
              <p className="text-xs text-muted-foreground">{a.chapterTitle}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {a.completedCount}/{a.totalStudents} hoàn thành ({a.completionPercent}%)
            </p>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {a.distribution.map((d) => (
              <StatBar
                key={d.band}
                label={`${d.band}% (${d.count})`}
                value={a.totalStudents === 0 ? 0 : Math.round((d.count / a.totalStudents) * 100)}
                tone={d.band === "0-20" || d.band === "20-50" ? "destructive" : "primary"}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Điểm TB {a.avgScore}% · Cao nhất {a.bestScore}% · Đúng hạn {a.onTimeCount} · Trễ{" "}
            {a.lateCount} · Quá hạn {a.overdueCount}
            {a.weakKpIds.length > 0 ? ` · ${a.weakKpIds.length} KP yếu` : ""}
          </p>
        </li>
      ))}
    </ul>
  )
}

function StudentTable({ students }: { students: StudentStatRow[] }) {
  const [sortKey, setSortKey] = useState<StudentSortKey>("name")
  const [openId, setOpenId] = useState<string | null>(null)
  const ordered = useMemo(() => {
    const copy = [...students]
    copy.sort((a, b) => {
      if (sortKey === "progress") return (b.progress ?? 0) - (a.progress ?? 0)
      if (sortKey === "quizAvg") return (b.quizAvg ?? 0) - (a.quizAvg ?? 0)
      if (sortKey === "status") return studentStatusLabel(a.status).localeCompare(studentStatusLabel(b.status), "vi")
      return a.name.localeCompare(b.name, "vi")
    })
    return copy
  }, [students, sortKey])

  if (students.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Chưa có học sinh nào tham gia lớp này.</p>
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap gap-2">
        {([
          ["name", "Tên"],
          ["progress", "Tiến độ"],
          ["quizAvg", "Quiz TB"],
          ["status", "Trạng thái"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              sortKey === key ? "border-primary text-primary" : "border-border text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3 font-medium">Học sinh</th>
            <th className="pb-2 px-3 font-medium">Trạng thái</th>
            <th className="pb-2 px-3 font-medium">Tiến độ</th>
            <th className="pb-2 px-3 text-center font-medium">Quiz TB</th>
            <th className="pb-2 px-3 text-center font-medium">Trend</th>
            <th className="pb-2 px-3 text-center font-medium">Thông thạo</th>
            <th className="pb-2 px-3 text-center font-medium">Chưa vững</th>
            <th className="pb-2 px-3 text-center font-medium">Chủ quan</th>
            <th className="pb-2 px-3 text-center font-medium">KP yếu</th>
            <th className="pb-2 px-3 text-center font-medium">Streak</th>
            <th className="pb-2 pl-3 font-medium">Hoạt động</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((s) => (
            <tr
              key={s.studentId}
              className={cn("border-b border-border/60 last:border-0", atRiskRowClass(s.atRisk))}
            >
              <td className="py-3 pr-3 font-medium text-foreground">
                <button type="button" onClick={() => setOpenId((id) => (id === s.studentId ? null : s.studentId))}>
                  {s.name}
                  {s.atRisk ? (
                    <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-destructive" aria-label="Cần chú ý" />
                  ) : null}
                </button>
                {openId === s.studentId ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.weakKpCount ? `${s.weakKpCount} điểm kiến thức yếu` : "Không có KP yếu ghi nhận"}
                  </p>
                ) : null}
              </td>
              <td className="py-3 px-3 text-foreground">{studentStatusLabel(s.status)}</td>
              <td className="py-3 px-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{s.progress}%</span>
                </div>
              </td>
              <td className="py-3 px-3 text-center text-foreground">{s.quizAvg ?? 0}%</td>
              <td className="py-3 px-3 text-center">
                <TrendArrow trend={s.trend} />
              </td>
              <td className="py-3 px-3 text-center font-medium text-primary">{s.masteredCount}</td>
              <td className="py-3 px-3 text-center text-foreground">{s.unknownCount}</td>
              <td className="py-3 px-3 text-center text-foreground">{s.overconfidentCount}</td>
              <td className="py-3 px-3 text-center text-foreground">{s.weakKpCount ?? 0}</td>
              <td className="py-3 px-3 text-center text-foreground">{s.streak ?? 0}</td>
              <td className="py-3 pl-3 text-xs text-muted-foreground">{formatActivityAt(s.lastActivityAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ClassStatsPanel({ stats }: { stats: ClassStatsDto }) {
  const [tab, setTab] = useState<Tab>("overview")
  const overview = stats.overview ?? {
    completionRate: 0,
    masteryRate: 0,
    avgQuiz: 0,
    medianQuiz: 0,
    atRiskCount: 0,
    weeklyActivity: 0,
  }
  const assignments = stats.assignments ?? []
  const hasStudents = stats.students.length > 0
  const hasKp = stats.knowledgePoints.length > 0
  const empty = !hasStudents && !hasKp && assignments.length === 0

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <h2 className="font-heading text-lg font-bold text-foreground">Thống kê lớp học</h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Theo dõi tiến độ, điểm quiz và mức độ nắm vững từng điểm kiến thức.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border px-3 pt-3">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={cn(
            "flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "overview"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Tổng quan
        </button>
        <button
          type="button"
          onClick={() => setTab("students")}
          className={cn(
            "flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "students"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="h-4 w-4" aria-hidden="true" />
          Học sinh
        </button>
        <button
          type="button"
          onClick={() => setTab("knowledge")}
          className={cn(
            "flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "knowledge"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Brain className="h-4 w-4" aria-hidden="true" />
          Điểm kiến thức
        </button>
      </div>

      <div className="p-5">
        {empty ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chưa có dữ liệu thống kê cho lớp này.</p>
        ) : tab === "overview" ? (
          <div className="flex flex-col gap-6">
            <OverviewCards overview={overview} />
            <div>
               <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Theo bài giao
              </h3>
              <AssignmentCards rows={assignments} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-foreground">Theo học sinh</h3>
              <StudentTable students={stats.students} />
            </div>
          </div>
        ) : tab === "students" ? (
          <StudentTable students={stats.students} />
        ) : hasKp ? (
          <ul className="flex flex-col gap-4">
            {stats.knowledgePoints.map((k) => (
              <li key={k.kpId} className="flex flex-col gap-2">
                <p className="text-sm text-foreground line-clamp-2">
                  {k.content}
                  {k.hardFlag ? (
                    <span className="ml-2 inline-flex items-center rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                      Khó
                    </span>
                  ) : null}
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <StatBar label="Đã nắm" value={k.knownPercent} tone="primary" />
                  <StatBar label="Chủ quan sai" value={k.overconfidentPercent} tone="destructive" />
                  <StatBar label="Đã củng cố" value={k.reinforcedPercent} tone="accent" />
                  <StatBar label="Đúng lần đầu" value={k.firstTryPercent ?? 0} tone="primary" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có điểm kiến thức nào ở trạng thái sẵn sàng.
          </p>
        )}
      </div>
    </section>
  )
}
