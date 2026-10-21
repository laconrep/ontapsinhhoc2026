const isDev = process.env.NODE_ENV === "development"

// SEC-04: allowedOrigins cho Server Actions KHÔNG còn wildcard cứng.
// - Có env SERVER_ACTIONS_ALLOWED_ORIGINS (các host cách nhau bằng dấu
//   phẩy): dùng đúng danh sách đó.
// - Chưa đặt env + development: cho localhost và domain dev monkeycode.
// - Chưa đặt env + production: BỎ HẲN khóa allowedOrigins -> Next áp
//   mặc định same-origin (chỉ chấp nhận đúng host của app).
const envAllowedOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const serverActions = { bodySizeLimit: "10mb" }
if (envAllowedOrigins.length > 0) {
  serverActions.allowedOrigins = envAllowedOrigins
} else if (isDev) {
  serverActions.allowedOrigins = [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.monkeycode-ai.live",
    ".monkeycode-ai.live",
  ]
}

// SEC-07: header bảo mật cho mọi route. CSP chạy ở chế độ Report-Only
// trước: theo dõi vi phạm ~1 tuần rồi mới chuyển sang
// "Content-Security-Policy" bắt buộc. Policy chặt theo spec — lưu ý
// Next.js có thể cần 'unsafe-inline'/'unsafe-eval' cho script ở một số
// chế độ; ở Report-Only cứ giữ policy này để quan sát báo cáo.
const cspReportOnly = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Tắt camera/microphone/geolocation; GIỮ fullscreen cho màn hình live.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), fullscreen=(self)",
  },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // allowedDevOrigins CHỈ có tác dụng ở `next dev` (Next bỏ qua khi
  // build/production) — giữ cho môi trường dev trên monkeycode; không
  // phải bề mặt production. Xem SEC-04.
  allowedDevOrigins: [".monkeycode-ai.live", "*.monkeycode-ai.live"],
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
