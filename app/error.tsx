"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("App error:", error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Có lỗi xảy ra</h1>
        <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
          Không thể tải trang. Bạn hãy thử lại hoặc quay về trang chủ.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Thử lại
        </Button>
        <Button onClick={() => (window.location.href = "/")}>Về trang chủ</Button>
      </div>
    </main>
  )
}
