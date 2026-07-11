import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { db } from "@/lib/db"
import { classStudents } from "@/lib/db/schema"
import { getSession } from "@/app/actions/sessions"
import { getCurrentUser } from "@/lib/auth-helpers"
import { StudentQuizView } from "@/components/live/student-quiz-view"
import { buttonVariants } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const session = await getSession(id)
  if (!session) notFound()

  // Kiểm tra HS thuộc lớp của phiên
  const member = await db
    .select({ classId: classStudents.classId })
    .from(classStudents)
    .where(and(eq(classStudents.classId, session.classId), eq(classStudents.studentId, user.id)))
    .limit(1)
  if (member.length === 0) notFound()

  // Chỉ vào làm bài khi phiên đang diễn ra. Các trạng thái khác -> màn thông báo thân thiện.
  if (session.status !== "active") {
    const ended = session.status === "ended"
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <CalendarClock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-xl font-bold text-balance">
            {ended ? "Phiên trình chiếu đã kết thúc" : "Phiên chưa bắt đầu"}
          </h1>
          <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
            {ended
              ? "Giáo viên đã kết thúc phiên này. Em có thể tiếp tục tự học các bài trên lớp."
              : "Giáo viên chưa mở phiên trình chiếu. Vui lòng chờ giáo viên bắt đầu nhé."}
          </p>
        </div>
        <Link href="/student" className={buttonVariants({ variant: "outline" })}>
          Về trang chủ
        </Link>
      </div>
    )
  }

  return <StudentQuizView sessionId={session.id} />
}
