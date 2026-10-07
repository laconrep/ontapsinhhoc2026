"use client"

import { useTransition } from "react"
import { completeOnboarding } from "@/app/actions/onboarding"
import { Button } from "@/components/ui/button"
import { GraduationCap, BookOpen } from "lucide-react"
import type { UserRole } from "@/types"

export function OnboardingForm({
  initialRole,
  name,
}: {
  initialRole: UserRole
  name: string
}) {
  const [pending, startTransition] = useTransition()
  const isTeacher = initialRole === "teacher"

  const handleContinue = () => {
    startTransition(async () => {
      await completeOnboarding(initialRole)
    })
  }

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
            Xin chào, {name}!
          </h1>
          <p className="mt-2 text-muted-foreground text-pretty leading-relaxed">
            Vai trò đã chọn lúc đăng ký. Bấm bắt đầu để vào không gian học tập.
          </p>
        </div>

        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            {isTeacher ? (
              <GraduationCap className="h-6 w-6" aria-hidden="true" />
            ) : (
              <BookOpen className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          <p className="mt-3 font-heading text-lg font-semibold text-foreground">
            {isTeacher ? "Giáo viên" : "Học sinh"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isTeacher
              ? "Tạo lớp, soạn bài giảng và theo dõi tiến độ học sinh."
              : "Tham gia lớp, ôn tập kiến thức và làm bài kiểm tra."}
          </p>
        </div>

        <Button
          className="mt-8 w-full"
          size="lg"
          onClick={handleContinue}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "Đang thiết lập..." : "Bắt đầu"}
        </Button>
      </div>
    </main>
  )
}
