import { cn } from "@/lib/utils"

export function PageSkeleton({
  variant = "default",
  className,
}: {
  variant?: "default" | "student" | "teacher"
  className?: string
}) {
  const width =
    variant === "student"
      ? "max-w-md md:max-w-3xl"
      : variant === "teacher"
        ? "max-w-7xl"
        : "max-w-3xl"

  return (
    <div
      className={cn("mx-auto w-full px-4 py-8 md:px-6", width, className)}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Đang tải…</span>
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="mt-6 h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  )
}
