import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24 md:pb-20">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Nền tảng ôn tập Sinh học
        </span>

        <h1 className="mt-6 text-balance font-heading text-4xl font-bold leading-tight tracking-tight md:text-6xl">
          Học Sinh học chủ động, <span className="text-primary">nhớ lâu hơn</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
          EduSync giúp giáo viên xây dựng bài giảng theo điểm kiến thức và học sinh luyện tập tương tác — điền khuyết, kéo
          thả, trắc nghiệm — kèm theo dõi tiến độ và ôn tập ngắt quãng.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" nativeButton={false} render={<Link href="/sign-up" />}>
            Tạo tài khoản
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#features" />}>
            Xem tính năng
          </Button>
        </div>
      </div>
    </section>
  )
}
