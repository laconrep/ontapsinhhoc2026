import { KeyRound, ListChecks, LineChart } from "lucide-react"

const steps = [
  {
    icon: KeyRound,
    title: "Tham gia lớp",
    desc: "Học sinh nhập mã 6 ký tự do giáo viên cấp để vào đúng lớp học.",
  },
  {
    icon: ListChecks,
    title: "Ôn tập 4 bước",
    desc: "Tự đánh giá, điền khuyết, kéo thả, rồi kiểm tra — đi lần lượt, không nhảy cóc.",
  },
  {
    icon: LineChart,
    title: "Xem tiến độ",
    desc: "Giáo viên và học sinh theo dõi kết quả, chuỗi ngày học và điểm kiến thức còn yếu.",
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <div className="max-w-2xl">
        <h2 className="text-balance font-heading text-3xl font-bold tracking-tight md:text-4xl">
          Cách hoạt động
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Ba bước để bắt đầu ôn tập trên EduSync.
        </p>
      </div>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="rounded-2xl border border-border bg-card p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <step.icon className="size-5" aria-hidden="true" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">
              Bước {i + 1}
            </p>
            <h3 className="mt-1 font-heading text-lg font-semibold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
