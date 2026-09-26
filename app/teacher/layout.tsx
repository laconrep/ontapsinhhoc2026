import type React from "react"
import { requireRole } from "@/lib/auth-helpers"
import { TeacherShell } from "@/components/teacher/teacher-shell"

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole("teacher")

  return <TeacherShell userName={user.name}>{children}</TeacherShell>
}
