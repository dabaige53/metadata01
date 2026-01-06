import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 启用压缩
  compress: true,

  // 优化生产构建
  productionBrowserSourceMaps: false,

  // 优化打包 - 将大型库单独分包
  experimental: {
    optimizePackageImports: ['echarts', 'echarts-for-react', 'mermaid', 'lucide-react'],
  },

  output: 'standalone',

  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8201';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  // 静态资源缓存优化
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
