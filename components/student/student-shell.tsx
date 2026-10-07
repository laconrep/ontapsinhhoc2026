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
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Bỏ qua tới nội dung
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 md:max-w-3xl lg:max-w-5xl">
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

      <div className="mx-auto flex max-w-md gap-4 px-4 pb-24 pt-4 md:max-w-3xl lg:max-w-5xl lg:pb-8">
        <aside className="hidden w-48 shrink-0 lg:block">
          <div className="sticky top-20">
            <StudentNav variant="sidebar" />
          </div>
        </aside>
        <main id="noi-dung" className="min-w-0 flex-1">{children}</main>
      </div>

      <div className="lg:hidden">
        <StudentNav />
      </div>
    </div>
  )
}
