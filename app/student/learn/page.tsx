import { getStudentLessons } from "@/app/actions/student-class"
import { LessonAccordion } from "@/components/student/lesson-accordion"
import { BookOpen } from "lucide-react"

export default async function StudentLearnPage() {
  const chapters = await getStudentLessons()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground text-balance">Học bài</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Chọn một bài để bắt đầu lộ trình 4 bước.
        </p>
      </div>

      {chapters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">
            Chưa có bài học nào. Hãy tham gia lớp hoặc chờ giáo viên xuất bản bài.
          </p>
        </div>
      ) : (
        <LessonAccordion chapters={chapters} />
      )}
    </div>
  )
}
