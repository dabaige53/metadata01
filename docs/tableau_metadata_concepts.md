# Tableau 元数据概念详解

> 本文档详细解释 Tableau 元数据治理平台中涉及的各类元数据概念、属性含义及其在数据治理中的作用。

---

## 目录

1. [元数据概述](#元数据概述)
2. [数据流向架构](#数据流向架构)
3. [核心元数据实体](#核心元数据实体)
   - [Database（数据库连接）](#1-database数据库连接)
   - [DBTable（数据表）](#2-dbtable数据表)
   - [DBColumn（数据库列）](#3-dbcolumn数据库列)
   - [Datasource（数据源）](#4-datasource数据源)
   - [Field（字段）](#5-field字段)
   - [CalculatedField（计算字段）](#6-calculatedfield计算字段)
   - [Workbook（工作簿）](#7-workbook工作簿)
   - [View（视图/仪表板）](#8-view视图仪表板)
4. [辅助元数据实体](#辅助元数据实体)
   - [TableauUser（用户）](#9-tableauuser用户)
   - [Project（项目）](#10-project项目)
5. [指标治理实体](#指标治理实体)
   - [Metric（指标）](#11-metric指标)
   - [MetricVariant（指标变体）](#12-metricvariant指标变体)
   - [MetricDuplicate（重复指标）](#13-metricduplicate重复指标)
6. [血缘关系](#血缘关系)
7. [数据治理应用场景](#数据治理应用场景)

---

## 元数据概述

**元数据（Metadata）** 是"关于数据的数据"，在 Tableau 环境中，元数据描述了：

- 数据从哪里来（数据库、表）
- 数据如何被加工（数据源、计算字段）
- 数据如何被展示（工作簿、视图）
- 数据的所有者、认证状态等治理信息

Tableau 提供两种 API 获取元数据：

- **Metadata API (GraphQL)**：获取详细的元数据和血缘关系
- **REST API**：获取资产基本信息和权限

---

## 数据流向架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              数据流向图                                      │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ Database │ ───▶ │  Table   │ ───▶ │  Column  │
  │ 数据库    │      │  数据表   │      │  数据列   │
  └──────────┘      └──────────┘      └──────────┘
                          │
                          ▼
                    ┌──────────┐
                    │Datasource│
                    │  数据源   │
                    └──────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
      ┌──────────┐  ┌──────────┐  ┌──────────┐
      │  Field   │  │ Workbook │  │  Metric  │
      │  字段    │  │  工作簿   │  │  指标    │
      └──────────┘  └──────────┘  └──────────┘
                          │
                          ▼
                    ┌──────────┐
                    │   View   │
                    │ 视图/仪表板│
                    └──────────┘
```

---

## 核心元数据实体

### 1. Database（数据库连接）

**定义**：代表 Tableau 连接的外部数据库系统。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | Tableau 内部唯一标识符 |
| `luid` | String | REST API 标识符（Locally Unique ID） |
| `name` | String | 数据库名称 |
| `connection_type` | String | 连接类型 |
| `host_name` | String | 数据库主机地址 |
| `port` | Integer | 连接端口号 |
| `service` | String | 服务名（Oracle 等数据库使用） |
| `description` | Text | 数据库描述 |
| `is_certified` | Boolean | 是否经过认证 |
| `certification_note` | Text | 认证说明 |
| `platform` | String | 部署平台（cloud/on-prem） |

**常见连接类型 (connection_type)**：

- `snowflake` - Snowflake 云数据仓库
- `sqlserver` - Microsoft SQL Server
- `oracle` - Oracle Database
- `postgres` - PostgreSQL
- `mysql` - MySQL
- `excel-direct` - Excel 文件
- `textscan` - CSV/文本文件
- `bigquery` - Google BigQuery

**数据治理意义**：

- 识别所有数据来源
- 追踪数据库连接的认证状态
- 监控是否有未授权的数据库连接

---

### 2. DBTable（数据表）

**定义**：数据库中的物理表或视图，是数据的实际存储位置。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `name` | String | 表名 |
| `full_name` | String | 完整名称（含 schema） |
| `schema` | String | 所属 schema |
| `database_id` | String | 关联的数据库 ID |
| `connection_type` | String | 连接类型 |
| `table_type` | String | 表类型（table/view） |
| `description` | Text | 表描述 |
| `is_embedded` | Boolean | 是否为嵌入式表 |
| `is_certified` | Boolean | 是否认证 |
| `certification_note` | Text | 认证说明 |
| `project_name` | String | 所属 Tableau 项目名称 |

**嵌入式表 vs 发布表**：

- **嵌入式表**（is_embedded=True）：直接包含在数据源/工作簿中的表定义
- **发布表**（is_embedded=False）：通过已发布数据源引用的表

**数据治理意义**：

- 了解底层数据结构
- 识别哪些物理表被 Tableau 使用
- 检测未记录描述的表

---

### 3. DBColumn（数据库列）

**定义**：数据表中的原生列，保留数据库的原始数据类型信息。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `name` | String | 列名 |
| `remote_type` | String | 数据库原生数据类型 |
| `description` | Text | 列描述/业务含义 |
| `is_nullable` | Boolean | 是否允许空值 |
| `is_certified` | Boolean | 是否认证 |
| `certification_note` | Text | 认证说明 |
| `table_id` | String | 所属表 ID |

**常见 remote_type 示例**：

- `NUMBER(18,2)` - Oracle 数值类型
- `VARCHAR2(255)` - Oracle 字符串
- `INT` / `BIGINT` - 整数类型
- `TIMESTAMP` / `DATE` - 日期时间类型
- `BOOLEAN` - 布尔类型

**数据治理意义**：

- 了解字段的真实数据类型
- 识别数据类型不一致的情况
- 检测缺少业务描述的列

---

### 4. Datasource（数据源）

**定义**：Tableau 数据源是连接数据库和可视化之间的桥梁，封装了数据连接、转换和字段定义。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `name` | String | 数据源名称 |
| `description` | Text | 数据源描述 |
| `uri` | String | 数据源 URI |
| `project_name` | String | 所属项目名称 |
| `owner` | String | 所有者用户名 |
| `owner_id` | String | 所有者 ID |
| `has_extract` | Boolean | 是否使用数据提取 |
| `extract_last_refresh_time` | DateTime | 提取最后刷新时间 |
| `extract_last_incremental_update_time` | DateTime | 增量更新时间 |
| `is_certified` | Boolean | 是否认证 |
| `certification_note` | Text | 认证说明 |
| `certifier_display_name` | String | 认证者名称 |
| `contains_unsupported_custom_sql` | Boolean | 是否包含不支持的自定义 SQL |
| `has_active_warning` | Boolean | 是否有活动警告 |

**数据提取 (Extract) vs 实时连接 (Live)**：

- **Extract（has_extract=True）**：数据被提取到 .hyper 文件，定期刷新
- **Live（has_extract=False）**：每次查询实时连接数据库

**数据治理意义**：

- 识别未认证的数据源
- 监控提取刷新状态
- 发现包含自定义 SQL 的数据源（可能存在性能或安全风险）
- 追踪数据源所有权

---

### 5. Field（字段）

**定义**：数据源或工作簿中的字段，可以是直接映射的数据库列，也可以是计算字段。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `name` | String | 字段名称（可被重命名） |
| `fully_qualified_name` | String | 完全限定名（内部唯一标识） |
| `upstream_column_name` | String | **原始列名**（数据库表的物理列名） |
| `caption` | String | 显示标题（用户看到的名称） |
| `data_type` | String | Tableau 数据类型 |
| `remote_type` | String | 数据库原生类型 |
| `description` | Text | 字段描述 |
| `table_id` | String | 关联的表 ID |
| `datasource_id` | String | 关联的数据源 ID |
| `workbook_id` | String | 关联的工作簿 ID |
| `is_calculated` | Boolean | 是否为计算字段 |
| `formula` | Text | 计算公式（如果是计算字段） |
| `role` | String | 字段角色 |
| `aggregation` | String | 默认聚合方式 |
| `is_hidden` | Boolean | 是否隐藏 |
| `folder_name` | String | 所属文件夹名称 |

#### 🔤 字段名称层次结构

Tableau 中的字段存在 **四个层次的名称**，理解这些层次对于数据血缘追溯至关重要：

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           字段名称层次                                      │
│                                                                            │
│   数据库层                    Tableau 层                    显示层          │
│   ─────────────────────────────────────────────────────────────────────    │
│                                                                            │
│   ① upstreamColumns  ──▶  ② fullyQualifiedName  ──▶  ③ name / caption     │
│      (原始列名)              (完全限定名)                (重命名后名称)       │
│                                                              │             │
│                                                              ▼             │
│                                                        ④ alias            │
│                                                           (成员别名)        │
└────────────────────────────────────────────────────────────────────────────┘
```

| 层次 | 字段名 | 说明 | 示例 |
|------|--------|------|------|
| ① **原始列名** | `upstreamColumns` | 数据库表中的**物理列名**，不可修改 | `ORDER_AMOUNT` |
| ② **完全限定名** | `fullyQualifiedName` | Tableau 内部的**唯一标识符**，包含数据源和表路径 | `[Sample - Superstore].[Orders].[ORDER_AMOUNT]` |
| ③ **重命名后名称** | `name` / `caption` | 用户在 Tableau 中**重命名后的显示名** | `订单金额` |
| ④ **成员别名** | `alias` | 维度**成员值**的替代显示名（非字段名） | `"华东" 替代 "East"` |

#### 名称层次详解

**① 原始列名 (`upstreamColumns`)**

- 来源于数据库表的物理列名
- 通过 Metadata API 的 `upstreamColumns` 关系查询
- 是数据血缘追溯的终点
- **不会因为 Tableau 中的操作而改变**

**② 完全限定名 (`fullyQualifiedName`)**

- Tableau 内部使用的唯一标识
- 格式：`[数据源名].[表名].[列名]` 或 `[表名].[列名]`
- 用于计算字段中引用其他字段
- 在血缘分析和影响分析中作为稳定的引用

**③ 重命名后名称 (`name` / `caption`)**

- 用户在 Tableau Desktop 或 Server 中看到的名称
- 可以通过右键菜单"重命名"修改
- `name` 是字段的标识名，`caption` 是显示标题
- **修改后不影响原始列名和完全限定名**

**④ 成员别名 (`alias`)**

- 用于维度字段的**成员值**（非字段名本身）
- 例如：将 "East Region" 显示为 "华东区"
- 通过 数据 → 编辑别名 设置
- 仅适用于离散维度

#### 血缘追溯示例

```
用户看到的字段名：    "销售金额"           ← name/caption（重命名后）
        ↓
完全限定名：          [订单].[Sales]       ← fullyQualifiedName
        ↓
原始数据库列：        SALES_AMOUNT         ← upstreamColumns（原始名称）
        ↓
物理表.列：          dbo.Orders.SALES_AMOUNT
```

**Tableau 数据类型 (data_type)**：

- `string` - 字符串
- `integer` - 整数
- `real` / `float` - 浮点数
- `date` - 日期
- `datetime` - 日期时间
- `boolean` - 布尔值

**字段角色 (role)**：

- `dimension` - **维度**：分类字段，用于分组（如：地区、产品类别）
- `measure` - **度量**：数值字段，用于计算（如：销售额、数量）

**聚合方式 (aggregation)**：

- `Sum` - 求和
- `Avg` - 平均值
- `Count` - 计数
- `CountD` - 去重计数
- `Min` / `Max` - 最小/最大值
- `None` - 无聚合（维度）

**数据治理意义**：

- 识别重复或相似的字段定义
- 检测未描述的字段
- 分析字段使用频率
- 发现复杂的计算字段

---

### 6. CalculatedField（计算字段）

**定义**：通过 Tableau 计算语言创建的派生字段，包含公式逻辑。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `field_id` | String | 关联的字段 ID |
| `name` | String | 计算字段名称 |
| `formula` | Text | 计算公式 |
| `reference_count` | Integer | 被引用次数 |
| `complexity_score` | Float | 复杂度评分 |

**公式示例**：

```
// 利润率计算
SUM([Profit]) / SUM([Sales])

// 条件逻辑
IF [Sales] > 10000 THEN "High" 
ELSEIF [Sales] > 5000 THEN "Medium" 
ELSE "Low" 
END

// 日期计算
DATEDIFF('day', [Order Date], [Ship Date])
```

**复杂度评分因素**：

- 嵌套函数数量
- 条件分支数量
- 引用的字段数量
- 表计算使用

**数据治理意义**：

- 识别过于复杂的计算（可能影响性能）
- 发现可能导致一致性问题的公式
- 统一相似计算逻辑

---

### 7. Workbook（工作簿）

**定义**：Tableau 工作簿是可视化内容的容器，包含多个视图和仪表板。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `name` | String | 工作簿名称 |
| `description` | Text | 工作簿描述 |
| `uri` | String | 工作簿 URI |
| `project_name` | String | 所属项目名称 |
| `owner` | String | 所有者用户名 |
| `owner_id` | String | 所有者 ID |
| `contains_unsupported_custom_sql` | Boolean | 是否包含不支持的自定义 SQL |
| `has_active_warning` | Boolean | 是否有活动警告 |

**数据治理意义**：

- 追踪工作簿所有权
- 识别包含警告的工作簿
- 管理工作簿生命周期

---

### 8. View（视图/仪表板）

**定义**：工作簿中的单个可视化页面，可以是工作表 (Sheet) 或仪表板 (Dashboard)。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `document_view_id` | String | 工作簿内唯一 ID |
| `name` | String | 视图名称 |
| `path` | String | 服务器路径 |
| `view_type` | String | 视图类型 |
| `index` | Integer | 在工作簿中的顺序 |
| `workbook_id` | String | 所属工作簿 ID |

**视图类型 (view_type)**：

- `sheet` - 工作表（单个可视化）
- `dashboard` - 仪表板（多个工作表组合）
- `story` - 故事（多个仪表板串联）

**数据治理意义**：

- 了解可视化资产数量
- 追踪哪些字段被哪些视图使用
- 分析视图使用情况

---

## 辅助元数据实体

### 9. TableauUser（用户）

**定义**：Tableau Server/Cloud 中的用户账户。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `name` | String | 用户名 |
| `display_name` | String | 显示名称 |
| `email` | String | 邮箱地址 |
| `domain` | String | 域名 |
| `site_role` | String | 站点角色 |

**站点角色 (site_role)**：

- `Creator` - 创建者（可创建数据源、工作簿）
- `Explorer` - 探索者（可编辑已有内容）
- `Viewer` - 查看者（只能查看）
- `SiteAdministratorCreator` - 站点管理员
- `Unlicensed` - 未授权

---

### 10. Project（项目）

**定义**：Tableau 中用于组织内容的文件夹结构。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `luid` | String | REST API 标识符 |
| `name` | String | 项目名称 |
| `description` | Text | 项目描述 |
| `parent_project_id` | String | 父项目 ID（支持嵌套） |
| `vizportal_url_id` | String | VizPortal URL 标识 |

---

## 指标治理实体

### 11. Metric（指标）

**定义**：标准化的业务指标定义，用于统一指标口径。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | String | 唯一标识符 |
| `name` | String | 指标名称 |
| `description` | Text | 指标描述 |
| `formula` | Text | 计算公式 |
| `formula_hash` | String(64) | 公式哈希（用于去重） |
| `metric_type` | String | 指标类型 |
| `owner` | String | 指标负责人 |
| `status` | String | 指标状态 |
| `complexity_score` | Integer | 复杂度评分 |

**指标类型 (metric_type)**：

- `KPI` - 关键绩效指标
- `Calculated` - 计算指标
- `Ratio` - 比率指标
- `Aggregate` - 聚合指标

**指标状态 (status)**：

- `active` - 活跃使用中
- `review` - 待审核
- `deprecated` - 已废弃
- `duplicate` - 重复指标

---

### 12. MetricVariant（指标变体）

**定义**：同一指标在不同数据源/工作簿中的变体版本。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | Integer | 唯一标识符 |
| `master_metric_id` | String | 主指标 ID |
| `variant_name` | String | 变体名称 |
| `source` | String | 来源（数据源/工作簿名称） |

---

### 13. MetricDuplicate（重复指标）

**定义**：检测到的可能重复的指标对。

| 属性名 | 数据类型 | 说明 |
|--------|----------|------|
| `id` | Integer | 唯一标识符 |
| `metric_id` | String | 原始指标 ID |
| `duplicate_metric_id` | String | 疑似重复指标 ID |
| `similarity_score` | Float | 相似度评分（0-1） |
| `detection_method` | String | 检测方法 |
| `status` | String | 处理状态 |

**检测方法 (detection_method)**：

- `hash` - 公式哈希匹配
- `semantic` - 语义相似度分析
- `manual` - 人工标记

---

## 血缘关系

Tableau 元数据的血缘关系通过关联表维护：

### table_to_datasource（表→数据源）

追踪哪些数据库表被哪些数据源使用。

| 属性名 | 说明 |
|--------|------|
| `table_id` | 数据表 ID |
| `datasource_id` | 数据源 ID |
| `relationship_type` | 关系类型 |

### datasource_to_workbook（数据源→工作簿）

追踪哪些数据源被哪些工作簿引用。

| 属性名 | 说明 |
|--------|------|
| `datasource_id` | 数据源 ID |
| `workbook_id` | 工作簿 ID |

### field_to_view（字段→视图）

追踪哪些字段被哪些视图使用。

| 属性名 | 说明 |
|--------|------|
| `field_id` | 字段 ID |
| `view_id` | 视图 ID |
| `used_in_formula` | 是否在公式中使用 |

---

## 数据治理应用场景

### 1. 数据质量监控

| 检查项 | 相关元数据 | 指标 |
|--------|-----------|------|
| 描述覆盖率 | 所有实体的 `description` | 有描述的资产百分比 |
| 认证率 | `is_certified` 字段 | 已认证资产百分比 |
| 数据新鲜度 | `extract_last_refresh_time` | 提取刷新及时性 |

### 2. 影响分析

当需要修改数据库表时：

1. 通过 `table_to_datasource` 找到影响的数据源
2. 通过 `datasource_to_workbook` 找到影响的工作簿
3. 通过工作簿找到影响的视图
4. 通知相关所有者

### 3. 指标一致性

1. 检测公式哈希相同但名称不同的计算字段
2. 识别语义相似的指标定义
3. 建立标准指标库，消除重复

### 4. 安全合规

1. 识别使用自定义 SQL 的数据源（`contains_unsupported_custom_sql`）
2. 追踪敏感数据的使用范围
3. 审计数据访问路径

---

## 附录：常用 Tableau Metadata API 查询

### 获取数据库列表

```graphql
{
  databases {
    id
    name
    connectionType
    tables {
      name
    }
  }
}
```

### 获取数据源血缘

```graphql
{
  publishedDatasources {
    id
    name
    upstreamTables {
      name
      database {
        name
      }
    }
  }
}
```

### 获取字段使用情况

```graphql
{
  fields {
    id
    name
    datasource {
      name
    }
    referencedByCalculations {
      name
    }
  }
}
```

---

*文档版本：1.0*  
*最后更新：2025-12-17*  
*维护团队：数据治理团队*
