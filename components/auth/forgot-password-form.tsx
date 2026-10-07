"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/shared/logo"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setFieldError("Nhập email")
      return
    }
    setFieldError(null)
    setLoading(true)
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    })
    setLoading(false)
    if (error) {
      setError(error.message ?? "Không gửi được yêu cầu. Vui lòng thử lại.")
      return
    }
    setSent(true)
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <Logo size="md" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Quên mật khẩu
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              Nhập email để nhận liên kết đặt lại mật khẩu. Cần cấu hình gửi email trên máy chủ.
            </p>
          </div>
          {sent ? (
            <p className="text-sm leading-relaxed text-muted-foreground" role="status">
              Nếu email tồn tại, bạn sẽ nhận hướng dẫn đặt lại mật khẩu. Kiểm tra hộp thư (và thư rác).
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
                  aria-invalid={Boolean(fieldError)}
                  aria-describedby={fieldError ? "email-error" : undefined}
                />
                {fieldError ? (
                  <p id="email-error" className="text-sm text-destructive" role="alert">
                    {fieldError}
                  </p>
                ) : null}
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={loading} className="w-full" aria-busy={loading}>
                {loading ? "Đang gửi..." : "Gửi liên kết"}
              </Button>
            </form>
          )}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              Quay lại đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
