# Tableau 元数据治理平台 - 前端

基于 Next.js 16 + React 19 构建的现代化数据治理前端应用。

## 技术栈

- **框架**: Next.js 16.0.10 (App Router)
- **UI**: React 19.2.1 + TypeScript 5
- **样式**: Tailwind CSS 4.x
- **图标**: Lucide React
- **图表**: ECharts + Mermaid

## 开发

```bash
npm install     # 安装依赖
npm run dev     # 启动开发服务器 (端口 3200)
npm run build   # 生产构建
npm run start   # 启动生产服务器
npm run lint    # 代码检查
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | 3200 |
| `BACKEND_URL` | 后端 API 地址 | http://127.0.0.1:8201 |

## 目录结构

```
src/
├── app/            # 页面路由 (App Router)
├── components/     # 可复用组件
├── hooks/          # 自定义 Hooks
└── lib/            # 工具函数
```
