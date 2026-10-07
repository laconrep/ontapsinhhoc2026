import Link from "next/link"
import { Logo } from "@/components/shared/logo"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <Logo size="sm" />
        <p className="text-center text-pretty">Ôn tập Sinh học thông minh cho lớp học hiện đại.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href="mailto:hello@edusync.local" className="hover:text-foreground">
            Liên hệ
          </a>
          <Link href="/terms" className="hover:text-foreground">
            Điều khoản
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Chính sách
          </Link>
        </nav>
      </div>
    </footer>
  )
}
