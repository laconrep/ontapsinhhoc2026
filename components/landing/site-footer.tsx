import { Leaf } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Leaf className="size-3.5" aria-hidden="true" />
          </span>
          <span className="font-heading font-semibold text-foreground">EduSync</span>
        </div>
        <p>Ôn tập Sinh học thông minh cho lớp học hiện đại.</p>
      </div>
    </footer>
  )
}
