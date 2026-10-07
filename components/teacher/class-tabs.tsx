"use client"

import { useMemo, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Thông tin lớp", icon: LayoutDashboard },
  { id: "assignments", label: "Bài tập đã giao", icon: BookMarked },
  { id: "stats", label: "Thống kê", icon: BarChart3 },
]

function parseTab(value: string | null): Tab {
  if (value === "assignments" || value === "stats" || value === "overview") return value
  return "overview"
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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = useMemo(() => parseTab(searchParams.get("tab")), [searchParams])

  function setTab(next: Tab) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === "overview") params.delete("tab")
    else params.set("tab", next)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Mục lớp học">
        {TABS.map((item) => {
          const Icon = item.icon
          const selected = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`class-tab-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
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

      <div role="tabpanel" aria-labelledby={`class-tab-${tab}`}>
        {tab === "overview" ? <ClassDetail cls={cls} hero={overviewExtra} /> : null}
        {tab === "assignments" ? <ClassAssignments classId={cls.id} initial={assignments} /> : null}
        {tab === "stats" ? <ClassStatsPanel stats={stats} /> : null}
      </div>
    </div>
  )
}
