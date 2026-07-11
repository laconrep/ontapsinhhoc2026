import { requireRole } from "@/lib/auth-helpers"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { BookOpen } from "lucide-react"

export default async function StudentHomePage() {
  const user = await requireRole("student")

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading font-bold leading-tight text-foreground">EduSync</p>
              <p className="text-xs text-muted-foreground">Khu vực học sinh</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-heading text-2xl font-bold text-foreground text-balance">
          Chào bạn, {user.name}
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground leading-relaxed text-pretty">
          Xác thực và phân quyền đã hoạt động. Chức năng tham gia lớp, ôn tập bài học và làm bài
          kiểm tra sẽ được xây dựng ở các bước tiếp theo (B6–B7).
        </p>
      </main>
    </div>
  )
}
