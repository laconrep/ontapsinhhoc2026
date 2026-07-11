import { Card, CardContent } from "@/components/ui/card"
import { Library } from "lucide-react"

export default function TeacherQuestionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Ngân hàng câu hỏi</h1>
        <p className="mt-1 text-muted-foreground">
          Tạo và quản lý câu hỏi luyện tập theo điểm kiến thức.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Library className="h-6 w-6 text-primary" />
          </span>
          <p className="font-medium text-foreground">Sắp ra mắt</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Chức năng ngân hàng câu hỏi sẽ được xây dựng ở bước tiếp theo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
