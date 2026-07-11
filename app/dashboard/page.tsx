import { redirect } from "next/navigation"
import { requireUser } from "@/lib/auth-helpers"

/** Trang trung chuyển: điều hướng người dùng tới đúng khu vực theo vai trò. */
export default async function DashboardPage() {
  const user = await requireUser()
  if (!user.isOnboarded) redirect("/onboarding")
  redirect(user.role === "teacher" ? "/teacher" : "/student")
}
