import { notFound, redirect } from "next/navigation"
import { getSession } from "@/app/actions/sessions"
import { getCurrentUser } from "@/lib/auth-helpers"
import { PresentView } from "@/components/live/present-view"

export const dynamic = "force-dynamic"

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect("/sign-in")

  const session = await getSession(id)
  if (!session || session.teacherId !== user.id) notFound()

  return <PresentView sessionId={session.id} />
}
