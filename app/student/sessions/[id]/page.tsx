import { notFound, redirect } from "next/navigation"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { classStudents } from "@/lib/db/schema"
import { getSession } from "@/app/actions/sessions"
import { getCurrentUser } from "@/lib/auth-helpers"
import { StudentQuizView } from "@/components/live/student-quiz-view"

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

  return <StudentQuizView sessionId={session.id} />
}
