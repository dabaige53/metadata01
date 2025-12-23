# 血缘优化验证回顾 Prompt

## 任务背景
系统已完成血缘预计算表的建设和 API 改造，需要全面验证所有血缘查询是否正确使用了预计算表。

---

## 一、已完成的改造

### 1.1 预计算血缘表 (`field_full_lineage`)
- **位置**: `backend/models.py` 第 48-77 行
- **字段**: `field_id`, `table_id`, `datasource_id`, `workbook_id`, `lineage_type`, `lineage_path`
- **记录数**: 25,596 条 (100% 覆盖)

### 1.2 同步脚本改造
- **位置**: `backend/tableau_sync.py` `_compute_full_lineage()` 方法
- **功能**: 在同步结束后预计算所有字段的完整血缘链

### 1.3 API 改造清单

| API                 | 改造内容                                       | 状态   |
| :------------------ | :--------------------------------------------- | :----- |
| `get_field_detail`  | 表信息、视图引用全部使用预计算表               | ✅ 完成 |
| `get_metric_detail` | 上游表、视图引用、相似指标视图全部使用预计算表 | ✅ 完成 |
| `get_view_detail`   | 上游数据源、上游表使用预计算表                 | ✅ 完成 |
| `get_column_detail` | 下游字段使用预计算表                           | ✅ 完成 |

---

## 二、验证步骤

### 2.1 重启后端
```bash
cd /Users/w/Desktop/吉祥/Team/代码管理/metadata分析
pkill -f "run_backend.py" ; sleep 1 && python3 run_backend.py &
```

### 2.2 SQL 验证 - 血缘覆盖率
```bash
sqlite3 metadata.db "
SELECT '=== 预计算血缘表验证 ===';
SELECT '覆盖率:', (SELECT COUNT(DISTINCT field_id) FROM field_full_lineage) || '/' || (SELECT COUNT(*) FROM fields);
SELECT '间接血缘(计算字段)数:', COUNT(*) FROM field_full_lineage WHERE lineage_type = 'indirect';
SELECT '直接血缘(原始字段)数:', COUNT(*) FROM field_full_lineage WHERE lineage_type = 'direct';
"
```

### 2.3 API 验证 - 字段详情

```bash
# 测试计算字段的血缘穿透
curl -s "http://localhost:8101/api/fields/147648e6-f0b2-461f-03c7-04a3cfc4b242" | jq '{
  name: .name,
  is_calculated: .isCalculated,
  table_info: .table_info,
  derived_tables: .derivedTables,
  used_in_views: (.used_in_views | length),
  used_in_workbooks: (.usedInWorkbooks | length)
}'
```

**预期结果**:
- `table_info` 应有值 (来自 `field_full_lineage`)
- `used_in_views` 数量应与 `field_to_view` 表一致

### 2.4 API 验证 - 指标详情

```bash
# 测试指标的血缘穿透
curl -s "http://localhost:8101/api/metrics/147648e6-f0b2-461f-03c7-04a3cfc4b242" | jq '{
  name: .name,
  upstream_tables: .upstream_tables,
  usedInViews: (.usedInViews | length),
  usedInWorkbooks: (.usedInWorkbooks | length)
}'
```

**预期结果**:
- `upstream_tables` 应有值 (来自 `field_full_lineage`)
- `usedInViews` 数量应与 `field_to_view` 表一致

### 2.5 API 验证 - 视图详情

```bash
# 获取一个视图ID
VIEW_ID=$(sqlite3 metadata.db "SELECT id FROM views LIMIT 1")

# 测试视图的上游血缘
curl -s "http://localhost:8101/api/views/$VIEW_ID" | jq '{
  name: .name,
  upstream_datasources: .upstream_datasources,
  upstream_tables: .upstream_tables
}'
```

**预期结果**:
- `upstream_datasources` 应有值 (来自 `field_full_lineage` + `field_to_view`)
- `upstream_tables` 应有值 (来自 `field_full_lineage` + `field_to_view`)

### 2.6 代码审计 - 确认无 ORM 血缘遍历

```bash
# 检查是否还有 ORM 血缘遍历
grep -n "for v in field.views\|for v in (s_field.views\|field.datasource.tables" backend/routes/api.py
```

**预期结果**: 无输出 (所有 ORM 遍历已移除)

---

## 三、运行完整验证脚本

```bash
sqlite3 metadata.db < docs/测试验证/系统设计验证.sql 2>&1 | grep -E "血缘|覆盖率"
```

**预期结果**:
```
★★★ 9. 预计算血缘表验证 ★★★
预计算血缘覆盖率|12768/12768
计算字段间接血缘|4929
计算字段血缘缺失|0
```

---

## 四、待继续优化的 API (非必需)

以下 API 仍使用 ORM 遍历，但不影响核心功能，可在后续版本优化：

| API                     | ORM 遍历                            | 优先级 |
| :---------------------- | :---------------------------------- | :----- |
| `get_database_detail`   | `db.tables`, `t.datasources`        | 低     |
| `get_table_detail`      | `table.datasources`, `ds.workbooks` | 中     |
| `get_datasource_detail` | `ds.tables`, `ds.workbooks`         | 中     |
| `get_workbook_detail`   | `wb.datasources`, `v.fields`        | 中     |

---

## 五、完成确认

- [ ] 后端重启成功
- [ ] SQL 验证通过 (血缘覆盖率 100%)
- [ ] `get_field_detail` API 验证通过
- [ ] `get_metric_detail` API 验证通过
- [ ] `get_view_detail` API 验证通过
- [ ] 代码审计通过 (无 ORM 血缘遍历)
- [ ] 完整验证脚本通过

---

## 六、问题排查

如果验证失败，请检查：

1. **血缘表为空**: 运行 `python3 -c "...预计算脚本..."` 重新生成
2. **API 返回 500**: 检查 Flask 日志，可能是 SQL 语法错误
3. **数据不一致**: 重新运行 `tableau_sync.py` 同步数据
