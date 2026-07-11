import { notFound, redirect } from "next/navigation"
import { getSession, getSessionEvents } from "@/app/actions/sessions"
import { getCurrentUser } from "@/lib/auth-helpers"
import { SessionBoard } from "@/components/teacher/session-board"

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

  const events = await getSessionEvents(id)

  return (
    <SessionBoard
      sessionId={session.id}
      className={session.className}
      status={session.status}
      initialEvents={events}
    />
  )
}
