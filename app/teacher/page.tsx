import Link from "next/link"
import { getClasses } from "@/app/actions/classes"
import { getChaptersWithLessons } from "@/app/actions/content"
import { getQuestionBank } from "@/app/actions/questions"
import { getCurrentUser } from "@/lib/auth-helpers"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, BookOpen, Library, ArrowRight, Plus } from "lucide-react"
import { StatCard } from "@/components/shared/stat-card"

export const dynamic = "force-dynamic"

export default async function TeacherHomePage() {
  const [user, classes, chapters, questions] = await Promise.all([
    getCurrentUser(),
    getClasses(),
    getChaptersWithLessons(),
    getQuestionBank(),
  ])
  const totalStudents = classes.reduce((sum, c) => sum + (c.studentCount ?? 0), 0)
  const totalLessons = chapters.reduce((sum, c) => sum + (c.lessons?.length ?? 0), 0)

  const stats = [
    { label: "Lớp học", value: classes.length, icon: Users, href: "/teacher/classes" },
    { label: "Tổng học sinh", value: totalStudents, icon: Users, href: "/teacher/classes" },
    { label: "Bài giảng", value: totalLessons, icon: BookOpen, href: "/teacher/lessons" },
    { label: "Câu hỏi", value: questions.length, icon: Library, href: "/teacher/questions" },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground text-balance">
            Chào mừng, thầy/cô {user?.name}
          </h1>
          <p className="mt-1 text-muted-foreground text-pretty">
            Tổng quan hoạt động giảng dạy của bạn.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/teacher/classes" />}>
          <Plus className="h-4 w-4" />
          Quản lý lớp học
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link key={s.label} href={s.href} className="block">
              <StatCard
                label={s.label}
                value={s.value}
                icon={<Icon className="h-5 w-5" aria-hidden="true" />}
              />
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Lớp học gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {classes.length === 0 ? (
            <p className="text-muted-foreground">
              Bạn chưa có lớp học nào.{" "}
              <Link href="/teacher/classes" className="text-primary underline">
                Tạo lớp đầu tiên
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {classes.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className="flex items-center justify-between py-3 transition-colors hover:text-primary"
                  >
                    <span>
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {c.subject} · {c.studentCount} học sinh
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
