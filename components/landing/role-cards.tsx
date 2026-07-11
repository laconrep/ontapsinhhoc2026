import Link from "next/link"
import { GraduationCap, Users, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const roles = [
  {
    icon: Users,
    title: "Dành cho Giáo viên",
    desc: "Tạo lớp, xây dựng bài giảng theo điểm kiến thức, ra đề luyện tập và theo dõi kết quả cả lớp theo thời gian thực.",
    points: ["Quản lý lớp & mã mời", "Soạn điểm kiến thức & câu hỏi", "Thống kê lớp chi tiết"],
    href: "/sign-up?role=teacher",
    cta: "Bắt đầu dạy",
  },
  {
    icon: GraduationCap,
    title: "Dành cho Học sinh",
    desc: "Tham gia lớp bằng mã mời, ôn tập qua các tab tương tác, làm quiz và xem tiến độ, huy hiệu, chuỗi ngày học của mình.",
    points: ["Ôn tập tương tác 4 tab", "Quiz & tự chấm điểm", "Tiến độ, huy hiệu & streak"],
    href: "/sign-up?role=student",
    cta: "Bắt đầu học",
  },
]

export function RoleCards() {
  return (
    <section id="roles" className="mx-auto max-w-6xl px-4 py-12 md:py-16">
      <div className="grid gap-6 md:grid-cols-2">
        {roles.map((role) => (
          <div
            key={role.title}
            className="flex flex-col rounded-2xl border border-border bg-card p-6 md:p-8"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <role.icon className="size-6" aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-heading text-xl font-bold">{role.title}</h3>
            <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{role.desc}</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {role.points.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-6 pt-2">
              <Button variant="secondary" nativeButton={false} render={<Link href={role.href} />}>
                {role.cta}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
