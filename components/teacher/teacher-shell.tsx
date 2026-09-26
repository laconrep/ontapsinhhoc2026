"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { TeacherNav } from "@/components/teacher/teacher-nav"

function isLiveConsolePath(pathname: string) {
  return /^\/teacher\/sessions\/[^/]+\/?$/.test(pathname)
}

function isPresentTvPath(pathname: string) {
  return /^\/teacher\/sessions\/[^/]+\/present\/?$/.test(pathname)
}

export function TeacherShell({
  userName,
  children,
}: {
  userName: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const presentTv = isPresentTvPath(pathname)
  const liveConsole = isLiveConsolePath(pathname)

  if (presentTv || liveConsole) {
    return <>{children}</>
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading font-bold leading-tight text-foreground">EduSync</p>
              <p className="text-xs text-muted-foreground">Khu vực giáo viên</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-card px-4 py-2 md:hidden">
        <TeacherNav variant="mobile" />
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20">
            <TeacherNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
