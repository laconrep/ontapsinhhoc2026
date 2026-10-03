"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { TvStageTour } from "@/components/live/tv-stage-tour"

export default function TvTourPreviewPage() {
  const [open, setOpen] = useState(true)

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-bold text-foreground">Xem trước hướng dẫn TV</h1>
      <p className="text-sm text-muted-foreground">
        Trang này không cần đăng nhập. Nút mở sân khấu không gọi cửa sổ present thật.
      </p>
      <Button className="w-fit" onClick={() => setOpen(true)}>
        Mở tour
      </Button>
      <TvStageTour open={open} onOpenChange={setOpen} />
    </div>
  )
}
