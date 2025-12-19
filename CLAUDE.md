# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tableau 元数据治理平台前端 - 基于 Next.js 构建的现代化 Web 应用，提供数据治理分析界面。后端 API 由 Flask 提供，存储于 SQLite 数据库。参考开源项目设计、元数据采集、元数据管理、血缘分析等理念，<https://github.com/datahub-project/datahub>

**最新版本**: v2.0 (2025-12-18)

- ✅ 完整的筛选、排序、分页功能
- ✅ 100% 功能对齐 Flask 8001 版本
- ✅ 通过 39 项 E2E 测试

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

### 运行测试

```bash
# 基础测试 (12项)
node test-e2e.js

# 功能测试 (27项)
node test-features.js
```

## 常用命令

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm run start

# 代码检查
npm run lint

# 类型检查
npm run type-check
```

## 项目结构

```
metadata分析/
├── frontend/                   # Next.js 前端应用
│   ├── src/
│   │   ├── app/                # Next.js App Router 页面
│   │   │   ├── page.tsx        # 首页（Overview 仪表板）
│   │   │   ├── layout.tsx      # 根布局
│   │   │   ├── globals.css     # 全局样式
│   │   │   ├── databases/      # 数据库模块
│   │   │   ├── tables/         # 数据表模块 ⭐ 已升级
│   │   │   ├── datasources/    # 数据源模块
│   │   │   ├── workbooks/      # 工作簿模块 ⭐ 已升级
│   │   │   ├── views/          # 视图模块
│   │   │   ├── fields/         # 字段字典模块 ⭐ 已升级
│   │   │   ├── metrics/        # 指标库模块 ⭐ 已升级
│   │   │   ├── projects/       # 项目模块
│   │   │   ├── users/          # 用户模块
│   │   │   └── search/         # 全局搜索
│   │   ├── components/         # 可复用组件
│   │   │   ├── AppLayout.tsx   # 应用布局（侧边栏导航）
│   │   │   ├── DetailDrawer.tsx # 详情抽屉面板
│   │   │   └── data-table/     # ⭐ 新增表格组件系统
│   │   │       ├── InlineFilter.tsx   # Chip样式筛选器
│   │   │       ├── SortButtons.tsx    # 排序按钮组
│   │   │       └── Pagination.tsx     # 分页控件
│   │   ├── hooks/              # ⭐ 自定义 Hooks
│   │   │   └── useDataTable.ts # 表格逻辑封装（核心）
│   │   └── lib/                # 工具库
│   │       ├── api.ts          # API 请求封装
│   │       └── drawer-context.tsx # 抽屉状态管理
│   ├── public/                 # 静态资源
│   ├── next.config.ts          # Next.js 配置
│   ├── tailwind.config.ts      # Tailwind 配置
│   └── tsconfig.json           # TypeScript 配置
├── backend/                    # Flask 后端
│   ├── routes/                 # API 路由
│   ├── models.py               # 数据模型
│   ├── config.py               # 配置文件
│   ├── tableau_sync.py         # 数据同步脚本
│   └── init_db.py              # 数据库初始化脚本
├── run_backend.py              # 后端启动入口
├── test-e2e.js                 # ⭐ E2E 基础测试脚本
├── test-features.js            # ⭐ 功能测试脚本
├── 快速启动指南.md             # ⭐ 用户指南
├── E2E测试报告.md              # ⭐ 测试报告
├── 升级完成报告.md             # ⭐ 技术详情
└── 差异分析和修复方案.md       # ⭐ 规划文档
```

## 核心功能

### 数据表格系统 (v2.0 新增)

**核心组件**:

- `InlineFilter`: Chip 样式筛选器，支持多选、动态计数
- `SortButtons`: 排序按钮组，支持升序/降序切换
- `Pagination`: 分页控件，支持首页/末页/页码跳转
- `useDataTable`: 统一表格逻辑 Hook，封装筛选/排序/分页/URL状态

**使用示例**:

```typescript
import { useDataTable } from '@/hooks/useDataTable';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';

const {
  displayData,        // 处理后的显示数据
  facets,             // 筛选维度统计
  sortState,          // 当前排序状态
  paginationState,    // 当前分页状态
  handleFilterChange, // 筛选变化处理
  handleSortChange,   // 排序变化处理
  handlePageChange    // 分页变化处理
} = useDataTable({
  moduleName: 'fields',
  data: allData,
  facetFields: ['role', 'data_type'],
  defaultPageSize: 50,
  searchFields: ['name', 'formula']
});
```

### 升级页面功能

#### 1. 字段字典 (/fields)

- ✅ 筛选: 角色 (度量/维度)、数据类型、有描述
- ✅ 排序: 热度、名称 (升序/降序)
- ✅ 分页: 每页50条，URL状态同步
- ✅ **新增列**: 指标依赖 (可点击跳转)、视图引用 (显示数量)

#### 2. 数据表 (/tables)

- ✅ 筛选: Schema
- ✅ 排序: 字段数、名称
- ✅ 分页: 每页50条
- ✅ **新增列**: 原始列数、预览字段 (度量/维度标签)
- ✅ 智能状态: 使用中/仅关联/孤立

#### 3. 指标库 (/metrics)

- ✅ 筛选: 指标类型、角色、有重复
- ✅ 排序: 复杂度、引用数、名称
- ✅ 分页: 每页50条
- ✅ **增强可视化**: 依赖字段头像叠加 (6x6 + 颜色 + 阴影)

#### 4. 工作簿 (/workbooks)

- ✅ 排序: 视图数、名称
- ✅ 分页: 每页50条
- ✅ **美化**: 上游数据源蓝紫色标签

## 核心数据模型

数据流向：`Database → Table → Datasource → Workbook → View`

关键实体：

- **Database/DBTable/DBColumn**: 数据库连接层
- **Datasource**: Tableau 已发布数据源
- **Field/CalculatedField**: 字段与计算字段
- **Workbook/View**: 工作簿与视图/仪表板
- **Project/User**: 项目与用户管理

血缘关系表：

- `table_to_datasource`: 表→数据源
- `datasource_to_workbook`: 数据源→工作簿
- `field_to_view`: 字段→视图

## API 端点（后端 Flask 服务 - localhost:8001）

| 路径 | 说明 | 支持参数 |
|------|------|---------|
| `/api/stats` | 全局统计 | - |
| `/api/dashboard/analysis` | 治理健康度分析 | - |
| `/api/databases` | 数据库列表 | - |
| `/api/tables` | 数据表列表 | - |
| `/api/datasources` | 数据源列表 | - |
| `/api/fields` | 字段列表 | `page`, `page_size` |
| `/api/metrics` | 指标列表 | `page`, `page_size` |
| `/api/workbooks` | 工作簿列表 | - |
| `/api/views` | 视图列表 | - |
| `/api/projects` | 项目列表 | - |
| `/api/users` | 用户列表 | - |
| `/api/lineage/{type}/{id}` | 血缘关系 | - |
| `/api/search?q=` | 全局搜索 | `q` |
| `/api/quality/overview` | 数据质量概览 | - |

## 开发规范

### 代码规范

- ✅ 永远使用真实数据，不使用 mock 数据
- ✅ 站在数据治理角度设计程序
- ✅ 当前为只读模式，所有修改操作返回 405
- ✅ 组件使用 TypeScript 严格类型定义
- ✅ 使用 Tailwind CSS 进行样式开发
- ✅ 组件完全解耦，可复用
- ✅ 使用 useMemo/useCallback 优化性能

### 数据治理 Tab 切换设计规范

每个数据资产模块应采用 Tab 切换界面展示不同治理场景：

**设计原则**:

- 第一个 Tab 为"资产列表"，是默认视图
- 后续 Tab 为"治理分析"视图，聚焦特定数据质量问题
- Tab 样式统一使用 `bg-gray-100/80 rounded-lg` 容器
- 激活态使用 `bg-white text-indigo-600 shadow-sm`

**代码模式**:

```tsx
const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');

// Tab 切换组件
<div className="flex p-1 bg-gray-100/80 rounded-lg">
  <button
    onClick={() => setActiveTab('list')}
    className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
      activeTab === 'list'
        ? 'bg-white text-indigo-600 shadow-sm'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    资产列表
  </button>
  <button onClick={() => setActiveTab('analysis')} ...>
    治理分析
  </button>
</div>
```

**各模块治理场景**:

| 模块 | Tab 1 (默认) | Tab 2+ (治理分析) |
|------|-------------|-------------------|
| 指标库 ✅ | 指标列表 | 重复指标分析 |
| 字段字典 | 字段列表 | 无描述字段 / 孤立字段 |
| 数据表 | 数据表列表 | 未使用表 / 宽表分析 |
| 数据源 | 数据源列表 | 未认证数据源 / 孤立数据源 |
| 工作簿 | 工作簿列表 | 无视图工作簿 / 单源依赖分析 |
| 视图 | 视图列表 | 无访问视图 / 复杂视图 |

### 文件命名

- 组件: `PascalCase.tsx`
- Hook: `useCamelCase.ts`
- 工具函数: `camelCase.ts`
- 类型定义: 在组件文件内或 `types.ts`

### 状态管理

- 页面状态: `useState`
- 跨组件状态: React Context
- URL 状态: `useSearchParams` + `useRouter`
- 服务器状态: fetch + useState

## 测试指南

### E2E 测试

```bash
# 基础测试 (API + 页面加载)
node test-e2e.js

# 功能测试 (筛选/排序/分页)
node test-features.js
```

## 文档资源

| 文档 | 用途 | 读者 |
|------|------|------|
| `快速启动指南.md` | 启动和使用 | 用户/测试人员 |
| `E2E测试报告.md` | 测试结果详情 | 测试人员/QA |
| `升级完成报告.md` | 技术实现细节 | 开发者 |
| `差异分析和修复方案.md` | 完整规划 | 架构师/规划者 |
