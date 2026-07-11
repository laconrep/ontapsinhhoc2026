"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GraduationCap, BookOpen, Sprout } from "lucide-react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("student")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSignUp = mode === "sign-up"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name, role })
      : await authClient.signIn.email({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message ?? "Đã có lỗi xảy ra, vui lòng thử lại")
      return
    }

    // Điều hướng theo trạng thái onboarding sẽ do trang gốc xử lý
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" />
          </span>
          <span className="font-heading text-xl font-bold text-foreground">EduSync</span>
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  />
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
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
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
