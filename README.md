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
docker-compose up -d --build

# 3. 访问
# 本机访问
open http://localhost:3201

# 局域网访问 (其他设备)
# http://<本机IP>:3201
```

#### 局域网访问说明

部署后，局域网内其他设备可通过 `http://<本机IP>:3201` 访问。

**已优化配置**：
- ✅ Next.js 监听 `0.0.0.0`（支持局域网访问）
- ✅ 禁用 IPv6（避免 DNS 延迟）
- ✅ MTU 优化（适配 VPN/虚拟化环境）
- ✅ DNS 加速（使用 8.8.8.8/1.1.1.1）

**端口说明**：
| 服务 | 容器端口 | 宿主机端口 |
|------|---------|-----------|
| 前端 | 3200 | 3201 |
| 后端 API | 8201 | 8202 |

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
├── frontend/               # Next.js 前端
│   ├── src/app/            # 页面路由 (App Router)
│   ├── src/components/     # 可复用组件
│   ├── src/hooks/          # 自定义 Hooks
│   └── src/lib/            # 工具函数
├── backend/                # Flask 后端 API
│   ├── routes/             # API 路由
│   ├── services/           # 业务逻辑（同步、Tableau 客户端）
│   ├── migrations/         # 数据库迁移脚本
│   └── models.py           # 数据模型
├── scripts/                # 运维脚本
│   ├── analysis/           # 数据分析脚本
│   ├── generation/         # 报表生成脚本
│   ├── maintenance/        # 维护脚本
│   └── validation/         # 数据校验脚本
├── tests/                  # 测试
├── docs/                   # 项目文档
├── data/                   # SQLite 数据库
├── logs/                   # 运行日志
├── docker-compose.yml      # Docker 编排
├── Dockerfile.backend      # 后端镜像
├── Dockerfile.frontend     # 前端镜像
└── .env.example            # 环境变量模板
```

## 文档

- [AGENTS.md](AGENTS.md) - AI 助手规范 & 项目技术文档

## 常用命令

```bash
# Docker 部署
docker-compose up -d --build  # 首次启动/重新构建
docker-compose up -d          # 启动（已构建）
docker-compose down           # 停止
docker-compose logs -f        # 查看日志
docker-compose ps             # 查看状态

# 本地开发
venv/bin/python dev.py                    # 启动开发服务
venv/bin/python backend/tableau_sync.py  # 同步数据
```

## 故障排查

```bash
# 检查容器状态
docker-compose ps

# 查看容器日志
docker-compose logs frontend
docker-compose logs backend

# 测试局域网连接
curl -o /dev/null -s -w "连接: %{time_connect}s, 首字节: %{time_starttransfer}s\n" http://<IP>:3201
```

## 许可证

内部项目，仅供内部使用。
