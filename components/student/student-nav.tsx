"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, BookOpen, BarChart3 } from "lucide-react"

const items = [
  { href: "/student", label: "Trang chủ", icon: Home, exact: true },
  { href: "/student/learn", label: "Học bài", icon: BookOpen },
  { href: "/student/stats", label: "Tiến độ", icon: BarChart3 },
]

export function StudentNav({ variant = "bottom" }: { variant?: "bottom" | "sidebar" }) {
  const pathname = usePathname()

  if (variant === "sidebar") {
    return (
      <nav className="flex flex-col gap-1" aria-label="Điều hướng học sinh">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]"
      aria-label="Điều hướng học sinh"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around md:max-w-3xl">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
