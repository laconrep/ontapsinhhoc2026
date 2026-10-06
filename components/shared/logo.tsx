import { Leaf } from "lucide-react"
import { cn } from "@/lib/utils"

const sizes = {
  sm: { wrap: "size-8 rounded-lg", icon: "size-4", text: "text-sm" },
  md: { wrap: "size-9 rounded-xl", icon: "size-5", text: "text-lg" },
} as const

export function Logo({
  size = "md",
  className,
}: {
  size?: keyof typeof sizes
  className?: string
}) {
  const s = sizes[size]
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "flex items-center justify-center bg-primary text-primary-foreground",
          s.wrap,
        )}
      >
        <Leaf className={s.icon} aria-hidden="true" />
      </span>
      <span className={cn("font-heading font-bold tracking-tight", s.text)}>EduSync</span>
    </span>
  )
}
