import { notFound } from "next/navigation"
import { getLessonDetail } from "@/app/actions/content"
import { LessonDetail } from "@/components/teacher/lesson-detail"

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getLessonDetail(id)
  if (!data) notFound()
  return <LessonDetail lesson={data.lesson} initialKnowledgePoints={data.knowledgePoints} />
}
