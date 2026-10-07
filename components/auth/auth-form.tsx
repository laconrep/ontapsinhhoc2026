"use client"

import type React from "react"
import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, GraduationCap, BookOpen } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/logo"
import type { UserRole } from "@/types"

function passwordStrength(password: string): { score: number; label: string } {
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (score <= 1) return { score, label: "Yếu" }
  if (score <= 3) return { score, label: "Trung bình" }
  return { score, label: "Mạnh" }
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("student")
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const isSignUp = mode === "sign-up"
  const strength = useMemo(() => (isSignUp ? passwordStrength(password) : null), [isSignUp, password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const next: { email?: string; password?: string; name?: string } = {}
    if (!email.trim()) next.email = "Nhập email"
    if (isSignUp && !name.trim()) next.name = "Nhập họ và tên"
    if (!password) {
      next.password = "Nhập mật khẩu"
    } else if (isSignUp && password.length < 8) {
      next.password = "Mật khẩu tối thiểu 8 ký tự"
    }
    setFieldErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)

    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name, role })
      : await authClient.signIn.email({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message ?? "Đã có lỗi xảy ra, vui lòng thử lại")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <Logo size="md" />
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground text-balance">
              {isSignUp ? "Tạo tài khoản EduSync" : "Chào mừng trở lại"}
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              {isSignUp
                ? "Đăng ký để bắt đầu hành trình ôn tập Sinh học"
                : "Đăng nhập để tiếp tục ôn tập"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {isSignUp && (
              <>
                <div className="flex flex-col gap-2">
                  <Label>Bạn là</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <RoleOption
                      active={role === "student"}
                      onClick={() => setRole("student")}
                      icon={<BookOpen className="h-5 w-5" />}
                      label="Học sinh"
                    />
                    <RoleOption
                      active={role === "teacher"}
                      onClick={() => setRole("teacher")}
                      icon={<GraduationCap className="h-5 w-5" />}
                      label="Giáo viên"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Họ và tên</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Nguyễn Văn A"
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={fieldErrors.name ? "name-error" : undefined}
                  />
                  {fieldErrors.name ? (
                    <p id="name-error" className="text-sm text-destructive" role="alert">
                      {fieldErrors.name}
                    </p>
                  ) : null}
                </div>
              </>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="ban@example.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
              />
              {fieldErrors.email ? (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Mật khẩu</Label>
                {!isSignUp ? (
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignUp ? 8 : 6}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder={isSignUp ? "Tối thiểu 8 ký tự" : "Mật khẩu"}
                  className="pr-11"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password
                      ? "password-error"
                      : isSignUp && password
                        ? "password-strength"
                        : undefined
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="text-sm text-destructive" role="alert">
                  {fieldErrors.password}
                </p>
              ) : null}
              {isSignUp && password && !fieldErrors.password && strength ? (
                <p id="password-strength" className="text-xs text-muted-foreground">
                  Độ mạnh: {strength.label}
                </p>
              ) : null}
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full" aria-busy={loading}>
              {loading ? "Đang xử lý..." : isSignUp ? "Tạo tài khoản" : "Đăng nhập"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <Link
              href={isSignUp ? "/sign-in" : "/sign-up"}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {isSignUp ? "Đăng nhập" : "Đăng ký ngay"}
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

function RoleOption({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-primary/40",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
