import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/auth-helpers"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = { title: "Đăng ký" }

export default async function SignUpPage() {
  const user = await getCurrentUser()
  if (user) redirect("/dashboard")
  return <AuthForm mode="sign-up" />
}
