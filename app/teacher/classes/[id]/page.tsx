import { getClassDetail } from "@/app/actions/classes"
import { getClassStats } from "@/app/actions/class-stats"
import { getActiveSessionForClass } from "@/app/actions/sessions"
import { getDraftSessions } from "@/app/actions/live-quiz"
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
  
  // Get class (required)
  const cls = await getClassDetail(id)
  
  // Get optional data with fallbacks
  let stats = { totalStudents: 0, averageScore: 0, completedQuizzes: 0 }
  let activeSession = null
  let drafts: any[] = []
  
  try {
    stats = await getClassStats(id)
  } catch (err) {
    console.error("[v0] getClassStats error:", err)
  }
  
  try {
    activeSession = await getActiveSessionForClass(id)
  } catch (err) {
    console.error("[v0] getActiveSessionForClass error:", err)
  }
  
  try {
    drafts = await getDraftSessions(id)
  } catch (err) {
    console.error("[v0] getDraftSessions error:", err)
  }
  
  return (
    <div className="flex flex-col gap-8">
      <ClassDetail cls={cls} />
      <SessionControl classId={cls.id} activeSession={activeSession} drafts={drafts} />
      <ClassStatsPanel stats={stats} />
    </div>
  )
}
