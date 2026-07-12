"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function StudentSessionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  console.error("[v0] StudentSession error:", error)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <h1 className="font-heading text-xl font-bold">Có lỗi xảy ra</h1>
        <p className="mt-2 max-w-sm text-pretty text-muted-foreground">
          Không thể tải phiên trình chiếu. Vui lòng thử lại hoặc quay về trang chủ.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Thử lại
        </Button>
        <Button onClick={() => (window.location.href = "/student")}>
          Về trang chủ
        </Button>
      </div>
    </div>
  )
}
