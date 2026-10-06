import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center">
          <Logo size="md" />
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#how" className="transition-colors hover:text-foreground">
            Cách hoạt động
          </Link>
          <Link href="#features" className="transition-colors hover:text-foreground">
            Tính năng
          </Link>
          <Link href="#roles" className="transition-colors hover:text-foreground">
            Dành cho ai
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/sign-in" />}>
            Đăng nhập
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/sign-up" />}>
            Bắt đầu
          </Button>
        </div>
      </div>
    </header>
  )
}
