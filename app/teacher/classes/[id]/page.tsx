import { notFound } from "next/navigation"
import { getClassDetail } from "@/app/actions/classes"
import { ClassDetail } from "@/components/teacher/class-detail"

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  try {
    const cls = await getClassDetail(id)
    return <ClassDetail cls={cls} />
  } catch {
    notFound()
  }
}
