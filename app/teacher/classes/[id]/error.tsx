"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function ClassDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="flex flex-col items-center text-center">
        <AlertCircle className="mb-4 h-16 w-16 text-destructive" />
        <h1 className="font-heading text-2xl font-bold text-foreground">Có lỗi xảy ra</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          {error.message || "Không thể tải thông tin lớp học. Vui lòng thử lại."}
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={reset}>
          Thử lại
        </Button>
        <Link href="/teacher/classes">
          <Button>
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
        </Link>
      </div>
    </div>
  )
}
