# 重构验证对比报告

> 生成时间: 2025-12-25 10:08:50
> 重构前快照: 2025-12-24T16:28:24.031706
> 重构后快照: 2025-12-25T10:08:39.936792

---

## 差异汇总

共发现 **54** 处差异。

| 指标路径 | 重构前 | 重构后 | 变化 |
|----------|--------|--------|------|
| `view_to_field.stats.views_without_fields` | 213 | 206 | -7 |
| `view_to_field.stats.total_relations` | 12936 | 15288 | +2352 |
| `lineage_integrity.broken_lineage_regular_fields` | 922 | 10770 | +9848 |
| `lineage_integrity.complete_field_to_wb_chain` | 8890 | 18554 | +9664 |
| `lineage_integrity.complete_field_to_db_chain` | 1501 | 1142 | -359 |
| `lineage_integrity.full_lineage_count` | 202484 | 505460 | +302976 |
| `field_to_column.stats.with_column` | 4658 | 4457 | -201 |
| `field_to_column.stats.total_regular` | 5638 | 15296 | +9658 |
| `table_counts.regular_field_full_lineage` | None | 329938 |  |
| `table_counts.regular_fields` | None | 15296 |  |
| `table_counts.calculated_fields` | 4926 | 4935 | +9 |
| `table_counts.calc_field_full_lineage` | None | 175522 |  |
| `table_counts.field_dependencies` | 9809 | 9827 | +18 |
| `table_counts.db_columns` | 5893 | 5891 | -2 |
| `table_counts.views` | 1594 | 1595 | +1 |
| `table_counts.metrics` | 3242 | 1683 | -1559 |
| `table_counts.field_full_lineage` | 202484 | 505460 | +302976 |
| `table_counts.fields` | 10567 | 20231 | +9664 |
| `relation_tables.field_to_view_count` | 12936 | 15288 | +2352 |
| `full_chain_field_to_db.stats.complete_chain_count` | 1209 | 1123 | -86 |
| `full_chain_view_to_db.stats.views_with_table_lineage` | 1323 | 511 | -812 |
| `cross_validation` | None | [{'id': 1, 'name': '数据库→物理表', 'main_count': 6, 'cross_count': 6, 'rule': 'eq_total', 'expected': 6, 'passed': True, 'error': None}, {'id': 2, 'name': '物理表→数据库', 'main_count': 36, 'cross_count': 36, 'rule': 'ge_main', 'expected': '>= 36', 'passed': True, 'error': None}, {'id': 3, 'name': '物理表→数据列', 'main_count': 17, 'cross_count': 17, 'rule': 'ge_main', 'expected': '>= 17', 'passed': True, 'error': None}, {'id': 4, 'name': '物理表→发布源', 'main_count': 66, 'cross_count': 28, 'rule': 'ge_main', 'expected': '>= 66', 'passed': False, 'error': None}, {'id': 5, 'name': '物理表→嵌入源(独立)', 'main_count': 108, 'cross_count': 7, 'rule': 'ge_main', 'expected': '>= 108', 'passed': False, 'error': None}, {'id': 6, 'name': '物理表→字段', 'main_count': 21, 'cross_count': 21, 'rule': 'ge_main', 'expected': '>= 21', 'passed': True, 'error': None}, {'id': 7, 'name': '嵌入表→物理表', 'main_count': 446, 'cross_count': 446, 'rule': 'ge_main', 'expected': '>= 446', 'passed': True, 'error': None}, {'id': 8, 'name': '嵌入表→数据列', 'main_count': 180, 'cross_count': 180, 'rule': 'ge_main', 'expected': '>= 180', 'passed': True, 'error': None}, {'id': 9, 'name': '嵌入表→嵌入源(独立)', 'main_count': 108, 'cross_count': 101, 'rule': 'ge_main', 'expected': '>= 108', 'passed': False, 'error': None}, {'id': 10, 'name': '嵌入表→字段', 'main_count': 158, 'cross_count': 158, 'rule': 'ge_main', 'expected': '>= 158', 'passed': True, 'error': None}, {'id': 11, 'name': '数据列→物理表', 'main_count': 964, 'cross_count': 964, 'rule': 'eq_main', 'expected': 964, 'passed': True, 'error': None}, {'id': 12, 'name': '数据列→嵌入表', 'main_count': 4927, 'cross_count': 4927, 'rule': 'eq_main', 'expected': 4927, 'passed': True, 'error': None}, {'id': 13, 'name': '数据列→字段', 'main_count': 3829, 'cross_count': 3829, 'rule': 'eq_main', 'expected': 3829, 'passed': True, 'error': None}, {'id': 14, 'name': '发布源→物理表', 'main_count': 32, 'cross_count': 32, 'rule': 'ge_main', 'expected': '>= 32', 'passed': True, 'error': None}, {'id': 15, 'name': '发布源→嵌入源(穿透)', 'main_count': 27, 'cross_count': 27, 'rule': 'ge_main', 'expected': '>= 27', 'passed': True, 'error': None}, {'id': 16, 'name': '发布源→工作簿', 'main_count': 27, 'cross_count': 27, 'rule': 'ge_main', 'expected': '>= 27', 'passed': True, 'error': None}, {'id': 17, 'name': '发布源→字段', 'main_count': 57, 'cross_count': 57, 'rule': 'ge_main', 'expected': '>= 57', 'passed': True, 'error': None}, {'id': 18, 'name': '嵌入源(穿透)→发布源', 'main_count': 68, 'cross_count': 68, 'rule': 'eq_total', 'expected': 68, 'passed': True, 'error': None}, {'id': 19, 'name': '嵌入源(穿透)→工作簿', 'main_count': 68, 'cross_count': 68, 'rule': 'ge_main', 'expected': '>= 68', 'passed': True, 'error': None}, {'id': 20, 'name': '嵌入源(独立)→物理表', 'main_count': 4, 'cross_count': 4, 'rule': 'ge_main', 'expected': '>= 4', 'passed': True, 'error': None}, {'id': 21, 'name': '嵌入源(独立)→嵌入表', 'main_count': 40, 'cross_count': 40, 'rule': 'ge_main', 'expected': '>= 40', 'passed': True, 'error': None}, {'id': 22, 'name': '嵌入源(独立)→工作簿', 'main_count': 47, 'cross_count': 47, 'rule': 'ge_main', 'expected': '>= 47', 'passed': True, 'error': None}, {'id': 23, 'name': '嵌入源(独立)→字段', 'main_count': 47, 'cross_count': 47, 'rule': 'ge_main', 'expected': '>= 47', 'passed': True, 'error': None}, {'id': 24, 'name': '工作簿→数据库', 'main_count': 71, 'cross_count': 71, 'rule': 'eq_main', 'expected': 71, 'passed': True, 'error': None}, {'id': 25, 'name': '工作簿→物理表', 'main_count': 40, 'cross_count': 40, 'rule': 'eq_main', 'expected': 40, 'passed': True, 'error': None}, {'id': 26, 'name': '工作簿→嵌入表', 'main_count': 57, 'cross_count': 57, 'rule': 'eq_main', 'expected': 57, 'passed': True, 'error': None}, {'id': 27, 'name': '工作簿→发布源', 'main_count': 47, 'cross_count': 47, 'rule': 'eq_main', 'expected': 47, 'passed': True, 'error': None}, {'id': 28, 'name': '工作簿→嵌入源(穿透)', 'main_count': 47, 'cross_count': 47, 'rule': 'eq_main', 'expected': 47, 'passed': True, 'error': None}, {'id': 29, 'name': '工作簿→嵌入源(独立)', 'main_count': 35, 'cross_count': 35, 'rule': 'eq_main', 'expected': 35, 'passed': True, 'error': None}, {'id': 30, 'name': '工作簿→视图', 'main_count': 80, 'cross_count': 80, 'rule': 'eq_total', 'expected': 80, 'passed': True, 'error': None}, {'id': 31, 'name': '工作簿→字段', 'main_count': 80, 'cross_count': 80, 'rule': 'ge_main', 'expected': '>= 80', 'passed': True, 'error': None}, {'id': 32, 'name': '视图→数据库', 'main_count': 493, 'cross_count': 1388, 'rule': 'ge_main', 'expected': '>= 493', 'passed': True, 'error': None}, {'id': 33, 'name': '视图→物理表', 'main_count': 23, 'cross_count': 768, 'rule': 'ge_main', 'expected': '>= 23', 'passed': True, 'error': None}, {'id': 34, 'name': '视图→工作簿', 'main_count': 1595, 'cross_count': 1595, 'rule': 'eq_total', 'expected': 1595, 'passed': True, 'error': None}, {'id': 35, 'name': '视图→字段', 'main_count': 1389, 'cross_count': 1389, 'rule': 'eq_main', 'expected': 1389, 'passed': True, 'error': None}, {'id': 36, 'name': '字段→数据库', 'main_count': 4127, 'cross_count': 15296, 'rule': 'ge_main', 'expected': '>= 4127', 'passed': True, 'error': None}, {'id': 37, 'name': '字段→物理表', 'main_count': 1156, 'cross_count': 9133, 'rule': 'ge_main', 'expected': '>= 1156', 'passed': True, 'error': None}, {'id': 38, 'name': '字段→嵌入表', 'main_count': 4222, 'cross_count': 11896, 'rule': 'ge_main', 'expected': '>= 4222', 'passed': True, 'error': None}, {'id': 39, 'name': '字段→数据列', 'main_count': 4457, 'cross_count': 4457, 'rule': 'eq_main', 'expected': 4457, 'passed': True, 'error': None}, {'id': 40, 'name': '字段→发布源', 'main_count': 15597, 'cross_count': 11965, 'rule': 'eq_main', 'expected': 15597, 'passed': False, 'error': None}, {'id': 41, 'name': '字段→嵌入源(穿透)', 'main_count': 0, 'cross_count': 0, 'rule': 'eq_zero', 'expected': 0, 'passed': True, 'error': None}, {'id': 42, 'name': '字段→嵌入源(独立)', 'main_count': 4634, 'cross_count': 3331, 'rule': 'eq_main', 'expected': 4634, 'passed': False, 'error': None}, {'id': 43, 'name': '字段→工作簿', 'main_count': 16513, 'cross_count': 13620, 'rule': 'ge_main', 'expected': '>= 16513', 'passed': False, 'error': None}, {'id': 44, 'name': '字段→视图', 'main_count': 3063, 'cross_count': 1353, 'rule': 'eq_main', 'expected': 3063, 'passed': False, 'error': None}, {'id': 45, 'name': '字段→计算字段', 'main_count': 1964, 'cross_count': 1964, 'rule': 'eq_main', 'expected': 1964, 'passed': True, 'error': None}, {'id': 46, 'name': '计算字段→物理表', 'main_count': 852, 'cross_count': 3497, 'rule': 'ge_main', 'expected': '>= 852', 'passed': True, 'error': None}, {'id': 47, 'name': '计算字段→字段(依赖)', 'main_count': 4858, 'cross_count': 4858, 'rule': 'eq_main', 'expected': 4858, 'passed': True, 'error': None}, {'id': 48, 'name': '计算字段→发布源', 'main_count': 3632, 'cross_count': 3632, 'rule': 'eq_main', 'expected': 3632, 'passed': True, 'error': None}, {'id': 49, 'name': '计算字段→嵌入源(独立)', 'main_count': 1303, 'cross_count': 1303, 'rule': 'eq_main', 'expected': 1303, 'passed': True, 'error': None}, {'id': 50, 'name': '计算字段→工作簿', 'main_count': 4934, 'cross_count': 4934, 'rule': 'ge_main', 'expected': '>= 4934', 'passed': True, 'error': None}, {'id': 51, 'name': '计算字段→视图', 'main_count': 1710, 'cross_count': 1710, 'rule': 'eq_main', 'expected': 1710, 'passed': True, 'error': None}] |  |
| `calc_field_to_dependency.stats.unresolved_dependencies` | 717 | 450 | -267 |
| `calc_field_to_dependency.stats.total_dependencies` | 9809 | 9827 | +18 |
| `calc_field_to_dependency.stats.calc_fields_with_deps` | 4851 | 4858 | +7 |
| `table_to_field.stats.tables_with_fields` | 181 | 179 | -2 |
| `field_to_datasource.stats.with_datasource` | 10567 | 20231 | +9664 |
| `field_to_datasource.stats.total` | 10567 | 20231 | +9664 |
| `field_to_database.stats.fields_with_database` | 1501 | 1156 | -345 |
| `calculated_fields.with_duplicates` | 4236 | 0 | -4236 |
| `calculated_fields.total_dependencies` | 9809 | 9827 | +18 |
| `calculated_fields.total_count` | 4926 | 4935 | +9 |
| `field_to_table.stats.regular_without_table` | 922 | 10770 | +9848 |
| `field_to_table.stats.total` | 10567 | 20231 | +9664 |
| `field_to_table.stats.with_table` | 5838 | 5378 | -460 |
| `field_to_table.stats.calc_without_table` | 3807 | 4083 | +276 |
| `api_vs_db_samples` | None | {'api_base': 'http://localhost:8201/api', 'entities': [{'entity': 'fields', 'sampled': 10, 'mismatches': [{'id': '62f4a9f5-00d7-746f-718f-56d0b4587193', 'error': 'HTTP Error 404: NOT FOUND', 'url': 'http://localhost:8201/api/fields/62f4a9f5-00d7-746f-718f-56d0b4587193'}, {'id': 'b715cf9e-19ec-b8d5-dcb5-a3ef83e47a3b', 'error': 'HTTP Error 404: NOT FOUND', 'url': 'http://localhost:8201/api/fields/b715cf9e-19ec-b8d5-dcb5-a3ef83e47a3b'}], 'mismatch_count': 2}, {'entity': 'tables', 'sampled': 10, 'mismatches': [], 'mismatch_count': 0}, {'entity': 'datasources', 'sampled': 10, 'mismatches': [], 'mismatch_count': 0}, {'entity': 'workbooks', 'sampled': 10, 'mismatches': [], 'mismatch_count': 0}, {'entity': 'views', 'sampled': 10, 'mismatches': [], 'mismatch_count': 0}]} |  |
| `views.total_count` | 1594 | 1595 | +1 |
| `views.by_type.sheet` | 1395 | 1396 | +1 |
| `views.views_without_fields` | 213 | 206 | -7 |
| `full_chain_field_to_wb.stats.via_datasource_count` | 8890 | 18554 | +9664 |
| `fields.regular_count` | 5638 | 15296 | +9658 |
| `fields.fields_with_table` | 5838 | 5378 | -460 |
| `fields.calculated_count` | 4929 | 4935 | +6 |
| `fields.fields_with_datasource` | 10567 | 20231 | +9664 |
| `fields.fields_with_workbook` | 6849 | 16513 | +9664 |
| `fields.fields_without_table` | 4729 | 14853 | +10124 |
| `fields.total_count` | 10567 | 20231 | +9664 |
| `fields.fields_with_upstream_column` | 4658 | 4457 | -201 |
| `calc_field_to_table.stats.with_table` | 1122 | 852 | -270 |
| `calc_field_to_table.stats.total_calc` | 4929 | 4935 | +6 |
| `field_to_workbook.stats.via_datasource` | 8890 | 18554 | +9664 |
| `field_to_workbook.stats.direct_workbook` | 6849 | 16513 | +9664 |
| `field_to_view.stats.fields_with_views` | 2463 | 3063 | +600 |