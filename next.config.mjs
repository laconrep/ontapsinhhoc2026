/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['.monkeycode-ai.live', '*.monkeycode-ai.live'],
  serverActions: {
    allowedOrigins: ['*.monkeycode-ai.live', '.monkeycode-ai.live'],
    bodySizeLimit: "10mb",
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['*.monkeycode-ai.live', '.monkeycode-ai.live'],
      bodySizeLimit: "10mb",
    },
  },
}

export default nextConfig
