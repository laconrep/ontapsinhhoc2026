import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/shared/logo"

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10 text-center">
      <Logo size="md" />
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Không tìm thấy trang</h1>
        <p className="mt-2 max-w-sm text-pretty text-sm text-muted-foreground">
          Đường dẫn không tồn tại hoặc đã được chuyển đi. Bạn hãy quay về trang chủ để tiếp tục.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        Về trang chủ
      </Button>
    </main>
  )
}
