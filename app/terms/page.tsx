import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/landing/site-header"
import { SiteFooter } from "@/components/landing/site-footer"

export const metadata: Metadata = { title: "Điều khoản sử dụng" }

export default function TermsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-10">
        <h1 className="font-heading text-2xl font-bold text-foreground">Điều khoản sử dụng</h1>
        <p className="mt-2 text-sm text-muted-foreground">Bản nháp — cần người sở hữu duyệt trước khi áp dụng.</p>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground">
          <p>
            EduSync là nền tảng ôn tập Sinh học dành cho giáo viên và học sinh. Nội dung dưới đây
            chỉ là khung tạm, chưa phải điều khoản pháp lý.
          </p>
          <p>
            Khi dùng dịch vụ, bạn cần cung cấp thông tin trung thực, bảo mật tài khoản, và không
            chia sẻ dữ liệu lớp học trái phép.
          </p>
          <p>
            Giáo viên chịu trách nhiệm nội dung bài giảng đưa lên. Học sinh chỉ xem và làm bài được
            giao trong lớp đã tham gia.
          </p>
          <p>
            Bản này sẽ được cập nhật sau khi người sở hữu rà soát. Mọi thắc mắc gửi qua trang{" "}
            <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
              Chính sách bảo mật
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
