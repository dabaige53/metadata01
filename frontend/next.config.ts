import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API 代理到 Flask 后端
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8101/api/:path*',
      },
    ];
  },
};

export default nextConfig;
