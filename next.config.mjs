/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*.monkeycode-ai.live'],
  serverActions: {
    bodySizeLimit: "10mb",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
}

export default nextConfig
