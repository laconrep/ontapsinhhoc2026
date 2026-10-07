import { Suspense } from "react"
import type { Metadata } from "next"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { PageSkeleton } from "@/components/shared/page-skeleton"

export const metadata: Metadata = { title: "Đặt lại mật khẩu" }

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
