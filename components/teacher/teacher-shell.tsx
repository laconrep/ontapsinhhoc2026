"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { GraduationCap } from "lucide-react"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { TeacherNav } from "@/components/teacher/teacher-nav"
import { cn } from "@/lib/utils"

const LEFT_REVEAL_MS = 1500

function isLiveConsolePath(pathname: string) {
  return /^\/teacher\/sessions\/[^/]+$/.test(pathname)
}

function isPresentTvPath(pathname: string) {
  return /^\/teacher\/sessions\/[^/]+\/present$/.test(pathname)
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

  const [headerOpen, setHeaderOpen] = useState(false)
  const [leftOpen, setLeftOpen] = useState(false)
  const leftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (leftTimer.current) clearTimeout(leftTimer.current)
    }
  }, [])

  function clearLeftTimer() {
    if (leftTimer.current) {
      clearTimeout(leftTimer.current)
      leftTimer.current = null
    }
  }

  function onLeftEnter() {
    clearLeftTimer()
    leftTimer.current = setTimeout(() => setLeftOpen(true), LEFT_REVEAL_MS)
  }

  function onLeftLeave() {
    clearLeftTimer()
    setLeftOpen(false)
  }

  if (presentTv) {
    return <div className="h-svh overflow-hidden bg-background">{children}</div>
  }

  if (liveConsole) {
    return (
      <div className="relative h-svh overflow-hidden bg-background">
        <div
          className="fixed inset-x-0 top-0 z-[60]"
          onMouseEnter={() => setHeaderOpen(true)}
          onMouseLeave={() => setHeaderOpen(false)}
        >
          <div className="h-2 w-full bg-foreground/15" />
          <header
            className={cn(
              "overflow-hidden border-b border-white/10 bg-background/10 backdrop-blur-[1px] transition-[max-height,opacity] duration-200",
              headerOpen ? "max-h-10 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="flex h-8 items-center justify-between px-3">
              <div className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/80 text-primary-foreground">
                  <GraduationCap className="h-3.5 w-3.5" />
                </span>
                <p className="font-heading text-sm font-bold leading-none text-foreground">EduSync</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline">{userName}</span>
                <SignOutButton />
              </div>
            </div>
          </header>
        </div>

        <div
          className={cn("fixed top-0 left-0 z-[50] h-full", leftOpen ? "w-40" : "w-2.5")}
          onMouseEnter={onLeftEnter}
          onMouseLeave={onLeftLeave}
        >
          <div className="absolute inset-y-0 left-0 w-0.5 bg-primary/25" />
          <aside
            className={cn(
              "absolute inset-y-0 left-0 w-40 border-r border-border/50 bg-card/95 shadow-lg transition-transform duration-200",
              leftOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <div className="flex h-full flex-col gap-2 overflow-y-auto px-2 pt-12 pb-3">
              <p className="px-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Menu
              </p>
              <TeacherNav />
            </div>
          </aside>
        </div>

        <main className="h-full min-w-0">{children}</main>
      </div>
    )
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
