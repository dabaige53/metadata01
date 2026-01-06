# CLAUDE.md

## AI回复语言
简体中文

## 项目概述

Tableau 元数据治理平台 - 基于 Next.js + Flask 构建，提供数据治理分析界面。

**版本**: v2.2 (2026-01-06) - Docker 一键部署版本

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript + Tailwind CSS |
| 后端 | Flask 3.0 + SQLAlchemy |
| 数据库 | SQLite |
| 部署 | Docker Compose |

## 快速开始

### Docker 部署（推荐）

```bash
cp .env.example .env  # 配置 Tableau PAT
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

## 访问地址

- **前端**: http://localhost:3200
- **后端 API**: http://localhost:8201/api/

## 常用命令

```bash
# Docker
docker-compose up -d      # 启动
docker-compose down       # 停止
docker-compose logs -f    # 日志

# 本地开发
venv/bin/python dev.py    # 开发模式
venv/bin/python deploy.py # 生产模式

# 数据同步
venv/bin/python backend/tableau_sync.py
```

## 项目结构

```
metadata/
├── frontend/           # Next.js 前端
│   ├── src/app/        # 页面路由
│   ├── src/components/ # 组件
│   └── src/hooks/      # Hooks
├── backend/            # Flask 后端
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   └── models.py       # 数据模型
├── data/               # SQLite 数据库
├── docker-compose.yml  # Docker 编排
├── Dockerfile.backend  # 后端镜像
└── Dockerfile.frontend # 前端镜像
```

## API 端点

| 路径 | 说明 |
|------|------|
| `/api/stats` | 全局统计 |
| `/api/databases` | 数据库列表 |
| `/api/tables` | 数据表列表 |
| `/api/datasources` | 数据源列表 |
| `/api/fields` | 字段列表 |
| `/api/metrics` | 指标列表 |
| `/api/workbooks` | 工作簿列表 |
| `/api/views` | 视图列表 |
| `/api/lineage/{type}/{id}` | 血缘关系 |
| `/api/search?q=` | 全局搜索 |

## 开发规范

- 使用 `venv/bin/python` 执行 Python 脚本
- 前端命令在 `frontend/` 目录执行
- 数据同步后统计数据预计算存储
