import { notFound, redirect } from "next/navigation"
import { getSession } from "@/app/actions/sessions"
import { getCurrentUser } from "@/lib/auth-helpers"
import { TeacherConsole } from "@/components/live/teacher-console"

export const dynamic = "force-dynamic"

export default async function SessionBoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const session = await getSession(id)
  if (!session || session.teacherId !== user.id) notFound()

  return <TeacherConsole sessionId={session.id} />
}
