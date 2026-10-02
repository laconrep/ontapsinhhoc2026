import type React from "react"
import { requireRole } from "@/lib/auth-helpers"
import { StudentShell } from "@/components/student/student-shell"

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("student")
  return <StudentShell userName={user.name}>{children}</StudentShell>
}
