import { getLessonForStudy } from "@/app/actions/student-learn"
import { LessonStudy } from "@/components/student/lesson-study"
import { notFound } from "next/navigation"

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let data
  try {
    data = await getLessonForStudy(id)
  } catch {
    notFound()
  }

  return (
    <LessonStudy
      lessonId={id}
      lesson={data.lesson}
      knowledgePoints={data.knowledgePoints}
      savedAssessments={data.savedAssessments}
      stage={data.stage}
      skippedTab2={data.skippedTab2}
      quizQuestionCount={data.quizQuestionCount}
    />
  )
}
