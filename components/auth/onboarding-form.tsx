"use client"

import { useState, useTransition } from "react"
import { completeOnboarding } from "@/app/actions/onboarding"
import { Button } from "@/components/ui/button"
import { GraduationCap, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

export function OnboardingForm({
  initialRole,
  name,
}: {
  initialRole: UserRole
  name: string
}) {
  const [role, setRole] = useState<UserRole>(initialRole)
  const [pending, startTransition] = useTransition()

  const handleContinue = () => {
    startTransition(async () => {
      await completeOnboarding(role)
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
            Xác nhận vai trò của bạn để chúng tôi thiết lập không gian học tập phù hợp.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            active={role === "student"}
            onClick={() => setRole("student")}
            icon={<BookOpen className="h-6 w-6" />}
            title="Học sinh"
            desc="Tham gia lớp, ôn tập kiến thức và làm bài kiểm tra."
          />
          <RoleCard
            active={role === "teacher"}
            onClick={() => setRole("teacher")}
            icon={<GraduationCap className="h-6 w-6" />}
            title="Giáo viên"
            desc="Tạo lớp, soạn bài giảng và theo dõi tiến độ học sinh."
          />
        </div>

        <Button
          className="mt-8 w-full"
          size="lg"
          onClick={handleContinue}
          disabled={pending}
        >
          {pending ? "Đang thiết lập..." : "Bắt đầu"}
        </Button>
      </div>
    </main>
  )
}

function RoleCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        )}
      >
        {icon}
      </span>
      <span className="font-heading text-lg font-semibold text-foreground">{title}</span>
      <span className="text-sm leading-relaxed text-muted-foreground">{desc}</span>
    </button>
  )
}
