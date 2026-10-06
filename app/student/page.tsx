import Link from "next/link"
import { getAssignedLessonsForStudent } from "@/app/actions/assignments"
import { getMyClasses } from "@/app/actions/student-class"
import { getActiveSessionsForStudent } from "@/app/actions/sessions"
import { AssignedWork } from "@/components/student/assigned-work"
import { JoinClassCard } from "@/components/student/join-class-card"
import { Users, Radio } from "lucide-react"
import type { AssignedLessonDto } from "@/types"

export const dynamic = "force-dynamic"

export default async function StudentHomePage() {
  const [classes, liveSessions, assigned] = await Promise.all([
    getMyClasses(),
    getActiveSessionsForStudent(),
    getAssignedLessonsForStudent().catch((err) => {
      console.error("getAssignedLessonsForStudent error:", err)
      return [] as AssignedLessonDto[]
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground text-balance">Trang chủ</h1>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Tham gia lớp bằng mã mời để bắt đầu học.
        </p>
      </div>

      {liveSessions.length > 0 && (
        <section aria-labelledby="live-heading" className="flex flex-col gap-2">
          <h2 id="live-heading" className="sr-only">
            Phiên học đang diễn ra
          </h2>
          {liveSessions.map((s) => (
            <Link
              key={s.id}
              href={`/student/sessions/${s.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
                  <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="absolute right-0 top-0 h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
                </span>
                <div>
                  <p className="font-heading text-sm font-semibold text-foreground">
                    Phiên học đang diễn ra
                  </p>
                  <p className="text-xs text-muted-foreground">{s.className} · Bấm để tham gia</p>
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}

      <AssignedWork items={assigned} />

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
