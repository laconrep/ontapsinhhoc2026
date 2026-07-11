"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, BookOpen, Library } from "lucide-react"

const items = [
  { href: "/teacher", label: "Tổng quan", icon: LayoutDashboard, exact: true },
  { href: "/teacher/classes", label: "Lớp học", icon: Users },
  { href: "/teacher/lessons", label: "Bài giảng", icon: BookOpen },
  { href: "/teacher/questions", label: "Ngân hàng câu hỏi", icon: Library },
]

export function TeacherNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1" aria-label="Điều hướng giáo viên">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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
