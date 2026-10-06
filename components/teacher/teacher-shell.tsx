"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { TeacherNav } from "@/components/teacher/teacher-nav"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { cn } from "@/lib/utils"

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
  const [headerVisible, setHeaderVisible] = useState(true)
  const [canAutoHide, setCanAutoHide] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hovering = useRef(false)

  function clearHide() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  function revealHeader() {
    clearHide()
    setHeaderVisible(true)
  }

  function showHeader() {
    hovering.current = true
    revealHeader()
  }

  function scheduleHide(delay = 3000) {
    if (!canAutoHide) return
    clearHide()
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null
      if (!hovering.current) setHeaderVisible(false)
    }, delay)
  }

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)")
    setCanAutoHide(mq.matches)
    if (!mq.matches) return
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null
      if (!hovering.current) setHeaderVisible(false)
    }, 3000)
    return () => clearHide()
  }, [])

  if (presentTv || liveConsole) {
    return <>{children}</>
  }

  return (
    <div className="min-h-svh bg-background">
      <div
        className="fixed inset-x-0 top-0 z-40 hidden h-2 md:block"
        onMouseEnter={revealHeader}
        onMouseLeave={() => {
          if (!hovering.current) scheduleHide(400)
        }}
        aria-hidden="true"
      />

      <header
        onMouseEnter={showHeader}
        onMouseLeave={() => {
          hovering.current = false
          scheduleHide(400)
        }}
        className={cn(
          "fixed inset-x-0 top-0 z-30 hidden border-b border-border/50 bg-card/90 backdrop-blur-md md:block",
          "transition-transform duration-300 motion-reduce:transition-none",
          headerVisible ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <div className="flex items-center justify-between px-3 py-1">
          <p className="font-heading text-sm font-semibold leading-tight text-foreground">
            Quản lý ôn tập
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="border-b border-border bg-card/90 md:hidden">
        <div className="flex items-center justify-between px-3 py-1">
          <p className="font-heading text-sm font-semibold leading-tight text-foreground">
            Quản lý ôn tập
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{userName}</span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <div className="px-2 pb-2">
          <TeacherNav variant="mobile" />
        </div>
      </div>

      <div className="flex gap-3 px-2 py-4 md:pt-3">
        <aside className="hidden w-fit max-w-[12.5rem] shrink-0 md:block">
          <div className="sticky top-3">
            <TeacherNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
