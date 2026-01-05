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

  // API 代理到 Flask 后端
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8201/api/:path*',
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
