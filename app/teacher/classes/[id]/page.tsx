import { notFound } from "next/navigation"
import { getClassDetail } from "@/app/actions/classes"
import { getClassStats } from "@/app/actions/class-stats"
import { getActiveSessionForClass } from "@/app/actions/sessions"
import { ClassDetail } from "@/components/teacher/class-detail"
import { ClassStatsPanel } from "@/components/teacher/class-stats-panel"
import { SessionControl } from "@/components/teacher/session-control"

export const dynamic = "force-dynamic"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    const [cls, stats, activeSession] = await Promise.all([
      getClassDetail(id),
      getClassStats(id),
      getActiveSessionForClass(id),
    ])
    return (
      <div className="flex flex-col gap-8">
        <ClassDetail cls={cls} />
        <SessionControl classId={cls.id} activeSession={activeSession} />
        <ClassStatsPanel stats={stats} />
      </div>
    )
  } catch {
    notFound()
  }
}
