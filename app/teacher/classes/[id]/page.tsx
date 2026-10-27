import { getClassDetail } from "@/app/actions/classes"
import { getActiveSessionForClass } from "@/app/actions/sessions"
import { getDraftSessions } from "@/app/actions/live-quiz"
import { getClassAssignments } from "@/app/actions/assignments"
import { Suspense } from "react"
import { ClassTabs } from "@/components/teacher/class-tabs"
import { SessionControl } from "@/components/teacher/session-control"
import type { ClassAssignmentDto } from "@/types"

export const dynamic = "force-dynamic"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const cls = await getClassDetail(id)

  let activeSession = null
  let drafts: Awaited<ReturnType<typeof getDraftSessions>> = []
  let assignments: ClassAssignmentDto[] = []

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
    <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải lớp…</p>}>
      <ClassTabs
        cls={cls}
        assignments={assignments}
        overviewExtra={
          <SessionControl classId={cls.id} activeSession={activeSession} drafts={drafts} />
        }
      />
    </Suspense>
  )
}
