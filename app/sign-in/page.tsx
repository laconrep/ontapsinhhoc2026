import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-helpers"
import { AuthForm } from "@/components/auth/auth-form"

export default async function SignInPage() {
  const user = await getCurrentUser()
  if (user) redirect("/dashboard")
  return <AuthForm mode="sign-in" />
}
