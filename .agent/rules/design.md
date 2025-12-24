---
trigger: always_on
---

不允许打补丁修复，必须系统化分析，然后解决问题，这是全新的项目，无需补丁

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tableau 元数据治理平台前端 - 基于 Next.js 构建的现代化 Web 应用，提供数据治理分析界面。后端 API 由 Flask 提供，存储于 SQLite 数据库。参考开源项目设计、元数据采集、元数据管理、血缘分析等理念，<https://github.com/datahub-project/datahub>

## 技术栈

- **框架**: Next.js 16 + React 19
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4
- **图标**: Lucide React
- **后端 API**: Flask 3.0（运行于 localhost:8101）
- **数据库**: SQLite (metadata.db)
- **Tableau 集成**: Metadata API (GraphQL) + REST API 认证
- **UI 风格**: 参考 [ui_style.md](docs/ui_style.md)

## 快速开始

### 启动服务

```bash
# 一键启动 (推荐)
python3 dev.py

# 分步启动 (手动控制)
# 后端: python3 run_backend.py
# 前端: cd frontend && npm run dev
```

### 访问地址

- **Next.js 前端**: <http://localhost:3100> ⭐ 主要使用
- Flask 后端 API: <http://localhost:8101/api/>*