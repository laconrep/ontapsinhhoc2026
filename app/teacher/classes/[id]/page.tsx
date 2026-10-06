import { getClassDetail } from "@/app/actions/classes"
import { getClassStats } from "@/app/actions/class-stats"
import { getActiveSessionForClass } from "@/app/actions/sessions"
import { getDraftSessions } from "@/app/actions/live-quiz"
import { getClassAssignments } from "@/app/actions/assignments"
import { ClassTabs } from "@/components/teacher/class-tabs"
import { SessionControl } from "@/components/teacher/session-control"
import { emptyClassStats } from "@/lib/class-stats-calc"
import type { ClassAssignmentDto, ClassStatsDto } from "@/types"

export const dynamic = "force-dynamic"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cls = await getClassDetail(id)

  let stats: ClassStatsDto = emptyClassStats()
  let activeSession = null
  let drafts: Awaited<ReturnType<typeof getDraftSessions>> = []
  let assignments: ClassAssignmentDto[] = []

  try {
    stats = await getClassStats(id)
  } catch (err) {
    console.error("getClassStats error:", err)
  }

  try {
    activeSession = await getActiveSessionForClass(id)
  } catch (err) {
    console.error("getActiveSessionForClass error:", err)
  }

  try {
    drafts = await getDraftSessions(id)
  } catch (err) {
    console.error("getDraftSessions error:", err)
  }

  try {
    assignments = await getClassAssignments(id)
  } catch (err) {
    console.error("getClassAssignments error:", err)
  }

  return (
    <ClassTabs
      cls={cls}
      assignments={assignments}
      stats={stats}
      overviewExtra={
        <SessionControl classId={cls.id} activeSession={activeSession} drafts={drafts} />
      }
    />
  )
}
