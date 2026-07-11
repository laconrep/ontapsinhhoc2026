import { getMyClasses } from "@/app/actions/student-class"
import { JoinClassCard } from "@/components/student/join-class-card"
import { Users } from "lucide-react"

export default async function StudentHomePage() {
  const classes = await getMyClasses()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground text-balance">Trang chủ</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Tham gia lớp bằng mã mời để bắt đầu học.
        </p>
      </div>

      <JoinClassCard />

      <section aria-labelledby="my-classes-heading" className="flex flex-col gap-3">
        <h2 id="my-classes-heading" className="font-heading text-sm font-semibold text-foreground">
          Lớp của tôi
        </h2>
        {classes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">
              Bạn chưa tham gia lớp nào. Nhập mã mời phía trên.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {classes.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-heading font-semibold text-foreground">{c.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {c.subject} · {c.schoolYear}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Giáo viên: {c.teacherName}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
