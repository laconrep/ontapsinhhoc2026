import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon,
  highlight,
  compact,
  className,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  highlight?: boolean
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <div className={cn("flex flex-col items-center gap-0.5", className)}>
        {icon ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {icon}
            {label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
        <span
          className={cn(
            "font-heading text-lg font-bold tabular-nums",
            highlight ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border border-border bg-card p-4", className)}>
      {icon ? (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
      ) : null}
      <div>
        <p
          className={cn(
            "font-heading text-2xl font-bold tabular-nums",
            highlight ? "text-primary" : "text-foreground",
          )}
        >
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
