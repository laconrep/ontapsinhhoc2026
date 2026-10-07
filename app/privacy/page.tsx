import type { Metadata } from "next"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"

export const metadata: Metadata = { title: "Chính sách bảo mật" }

export default function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-10">
        <h1 className="font-heading text-2xl font-bold text-foreground">Chính sách bảo mật</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bản nháp — cần người sở hữu duyệt trước khi áp dụng.</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            EduSync lưu thông tin tài khoản (họ tên, email, vai trò) và dữ liệu học tập (lớp, bài
            nộp, tiến độ) để vận hành lớp học.
          </p>
          <p>
            Dữ liệu dùng để đăng nhập, giao bài, chấm và thống kê trong lớp. Không bán dữ liệu cho
            bên thứ ba.
          </p>
          <p>
            Bạn có thể yêu cầu xem hoặc xoá tài khoản qua email liên hệ trên trang chủ. Bản này chưa
            phải chính sách pháp lý hoàn chỉnh.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
