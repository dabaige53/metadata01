# 血缘系统全面测试与优化 Prompt

## 目标
确保所有血缘查询使用预计算表，消除 ORM 遍历，提升系统性能和数据一致性。

---

## 一、血缘表现状

### 已有预计算血缘表
| 表名                     | 用途                        | 记录数 |
| :----------------------- | :-------------------------- | :----- |
| `field_full_lineage`     | 字段→表/数据源/工作簿完整链 | 25596  |
| `table_to_datasource`    | 物理表→数据源               | 194    |
| `datasource_to_workbook` | 数据源→工作簿               | 118    |
| `field_to_view`          | 字段→视图                   | 9979   |
| `dashboard_to_sheet`     | 仪表板→工作表               | 640    |
| `field_dependencies`     | 计算字段→依赖的原始字段     | 9811   |

---

## 二、需要修复的 API

### 2.1 `get_field_detail` (已部分修复)
**位置**: `backend/routes/api.py` 约 2475 行
**问题**: `field.views` 仍使用 ORM 遍历
**修复**: 改用 `field_to_view` 表查询

### 2.2 `get_metric_detail`
**位置**: `backend/routes/api.py` 约 3447 行
**问题**: 
1. `field.views` ORM 遍历 (第 3587-3602 行)
2. `s_field.views` ORM 遍历 (第 3531 行)
3. `field.datasource` ORM 遍历 (第 3609-3619 行)

**修复**: 
- 视图引用改用 `field_to_view` 表
- 数据源信息从 `field_full_lineage` 获取

### 2.3 `get_view_detail`
**位置**: `backend/routes/api.py` 约 1596 行
**现状**: ✅ 已修复 - 使用 `field_full_lineage` + `field_to_view`

### 2.4 `get_table_detail`
**位置**: `backend/routes/api.py` 约 807 行
**问题**:
1. `table.datasources` ORM 遍历 (第 860-873 行)
2. `ds.workbooks` ORM 遍历 (第 880-891 行)

**修复**:
- 改用 `table_to_datasource` 表
- 工作簿信息通过 `datasource_to_workbook` 获取

### 2.5 `get_datasource_detail`
**位置**: `backend/routes/api.py` 约 1055 行
**问题**:
1. `ds.tables` ORM 遍历 (第 1065-1075 行)
2. `ds.workbooks` ORM 遍历 (第 1079-1087 行)
3. `ds.fields` ORM 遍历 (第 1098-1117 行)

**修复**:
- 表信息从 `table_to_datasource` 获取
- 工作簿从 `datasource_to_workbook` 获取
- 字段从 `field_full_lineage` 反查

### 2.6 `get_workbook_detail`
**位置**: `backend/routes/api.py` 约 1272 行
**问题**:
1. `wb.datasources` ORM 遍历 (第 1304-1315 行)
2. `ds.tables` ORM 遍历 (第 1322-1331 行)
3. `v.fields` ORM 遍历 (第 1368-1369 行)

**修复**:
- 数据源从 `datasource_to_workbook` 反查
- 表从 `table_to_datasource` 获取
- 字段从 `field_to_view` 获取

---

## 三、修复模式示例

### 原始代码 (ORM 遍历)
```python
# ❌ 不要这样做
for v in field.views:
    views_data.append({
        'id': v.id,
        'name': v.name,
        'workbook_name': v.workbook.name
    })
```

### 优化代码 (预计算表)
```python
# ✅ 使用预计算血缘表
from sqlalchemy import text
views_result = session.execute(text("""
    SELECT fv.view_id, v.name, v.view_type, v.workbook_id, w.name as wb_name
    FROM field_to_view fv
    JOIN views v ON fv.view_id = v.id
    LEFT JOIN workbooks w ON v.workbook_id = w.id
    WHERE fv.field_id = :field_id
"""), {'field_id': field_id}).fetchall()

views_data = [{
    'id': row[0],
    'name': row[1],
    'view_type': row[2],
    'workbook_id': row[3],
    'workbook_name': row[4]
} for row in views_result]
```

---

## 四、验证方法

### 4.1 SQL 验证脚本
```bash
sqlite3 metadata.db < docs/测试验证/系统设计验证.sql
```

### 4.2 API 验证
```bash
# 字段详情 - 验证 table_info 来自血缘表
curl -s "http://localhost:8101/api/fields/147648e6-f0b2-461f-03c7-04a3cfc4b242" | jq '{table_info, derived_tables}'

# 指标详情 - 验证 upstream_tables 来自血缘表
curl -s "http://localhost:8101/api/metrics/147648e6-f0b2-461f-03c7-04a3cfc4b242" | jq '{upstream_tables}'

# 视图详情 - 验证 upstream_datasources 和 upstream_tables
curl -s "http://localhost:8101/api/views/[VIEW_ID]" | jq '{upstream_datasources, upstream_tables}'
```

### 4.3 代码审计
```bash
# 查找所有 ORM 血缘遍历
grep -n "\.tables\|\.workbooks\|\.datasources\|\.views\|\.fields" backend/routes/api.py | grep -v "upstream_tables\|derived_tables"
```

---

## 五、完成标准

- [ ] `get_field_detail` - 所有血缘使用预计算表
- [ ] `get_metric_detail` - 所有血缘使用预计算表
- [ ] `get_view_detail` - 所有血缘使用预计算表 ✅
- [ ] `get_table_detail` - 所有血缘使用预计算表
- [ ] `get_datasource_detail` - 所有血缘使用预计算表
- [ ] `get_workbook_detail` - 所有血缘使用预计算表
- [ ] `get_column_detail` - 所有血缘使用预计算表 ✅
- [ ] 代码审计通过 - 无 ORM 血缘遍历
- [ ] API 验证通过 - 返回数据正确
- [ ] SQL 验证通过 - 血缘覆盖率 100%

---

## 六、执行命令

```bash
# 1. 修复完成后重启后端
pkill -f "run_backend.py" && python3 run_backend.py &

# 2. 运行 SQL 验证
sqlite3 metadata.db < docs/测试验证/系统设计验证.sql | tail -20

# 3. 运行 API 验证
bash docs/测试验证/系统设计验证API.sh
```
