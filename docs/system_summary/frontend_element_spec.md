# 前端页面元素清单 (Frontend Element Specification)

**版本**: 1.0.0
**生成时间**: 2025-12-24
**数据来源**: `DetailDrawer.tsx`, `*Card.tsx`

本文档梳理了元数据治理平台前端各模块的 **列表卡片字段** 和 **详情页 Tab 结构**，用于指导验证 JSON 的前端对齐逻辑编写。

---

## 1. 数据库 (Databases)

### 1.1 列表卡片 (未明确定义独立 Card，使用通用列表)
无独立 Card 组件，使用 DataTable 默认渲染。

### 1.2 详情页 Tab (`DetailDrawer.tsx` L207-L211)
| Tab 名称   | 显示条件            | 对应 API                           | 关联资产类型 |
| :--------- | :------------------ | :--------------------------------- | :----------- |
| 概览       | 始终显示            | -                                  | -            |
| 数据表 (N) | `tables.length > 0` | `/api/databases/{id}`              | tables       |
| 血缘图     | 始终显示            | `/api/lineage/graph/database/{id}` | -            |

---

## 2. 数据表 (Tables)

### 2.1 列表卡片 (`TableCard.tsx`)
| 字段名 (API Key)                       | 显示标签      | 说明              |
| :------------------------------------- | :------------ | :---------------- |
| `name`                                 | 表名          | 主标题            |
| `schema`                               | Schema        | 徽章              |
| `database_name` / `databaseName`       | 数据库        | 详情项            |
| `column_count` / `columnCount`         | 原始列        | 详情项            |
| `field_count` / `fieldCount`           | Tableau字段   | 详情项            |
| `datasource_count` / `datasourceCount` | 数据源        | 详情项 (非嵌入式) |
| `workbook_count` / `workbookCount`     | 工作簿        | 详情项 (非嵌入式) |
| `is_embedded` / `isEmbedded`           | 嵌入式        | 徽章              |
| `is_certified` / `isCertified`         | 已认证        | 徽章              |
| `created_at` / `updatedAt`             | 创建/更新时间 | 详情项            |

### 2.2 详情页 Tab (`DetailDrawer.tsx` L214-L234)
| Tab 名称       | 显示条件                 | 对应 API                        | 关联资产类型 |
| :------------- | :----------------------- | :------------------------------ | :----------- |
| 概览           | 始终显示                 | `/api/tables/{id}`              | -            |
| 所属数据库     | `database_info` 存在     | -                               | databases    |
| 原始列 (N)     | `columns.length > 0`     | `/api/tables/{id}`              | columns      |
| 包含字段 (N)   | `full_fields.length > 0` | `/api/tables/{id}/fields`       | fields       |
| 关联数据源 (N) | `datasources.length > 0` | `/api/tables/{id}/datasources`  | datasources  |
| 关联工作簿 (N) | `workbooks.length > 0`   | `/api/tables/{id}/workbooks`    | workbooks    |
| 血缘图         | 始终显示                 | `/api/lineage/graph/table/{id}` | -            |

---

## 3. 数据源 (Datasources)

### 3.1 列表卡片 (`DatasourceCard.tsx`)
| 字段名 (API Key)                   | 显示标签      | 说明                  |
| :--------------------------------- | :------------ | :-------------------- |
| `name`                             | 数据源名      | 主标题                |
| `project_name` / `projectName`     | 项目          | 详情项                |
| `owner`                            | 所有者        | 详情项                |
| `table_count` / `tableCount`       | 表            | 详情项                |
| `field_count` / `fieldCount`       | 字段          | 详情项                |
| `metric_count` / `metricCount`     | 指标          | 详情项                |
| `workbook_count` / `workbookCount` | 工作簿        | 详情项                |
| `view_count` / `viewCount`         | 视图          | 详情项                |
| `has_extract` / `hasExtract`       | Extract/Live  | 徽章                  |
| `is_certified` / `isCertified`     | 已认证        | 徽章                  |
| `last_refresh` / `lastRefresh`     | 刷新时间      | 详情项 + 停更状态徽章 |
| `isEmbedded`                       | 直连嵌入      | 徽章 (嵌入式专用)     |
| `contains_unsupported_custom_sql`  | 包含自定义SQL | 标签                  |
| `has_active_warning`               | 有警告        | 标签                  |

### 3.2 详情页 Tab (`DetailDrawer.tsx` L279-L300)
| Tab 名称       | 显示条件                          | 对应 API                             | 关联资产类型 |
| :------------- | :-------------------------------- | :----------------------------------- | :----------- |
| 概览           | 始终显示                          | `/api/datasources/{id}`              | -            |
| 原始表 (N)     | `tables.length > 0`               | `/api/datasources/{id}/tables`       | tables       |
| 包含字段 (N)   | `full_fields.length > 0`          | `/api/datasources/{id}/fields`       | fields       |
| 包含指标 (N)   | `metrics.length > 0`              | `/api/datasources/{id}/metrics`      | metrics      |
| 关联工作簿 (N) | `workbooks.length > 0`            | `/api/datasources/{id}/workbooks`    | workbooks    |
| 嵌入式副本 (N) | `embedded_datasources.length > 0` | `/api/datasources/{id}` (字段)       | datasources  |
| 血缘图         | 始终显示                          | `/api/lineage/graph/datasource/{id}` | -            |

---

## 4. 工作簿 (Workbooks)

### 4.1 列表卡片 (`WorkbookCard.tsx`)
| 字段名 (API Key)                       | 显示标签      | 说明              |
| :------------------------------------- | :------------ | :---------------- |
| `name`                                 | 工作簿名      | 主标题            |
| `project_name` / `projectName`         | 项目          | 详情项            |
| `owner`                                | 所有者        | 详情项            |
| `view_count` / `viewCount`             | 视图数        | 徽章 + 详情项     |
| `datasource_count` / `datasourceCount` | 数据源数      | 详情项            |
| `field_count` / `fieldCount`           | 使用字段      | 详情项            |
| `metric_count` / `metricCount`         | 使用指标      | 详情项            |
| `upstream_datasources`                 | 上游数据源    | 详情项 (名称预览) |
| `contains_unsupported_custom_sql`      | 包含自定义SQL | 标签              |
| `has_active_warning`                   | 有警告        | 标签              |

### 4.2 详情页 Tab (`DetailDrawer.tsx` L302-L325)
| Tab 名称       | 显示条件                  | 对应 API                           | 关联资产类型 |
| :------------- | :------------------------ | :--------------------------------- | :----------- |
| 概览           | 始终显示                  | `/api/workbooks/{id}`              | -            |
| 视图/看板 (N)  | `views.length > 0`        | `/api/workbooks/{id}/views`        | views        |
| 使用数据源 (N) | `datasources.length > 0`  | `/api/workbooks/{id}/datasources`  | datasources  |
| 关联数据表 (N) | `tables.length > 0`       | `/api/workbooks/{id}/tables`       | tables       |
| 使用字段 (N)   | `used_fields.length > 0`  | `/api/workbooks/{id}/fields`       | fields       |
| 使用指标 (N)   | `used_metrics.length > 0` | `/api/workbooks/{id}/metrics`      | metrics      |
| 访问统计       | 始终显示                  | `/api/views/{id}/usage` (聚合)     | -            |
| 血缘图         | 始终显示                  | `/api/lineage/graph/workbook/{id}` | -            |

---

## 5. 视图 (Views)

### 5.1 列表卡片 (`ViewCard.tsx`)
| 字段名 (API Key)                     | 显示标签           | 说明                    |
| :----------------------------------- | :----------------- | :---------------------- |
| `name`                               | 视图名             | 主标题                  |
| `viewType` / `type`                  | 仪表板/工作表/故事 | 徽章 + 图标             |
| `workbook_name` / `workbookName`     | 工作簿             | 详情项                  |
| `project_name` / `projectName`       | 项目               | 徽章                    |
| `owner`                              | 所有者             | 详情项                  |
| `field_count` / `fieldCount`         | 字段数             | 详情项                  |
| `hits_total` / `hitsTotal` / `usage` | 访问量             | 详情项 + 热门标签       |
| `containedSheetCount`                | 包含视图           | 详情项 (Dashboard 专用) |

### 5.2 详情页 Tab (`DetailDrawer.tsx` L327-L347)
| Tab 名称     | 显示条件                     | 对应 API                       | 关联资产类型 |
| :----------- | :--------------------------- | :----------------------------- | :----------- |
| 概览         | 始终显示                     | `/api/views/{id}`              | -            |
| 所属工作簿   | `workbook_info` 存在         | -                              | workbooks    |
| 使用字段 (N) | `used_fields.length > 0`     | `/api/views/{id}/fields`       | fields       |
| 使用指标 (N) | `used_metrics.length > 0`    | `/api/views/{id}/metrics`      | metrics      |
| 访问统计     | 始终显示                     | `/api/views/{id}/usage`        | -            |
| 包含视图 (N) | `contained_views.length > 0` | `/api/views/{id}` (字段)       | views        |
| 血缘图       | 始终显示                     | `/api/lineage/graph/view/{id}` | -            |

---

## 6. 字段 (Fields) / 指标 (Metrics)

### 6.1 列表卡片 (`FieldCard.tsx`)
| 字段名 (API Key)                              | 显示标签          | 说明              |
| :-------------------------------------------- | :---------------- | :---------------- |
| `name`                                        | 字段名 (别名优先) | 主标题            |
| `upstream_column_name` / `upstreamColumnName` | 物理列名          | 主标题 (如有)     |
| `role`                                        | 度量/维度         | 徽章              |
| `data_type` / `dataType`                      | 数据类型          | 徽章              |
| `datasource_name`                             | 数据源            | 详情项            |
| `usage_count` / `usageCount`                  | 热度              | 详情项 + 热门标签 |
| `is_calculated` / `isCalculated`              | 计算字段          | 标签              |
| `used_by_metrics_count` / `metricUsageCount`  | 指标依赖          | 标签              |
| `usedInViews` / `used_in_views`               | 视图引用          | 标签              |
| `description`                                 | 描述              | 缺少描述警告      |

### 6.2 详情页 Tab (`DetailDrawer.tsx` L245-L277)
| Tab 名称       | 显示条件                    | 对应 API                                     | 关联资产类型 |
| :------------- | :-------------------------- | :------------------------------------------- | :----------- |
| 概览           | 始终显示                    | `/api/fields/{id}` 或 `/api/metrics/{id}`    | -            |
| 所属数据表     | 始终显示                    | `/api/fields/{id}` (字段 `table_info`)       | tables       |
| 依赖字段 (N)   | 计算字段/指标               | `/api/fields/{id}` (字段 `dependencyFields`) | fields       |
| 所属数据源 (N) | 始终显示                    | `/api/fields/{id}` (字段 `all_datasources`)  | datasources  |
| 影响指标 (N)   | 始终显示                    | `/api/fields/{id}` (字段 `used_by_metrics`)  | metrics      |
| 关联视图 (N)   | 始终显示                    | `/api/fields/{id}` (字段 `used_in_views`)    | views        |
| 引用工作簿 (N) | 始终显示                    | `/api/fields/{id}` (字段 `all_workbooks`)    | workbooks    |
| 同名定义 (N)   | `similarMetrics.length > 0` | `/api/fields/{id}` (字段)                    | metrics      |
| 血缘图         | 始终显示                    | `/api/lineage/graph/field/{id}`              | -            |

---

## 7. 项目 (Projects) / 用户 (Users)

### 7.1 详情页 Tab (`DetailDrawer.tsx` L349-L356)
| Tab 名称   | 显示条件                 | 对应 API |
| :--------- | :----------------------- | :------- |
| 概览       | 始终显示                 | -        |
| 数据源 (N) | `datasources.length > 0` | -        |
| 工作簿 (N) | `workbooks.length > 0`   | -        |

---

## 附录：API 路径与详情页数据字段对照

| 模块   | 详情 API                | 关键响应字段                                                                                             |
| :----- | :---------------------- | :------------------------------------------------------------------------------------------------------- |
| 数据库 | `/api/databases/{id}`   | `tables`                                                                                                 |
| 数据表 | `/api/tables/{id}`      | `database_info`, `columns`, `full_fields`, `datasources`, `workbooks`                                    |
| 数据源 | `/api/datasources/{id}` | `tables`, `full_fields`, `metrics`, `workbooks`, `embedded_datasources`                                  |
| 工作簿 | `/api/workbooks/{id}`   | `views`, `datasources`, `tables`, `used_fields`, `used_metrics`                                          |
| 视图   | `/api/views/{id}`       | `workbook_info`, `used_fields`, `used_metrics`, `contained_views`                                        |
| 字段   | `/api/fields/{id}`      | `table_info`, `all_datasources`, `used_by_metrics`, `used_in_views`, `all_workbooks`, `dependencyFields` |
| 指标   | `/api/metrics/{id}`     | (同字段)                                                                                                 |
