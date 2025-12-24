# 元数据验证 JSON 设计规范 (Metadata Validation JSON Spec)

**版本**: 1.0.0
**状态**: 正式发布
**适用范围**: 元数据系统全链路验证脚本生成与执行

## 1. 设计概述

本规范定义了一套标准化的 JSON 结构，用于描述元数据系统中各模块（Workbooks, Datasources, Tables, Fields 等）的验证规则。该方案采用了**“全维度闭环验证”**策略，覆盖了从数据库底层血缘到 API 聚合计算，再到前端 UI 展示的完整数据链路。

### 核心设计原则

1.  **任务导向 (Task-Oriented)**: 任何层级的验证节点必须包含 `任务描述`，明确“为什么验这个”。
2.  **原子化与分布指纹**: 验证粒度细化到字段级，支持枚举值的分布指纹（如 `Production:24, Default:12`）比对。
3.  **负向监测 (Negative Testing)**: 内置 `血缘质量检测` 模块，主动扫描孤儿资产和断链血缘。
4.  **逻辑闭环 (Logical Loop)**: 显式定义前端展示值与底层血缘值的一致性校验规则，确保表里如一。
5.  **空值填入模式**: JSON 模板中的实际结果字段预留为空字符串 `""`，由自动化执行引擎填入。

## 2. JSON 结构定义

### 2.1 根对象结构

文档以模块为顶层键，包含该模块下所有的验证逻辑。

```json
{
  "模块列表": {
    "全量验证配置": {
      "执行模式": "并发执行",
      "重试策略": "失败重试 3 次"
    },
    "工作簿": { "/* 工作簿模块验证详情 */" },
    "数据源": { "/* 数据源模块验证详情 */" },
    "数据表": { "/* 数据表模块验证详情 */" },
    ...
  }
}
```

### 2.2 模块验证对象结构

每个模块对象包含以下五个核心部分：

1.  **元数据描述**: `任务描述`, `显示名称`
2.  **核心属性验证**: 基础计数与枚举分布
3.  **血缘质量检测**: 负向规则扫描
4.  **关联元素**: 数组化的血缘路径验证
5.  **前端元素对齐**: UI 卡片与详情页的验证
6.  **逻辑闭环验证**: 跨层级数据比对

#### 完整结构示例 (以[物理表]为例)

```json
{
  "物理表": {
    "任务描述": "验证物理表模块的核心指标、血缘关联及数据质量",
    "显示名称": "物理表",
    "核心属性验证": {
      "任务描述": "验证物理表的基础属性统计，包括总数和关键枚举分布",
      "资产总数": {
        "任务描述": "统计物理表总记录数，确保不为0且与数据库一致",
        "API路径": "/api/stats",
        "API取值键": "tables",
        "API实际结果": "",
        "SQL查询": "SELECT COUNT(*) FROM tables WHERE is_embedded = 0",
        "SQL实际结果": ""
      },
      "数据库分布 (枚举)": {
        "任务描述": "验证物理表在各数据库中的分布情况",
        "API路径": "/api/databases",
        "字段名": "name",
        "API实际分布": "",
        "SQL查询": "SELECT name || ':' || COUNT(*) FROM tables t JOIN databases d ON t.database_id = d.id WHERE is_embedded = 0 GROUP BY d.name",
        "SQL实际分布": ""
      }
    },
    "血缘质量检测": {
      "任务描述": "检测字段空值率及血缘未匹配情况，挖掘潜在的数据质量问题",
      "关键字段空值检测": [
         {
            "字段名": "database_id",
            "任务描述": "检测未关联数据库的物理表数量（孤儿表）",
            "SQL查询": "SELECT COUNT(*) FROM tables WHERE database_id IS NULL AND is_embedded = 0",
            "SQL实际结果": ""
         }
      ],
      "未匹配血缘检测": [
         {
            "关联方向": "表->数据源",
            "任务描述": "检测未被任何数据源引用的物理表数量（冗余资产）",
            "SQL查询": "SELECT COUNT(*) FROM tables t WHERE is_embedded = 0 AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id)",
            "SQL实际结果": ""
         }
      ]
    },
    "关联元素": [
      {
        "目标模块": "数据库",
        "任务描述": "验证物理表与数据库的 1:1 所属关系",
        "关联方式": "物理表 > 数据库 (所属库)",
        "关联验证": {
          "正向SQL (表>库)": "SELECT COUNT(DISTINCT id) || ':' || COUNT(DISTINCT database_id) FROM tables WHERE is_embedded = 0",
          "正向SQL结果": "",
          "反向SQL (库>表)": "SELECT COUNT(DISTINCT d.id) || ':' || COUNT(DISTINCT t.id) FROM databases d JOIN tables t ON d.id = t.database_id WHERE t.is_embedded = 0",
          "反向SQL结果": "",
          "API路径 (表列表)": "/api/tables",
          "API统计逻辑": "COUNT(items), COUNT(DISTINCT database_id from items)",
          "API实际结果": ""
        }
      },
      {
        "目标模块": "数据源",
        "任务描述": "验证物理表被发布数据源引用的 M:N 关系",
        "关联方式": "物理表 > 中间表 > 数据源 (被引用)",
        "关联验证": {
          "正向SQL (表>源)": "SELECT COUNT(DISTINCT table_id) || ':' || COUNT(DISTINCT datasource_id) FROM table_to_datasource td JOIN tables t ON td.table_id = t.id WHERE t.is_embedded = 0",
          "正向SQL结果": "",
          "反向SQL (源>表)": "SELECT COUNT(DISTINCT ds.id) || ':' || COUNT(DISTINCT td.table_id) FROM datasources ds JOIN table_to_datasource td ON ds.id = td.datasource_id WHERE ds.is_embedded = 0",
          "反向SQL结果": "",
          "API路径": "无 (纯后端关系)",
          "API实际结果": "N/A"
        }
      }
    ],
    "前端元素对齐": {
      "任务描述": "验证前端卡片和详情页数据与后端逻辑的一致性",
      "列表卡片": {
        "任务描述": "验证列表页关键指标显示",
        "字段:datasourceCount": {
          "任务描述": "验证物理表列表卡片上的关联数据源计数",
          "API键": "datasourceCount",
          "SQL查询": "SELECT SUM(ds_cnt) FROM (SELECT COUNT(DISTINCT datasource_id) as ds_cnt FROM table_to_datasource WHERE table_id IN (SELECT id FROM tables WHERE is_embedded=0) GROUP BY table_id)",
          "API汇总结果": "",
          "SQL汇总结果": ""
        }
      },
      "详情页": {
        "任务描述": "验证详情页各 Tab 页签的数据准确性",
        "页签:所属数据源": {
          "任务描述": "验证'所属数据源' Tab 下的记录数和类型分布",
          "API路径": "/api/tables/{id}/datasources",
          "字段:type (枚举)": {
            "任务描述": "验证数据源类型的枚举分布",
            "API统计逻辑": "GROUP BY type, COUNT",
            "API实际分布": "",
            "SQL查询": "SELECT type || ':' || COUNT(*) FROM datasources ds JOIN table_to_datasource td ON ds.id = td.datasource_id WHERE td.table_id = ? GROUP BY type",
            "SQL实际分布": ""
          }
        }
      }
    },
    "逻辑闭环验证": {
      "任务描述": "跨层级比对：验证'前端展示值'与'底层血缘统计值'是否严丝合缝",
      "比对项列表": [
        {
          "比对名称": "数据源引用数闭环",
          "前端数据源": "前端元素对齐.列表卡片.字段:datasourceCount.API汇总结果",
          "血缘数据源": "关联元素[目标模块='数据源'].关联验证.正向SQL结果(提取目标数)",
          "比对逻辑": "数值相等",
          "差异容忍度": 0
        },
        {
          "比对名称": "数据库分布闭环",
          "前端数据源": "核心属性验证.数据库分布 (枚举).API实际分布",
          "血缘数据源": "关联元素[目标模块='数据库'].关联验证.API实际结果(提取分布)",
          "比对逻辑": "分布指纹完全匹配",
          "差异容忍度": 0
        }
      ]
    }
  }
}
```

## 3. 字段详解

| 模块         | 字段 Key      | 必填 | 说明                                                                    |
| :----------- | :------------ | :--- | :---------------------------------------------------------------------- |
| **通用**     | `任务描述`    | 是   | 解释当前验证项的业务目的，便于生成报告。                                |
| **通用**     | `SQL实际结果` | 留空 | 执行前为空，执行后由脚本填入 SQL 运行结果。                             |
| **通用**     | `API实际结果` | 留空 | 执行前为空，执行后由脚本填入 API 响应解析结果。                         |
| **关联元素** | `关联方式`    | 是   | 描述血缘流向，格式：`A > B > C (说明)`。                                |
| **逻辑闭环** | `比对逻辑`    | 是   | `数值相等` 或 `分布指纹完全匹配`。                                      |
| **逻辑闭环** | `前端数据源`  | 是   | 指向 JSON 内部其他节点的 JSONPath 路径，如 `前端元素对齐.列表卡片...`。 |
| **前端对齐** | `API统计逻辑` | 是   | 描述如何聚合 API 响应数据，如 `GROUP BY type, COUNT`。                  |

## 4. 最佳实践

1.  **路径描述标准化**: 始终使用 `>` 符号表示数据流向。
2.  **SQL 结果字符串化**: 建议 SQL 直接使用 `||` 拼接字符串（如 `Key:Count`），便于自动化脚本进行简单的字符串比对。
3.  **覆盖率优先**: 优先覆盖 `IS NULL` 和 `NOT EXISTS` 等反向检查，这类问题在前端最难被发现。
