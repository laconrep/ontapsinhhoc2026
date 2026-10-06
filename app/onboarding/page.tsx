import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { requireUser } from "@/lib/auth-helpers"
import { OnboardingForm } from "@/components/auth/onboarding-form"

export const metadata: Metadata = { title: "Thiết lập tài khoản" }

export default async function OnboardingPage() {
  const user = await requireUser()
  if (user.isOnboarded) redirect("/dashboard")
  return <OnboardingForm initialRole={user.role} name={user.name} />
}
