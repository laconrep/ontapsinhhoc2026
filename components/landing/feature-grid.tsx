import { BookOpen, PencilRuler, MousePointerClick, ListChecks, LineChart, Radio } from "lucide-react"

const features = [
  {
    icon: BookOpen,
    title: "Điểm kiến thức",
    desc: "Bài giảng chia nhỏ thành các điểm kiến thức với thuật ngữ gạch chân để luyện tập.",
  },
  {
    icon: PencilRuler,
    title: "Điền khuyết",
    desc: "Học sinh điền thuật ngữ còn thiếu, hệ thống chấm tự động và linh hoạt.",
  },
  {
    icon: MousePointerClick,
    title: "Kéo thả",
    desc: "Củng cố kiến thức bằng thao tác kéo thả trực quan, hỗ trợ hoán đổi nhóm.",
  },
  {
    icon: ListChecks,
    title: "Quiz tổng hợp",
    desc: "Trắc nghiệm, đúng/sai, trả lời ngắn — tự lưu bài và chấm điểm ngay.",
  },
  {
    icon: LineChart,
    title: "Tiến độ & thống kê",
    desc: "Theo dõi streak, huy hiệu, tỉ lệ nắm vững theo từng bài và cả lớp.",
  },
  {
    icon: Radio,
    title: "Học trực tiếp",
    desc: "Chế độ lớp học realtime cho phép giáo viên điều phối buổi ôn tập chung.",
  },
]

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <div className="max-w-2xl">
        <h2 className="text-balance font-heading text-3xl font-bold tracking-tight md:text-4xl">
          Mọi thứ cho một buổi ôn tập hiệu quả
        </h2>
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Từ soạn bài đến luyện tập và đánh giá — tất cả trong một nền tảng thống nhất.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-accent/20 text-accent-foreground">
              <f.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-4 font-heading text-lg font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
