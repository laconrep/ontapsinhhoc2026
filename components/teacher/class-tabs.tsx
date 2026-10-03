"use client"

import { useState, type ReactNode } from "react"
import type { ClassAssignmentDto, ClassStatsDto } from "@/types"
import { ClassDetail } from "@/components/teacher/class-detail"
import { ClassAssignments } from "@/components/teacher/class-assignments"
import { ClassStatsPanel } from "@/components/teacher/class-stats-panel"
import { cn } from "@/lib/utils"
import { BarChart3, BookMarked, LayoutDashboard } from "lucide-react"

type Tab = "overview" | "assignments" | "stats"

type ClassDetailData = {
  id: string
  name: string
  subject: string
  inviteCode: string
  schoolYear: string
  students: { id: string; name: string; email: string; joinedAt: Date | string }[]
}

export function ClassTabs({
  cls,
  assignments,
  stats,
  overviewExtra,
}: {
  cls: ClassDetailData
  assignments: ClassAssignmentDto[]
  stats: ClassStatsDto
  overviewExtra?: ReactNode
}) {
  const [tab, setTab] = useState<Tab>("overview")

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Thông tin lớp", icon: LayoutDashboard },
    { id: "assignments", label: "Bài tập đã giao", icon: BookMarked },
    { id: "stats", label: "Thống kê", icon: BarChart3 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
                tab === item.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" ? <ClassDetail cls={cls} hero={overviewExtra} /> : null}
      {tab === "assignments" ? <ClassAssignments classId={cls.id} initial={assignments} /> : null}
      {tab === "stats" ? <ClassStatsPanel stats={stats} /> : null}
    </div>
  )
}
