import { getChaptersWithLessons } from "@/app/actions/content"
import { LessonManager } from "@/components/teacher/lesson-manager"

export const dynamic = "force-dynamic"

export default async function TeacherLessonsPage() {
  const chapters = await getChaptersWithLessons()
  return <LessonManager initialChapters={chapters} />
}
