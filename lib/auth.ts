import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"

const isBuild = process.env.NEXT_PHASE === "phase-production-build"

export const auth = betterAuth({
  database: pool,
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (isBuild ? "edusync-build-placeholder-secret-min-32" : undefined),
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // SEC-08: nâng độ dài mật khẩu tối thiểu 6 -> 8.
    minPasswordLength: 8,
    sendResetPassword: async () => {
      throw new Error(
        "Chưa cấu hình gửi email. Liên hệ quản trị viên để đặt lại mật khẩu.",
      )
    },
  },
  // SEC-01 (phòng thủ nhiều lớp): kể cả khi client tìm được đường gửi role,
  // hook phía server luôn ép tài khoản mới về "student".
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => ({
          data: { ...newUser, role: "student" },
        }),
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "student",
        // Client KHÔNG được tự gửi role khi đăng ký/cập nhật.
        // Đăng ký luôn là student; quyền teacher chỉ cấp qua
        // completeOnboarding (từ §23 không còn mã mời — xem
        // app/actions/onboarding.ts).
        input: false,
      },
      isOnboarded: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000", "http://127.0.0.1:3000"]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 ngày
    updateAge: 60 * 60 * 24, // 1 ngày
  },
  advanced: {
    ...(process.env.NODE_ENV === "development"
      ? {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        }
      : {}),
  },
})
