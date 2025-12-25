---
description: 生成元数据模块验证 JSON 文件的标准工作流
---

# 验证 JSON 生成工作流

本工作流指导 AI 为元数据模块生成标准化的验证 JSON 文件。

## 前置准备

// turbo
1. 确认已阅读前端元素清单
```bash
cat docs/system_summary/frontend_element_spec.md
```

// turbo
2. 确认已阅读 API 文档
```bash
cat docs/system_summary/api_details.md
```

// turbo
3. 确认已阅读血缘交叉表
```bash
head -120 docs/重构方案/重构验证方案.md
```

## JSON 结构模板

每个模块的 JSON 必须包含以下 6 个顶层节点：

```json
{
  "模块名": {
    "任务描述": "...",
    "显示名称": "...",
    "模块定义": {},
    "核心属性验证": {},
    "血缘质量检测": {},
    "关联元素": [],
    "前端元素对齐": {},
    "逻辑闭环验证": {}
  }
}
```

## 生成步骤

### 第一步：分析模块定义

根据 `重构验证方案.md` 中的模块定义，确定：
- 数据库表名
- 过滤条件（如 `is_embedded = 0`）
- 主键

### 第二步：核心属性验证

1. **资产总数**：
   - 找到对应的 `/api/stats` 取值键
   - 编写 `SELECT COUNT(*)` SQL

2. **枚举分布**（如有）：
   - 字段名
   - SQL: `SELECT 字段 || ':' || COUNT(*) ... GROUP BY 字段`

### 第三步：血缘质量检测

1. **关键字段空值检测**：检查外键字段（如 `database_id`, `table_id`）是否为 NULL
2. **未匹配血缘检测**：使用 `NOT EXISTS` 检查孤儿记录

### 第四步：关联元素

参考 `frontend_element_spec.md` 的"附录：API 路径与详情页数据字段对照"：

对于每个关联：
```json
{
  "目标模块": "...",
  "任务描述": "验证 A 与 B 的 X:Y 关系",
  "关联方式": "A > 中间表(如有) > B (描述)",
  "关联验证": {
    "正向SQL (A>B)": "SELECT COUNT(DISTINCT a.id) || ':' || COUNT(DISTINCT b.id) FROM ...",
    "正向SQL结果": "",
    "反向SQL (B>A)": "...",
    "反向SQL结果": "",
    "API路径": "/api/xxx/{id}",
    "API取值键": "yyy",
    "API实际结果": ""
  }
}
```

### 第五步：前端元素对齐

参考 `frontend_element_spec.md`：

1. **列表卡片 (XxxCard.tsx)**：
   - 找到对应 Card 组件中的所有字段
   - 为每个字段编写验证 SQL

2. **详情页 (DetailDrawer)**：
   - 找到该模块的所有 Tab
   - 记录每个 Tab 的 API 路径、取值键、显示条件、验证 SQL

### 第六步：逻辑闭环验证

定义前端展示值与血缘统计值的比对规则：
```json
{
  "比对名称": "...",
  "前端数据源": "前端元素对齐.xxx",
  "血缘数据源": "关联元素[xxx].xxx",
  "比对逻辑": "数值相等 | 分布指纹完全匹配",
  "差异容忍度": 0
}
```

### 第七步：卡片与详情页一致性验证 (Card-Detail Alignment)

> [!IMPORTANT]
> 此步骤用于检测"列表卡片显示值"与"详情页 Tab 显示值"是否来自同一数据源。这是最常见的前端数据不一致问题类型。

#### 问题模式

| 模式                   | 描述                                                                                                     | 根因                 |
| :--------------------- | :------------------------------------------------------------------------------------------------------- | :------------------- |
| **实例字段 vs 血缘表** | 卡片从主表 (如 `calculated_fields.workbook_id`) 取值，详情页从血缘表 (如 `calc_field_full_lineage`) 聚合 | API 设计不一致       |
| **预计算 vs 实时聚合** | 卡片使用预存的 `xxx_count` 字段，详情页使用 `COUNT(*)` 实时计算                                          | 预计算字段未同步更新 |
| **单实例 vs 全量聚合** | 卡片只取当前实例关联，详情页按 name/formula_hash 聚合所有同名实例                                        | 聚合粒度不一致       |

#### 验证 SQL 模板

对于每个需要验证的统计字段（如 `workbook_count`），添加以下结构：
```json
{
  "一致性检测项": "工作簿数量",
  "卡片数据源": {
    "描述": "列表 API 返回的 workbook_count",
    "SQL (模拟卡片逻辑)": "SELECT COUNT(DISTINCT cf.workbook_id) FROM calculated_fields cf WHERE cf.formula_hash = :hash",
    "SQL结果": ""
  },
  "详情数据源": {
    "描述": "详情 API 返回的 all_workbooks 长度",
    "SQL (模拟详情逻辑)": "SELECT COUNT(DISTINCT cfl.workbook_id) FROM calc_field_full_lineage cfl WHERE cfl.field_id IN (SELECT id FROM calculated_fields WHERE formula_hash = :hash)",
    "SQL结果": ""
  },
  "预期规则": "卡片数据源.SQL结果 = 详情数据源.SQL结果",
  "修复建议": "统一使用血缘表作为权威数据源"
}
```

#### 必查字段清单

对于每个模块，以下字段必须进行卡片-详情一致性验证：

| 模块                 | 必查字段                                                       |
| :------------------- | :------------------------------------------------------------- |
| 指标 (Metrics)       | `workbook_count`, `datasource_count`, `view_count`             |
| 字段 (Fields)        | `workbook_count`, `datasource_count`, `view_count`             |
| 数据源 (Datasources) | `field_count`, `metric_count`, `table_count`, `workbook_count` |
| 物理表 (Tables)      | `column_count`, `field_count`, `datasource_count`              |
| 工作簿 (Workbooks)   | `view_count`, `datasource_count`                               |

## 输出规范


// turbo
4. 将生成的 JSON 保存到指定目录
```bash
ls docs/validation_json/
```

文件命名规则：`模块英文名.json`（如 `databases.json`, `physical_tables.json`）

## 验证检查清单

生成完成后，确认以下内容：

- [ ] 所有 `API路径` 和 `API取值键` 已填写
- [ ] 所有 `显示条件` 与 DetailDrawer 代码一致
- [ ] 所有 SQL 可执行（无语法错误）
- [ ] 列表卡片字段与 XxxCard.tsx 一致
- [ ] 详情页 Tab 与 DetailDrawer getTabs() 一致
- [ ] 闭环验证覆盖了主要的前端-血缘关系

## 参考文档

- [前端元素清单](file:///docs/system_summary/frontend_element_spec.md)
- [API 文档](file:///docs/system_summary/api_details.md)
- [血缘交叉表](file:///docs/重构方案/重构验证方案.md)
- [JSON 结构规范](file:///docs/system_summary/metadata_validation_json_spec.md)
- [验证策略](file:///docs/system_summary/metadata_validation_strategy.md)
