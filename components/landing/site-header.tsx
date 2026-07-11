import Link from "next/link"
import { Leaf } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="font-heading text-lg font-bold tracking-tight">EduSync</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="#features" className="transition-colors hover:text-foreground">
            Tính năng
          </Link>
          <Link href="#roles" className="transition-colors hover:text-foreground">
            Dành cho ai
          </Link>
          <Link href="#status" className="transition-colors hover:text-foreground">
            Tiến độ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Đăng nhập</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/sign-up">Bắt đầu</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
