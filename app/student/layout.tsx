import type React from "react"
import { requireRole } from "@/lib/auth-helpers"
import { StudentNav } from "@/components/student/student-nav"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { BookOpen } from "lucide-react"

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("student")

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="font-heading text-sm font-bold text-foreground">EduSync</p>
              <p className="text-xs text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</main>

      <StudentNav />
    </div>
  )
}
