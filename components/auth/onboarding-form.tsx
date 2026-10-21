"use client"

import { useState, useTransition } from "react"
import { completeOnboarding } from "@/app/actions/onboarding"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

/**
 * SEC-01: vai trò được chốt TẠI ĐÂY (đăng ký luôn tạo student). Chọn
 * "Giáo viên" thì phải nhập mã mời giáo viên do quản trị viên cấp;
 * server kiểm tra lại mã (completeOnboarding) — client không tự cấp quyền.
 */
export function OnboardingForm({
  initialRole,
  name,
}: {
  initialRole: UserRole
  name: string
}) {
  const [role, setRole] = useState<UserRole>(initialRole)
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const isTeacher = role === "teacher"

  const handleContinue = () => {
    setError(null)
    startTransition(async () => {
      try {
        await completeOnboarding(role, isTeacher ? inviteCode : undefined)
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
            Chọn vai trò của bạn để bắt đầu. Giáo viên cần mã mời do quản trị
            viên cấp.
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

        {isTeacher && (
          <div className="mt-5 flex flex-col gap-2">
            <Label htmlFor="teacher-invite-code">Mã mời giáo viên</Label>
            <Input
              id="teacher-invite-code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Nhập mã mời được cấp"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Chưa có mã mời? Hãy liên hệ quản trị viên, hoặc tiếp tục với vai
              trò học sinh.
            </p>
          </div>
        )}

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
