"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { StudentNav } from "@/components/student/student-nav"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"

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
            <Logo size="sm" />
            <p className="text-xs text-muted-foreground">{userName}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</main>

      <StudentNav />
    </div>
  )
}
