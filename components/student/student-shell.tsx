"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { BookOpen } from "lucide-react"
import { StudentNav } from "@/components/student/student-nav"
import { SignOutButton } from "@/components/auth/sign-out-button"

export function StudentShell({
  userName,
  children,
}: {
  userName: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const liveSession = /^\/student\/sessions\//.test(pathname)

  if (liveSession) {
    return <>{children}</>
  }

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
              <p className="text-xs text-muted-foreground">{userName}</p>
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
