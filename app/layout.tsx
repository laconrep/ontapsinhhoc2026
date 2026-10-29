import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Inter, Bricolage_Grotesque } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
})

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  variable: "--font-bricolage",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "AI Trợ lí Ôn tập — Sinh học",
    template: "%s · AI Trợ lí Ôn tập",
  },
  description:
    "Nền tảng ôn tập Sinh học cho giáo viên và học sinh: bài giảng, điểm kiến thức, luyện tập tương tác và theo dõi tiến độ.",
  openGraph: {
    title: "AI Trợ lí Ôn tập — Sinh học",
    description:
      "Nền tảng ôn tập Sinh học cho giáo viên và học sinh: bài giảng, điểm kiến thức, luyện tập tương tác và theo dõi tiến độ.",
    locale: "vi_VN",
    type: "website",
    siteName: "AI Trợ lí Ôn tập",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fdfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1f1a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`bg-background ${inter.variable} ${bricolage.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
