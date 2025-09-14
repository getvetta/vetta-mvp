/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ftrxfldibfjksmnrprgx.supabase.co",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },

  experimental: {
    typedRoutes: true,
  },

  output: "standalone",
};

module.exports = nextConfig;
