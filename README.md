# Tableau 元数据治理平台

基于 Next.js + Flask 的 Tableau 元数据治理平台，提供数据资产可视化、血缘分析、数据质量监控等功能。

## 功能特性

- 📊 **元数据管理** - 数据库、表、字段、数据源、工作簿、视图的完整管理
- 🔗 **血缘分析** - 数据资产间的上下游关系可视化
- 📈 **治理分析** - 孤立资源、重复指标、无描述字段等治理指标
- 🔍 **全局搜索** - 跨实体类型的统一搜索
- 📚 **术语表** - 业务术语定义与管理

## 快速开始

### 方式一：Docker 一键部署（推荐）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 Tableau PAT 凭据

# 2. 启动服务
docker-compose up -d

# 3. 访问
open http://localhost:3200
```

### 方式二：本地开发

```bash
# 1. 安装依赖
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..

# 2. 配置
cp .env.example .env
# 编辑 .env 填入 Tableau PAT 凭据

# 3. 同步数据
venv/bin/python backend/tableau_sync.py

# 4. 启动服务
venv/bin/python dev.py

# 5. 访问
open http://localhost:3200
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript + Tailwind CSS |
| 后端 | Flask 3.0 + SQLAlchemy |
| 数据库 | SQLite |
| 数据源 | Tableau Metadata API (GraphQL) |
| 部署 | Docker Compose |

## 项目结构

```
metadata/
├── frontend/           # Next.js 前端
├── backend/            # Flask 后端 API
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   └── models.py       # 数据模型
├── data/               # SQLite 数据库
├── docker-compose.yml  # Docker 编排
├── Dockerfile.backend  # 后端镜像
├── Dockerfile.frontend # 前端镜像
└── .env.example        # 环境变量模板
```

## 文档

- [CLAUDE.md](CLAUDE.md) - 完整技术文档
- [AGENTS.md](AGENTS.md) - AI 助手规范

## 常用命令

```bash
# Docker 部署
docker-compose up -d        # 启动
docker-compose down         # 停止
docker-compose logs -f      # 查看日志

# 本地开发
venv/bin/python dev.py      # 启动开发服务
venv/bin/python backend/tableau_sync.py  # 同步数据
```

## 许可证

内部项目，仅供内部使用。
