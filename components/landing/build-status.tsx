import { CheckCircle2, Circle } from "lucide-react"

const steps = [
  { label: "B1 — Nền tảng (Next.js, types, DB, theme)", done: true },
  { label: "B2 — Schema cơ sở dữ liệu", done: false },
  { label: "B3 — Xác thực & phân quyền", done: false },
  { label: "B4+ — Lớp học, bài giảng, luyện tập...", done: false },
]

export function BuildStatus() {
  return (
    <section id="status" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <p className="text-sm font-medium text-primary">Trạng thái dự án</p>
        <h2 className="mt-1 font-heading text-2xl font-bold tracking-tight">Đang xây dựng theo lộ trình EduSync</h2>
        <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Bước B1 đã hoàn tất: khung ứng dụng, bộ kiểu dữ liệu dùng chung, kết nối Neon Postgres và hệ thống giao diện.
          Các bước tiếp theo sẽ bổ sung dữ liệu và nghiệp vụ.
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-3">
              {s.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
              )}
              <span className={s.done ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
