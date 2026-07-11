import { notFound } from "next/navigation"
import { getClassDetail } from "@/app/actions/classes"
import { getClassStats } from "@/app/actions/class-stats"
import { ClassDetail } from "@/components/teacher/class-detail"
import { ClassStatsPanel } from "@/components/teacher/class-stats-panel"

export const dynamic = "force-dynamic"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    const [cls, stats] = await Promise.all([getClassDetail(id), getClassStats(id)])
    return (
      <div className="flex flex-col gap-8">
        <ClassDetail cls={cls} />
        <ClassStatsPanel stats={stats} />
      </div>
    )
  } catch {
    notFound()
  }
}
