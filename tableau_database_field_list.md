# Tableau Metadata API 导出结构 — 数据库字段列表（DB Fields）完整介绍

本页面介绍 **Tableau Metadata API 可导出字段的完整数据库设计结构（ERD 字段级说明）**，包括：
- 数据库（Database）层字段
- 表（Table）层字段
- 列（Field / Column）层字段
- 数据源（Data Source）字段
- 工作簿（Workbook）字段
- 视图（View）字段
- 计算字段（Calculated Field）字段
- 指标关联字段（Measure / Dimension）
- 血缘（Lineage）字段

以下内容可用于：
- 构建元数据仓库
- 设计治理系统数据库（DB Schema）
- 构建元数据分析模型
- 元数据爬虫的字段映射

---

## 📌 1. Database（数据库）字段
**Metadata API 对应对象：database**

| 字段名 | 含义 | 示例 | 说明 |
|-------|------|------|------|
| id | 数据库唯一ID | db123 | Metadata API 主键 |
| name | 数据库名称 | SalesDB | 显示名称 |
| connectionType | 连接器类型 | snowflake / sqlserver | Tableau检测到的数据源类型 |
| hostName | 数据库主机地址 | example.snowflakecomputing.com | 取决于权限 |
| platform | 平台类型 | cloud / on-prem | 系统识别 |
| upstreamTables | 上游表列表 | Array | 多表关系 |

---

## 📌 2. Table（数据表）字段
**Metadata API 对应对象：table**

| 字段 | 含义 | 示例 |
|------|------|------|
| id | 表唯一ID | table_98f1 | 主键 |
| name | 表名 | FACT_SALES | 自动解析 |
| fullName | 完整表名 | SALES.FACT_SALES | 带 schema |
| schema | Schema 名 | SALES | |
| database.id | 所属数据库ID | db123 | 外键 |
| connectionType | 数据库类型 | snowflake | |
| isEmbedded | 是否嵌入式连接 | true/false | |
| columns | 字段列表 | array | 下游 Fields |
| downstreamDatasources | 表→数据源 血缘 | array | |
| downstreamWorkbooks | 表→工作簿 血缘 | array | |

---

## 📌 3. Field / Column（字段）层字段
**Metadata API 对象：column / field**

| 字段 | 含义 | 示例 |
|------|------|------|
| id | 字段唯一ID | col_c9cc | 主键 |
| name | 字段名 | SALES_AMT | |
| dataType | 字段类型 | float / int / string | Tableau 自动识别 |
| remoteType | 原始数据库类型 | NUMBER(18,2) | 原始数据库字段类型 |
| description | 字段描述 | 销售金额 | 可维护 |
| table.id | 所属表 | table_98f1 | 外键 |
| datasource.id | 来源数据源 | ds_598a | 外键 |
| workbook.id | 来源工作簿（若计算字段） | wb_32ef | 可空 |
| isCalculated | 是否为计算字段 | true | |
| formula | 计算公式 | SUM([Sales]) | 计算字段时存在 |
| upstreamColumns | 字段上游映射 | array | 字段级血缘 |
| downstreamFields | 下游依赖 | array | 计算字段解析后获得 |

---

## 📌 4. Data Source（数据源）字段
**Metadata API 对象：datasource**

| 字段 | 含义 | 示例 |
|------|------|------|
| id | 数据源ID | ds_123 | 主键 |
| name | 名称 | Sales Source | |
| hasExtract | 是否为 Extract | true/false | |
| extractLastRefreshTime | 最近刷新时间 | 2025-01-08 | |
| projectName | 所在项目 | Sales Analytics | |
| upstreamTables | 数据源依赖的表 | array | |
| fields | 数据源字段列表 | array | |
| downstreamWorkbooks | 下游引用 | array | |

---

## 📌 5. Workbook（工作簿）字段
**Metadata API 对象：workbook**

| 字段 | 含义 |
|------|------|
| id | 工作簿ID |
| name | 工作簿名称 |
| projectName | 所属项目 |
| owner.username | 所有者 |
| createdAt | 创建时间 |
| updatedAt | 修改时间 |
| downstreamViews | 下属视图 |
| upstreamDatasources | 使用的数据源 |
| usedFields | 工作簿使用字段汇总 |

---

## 📌 6. View（视图 / Sheet）字段
**Metadata API 对象：view**

| 字段 | 含义 |
|-------|------|
| id | 视图ID |
| name | 名称 |
| workbook.id | 所属工作簿 |
| upstreamFields | 使用的字段（字段→视图） |
| upstreamDatasources | 使用的数据源 |

---

## 📌 7. Calculated Fields（计算字段）
Metadata API 不叫这个对象，但 `fields.isCalculated == true` 即为计算字段。
可抽象字段：

| 字段 | 含义 |
|------|------|
| field_id | 字段ID |
| name | 字段名 |
| formula | Tableau 计算公式 |
| referenceCount | 引用字段数量 |
| complexityScore | 自动计算复杂度（可自定义） |

---

## 📌 8. Lineage（血缘字段）
血缘在 Metadata API 中不是一个表，而是一组“上下游”结构：

### 表 → 数据源：`upstreamTables`, `downstreamDatasources`
### 数据源 → 工作簿：`downstreamWorkbooks`
### 字段 → 视图：`upstreamFields`

你可在数据库设计中对应为：
- table_to_datasource
- datasource_to_workbook
- field_to_view
- measure_lineage

---

## 📌 9. 推荐的数据库设计（字段级）
结合 Metadata API → 推荐存储结构：
- databases
- tables
- fields
- datasources
- workbooks
- views
- lineage 关系表（多个）
- measures / dimensions
- calculated_fields
- formula_dependencies

这是我们前面讨论的完整元数据结构。

如果你希望，我可以：
👉生成**完整建表 SQL（MySQL/PostgreSQL）**
👉生成**字段与 Metadata API JSON 的对应映射表**
👉生成**元数据库字段文档（CSV / Excel）**


---

# 📘 字段字典（Field Dictionary）
以下字段字典根据 **Tableau Metadata API 输出的结构** 汇总，是为构建元数据仓库或数据治理平台使用的标准字段文档。你可以直接复制成 Excel 使用。

## 📍 目录结构
- Database 字段字典
- Table 字段字典
- Field / Column 字段字典
- Data Source 字段字典
- Workbook 字段字典
- View 字段字典
- Lineage 字段字典
- Calculated Field 字段字典
- Metric / Dimension 字段字典

---

## 🗄️ 1. Database（数据库）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| id | string | db_123 | 数据库唯一 ID |
| name | string | SalesDB | 数据库名称 |
| connectionType | string | snowflake | 数据库连接类型 |
| hostName | string | acme.snowflakecomputing.com | 主机地址（若可获取） |
| platform | string | cloud | 平台类型（cloud/on-prem） |

---

## 🗄️ 2. Table（数据表）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| id | string | table_98f1 | 表唯一 ID |
| name | string | FACT_SALES | 表名 |
| fullName | string | SALES.FACT_SALES | 完整表名 |
| schema | string | SALES | Schema 名称 |
| databaseId | string | db_123 | 外键 → database.id |
| connectionType | string | snowflake | 数据库类型 |
| isEmbedded | boolean | false | 是否为嵌入式连接 |
| columns | array | — | 表字段列表 |

---

## 🗄️ 3. Field / Column（字段）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| id | string | col_c9cc | 字段唯一 ID |
| name | string | SALES_AMT | 字段名 |
| dataType | string | float | Tableau 判断类型 |
| remoteType | string | NUMBER(18,2) | 原始数据库字段类型 |
| description | string | 销售金额 | 字段描述 |
| tableId | string | table_98f1 | 来源表 |
| datasourceId | string | ds_598a | 来源数据源 |
| workbookId | string | wb_32ef | 若为计算字段，则有来源报表 |
| isCalculated | boolean | true | 是否为计算字段 |
| formula | string | SUM([Sales]) | 计算公式（若有） |
| upstreamColumns | array | — | 上游字段列表 |
| downstreamFields | array | — | 下游字段列表 |

---

## 🗄️ 4. Data Source（数据源）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| id | string | ds_123 | 数据源 ID |
| name | string | Sales Source | 数据源名称 |
| projectName | string | Sales Analytics | 所属项目 |
| owner | string | admin | 管理者 |
| hasExtract | boolean | true | 是否为 Extract 提取 |
| extractLastRefreshTime | timestamp | 2025-01-07 | 最近刷新时间 |
| upstreamTables | array | — | 表 → 数据源关系 |
| fields | array | — | 字段列表 |
| downstreamWorkbooks | array | — | 引用该数据源的工作簿 |

---

## 🗄️ 5. Workbook（工作簿）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| id | string | wb_11a2 | 工作簿 ID |
| name | string | 销售分析看板 | 工作簿名称 |
| projectName | string | Retail Analytics | 所属项目 |
| owner | string | analyst | 所有人 |
| createdAt | timestamp | 2024-08-12 | 创建时间 |
| updatedAt | timestamp | 2025-01-01 | 修改时间 |
| upstreamDatasources | array | — | 使用的数据源 |
| upstreamFields | array | — | 使用的字段汇总 |

---

## 🗄️ 6. View（视图 / Worksheet）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| id | string | v_210f | 视图 ID |
| name | string | 利润趋势 | 视图名称 |
| workbookId | string | wb_11a2 | 父工作簿 |
| upstreamFields | array | — | 视图中使用的字段 |
| upstreamDatasources | array | — | 视图使用的数据源 |

---

## 🗄️ 7. Calculated Fields（计算字段）字段字典
| 字段名 | 类型 | 示例 | 说明 |
|--------|--------|--------|--------|
| fieldId | string | col_aa2e | 字段 ID（等于 fields.id） |
| name | string | 销售增长率 | 计算字段名称 |
| formula | string | ([Sales]-[Prev Sales])/[Prev Sales] | Tableau 计算公式 |
| referenceCount | int | 3 | 引用字段数量 |
| complexityScore | int | 12 | 自动计算复杂度 |

---

## 🗄️ 8. Lineage（血缘）字段字典
### 表 → 数据源（table_to_datasource）
| 字段 | 类型 | 示例 |
|------|------|------|
| tableId | string | table_98f1 |
| datasourceId | string | ds_123 |
| relationshipType | string | upstream |

### 数据源 → 工作簿（datasource_to_workbook）
| 字段 | 类型 | 示例 |
|------|------|------|
| datasourceId | string | ds_123 |
| workbookId | string | wb_11a2 |

### 字段 → 视图（field_to_view）
| 字段 | 类型 | 示例 |
|------|------|------|
| fieldId | string | col_c9cc |
| viewId | string | v_210f |
| usedInFormula | boolean | true |

---

## 🗄️ 9. Metric / Dimension（指标 / 维度）字段字典
### Measures（指标）
| 字段 | 类型 | 示例 |
|------|------|------|
| measureId | string | col_ab12 |
| measureName | string | GMV |
| datasourceId | string | ds_123 |
| tableId | string | table_98f1 |
| isCalculated | boolean | true |
| formula | string | SUM([Sales]) |

### Dimensions（维度）
| 字段 | 类型 | 示例 |
|------|------|------|
| dimensionId | string | col_aa00 |
| dimensionName | string | 地区 |
| hierarchyLevel | string | 省份级 |

---

如果你需要：
### ✅ 将字段字典导出为 Excel（自动生成）
### ✅ 将字段字典与 Metadata API JSON 自动映射脚本（Python）
### ✅ 为你的公司字段字典生成“网页版搜索平台”
我都可以进一步为你生成。
