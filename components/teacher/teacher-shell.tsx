"use client"

import { useTransition, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Leaf, LogOut, Moon, Sun, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { TeacherNav } from "@/components/teacher/teacher-nav"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"

function isLiveConsolePath(pathname: string) {
  return /^\/teacher\/sessions\/[^/]+\/?$/.test(pathname)
}

function isPresentTvPath(pathname: string) {
  return /^\/teacher\/sessions\/[^/]+\/present\/?$/.test(pathname)
}

function UserMenu({ userName }: { userName: string }) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [pending, startTransition] = useTransition()
  const dark = resolvedTheme === "dark"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted md:h-9"
        aria-label="Tài khoản"
      >
        <UserRound className="h-4 w-4" aria-hidden="true" />
        <span className="hidden max-w-[10rem] truncate sm:inline">{userName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{userName}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(dark ? "light" : "dark")}>
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Giao diện sáng" : "Giao diện tối"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await authClient.signOut()
              router.push("/sign-in")
              router.refresh()
            })
          }}
        >
          <LogOut className="h-4 w-4" />
          {pending ? "Đang thoát..." : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
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
      <header className="sticky top-0 z-30 border-b border-border/50 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 md:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold leading-tight text-foreground">EduSync</p>
          </div>
          <UserMenu userName={userName} />
        </div>
      </header>

      <div className="border-b border-border bg-card/90 md:hidden">
        <div className="px-2 py-2">
          <TeacherNav variant="mobile" />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-3 px-4 py-4 md:px-6">
        <aside className="hidden w-fit max-w-[12.5rem] shrink-0 md:block">
          <div className="sticky top-16">
            <TeacherNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
