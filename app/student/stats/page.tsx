import { getStudentStats } from "@/app/actions/student-stats"
import { StudentStats } from "@/components/student/student-stats"

export const dynamic = "force-dynamic"

export default async function StudentStatsPage() {
  const stats = await getStudentStats()
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground text-balance">Tiến độ học tập</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Chuỗi ngày học, hoạt động tuần qua, huy hiệu và tiến độ từng bài.
        </p>
      </div>
      <StudentStats stats={stats} />
    </div>
  )
}
