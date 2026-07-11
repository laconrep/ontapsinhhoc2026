import { BarChart3 } from "lucide-react"

export default function StudentStatsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground text-balance">Tiến độ</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Thống kê học tập, chuỗi ngày và ôn tập ngắt quãng.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          Bảng thống kê tiến độ sẽ được bổ sung ở bước tiếp theo.
        </p>
      </div>
    </div>
  )
}
