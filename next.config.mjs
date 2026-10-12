/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['.monkeycode-ai.live', '*.monkeycode-ai.live'],
  serverExternalPackages: ['pg'],
  experimental: {
    serverActions: {
      allowedOrigins: ['*.monkeycode-ai.live', '.monkeycode-ai.live'],
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
