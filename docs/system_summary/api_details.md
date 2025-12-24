# Tableau 元数据治理平台 - API 详细说明文档

本文档对系统核心 API 的参数、返回值及内部逻辑进行了详细说明。

## 1. 统计与分析模块

### 1.1 获取全局统计 (`/stats`)
*   **方法**: `GET`
*   **功能**: 返回系统中各类资产的总数。
*   **输出示例**:
    ```json
    {
      "databases": 5,
      "tables": 120,
      "fields": 5400,
      "metrics": 450,
      "datasources": 35,
      "workbooks": 80,
      "views": 320,
      "orphanedFields": 120
    }
    ```

### 1.2 仪表盘治理分析 (`/dashboard/analysis`)
*   **方法**: `GET`
*   **功能**: 为治理大屏提供深度分析数据，包含健康分和各类覆盖率。
*   **核心逻辑**:
    *   **健康分**: 综合考虑「完整性 (25%)」、「规范性 (20%)」、「一致性 (20%)」、「有效性 (15%)」、「时效性 (20%)」。
    *   **陈旧资产**: 统计 30 天/90 天未更新的数据源。

---

## 2. 元数据资产模块

### 2.1 数据表列表 (`/tables`)
*   **方法**: `GET`
*   **参数**:
    *   `page`: 页码 (默认 1)
    *   `page_size`: 每页数量 (默认 50)
    *   `search`: 按名称模糊搜索
    *   `is_embedded`: `1` 或 `true` 筛选嵌入式表
    *   `sort`: 排序字段 (`name`, `schema`, `field_count`)
*   **说明**: 内部通过 `selectinload` 优化，一次性加载数据库、字段、数据源等关联信息，解决 N+1 问题。

### 2.2 数据源详情 (`/datasources/<ds_id>`)
*   **方法**: `GET`
*   **功能**: 返回数据源及其完整的上下游上下文。
*   **特色逻辑**:
    *   **混合模式**: 如果是已发布数据源，会额外返回衍生自它的「嵌入式副本」列表 (`embedded_datasources`)。
    *   **字段截断**: 默认返回前 10000 个字段，超出部分会通过 `has_more_fields` 标记。

---

## 3. 字段与指标模块

### 3.1 字段目录 (`/fields/catalog`)
*   **方法**: `GET`
*   **功能**: 按物理列聚合字段。
*   **聚合规则**: 相同 `table_id` 且 `upstream_column_name`（或 `name`）相同的字段被视为同一个逻辑字段。
*   **价值**: 帮助识别同一个底层数据库列在不同报表中的不同命名和定义。

### 3.2 重复指标识别 (`/metrics/catalog/duplicate`)
*   **方法**: `GET`
*   **逻辑**: 按 `name + formula_hash` 进行聚合。如果 `instance_count > 1`，说明同一公式在多个地方被重复创建。

---

## 4. 血缘关系模块

### 4.1 基础血缘 (`/lineage/<type>/<id>`)
*   **方法**: `GET`
*   **支持类型**: `database`, `table`, `column`, `field`, `datasource`, `workbook`, `view`
*   **输出结构**:
    ```json
    {
      "nodes": [{"id": "...", "name": "...", "type": "..."}],
      "links": [{"source": "...", "target": "..."}]
    }
    ```

### 4.2 图形化血缘 (`/lineage/graph/<type>/<id>`)
*   **方法**: `GET`
*   **功能**: 返回符合 Mermaid 语法格式的图形字符串。
*   **特殊逻辑**: 字段级血缘支持向上追溯至原始数据库列。

---

## 5. 常见通用参数 (Query Params)
系统中大多数列表接口支持以下通用参数：
*   `search`: 字符串过滤。
*   `sort`: 排序字段名。
*   `order`: `asc` (升序) 或 `desc` (降序)。
*   `page` & `page_size`: 基础分页。
