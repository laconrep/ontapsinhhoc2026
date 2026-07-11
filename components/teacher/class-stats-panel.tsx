"use client"

import { useState } from "react"
import type { ClassStatsDto } from "@/types"
import { cn } from "@/lib/utils"
import { Users, Brain, AlertTriangle } from "lucide-react"

type Tab = "students" | "knowledge"

export function ClassStatsPanel({ stats }: { stats: ClassStatsDto }) {
  const [tab, setTab] = useState<Tab>("students")

  const hasStudents = stats.students.length > 0
  const hasKp = stats.knowledgePoints.length > 0

  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-5">
        <h2 className="font-heading text-lg font-bold text-foreground">Thống kê lớp học</h2>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Theo dõi tiến độ từng học sinh và mức độ nắm vững từng điểm kiến thức.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-3 pt-3">
        <button
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
        {tab === "students" &&
          (hasStudents ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Học sinh</th>
                    <th className="pb-2 px-3 font-medium">Tiến độ</th>
                    <th className="pb-2 px-3 text-center font-medium">Đã biết</th>
                    <th className="pb-2 px-3 text-center font-medium">Thông thạo</th>
                    <th className="pb-2 px-3 text-center font-medium">Chưa vững</th>
                    <th className="pb-2 pl-3 text-center font-medium">
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                        Chủ quan
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.students.map((s) => (
                    <tr key={s.studentId} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-3 font-medium text-foreground">{s.name}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${s.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{s.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center text-foreground">{s.knownCount}</td>
                      <td className="py-3 px-3 text-center font-medium text-primary">{s.masteredCount}</td>
                      <td className="py-3 px-3 text-center text-foreground">{s.unknownCount}</td>
                      <td className="py-3 pl-3 text-center">
                        {s.overconfidentCount > 0 ? (
                          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                            {s.overconfidentCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có học sinh nào tham gia lớp này.
            </p>
          ))}

        {tab === "knowledge" &&
          (hasKp ? (
            <ul className="flex flex-col gap-4">
              {stats.knowledgePoints.map((k) => (
                <li key={k.kpId} className="flex flex-col gap-2">
                  <p className="text-sm text-foreground line-clamp-2">{k.content}</p>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <StatBar label="Đã nắm" value={k.knownPercent} tone="primary" />
                    <StatBar label="Chủ quan sai" value={k.overconfidentPercent} tone="destructive" />
                    <StatBar label="Đã củng cố" value={k.reinforcedPercent} tone="accent" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Chưa có điểm kiến thức nào ở trạng thái sẵn sàng.
            </p>
          ))}
      </div>
    </section>
  )
}

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
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
