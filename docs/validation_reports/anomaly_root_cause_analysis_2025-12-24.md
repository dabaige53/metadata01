# 元数据验证异常根因分析报告

**执行时间**: 2025-12-24 21:38
**分析状态**: ✅ 完成

## 一、异常问题汇总

| 模块                  | 异常类型              | 数量  | 严重程度 |
| :-------------------- | :-------------------- | :---: | :------: |
| Embedded Tables       | 孤儿表 (无数据源)     |  341  |   ⚠️ 中   |
| Embedded Tables       | CSV类孤儿表           |  299  |   ⚠️ 中   |
| Embedded Tables       | 异常 Database ID      |  446  |   ℹ️ 低   |
| Embedded Tables       | 无字段关联            |  320  |   ⚠️ 中   |
| Published Datasources | 孤儿数据源 (无工作簿) |  30   |   ℹ️ 低   |
| Physical Tables       | 无列信息              |  19   |   ⚠️ 中   |
| Physical Tables       | 孤儿表 (无数据源)     |   2   |   ℹ️ 低   |

---

## 二、根因分析

### 2.1 嵌入表孤儿问题 (主要问题)

**现象**: 480个嵌入表中，341个(71%)无数据源关联，320个(67%)无字段关联。

**分类分析**:
| 类型      | 总数  | 无数据源(孤儿) | 孤儿率  |
| :-------- | :---: | :------------: | :-----: |
| CSV文件类 |  309  |      299       | **97%** |
| 非CSV类   |  171  |       42       |   24%   |

**根因判断**:
1. **CSV文件解析缺失**: Tableau 工作簿中直接嵌入的 CSV 文件（如 `20250712_dih.csv`）在 Metadata API 中以 `DatabaseTable` 形式返回，但其 `upstreamDatasources` 未被正确解析，导致 `table_to_datasource` 关联表未填充。
2. **无上游来源**: CSV 嵌入表本质上是"临时本地数据"，不存在发布式数据源上游，因此设计上可能就不应有 datasource 关联。
3. **建议**: 将 CSV 嵌入表视为"叶子节点"资产，不计入血缘完整性指标。

### 2.2 嵌入表 Database ID 异常

**现象**: 446个嵌入表关联了 Database ID（预期应为 NULL）。

**根因判断**:
1. **设计不一致**: 嵌入表仍保留了来源数据库信息（如 `0eb18804-5e39-0a9a-4920-db460e7c9b3d`），这是合理的——表示该嵌入表的数据来源于某个外部数据库。
2. **结论**: 非异常。嵌入表可以有 `database_id`，用于追溯数据来源。

### 2.3 孤儿发布式数据源

**现象**: 30个发布式数据源无工作簿引用。

**分布分析**:
| 项目         | 孤儿数 |
| :----------- | :----: |
| 数据沙盒     |   19   |
| 数据处理流程 |   5    |
| Tableau 示例 |   5    |
| 默认值       |   1    |

**根因判断**:
1. **沙盒/测试数据**: 63% (19/30) 的孤儿数据源位于"数据沙盒"项目，属于测试或临时资产。
2. **中间层数据源**: 部分数据源可能仅作为其他数据源的上游，未被工作簿直接引用。
3. **建议**: 按项目过滤统计，排除沙盒项目后仅有 11 个值得关注的孤儿源。

### 2.4 物理表无列信息

**现象**: 19张物理表缺少原始列 (db_columns) 信息。

**分布分析**:
| 连接类型        | 无列表数 |
| :-------------- | :------: |
| MySQL           |    13    |
| Clickhouse JDBC |    4     |
| Generic JDBC    |    2     |

**根因判断**:
1. **Metadata API 限制**: Tableau Metadata API 对部分 JDBC 连接类型（尤其是 Clickhouse、Generic JDBC）返回的列信息不完整。
2. **权限问题**: 采集账号可能对某些表没有 `SELECT` 权限，导致列信息无法获取。
3. **建议**: 在同步脚本中增加列信息获取的错误重试或告警机制。

---

## 三、建议措施

| 优先级 | 问题          | 建议措施                                      |
| :----: | :------------ | :-------------------------------------------- |
|   P2   | CSV嵌入表孤儿 | 在统计报告中过滤 CSV 类型，或标记为"本地数据" |
|   P3   | 孤儿发布源    | 增加按项目过滤的统计维度                      |
|   P3   | 物理表无列    | 增强同步脚本的列信息获取逻辑                  |
|   -    | 嵌入表 DB ID  | 无需修复，数据本身正确                        |

---

## 四、验证SQL参考

```sql
-- 查看 CSV 嵌入表详情
SELECT id, name, database_id FROM tables 
WHERE is_embedded = 1 AND name LIKE '%.csv' LIMIT 10;

-- 查看非沙盒项目的孤儿发布源
SELECT id, name, project_name FROM datasources 
WHERE is_embedded = 0 AND project_name != '数据沙盒'
AND NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = datasources.id);

-- 查看无列信息的物理表
SELECT id, name, connection_type FROM tables 
WHERE is_embedded = 0 
AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.table_id = tables.id);
```
