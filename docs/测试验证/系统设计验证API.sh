#!/bin/bash
# 系统设计验证 API 脚本
# 自动执行系统设计验证清单中的 API 检查项
# 依赖: curl, jq

BASE_URL="http://localhost:8101"

echo "================================================================"
echo "Tableau 元数据治理平台 - API 系统设计验证"
echo "验证时间: $(date)"
echo "API 地址: $BASE_URL"
echo "================================================================"

# Helper function to print header
check_item() {
    echo ""
    echo "----------------------------------------------------------------"
    echo "验证项: $1"
    echo "说明: $2"
    echo "Command: $3"
    echo "----------------------------------------------------------------"
}

# 1. 数据源名称为空
check_item "数据源名称为空" "发布的数据源 name 字段为空" \
"curl -s $BASE_URL/api/datasources | jq '.items[] | select(.name==null)'"
curl -s "$BASE_URL/api/datasources" | jq '.items[] | select(.name==null)'

# 2. 数据源未归属项目
check_item "数据源未归属项目" "发布数据源 (is_embedded=0) 未关联 Project" \
"curl -s $BASE_URL/api/datasources | jq '.items[] | select(.project_name==null)'"
curl -s "$BASE_URL/api/datasources" | jq '.items[] | select(.project_name==null)'

# 3. 工作簿未归属项目
check_item "工作簿未归属项目" "工作簿未关联 Project" \
"curl -s $BASE_URL/api/workbooks | jq '.items[] | select(.project_name==null)'"
curl -s "$BASE_URL/api/workbooks" | jq '.items[] | select(.project_name==null)'

# 4. 工作簿缺少负责人
check_item "工作簿缺少负责人" "工作簿 owner 字段为空" \
"curl -s $BASE_URL/api/workbooks | jq '.items[] | select(.owner==null)'"
curl -s "$BASE_URL/api/workbooks" | jq '.items[] | select(.owner==null)'

# 5. 工作簿名称为空
check_item "工作簿名称为空" "工作簿缺少 name 标识" \
"curl -s $BASE_URL/api/workbooks | jq '.items[] | select(.name==null)'"
curl -s "$BASE_URL/api/workbooks" | jq '.items[] | select(.name==null)'

# 6. 孤立视图记录
check_item "孤立视图记录" "视图缺少 workbook_id" \
"curl -s $BASE_URL/api/views | jq '.items[] | select(.workbook_id==null)'"
curl -s "$BASE_URL/api/views" | jq '.items[] | select(.workbook_id==null)'

# 7. 未使用字段(无视图引用)
check_item "未使用字段(无视图引用)" "字段未被任何视图引用 (API: orphanedFields)" \
"curl -s $BASE_URL/api/stats | jq '.orphanedFields'"
curl -s "$BASE_URL/api/stats" | jq '.orphanedFields'

# 8. 度量数据类型缺失
check_item "度量数据类型缺失" "标记为度量 (role='measure') 的字段缺少 data_type" \
"curl -s $BASE_URL/api/fields?role=measure | jq '.items[] | select(.data_type==null)'"
curl -s "$BASE_URL/api/fields?role=measure" | jq '.items[] | select(.data_type==null)'

# 9. 逻辑重复定义
check_item "逻辑重复定义" "多个字段使用完全相同的计算公式" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.duplicate_formulas_top'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.duplicate_formulas_top'

# 10. 非认证数据源
check_item "非认证数据源" "数据源未获得官方认证" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.quality_metrics.datasource_coverage.certified'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.quality_metrics.datasource_coverage.certified'

# 11. 资产描述缺失
check_item "资产描述缺失" "核心资产 (表/字段) 缺少业务描述" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.issues.missing_description'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.issues.missing_description'

# 12. 低价值重命名
check_item "低价值重命名" "计算字段过于简单 (Score<=1)" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.complexity_distribution.low'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.complexity_distribution.low'

# 13. 全局计数不一致
check_item "全局计数不一致" "API 返回的资产总数" \
"curl -s $BASE_URL/api/stats"
curl -s "$BASE_URL/api/stats"

# 14. 字段来源归类错误
check_item "字段来源归类错误" "API 统计的'字段来源'分类" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.field_source_distribution'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.field_source_distribution'

# 15. 质量分计算偏差
check_item "质量分计算偏差" "健康度/完整性评分" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.quality_metrics'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.quality_metrics'

# 16. 治理看板计数偏差
check_item "治理看板计数偏差" "治理页面展示的问题数" \
"curl -s $BASE_URL/api/dashboard/analysis | jq '.issues'"
curl -s "$BASE_URL/api/dashboard/analysis" | jq '.issues'

# 17. 未使用指标统计口径
check_item "未使用指标统计口径" "聚合后的未使用指标列表 (期望 INDEX() 不在其中)" \
"curl -s $BASE_URL/api/metrics/catalog/unused | jq '.total_count'"
curl -s "$BASE_URL/api/metrics/catalog/unused" | jq '.total_count'

# 18. 字段血缘物理表映射补齐 (P0)
check_item "字段血缘物理表映射补齐" "副本字段通过继承获取物理表信息 (期望 table_info 不为 null)" \
"curl -s $BASE_URL/api/fields/01332753-6b5f-b122-b4c9-9d627d11e420 | jq '.table_info.name'"
curl -s "$BASE_URL/api/fields/01332753-6b5f-b122-b4c9-9d627d11e420" | jq '.table_info.name'

# 19. 字段血缘命名一致性 (P0)
check_item "字段血缘命名一致性" "后端返回 usedInWorkbooks 兼容字段 (期望长度 >= 1)" \
"curl -s $BASE_URL/api/fields/01332753-6b5f-b122-b4c9-9d627d11e420 | jq '.usedInWorkbooks | length'"
curl -s "$BASE_URL/api/fields/01332753-6b5f-b122-b4c9-9d627d11e420" | jq '.usedInWorkbooks | length'

echo ""
echo "================================================================"
echo "验证结束"
echo "================================================================"
