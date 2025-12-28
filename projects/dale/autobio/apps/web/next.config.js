/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for Cloudflare Pages
  images: {
    unoptimized: true,
  },
  // Environment variables - NEXT_PUBLIC_ prefix required for client-side access
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://autobiography-api.manoscasey.workers.dev',
  },
};

module.exports = nextConfig;
