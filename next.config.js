/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, 

  swcMinify: true,


  images: {
    domains: [
      "ftrxfldibfjksmnrprgx.supabase.co", // Supabase storage bucket
    ],
    formats: ["image/avif", "image/webp"], // modern formats for better performance
  },

  
  experimental: {
    typedRoutes: true, // safer routing with TypeScript
  },

  
  output: "standalone",
};

module.exports = nextConfig;
