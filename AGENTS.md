# AGENTS.md

## AI回复语言
简体中文

## 项目概述

Tableau 元数据治理平台 - 基于 Next.js + Flask 构建的数据治理分析平台。

**版本**: v2.2 (2026-01-06)

## 技术栈

- **前端**: Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **后端**: Flask 3.0 + SQLAlchemy + SQLite
- **部署**: Docker Compose

## 快速开始

### Docker 一键部署（推荐）

```bash
cp .env.example .env
docker-compose up -d
open http://localhost:3200
```

### 本地开发

```bash
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..
cp .env.example .env
venv/bin/python backend/tableau_sync.py
venv/bin/python dev.py
```

## AI 助手规范

- 执行 Python 脚本必须使用 `venv/bin/python`
- 前端命令在 `frontend/` 目录执行
- 使用真实数据，不使用 mock

## 常用命令

```bash
# Docker
docker-compose up -d        # 启动
docker-compose down         # 停止

# 本地开发
venv/bin/python dev.py      # 开发模式
venv/bin/python backend/tableau_sync.py  # 同步数据
```

## 项目结构

```
metadata/
├── frontend/           # Next.js 前端
├── backend/            # Flask 后端
├── data/               # SQLite 数据库
├── docker-compose.yml  # Docker 编排
└── .env.example        # 环境变量模板
```
