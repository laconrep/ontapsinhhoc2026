import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Trợ lí Ôn tập — Sinh học",
    short_name: "AI Ôn tập",
    description:
      "Nền tảng ôn tập Sinh học cho giáo viên và học sinh: bài giảng, điểm kiến thức, luyện tập tương tác và theo dõi tiến độ.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7fdfa",
    theme_color: "#1f7a5c",
    lang: "vi",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
