#!/bin/bash
# 系统设计验证 API 脚本
# 自动执行系统设计验证清单中的 API 检查项
# 范围: 仅验证系统设计基础问题,不包含数据治理层面的验证
# 依赖: curl, jq

BASE_URL="http://localhost:8201"

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

# 2a. 嵌入式数据源统计验证
check_item "嵌入式数据源统计验证" "验证 is_embedded 筛选参数是否工作" \
"curl -s $BASE_URL/api/datasources?is_embedded=1 | jq '{embedded_count: .total}'"
curl -s "$BASE_URL/api/datasources?is_embedded=1" | jq '{embedded_count: .total}'

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

# 9. 全局计数验证
check_item "全局计数验证" "API 返回的资产总数 - 验证与数据库一致性" \
"curl -s $BASE_URL/api/stats"
curl -s "$BASE_URL/api/stats"

# 10. 计算字段孤儿数据源引用
check_item "计算字段孤儿数据源引用" "引用了不存在数据源的计算字段 (显示Unknown)" \
"curl -s $BASE_URL/api/metrics | jq '.items[] | select(.datasource_name==\"Unknown\" or .datasource_name==null)' | head -20"
curl -s "$BASE_URL/api/metrics" | jq '.items[] | select(.datasource_name=="Unknown" or .datasource_name==null)' | head -20

# 11. 计算字段物理表血缘缺失
check_item "计算字段物理表血缘缺失" "缺少物理表关联的计算字段数量" \
"curl -s $BASE_URL/api/metrics | jq '[.items[] | select(.table_id==null)] | length'"
curl -s "$BASE_URL/api/metrics" | jq '[.items[] | select(.table_id==null)] | length'

echo ""

# 12. 原始字段归属缺失
check_item "原始字段归属缺失" "原始字段无DataSource ID" \
"curl -s $BASE_URL/api/fields?page_size=10000 | jq '[.items[] | select(.isCalculated==false and .datasourceId==null)] | length'"
curl -s "$BASE_URL/api/fields?page_size=10000" | jq '[.items[] | select(.isCalculated==false and .datasourceId==null)] | length'

# 13. 计算字段归属缺失 (修正: 允许归属 DS 或 WB)
check_item "计算字段归属缺失" "计算字段无 Workbook 也无 Datasource" \
"curl -s $BASE_URL/api/fields?page_size=10000 | jq '[.items[] | select(.isCalculated==true and .workbookId==null and .datasourceId==null)] | length'"
curl -s "$BASE_URL/api/fields?page_size=10000" | jq '[.items[] | select(.isCalculated==true and .workbookId==null and .datasourceId==null)] | length'

# 14. 详情页数据完整性 (验证后端无硬编码限制)
echo ""
echo "----------------------------------------------------------------"
echo "验证项: 14. 详情页数据完整性"
echo "说明: 验证最大数据源的详情页是否包含所有字段 (应 > 100)"
echo "----------------------------------------------------------------"

# 1. 获取字段数最多的一个数据源 (从数据库查，比API排序靠谱)
DS_ID=$(sqlite3 metadata.db "SELECT datasource_id FROM fields WHERE datasource_id IS NOT NULL GROUP BY datasource_id ORDER BY count(*) DESC LIMIT 1;")
DETAIL_JSON=$(curl -s "$BASE_URL/api/datasources/$DS_ID")
DS_NAME=$(echo $DETAIL_JSON | jq -r '.name')
EXPECTED_COUNT=$(echo $DETAIL_JSON | jq -r '.total_field_count')

echo "测试对象: [数据源] $DS_NAME (ID: $DS_ID)"
echo "预期字段数: $EXPECTED_COUNT"

# 2. 获取详情页数据
# DETAIL_JSON is already fetched
ACTUAL_COUNT=$(echo $DETAIL_JSON | jq '.total_field_count') # 详情页统计值
LIST_LEN=$(echo $DETAIL_JSON | jq '.full_fields | length')   # 实际列表长度

echo "详情页统计: $ACTUAL_COUNT"
echo "实际列表长: $LIST_LEN"

if [ "$LIST_LEN" -eq "$ACTUAL_COUNT" ]; then
    if [ "$LIST_LEN" -gt 100 ]; then
        echo "✅ PASS: 列表完整且超过 100 条 (Limit 已移除) - 当前: $LIST_LEN"
    elif [ "$EXPECTED_COUNT" -le 100 ]; then
        echo "⚠️ SKIP: 该数据源字段不足 100 条 ($LIST_LEN)，无法验证高水位限制，但计数一致。"
    else
         echo "❌ FAIL: 计数一致但小于 100，预期应更多。"
    fi
else
    echo "❌ FAIL: 列表长度 ($LIST_LEN) 与统计值 ($ACTUAL_COUNT) 不一致！可能存在截断。"
fi

echo ""
echo "================================================================"
echo "系统设计验证结束"
echo "================================================================"
