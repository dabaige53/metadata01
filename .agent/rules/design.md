---
trigger: model_decision
description: 项目日志，启动时或者搜索前可看
---

# AGENTS.md

## AI回复语言
简体中文，包括思考过程，task任务和相关交付件都必须是简体中文。

## 项目概述

Tableau 元数据治理平台前端 - 基于 Next.js 构建的现代化 Web 应用，提供数据治理分析界面。后端 API 由 Flask 提供，存储于 SQLite 数据库。参考开源项目设计、元数据采集、元数据管理、血缘分析等理念，<https://github.com/datahub-project/datahub>

**最新版本**: v2.1 (2025-12-30)

- ✅ 完整的筛选、排序、分页功能
- ✅ 统一的数据表格组件系统
- ✅ 术语表（Glossary）模块
- ✅ 指标分析与重复检测

## 技术栈

- **框架**: Next.js 16.0.10 + React 19.2.1
- **语言**: TypeScript 5
- **样式**: Tailwind CSS 4.x
- **图标**: Lucide React 0.561+
- **后端 API**: Flask 3.0（运行于 localhost:8201）
- **数据库**: SQLite (metadata.db)
- **Tableau 集成**: Metadata API (GraphQL) + REST API 认证
- **UI 风格**: 参考 [ui_style.md](docs/ui_style.md)
- **图表**: Mermaid 11.x（用于血缘可视化）

## 快速开始

### 首次设置

```bash
# 1. 安装前端依赖
cd frontend
npm install

# 2. 配置 Tableau 连接（创建 .env 文件）
cd ..
cat > .env << EOF
TABLEAU_BASE_URL=http://tbi.juneyaoair.com
TABLEAU_PAT_NAME=your_pat_name
TABLEAU_PAT_SECRET=your_pat_secret
EOF

# 3. 初始化数据库（可选，首次同步会自动创建）
python3 backend/init_db.py

# 4. 首次数据同步
python3 backend/tableau_sync.py

# 5. 启动服务
python3 dev.py
```

### 启动服务

```bash
# 一键启动 - 开发模式 (推荐日常开发)
python3 dev.py

# 一键启动 - 生产模式 (推荐内网部署，性能提升 10-50 倍)
python3 deploy.py

# 分步启动 (手动控制)
# 后端: python3 run_backend.py
# 前端: cd frontend && npm run dev
```

### 访问地址

- **本机访问**: <http://localhost:3200> ⭐ 主要使用
- **内网访问**: 启动时会显示内网 IP，如 `http://192.168.x.x:3200`
- **Flask 后端 API**: <http://localhost:8201/api/>*

## 常用命令

### 服务管理

```bash
# 开发模式启动（实时编译，适合开发调试）
python3 dev.py start

# 生产模式启动（预编译，适合内网部署）
python3 deploy.py
python3 deploy.py --skip-build  # 跳过构建，直接启动

# 停止服务
python3 dev.py stop
python3 deploy.py stop

# 重启服务
python3 dev.py restart

# 手动启动后端（端口 8201）
python3 run_backend.py

# 手动启动前端（端口 3100，需在 frontend/ 目录下执行）
cd frontend && npm run dev
```

### 数据同步

```bash
# 完整同步 Tableau 元数据（包括视图使用统计）
python3 backend/tableau_sync.py

# 跳过视图使用统计同步
python3 backend/tableau_sync.py --skip-usage

# 仅同步视图使用统计
python3 backend/tableau_sync.py --usage-only

# 指定数据库路径
python3 backend/tableau_sync.py --db-path data/metadata.db
```

**重要说明**（2025-12-25 修复）：
- ✅ 已修复仪表板字段关联缺失问题（`fetch_views_with_fields` 现在同时查询 sheets 和 dashboards）
- ✅ 字段-视图血缘关系现在完整采集（包括所有仪表板的字段）
- ⚠️ 如果数据库是 2025-12-25 之前同步的，建议重新同步以获取完整的血缘数据
- 📦 旧数据库备份位置：`data/metadata_backup_YYYYMMDD.db`

### 前端开发（在 frontend/ 目录下执行）

```bash
cd frontend

# 开发模式（默认端口 3200）
npm run dev

# 生产构建
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint
```

### 测试

```bash
# 基础 E2E 测试（12项：API + 页面加载）
node tests/e2e/test-e2e.mjs

# 功能测试（27项：筛选/排序/分页）
node tests/e2e/test-features.mjs

# 性能测试
node tests/e2e/test-performance.mjs
```

### 工具脚本

```bash
# 数据分析（scripts/analysis/）
python3 scripts/analysis/get_lineage_counts.py      # 血缘链路统计
python3 scripts/analysis/get_orphan_counts.py       # 孤立资源分析
python3 scripts/analysis/analyze_anomalies.py       # 异常数据分析

# 数据验证（scripts/validation/）
python3 scripts/validation/check_lineage_breaks.py  # 血缘链路完整性检查
python3 scripts/validation/cross_validate_lineage.py # 血缘交叉验证

# 数据维护（scripts/maintenance/）
python3 scripts/maintenance/update_datasource_stats.py  # 更新数据源统计
python3 scripts/maintenance/cleanup_embedded_tables.py  # 清理嵌入式表
python3 scripts/maintenance/calculate_complexity.py     # 计算字段复杂度

# 术语表初始化
python3 scripts/seed_glossary_terms.py                  # 初始化业务术语

# 可视化生成（scripts/generation/）
python3 scripts/generation/generate_sankey.py       # 生成 Sankey 血缘图
python3 scripts/generation/generate_lineage_html.py # 生成血缘 HTML 报告
```

### 调试和日志

```bash
# 查看后端日志
tail -f logs/backend.log

# 查看开发日志
tail -f dev.log

# 前端开发工具
# 浏览器访问 http://localhost:3100，打开开发者工具查看 React DevTools

# 后端调试（使用 pdb）
# 在代码中添加: import pdb; pdb.set_trace()
# 然后查看启动终端的交互式调试器
```

## 项目架构

### 目录结构

```
metadata分析/
├── frontend/                   # Next.js 前端应用
│   ├── src/
│   │   ├── app/                # Next.js App Router 页面
│   │   │   ├── page.tsx        # 首页（Overview 仪表板）
│   │   │   ├── layout.tsx      # 根布局
│   │   │   ├── databases/      # 数据库模块
│   │   │   ├── tables/         # 数据表模块 ⭐
│   │   │   ├── datasources/    # 数据源模块
│   │   │   ├── workbooks/      # 工作簿模块 ⭐
│   │   │   ├── views/          # 视图模块
│   │   │   ├── fields/         # 原始字段模块 ⭐
│   │   │   ├── metrics/        # 计算字段模块 ⭐
│   │   │   ├── glossary/       # 术语表模块
│   │   │   ├── projects/       # 项目模块
│   │   │   ├── users/          # 用户模块
│   │   │   └── search/         # 全局搜索
│   │   ├── components/         # 可复用组件
│   │   │   ├── AppLayout.tsx   # 应用布局
│   │   │   ├── DetailDrawer.tsx # 详情抽屉
│   │   │   ├── data-table/     # 表格组件系统
│   │   │   ├── cards/          # 卡片组件
│   │   │   ├── metrics/        # 指标相关组件
│   │   │   ├── fields/         # 字段相关组件
│   │   │   └── views/          # 视图相关组件
│   │   ├── hooks/              # 自定义 Hooks
│   │   │   └── useDataTable.ts # 核心表格逻辑
│   │   └── lib/                # 工具库
│   │       ├── api.ts          # API 封装
│   │       └── drawer-context.tsx
│   └── package.json
├── backend/                    # Flask 后端
│   ├── routes/                 # API 路由（模块化）
│   │   ├── __init__.py         # 路由注册
│   │   ├── databases.py        # 数据库接口
│   │   ├── tables.py           # 数据表接口
│   │   ├── datasources.py      # 数据源接口
│   │   ├── workbooks.py        # 工作簿接口
│   │   ├── views.py            # 视图接口
│   │   ├── fields.py           # 字段接口
│   │   ├── metrics.py          # 指标接口
│   │   ├── lineage.py          # 血缘接口
│   │   ├── glossary.py         # 术语表接口
│   │   ├── utils.py            # 工具函数
│   │   └── api_legacy.py       # 兼容接口
│   ├── services/               # 业务逻辑层
│   │   ├── tableau_client.py   # Tableau API 客户端
│   │   └── sync_manager.py     # 同步管理器
│   ├── models.py               # SQLAlchemy ORM 模型
│   ├── config.py               # 配置管理
│   ├── tableau_sync.py         # 同步入口（重导出）
│   └── init_db.py              # 数据库初始化
├── scripts/                    # 工具脚本
│   ├── analysis/               # 数据分析
│   ├── validation/             # 数据验证
│   ├── maintenance/            # 数据维护
│   └── generation/             # 可视化生成
├── data/
│   └── metadata.db             # SQLite 数据库
├── logs/                       # 日志目录
├── tests/                      # 测试目录
│   ├── e2e/                    # E2E 测试
│   └── validation/             # 验证测试
├── dev.py                      # 一键启动脚本
├── deploy.py                   # 生产部署脚本
├── run_backend.py              # 后端启动入口
└── requirements.txt            # Python 依赖
```

### 后端架构

**三层架构**：
1. **Routes 层** (`backend/routes/`): API 路由定义，参数验证，响应格式化
2. **Services 层** (`backend/services/`): 业务逻辑，Tableau API 交互，数据同步
3. **Models 层** (`backend/models.py`): ORM 模型，数据库访问

**数据同步流程**：
```
Tableau Server (GraphQL + REST API)
    ↓ (backend/services/tableau_client.py)
TableauMetadataClient: 认证、查询、分页处理
    ↓ (backend/services/sync_manager.py)
MetadataSync: 数据清洗、关系映射、预计算统计
    ↓ (backend/models.py)
SQLAlchemy ORM: 写入 SQLite
    ↓
metadata.db
```

**关键类**：
- `TableauMetadataClient`: 封装 Tableau API 认证和查询（PAT 令牌、GraphQL 分页）
- `MetadataSync`: 管理同步流程，包括 `sync_all()` 和 `sync_views_usage()`
- `calculate_stats()`: 预计算所有 `*_count` 字段，避免 API 层实时聚合

### 前端架构

**设计模式**：
- **App Router**: 使用 Next.js 16 App Router，文件系统路由
- **服务端组件优先**: 默认使用 React Server Components，仅需交互时使用 'use client'
- **URL 状态管理**: 筛选、排序、分页状态通过 URL 参数同步，支持书签和刷新保留

**核心 Hook: `useDataTable`** (`frontend/src/hooks/useDataTable.ts`)：

统一封装表格的筛选、排序、分页逻辑，支持前端（客户端）和后端（服务端）两种模式：

- **前端模式** (`serverSide: false`): 适用于数据量较小的列表，一次性加载全部数据，客户端筛选排序
- **后端模式** (`serverSide: true`): 适用于大数据量，服务端分页，通过 `onParamsChange` 回调触发 API 请求

关键特性：
- 自动 URL 同步（`useSearchParams` + `useRouter`）
- Facet 动态计数（未筛选时显示总数，筛选后显示匹配数）
- 排序状态切换（未排序 → 升序 → 降序 → 未排序）

使用示例详见：`frontend/src/app/fields/page.tsx`（前端模式）、`frontend/src/app/metrics/page.tsx`（后端模式）

## 核心功能

### v2.1 升级亮点

**数据表格组件系统**：
- `InlineFilter`: Chip 样式筛选器，支持多选、动态计数
- `SortButtons`: 排序按钮组，支持升序/降序切换
- `Pagination`: 分页控件，支持页码跳转
- `useDataTable`: 统一表格逻辑，封装筛选/排序/分页/URL状态

**已升级页面**：
- `/fields` - 原始字段：新增"指标依赖"、"视图引用"列
- `/tables` - 数据表：新增"原始列数"、"预览字段"列，智能状态标识
- `/metrics` - 计算字段：增强依赖字段可视化（头像叠加）
- `/workbooks` - 工作簿：美化上游数据源标签
- `/glossary` - 术语表：业务术语定义与管理
- `/views` - 视图分析：无访问视图按工作簿分组展示

详见：`docs/升级完成报告.md`

## 核心数据模型与血缘

### 数据流向

```
Tableau Server
    ↓ (GraphQL Metadata API)
TableauMetadataClient (backend/services/tableau_client.py)
    ↓ (数据清洗、关系映射)
MetadataSync (backend/services/sync_manager.py)
    ↓ (预计算统计字段)
SQLite (data/metadata.db)
    ↓ (Flask API)
Next.js Frontend
```

### 核心实体与关系

**数据资产层级**：`Database → Table → Datasource → Workbook → View → Field`

**关键实体**：
- **Database/DBTable/DBColumn**: 物理数据库层（通过 Tableau 连接信息推断）
- **Datasource**: Tableau 已发布数据源（连接到物理表）
- **Field**: 原始字段（来自数据源的物理列）
- **CalculatedField**: 计算字段/指标（基于公式创建）
- **Workbook**: 工作簿（包含多个视图/仪表板）
- **View**: 视图/仪表板（使用字段进行可视化）

**血缘关系表**：
- `table_to_datasource`: 表→数据源（上游血缘）
- `datasource_to_workbook`: 数据源→工作簿（引用关系）
- `field_to_view`: 字段→视图（使用关系）
- `regular_field_to_view`: 原始字段→视图（v5 拆分后）
- `calc_field_to_view`: 计算字段→视图（v5 拆分后）

### 预计算字段规范

所有 `*_count` 统计字段必须在 `MetadataSync.calculate_stats()` 中预计算，API 层只读取不计算。

**关键预计算字段**：
| 模型              | 预计算字段                                                      | 用途                     |
| ----------------- | --------------------------------------------------------------- | ------------------------ |
| `Workbook`        | `view_count`, `datasource_count`, `field_count`, `metric_count` | 工作簿资源统计           |
| `Datasource`      | `table_count`, `workbook_count`, `field_count`, `metric_count`  | 数据源使用情况           |
| `Field`           | `usage_count`, `metric_usage_count`                             | 字段被引用次数           |
| `CalculatedField` | `has_duplicates`, `duplicate_count`, `formula_hash`             | 重复指标检测（治理指标） |

**修复流程**：统计数据异常 → 检查 `sync_manager.py` 的采集逻辑 → 检查 `calculate_stats()` → 重新同步

## API 端点

后端 Flask 服务运行在 `localhost:8201`，前端通过 Next.js 代理访问 `/api/*`

| 路径                       | 说明           | 支持参数            |
| -------------------------- | -------------- | ------------------- |
| `/api/stats`               | 全局统计       | -                   |
| `/api/dashboard/analysis`  | 治理健康度分析 | -                   |
| `/api/databases`           | 数据库列表     | -                   |
| `/api/tables`              | 数据表列表     | -                   |
| `/api/datasources`         | 数据源列表     | -                   |
| `/api/fields`              | 字段列表       | `page`, `page_size` |
| `/api/metrics`             | 指标列表       | `page`, `page_size` |
| `/api/workbooks`           | 工作簿列表     | -                   |
| `/api/views`               | 视图列表       | -                   |
| `/api/projects`            | 项目列表       | -                   |
| `/api/users`               | 用户列表       | -                   |
| `/api/lineage/{type}/{id}` | 血缘关系       | -                   |
| `/api/search?q=`           | 全局搜索       | `q`                 |
| `/api/quality/overview`    | 数据质量概览   | -                   |

## 开发指南

### 如何添加新的资源模块

以添加"流程（Flows）"模块为例：

1. **后端**：
   - 在 `backend/models.py` 添加 `Flow` ORM 模型
   - 在 `backend/routes/` 创建 `flows.py` 并注册路由
   - 在 `backend/services/sync_manager.py` 添加 `sync_flows()` 方法
   - 添加预计算统计字段到 `calculate_stats()`

2. **前端**：
   - 在 `frontend/src/app/` 创建 `flows/page.tsx`
   - 使用 `useDataTable` Hook 实现筛选/排序/分页
   - 在 `frontend/src/components/AppLayout.tsx` 添加导航项
   - 在 `frontend/src/lib/api.ts` 添加 API 类型定义

3. **测试**：
   - 在 `tests/e2e/test-e2e.mjs` 添加 API 测试
   - 在 `tests/e2e/test-features.mjs` 添加功能测试

### 代码规范

- ✅ 永远使用真实数据，不使用 mock 数据
- ✅ 站在数据治理角度设计功能（孤立资源、重复指标、无描述字段等）
- ✅ 当前为只读模式，所有修改操作返回 405
- ✅ 组件使用 TypeScript 严格类型，文件使用 PascalCase/camelCase 命名
- ✅ 使用 Tailwind CSS 进行样式开发，使用 useMemo/useCallback 优化性能