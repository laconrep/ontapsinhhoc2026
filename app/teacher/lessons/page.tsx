import { Card, CardContent } from "@/components/ui/card"
import { BookOpen } from "lucide-react"

export default function TeacherLessonsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Bài giảng</h1>
        <p className="mt-1 text-muted-foreground">
          Quản lý chương, bài giảng và điểm kiến thức.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <BookOpen className="h-6 w-6 text-primary" />
          </span>
          <p className="font-medium text-foreground">Sắp ra mắt</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Chức năng quản lý bài giảng và điểm kiến thức sẽ được xây dựng ở bước tiếp theo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
