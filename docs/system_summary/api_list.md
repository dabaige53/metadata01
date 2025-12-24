# Tableau 元数据治理平台 - API 接口列表

本文档提供了系统的 API 接口快速参考列表。所有接口的基础路径为 `/api`。

## 1. 概览与统计
| 路径                  | 方法 | 功能描述                                                 |
| :-------------------- | :--- | :------------------------------------------------------- |
| `/stats`              | GET  | 获取全局资产统计数据（数据库、表、字段、指标等数量）     |
| `/dashboard/analysis` | GET  | 获取仪表盘分析数据（覆盖率、复杂度、健康分、重复公式等） |
| `/search`             | GET  | 全局跨资产类型搜索                                       |

## 2. 数据库 (Databases)
| 路径                 | 方法 | 功能描述                             |
| :------------------- | :--- | :----------------------------------- |
| `/databases`         | GET  | 获取数据库列表，支持名称搜索         |
| `/databases/<db_id>` | GET  | 获取指定数据库的详情及其包含的数据表 |

## 3. 数据表 (Tables)
| 路径                        | 方法 | 功能描述                                             |
| :-------------------------- | :--- | :--------------------------------------------------- |
| `/tables`                   | GET  | 获取数据表列表，支持分页、排序、搜索及嵌入式筛选     |
| `/tables/<table_id>`        | GET  | 获取单表详情（包含原始列、字段、关联数据源及工作簿） |
| `/tables/governance/unused` | GET  | 获取未被任何数据源引用的孤立表分析                   |
| `/tables/governance/wide`   | GET  | 获取列数超过 50 的宽表分析                           |

## 4. 数据源 (Datasources)
| 路径                               | 方法 | 功能描述                                            |
| :--------------------------------- | :--- | :-------------------------------------------------- |
| `/datasources`                     | GET  | 获取数据源列表，支持分页、排序、项目筛选            |
| `/datasources/<ds_id>`             | GET  | 获取数据源详情（上游表、下游工作簿、字段/指标列表） |
| `/quality/uncertified-datasources` | GET  | 获取未认证的数据源列表                              |
| `/datasource/health`               | GET  | 获取数据源健康评分排名                              |

## 5. 工作簿与视图 (Workbooks & Views)
| 路径                                  | 方法 | 功能描述                                          |
| :------------------------------------ | :--- | :------------------------------------------------ |
| `/workbooks`                          | GET  | 获取工作簿列表，支持分页、搜索                    |
| `/workbooks/<wb_id>`                  | GET  | 获取工作簿详情（视图、上游数据源/表、使用的字段） |
| `/workbooks/governance/empty`         | GET  | 获取无视图的工作簿分析                            |
| `/workbooks/governance/single-source` | GET  | 获取仅依赖单一数据源的工作簿分析                  |
| `/views`                              | GET  | 获取视图列表                                      |
| `/views/<view_id>`                    | GET  | 获取视图详情及字段详情                            |
| `/views/<view_id>/usage-stats`        | GET  | 获取视图访问统计（今日/本周增量）                 |
| `/views/governance/zero-access`       | GET  | 获取零访问视图分析（沉默资产）                    |
| `/views/governance/hot`               | GET  | 获取热门视图排行榜                                |

## 6. 字段与指标 (Fields & Metrics)
| 路径                          | 方法 | 功能描述                               |
| :---------------------------- | :--- | :------------------------------------- |
| `/fields`                     | GET  | 获取字段列表，支持分页和深度使用情况   |
| `/fields/<field_id>`          | GET  | 获取单个字段详情（包含血缘及指标引用） |
| `/fields/catalog`             | GET  | 获取字段目录（按物理列聚合度量）       |
| `/metrics`                    | GET  | 获取指标列表（计算字段）               |
| `/metrics/<metric_id>`        | GET  | 获取单个指标详情（公式、引用关系等）   |
| `/metrics/catalog`            | GET  | 获取指标目录（按公式哈希去重聚合）     |
| `/metrics/governance/unused`  | GET  | 获取未被引用的指标分析                 |
| `/metrics/governance/complex` | GET  | 获取高复杂度指标分析                   |

## 7. 血缘与治理 (Lineage & Governance)
| 路径                         | 方法 | 功能描述                           |
| :--------------------------- | :--- | :--------------------------------- |
| `/lineage/<type>/<id>`       | GET  | 获取资产的上下游血缘数据           |
| `/lineage/graph/<type>/<id>` | GET  | 获取图形化血缘数据（Mermaid 格式） |
| `/governance/merge`          | POST | 接口：合并重复指标（逻辑触发）     |
| `/governance/cleanup`        | POST | 接口：清理无效字段（逻辑触发）     |
| `/quality/overview`          | GET  | 获取全系统数据质量概览             |

## 8. 其他接口
| 路径                     | 方法 | 功能描述                        |
| :----------------------- | :--- | :------------------------------ |
| `/projects`              | GET  | 获取项目列表及资产统计          |
| `/projects/<project_id>` | GET  | 获取项目详情及资产分布          |
| `/users`                 | GET  | 获取 Tableau 用户列表及资产统计 |
| `/glossary`              | GET  | 获取术语列表                    |
