import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/auth-helpers"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = { title: "Đăng nhập" }

export default async function SignInPage() {
  const user = await getCurrentUser()
  if (user) redirect("/dashboard")
  return <AuthForm mode="sign-in" />
}
