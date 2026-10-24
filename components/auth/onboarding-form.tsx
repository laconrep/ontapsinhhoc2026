"use client"

import { useState, useTransition } from "react"
import { completeOnboarding } from "@/app/actions/onboarding"
import { Button } from "@/components/ui/button"
import { GraduationCap, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

/**
 * Vai trò được chốt TẠI ĐÂY (đăng ký luôn tạo student). §23
 * (2026-10-24): chọn "Giáo viên" không cần mã mời nữa — cơ chế
 * SEC-01 đã bãi bỏ; server chỉ chốt vai trò (completeOnboarding).
 */
export function OnboardingForm({
  initialRole,
  name,
}: {
  initialRole: UserRole
  name: string
}) {
  const [role, setRole] = useState<UserRole>(initialRole)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isTeacher = role === "teacher"

  const handleContinue = () => {
    setError(null)
    startTransition(async () => {
      try {
        await completeOnboarding(role)
      } catch (e) {
        // redirect() của server action ném lỗi có digest NEXT_REDIRECT —
        // phải ném lại để Next điều hướng.
        if (
          e &&
          typeof e === "object" &&
          "digest" in e &&
          String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw e
        }
        setError(e instanceof Error ? e.message : "Có lỗi xảy ra, vui lòng thử lại")
      }
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
            Chọn vai trò của bạn để bắt đầu.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <RoleCard
            active={!isTeacher}
            onClick={() => setRole("student")}
            icon={<BookOpen className="h-6 w-6" aria-hidden="true" />}
            title="Học sinh"
            desc="Tham gia lớp, ôn tập kiến thức và làm bài kiểm tra."
          />
          <RoleCard
            active={isTeacher}
            onClick={() => setRole("teacher")}
            icon={<GraduationCap className="h-6 w-6" aria-hidden="true" />}
            title="Giáo viên"
            desc="Tạo lớp, soạn bài giảng và theo dõi tiến độ học sinh."
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

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
        "rounded-2xl border-2 p-5 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <p className="mt-3 font-heading text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </button>
  )
}
