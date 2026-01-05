# Tableau 元数据治理平台

基于 Next.js + Flask 的 Tableau 元数据治理平台，提供数据资产可视化、血缘分析、数据质量监控等功能。

## 功能特性

- 📊 **元数据管理** - 数据库、表、字段、数据源、工作簿、视图的完整管理
- 🔗 **血缘分析** - 数据资产间的上下游关系可视化
- 📈 **治理分析** - 孤立资源、重复指标、无描述字段等治理指标
- 🔍 **全局搜索** - 跨实体类型的统一搜索
- 📚 **术语表** - 业务术语定义与管理

## 快速开始

### 1. 环境要求

- Python 3.10+
- Node.js 18+
- Tableau Server (需要管理员权限创建 PAT)

### 2. 安装

```bash
# 克隆项目
git clone <repository-url>
cd metadata

# 创建并激活虚拟环境
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# Windows: venv\Scripts\activate

# 安装 Python 依赖
pip install -r requirements.txt

# 安装前端依赖
cd frontend && npm install && cd ..
```

### 3. 配置

创建 `.env` 文件：

```bash
TABLEAU_BASE_URL=http://your-tableau-server.com
TABLEAU_PAT_NAME=your_pat_name
TABLEAU_PAT_SECRET=your_pat_secret
```

### 4. 同步数据

```bash
venv/bin/python backend/tableau_sync.py
```

### 5. 启动服务

```bash
# 开发模式
venv/bin/python dev.py

# 生产模式
venv/bin/python deploy.py
```

访问 http://localhost:3200

## 项目结构

```
metadata/
├── frontend/           # Next.js 前端 (React 19 + TypeScript)
├── backend/            # Flask 后端 API
│   ├── routes/         # API 路由
│   ├── services/       # 业务逻辑
│   └── models.py       # 数据模型
├── data/               # SQLite 数据库
├── tests/              # E2E 测试
├── docs/               # 文档
├── dev.py              # 开发启动脚本
├── deploy.py           # 生产部署脚本
└── requirements.txt    # Python 依赖
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript + Tailwind CSS |
| 后端 | Flask 3.0 + SQLAlchemy |
| 数据库 | SQLite |
| 数据源 | Tableau Metadata API (GraphQL) |

## 文档

- [快速启动指南](docs/快速启动指南.md) - 详细安装和使用说明
- [CLAUDE.md](CLAUDE.md) - 完整项目文档（架构、API、开发指南）

## 常用命令

```bash
# 启动/停止服务
venv/bin/python dev.py start
venv/bin/python dev.py stop

# 数据同步
venv/bin/python backend/tableau_sync.py

# 运行测试
node tests/e2e/test-e2e.mjs
node tests/e2e/test-features.mjs
```

## 许可证

内部项目，仅供内部使用。
