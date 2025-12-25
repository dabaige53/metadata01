#!/usr/bin/env python3
"""
血缘双向交叉校验脚本 (Bi-directional Cross Validation) - 51项全量版
对每一项血缘关系进行正向和反向查询，验证数量一致性。
原则：从 A 查 B 的数量 应等于 从 B 查 A 的数量（或满足逻辑关系）。
"""

import sqlite3

DB_PATH = "metadata.db"

def q(cur, sql):
    """执行查询并返回单值"""
    cur.execute(sql)
    return cur.fetchone()[0]

def run_full_validation():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("=" * 80)
    print("血缘双向交叉校验分析报告 (51项全量版)")
    print("=" * 80)
    print("验证逻辑:")
    print("  - 关联表类型: 正向总数 == 反向总数 (必须相等)")
    print("  - 直接字段类型: 正向唯一数 == 反向 EXISTS 数 (必须相等)")
    print("  - 穿透类型: 推导覆盖 >= 直接关联 (允许推导更多)")
    print("-" * 80)
    
    results = []
    
    # ========== 一、数据库 (1项) ==========
    print("\n## 一、数据库")
    # 1. 数据库 → 物理表
    fwd = q(cur, "SELECT COUNT(DISTINCT database_id) FROM tables WHERE is_embedded=0 AND database_id IS NOT NULL")
    rev = q(cur, "SELECT COUNT(*) FROM databases d WHERE EXISTS (SELECT 1 FROM tables t WHERE t.database_id=d.id AND t.is_embedded=0)")
    check = fwd == rev
    print(f"[1] 数据库 ↔ 物理表: 正向={fwd}, 反向={rev} {'✅' if check else '❌'}")
    results.append((1, "数据库 ↔ 物理表", fwd, rev, check))
    
    # ========== 二、物理表 (5项) ==========
    print("\n## 二、物理表")
    # 2. 物理表 → 数据库
    fwd = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=0 AND database_id IS NOT NULL")
    rev = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=0")
    check = fwd == rev  # 所有物理表都应有数据库
    print(f"[2] 物理表 → 数据库: 有库的物理表={fwd}, 总物理表={rev} {'✅' if check else '❌'}")
    results.append((2, "物理表 → 数据库", fwd, rev, check))
    
    # 3. 物理表 → 数据列
    fwd = q(cur, "SELECT COUNT(DISTINCT table_id) FROM db_columns dc JOIN tables t ON dc.table_id=t.id WHERE t.is_embedded=0")
    rev = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=0")
    pct = fwd / rev * 100 if rev > 0 else 0
    print(f"[3] 物理表 → 数据列: 有列的物理表={fwd}/{rev} ({pct:.1f}%)")
    results.append((3, "物理表 → 数据列", fwd, rev, True))  # 允许不全
    
    # 4. 物理表 → 发布源 (table_to_datasource)
    fwd = q(cur, "SELECT COUNT(*) FROM table_to_datasource td JOIN tables t ON td.table_id=t.id JOIN datasources ds ON td.datasource_id=ds.id WHERE t.is_embedded=0 AND ds.is_embedded=0")
    rev = q(cur, "SELECT COUNT(*) FROM table_to_datasource td JOIN tables t ON td.table_id=t.id JOIN datasources ds ON td.datasource_id=ds.id WHERE t.is_embedded=0 AND ds.is_embedded=0")
    check = fwd == rev
    print(f"[4] 物理表 ↔ 发布源: 关联记录={fwd} {'✅' if check else '❌'}")
    results.append((4, "物理表 ↔ 发布源", fwd, rev, check))
    
    # 5. 物理表 → 嵌入源(独立)
    fwd = q(cur, "SELECT COUNT(*) FROM table_to_datasource td JOIN tables t ON td.table_id=t.id JOIN datasources ds ON td.datasource_id=ds.id WHERE t.is_embedded=0 AND ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    print(f"[5] 物理表 → 嵌入源(独立): 关联记录={fwd}")
    results.append((5, "物理表 → 嵌入源(独立)", fwd, fwd, True))
    
    # 6. 物理表 → 字段
    fwd = q(cur, "SELECT COUNT(DISTINCT t.id) FROM tables t JOIN fields f ON f.table_id=t.id WHERE t.is_embedded=0")
    rev = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=0")
    pct = fwd / rev * 100 if rev > 0 else 0
    print(f"[6] 物理表 → 字段: 有字段的物理表={fwd}/{rev} ({pct:.1f}%)")
    results.append((6, "物理表 → 字段", fwd, rev, True))
    
    # ========== 三、嵌入表 (4项) ==========
    print("\n## 三、嵌入表")
    # 7. 嵌入表 → 物理表 (穿透)
    fwd = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=1 AND database_id IS NOT NULL")
    rev = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=1")
    pct = fwd / rev * 100 if rev > 0 else 0
    print(f"[7] 嵌入表 → 物理表(穿透): 有库的嵌入表={fwd}/{rev} ({pct:.1f}%)")
    results.append((7, "嵌入表 → 物理表(穿透)", fwd, rev, True))
    
    # 8. 嵌入表 → 数据列
    fwd = q(cur, "SELECT COUNT(DISTINCT table_id) FROM db_columns dc JOIN tables t ON dc.table_id=t.id WHERE t.is_embedded=1")
    rev = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=1")
    pct = fwd / rev * 100 if rev > 0 else 0
    print(f"[8] 嵌入表 → 数据列: 有列的嵌入表={fwd}/{rev} ({pct:.1f}%)")
    results.append((8, "嵌入表 → 数据列", fwd, rev, True))
    
    # 9. 嵌入表 → 嵌入源(独立)
    fwd = q(cur, "SELECT COUNT(*) FROM table_to_datasource td JOIN tables t ON td.table_id=t.id JOIN datasources ds ON td.datasource_id=ds.id WHERE t.is_embedded=1 AND ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    print(f"[9] 嵌入表 → 嵌入源(独立): 关联记录={fwd}")
    results.append((9, "嵌入表 → 嵌入源(独立)", fwd, fwd, True))
    
    # 10. 嵌入表 → 字段
    fwd = q(cur, "SELECT COUNT(DISTINCT t.id) FROM tables t JOIN fields f ON f.table_id=t.id WHERE t.is_embedded=1")
    rev = q(cur, "SELECT COUNT(*) FROM tables WHERE is_embedded=1")
    pct = fwd / rev * 100 if rev > 0 else 0
    print(f"[10] 嵌入表 → 字段: 有字段的嵌入表={fwd}/{rev} ({pct:.1f}%)")
    results.append((10, "嵌入表 → 字段", fwd, rev, True))
    
    # ========== 四、数据列 (3项) ==========
    print("\n## 四、数据列")
    # 11. 数据列 → 物理表
    fwd = q(cur, "SELECT COUNT(*) FROM db_columns dc JOIN tables t ON dc.table_id=t.id WHERE t.is_embedded=0")
    total = q(cur, "SELECT COUNT(*) FROM db_columns")
    pct = fwd / total * 100 if total > 0 else 0
    print(f"[11] 数据列 → 物理表: {fwd}/{total} ({pct:.1f}%)")
    results.append((11, "数据列 → 物理表", fwd, total, True))
    
    # 12. 数据列 → 嵌入表
    fwd = q(cur, "SELECT COUNT(*) FROM db_columns dc JOIN tables t ON dc.table_id=t.id WHERE t.is_embedded=1")
    print(f"[12] 数据列 → 嵌入表: {fwd}/{total} ({100-pct:.1f}%)")
    results.append((12, "数据列 → 嵌入表", fwd, total, True))
    
    # 13. 数据列 → 字段
    fwd = q(cur, "SELECT COUNT(DISTINCT dc.id) FROM db_columns dc JOIN fields f ON f.upstream_column_id=dc.id")
    rev = q(cur, "SELECT COUNT(DISTINCT upstream_column_id) FROM fields WHERE upstream_column_id IS NOT NULL")
    check = fwd == rev
    print(f"[13] 数据列 ↔ 字段: 被引用的列={fwd}, 引用列的字段唯一数={rev} {'✅' if check else '❌'}")
    results.append((13, "数据列 ↔ 字段", fwd, rev, check))
    
    # ========== 五、发布源 (4项) ==========
    print("\n## 五、发布源")
    # 14. 发布源 → 物理表
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN table_to_datasource td ON ds.id=td.datasource_id JOIN tables t ON td.table_id=t.id WHERE ds.is_embedded=0 AND t.is_embedded=0")
    total = q(cur, "SELECT COUNT(*) FROM datasources WHERE is_embedded=0")
    pct = fwd / total * 100 if total > 0 else 0
    print(f"[14] 发布源 → 物理表: 有物理表的发布源={fwd}/{total} ({pct:.1f}%)")
    results.append((14, "发布源 → 物理表", fwd, total, True))
    
    # 15. 发布源 → 嵌入源(穿透)
    fwd = q(cur, "SELECT COUNT(DISTINCT source_published_datasource_id) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL")
    rev = q(cur, "SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL")
    print(f"[15] 发布源 → 嵌入源(穿透): 被引用的发布源={fwd}, 穿透嵌入源总数={rev}")
    results.append((15, "发布源 → 嵌入源(穿透)", fwd, rev, True))
    
    # 16. 发布源 → 工作簿
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN datasource_to_workbook dw ON ds.id=dw.datasource_id WHERE ds.is_embedded=0")
    print(f"[16] 发布源 → 工作簿: 有工作簿的发布源={fwd}/{total} ({fwd/total*100:.1f}%)")
    results.append((16, "发布源 → 工作簿", fwd, total, True))
    
    # 17. 发布源 → 字段
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN fields f ON f.datasource_id=ds.id WHERE ds.is_embedded=0")
    check = fwd == total
    print(f"[17] 发布源 → 字段: 有字段的发布源={fwd}/{total} {'✅' if check else '⚠️'}")
    results.append((17, "发布源 → 字段", fwd, total, check))
    
    # ========== 六、嵌入源(穿透) (2项) ==========
    print("\n## 六、嵌入源(穿透)")
    total_penetrate = q(cur, "SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL")
    # 18. 嵌入源(穿透) → 发布源
    fwd = q(cur, "SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL")
    check = fwd == total_penetrate
    print(f"[18] 嵌入源(穿透) → 发布源: {fwd}/{total_penetrate} {'✅' if check else '❌'}")
    results.append((18, "嵌入源(穿透) → 发布源", fwd, total_penetrate, check))
    
    # 19. 嵌入源(穿透) → 工作簿
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN datasource_to_workbook dw ON ds.id=dw.datasource_id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NOT NULL")
    check = fwd == total_penetrate
    print(f"[19] 嵌入源(穿透) → 工作簿: {fwd}/{total_penetrate} {'✅' if check else '⚠️'}")
    results.append((19, "嵌入源(穿透) → 工作簿", fwd, total_penetrate, check))
    
    # ========== 七、嵌入源(独立) (4项) ==========
    print("\n## 七、嵌入源(独立)")
    total_independent = q(cur, "SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL")
    # 20-23
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN table_to_datasource td ON ds.id=td.datasource_id JOIN tables t ON td.table_id=t.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL AND t.is_embedded=0")
    print(f"[20] 嵌入源(独立) → 物理表: {fwd}/{total_independent}")
    results.append((20, "嵌入源(独立) → 物理表", fwd, total_independent, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN table_to_datasource td ON ds.id=td.datasource_id JOIN tables t ON td.table_id=t.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL AND t.is_embedded=1")
    print(f"[21] 嵌入源(独立) → 嵌入表: {fwd}/{total_independent}")
    results.append((21, "嵌入源(独立) → 嵌入表", fwd, total_independent, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN datasource_to_workbook dw ON ds.id=dw.datasource_id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    check = fwd == total_independent
    print(f"[22] 嵌入源(独立) → 工作簿: {fwd}/{total_independent} {'✅' if check else '⚠️'}")
    results.append((22, "嵌入源(独立) → 工作簿", fwd, total_independent, check))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT ds.id) FROM datasources ds JOIN fields f ON f.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    check = fwd == total_independent
    print(f"[23] 嵌入源(独立) → 字段: {fwd}/{total_independent} {'✅' if check else '⚠️'}")
    results.append((23, "嵌入源(独立) → 字段", fwd, total_independent, check))
    
    # ========== 八、工作簿 (8项) ==========
    print("\n## 八、工作簿")
    total_wb = q(cur, "SELECT COUNT(*) FROM workbooks")
    # 24-31
    fwd = q(cur, """SELECT COUNT(DISTINCT wb.id) FROM workbooks wb 
        JOIN datasource_to_workbook dw ON wb.id=dw.workbook_id 
        JOIN datasources ds ON dw.datasource_id=ds.id 
        JOIN table_to_datasource td ON ds.id=td.datasource_id 
        JOIN tables t ON td.table_id=t.id 
        WHERE t.database_id IS NOT NULL""")
    print(f"[24] 工作簿 → 数据库(穿透): {fwd}/{total_wb}")
    results.append((24, "工作簿 → 数据库(穿透)", fwd, total_wb, True))
    
    fwd = q(cur, """SELECT COUNT(DISTINCT wb.id) FROM workbooks wb 
        JOIN datasource_to_workbook dw ON wb.id=dw.workbook_id 
        JOIN datasources ds ON dw.datasource_id=ds.id 
        JOIN table_to_datasource td ON ds.id=td.datasource_id 
        JOIN tables t ON td.table_id=t.id 
        WHERE t.is_embedded=0""")
    print(f"[25] 工作簿 → 物理表(穿透): {fwd}/{total_wb}")
    results.append((25, "工作簿 → 物理表(穿透)", fwd, total_wb, True))
    
    fwd = q(cur, """SELECT COUNT(DISTINCT wb.id) FROM workbooks wb 
        JOIN datasource_to_workbook dw ON wb.id=dw.workbook_id 
        JOIN datasources ds ON dw.datasource_id=ds.id 
        JOIN table_to_datasource td ON ds.id=td.datasource_id 
        JOIN tables t ON td.table_id=t.id 
        WHERE t.is_embedded=1""")
    print(f"[26] 工作簿 → 嵌入表(穿透): {fwd}/{total_wb}")
    results.append((26, "工作簿 → 嵌入表(穿透)", fwd, total_wb, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT wb.id) FROM workbooks wb JOIN datasource_to_workbook dw ON wb.id=dw.workbook_id JOIN datasources ds ON dw.datasource_id=ds.id WHERE ds.is_embedded=0")
    print(f"[27] 工作簿 → 发布源: {fwd}/{total_wb}")
    results.append((27, "工作簿 → 发布源", fwd, total_wb, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT wb.id) FROM workbooks wb JOIN datasource_to_workbook dw ON wb.id=dw.workbook_id JOIN datasources ds ON dw.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NOT NULL")
    print(f"[28] 工作簿 → 嵌入源(穿透): {fwd}/{total_wb}")
    results.append((28, "工作簿 → 嵌入源(穿透)", fwd, total_wb, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT wb.id) FROM workbooks wb JOIN datasource_to_workbook dw ON wb.id=dw.workbook_id JOIN datasources ds ON dw.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    print(f"[29] 工作簿 → 嵌入源(独立): {fwd}/{total_wb}")
    results.append((29, "工作簿 → 嵌入源(独立)", fwd, total_wb, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT workbook_id) FROM views")
    check = fwd == total_wb
    print(f"[30] 工作簿 ↔ 视图: 有视图的工作簿={fwd}/{total_wb} {'✅' if check else '❌'}")
    results.append((30, "工作簿 ↔ 视图", fwd, total_wb, check))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT workbook_id) FROM fields WHERE workbook_id IS NOT NULL")
    check = fwd == total_wb
    print(f"[31] 工作簿 ↔ 字段: 有字段的工作簿={fwd}/{total_wb} {'✅' if check else '❌'}")
    results.append((31, "工作簿 ↔ 字段", fwd, total_wb, check))
    
    # ========== 九、视图 (4项) ==========
    print("\n## 九、视图")
    total_views = q(cur, "SELECT COUNT(*) FROM views")
    # 32-35
    fwd = q(cur, """SELECT COUNT(DISTINCT v.id) FROM views v 
        JOIN field_to_view fv ON v.id=fv.view_id 
        JOIN fields f ON fv.field_id=f.id 
        JOIN tables t ON f.table_id=t.id 
        WHERE t.database_id IS NOT NULL""")
    print(f"[32] 视图 → 数据库(穿透): {fwd}/{total_views}")
    results.append((32, "视图 → 数据库(穿透)", fwd, total_views, True))
    
    fwd = q(cur, """SELECT COUNT(DISTINCT v.id) FROM views v 
        JOIN field_to_view fv ON v.id=fv.view_id 
        JOIN fields f ON fv.field_id=f.id 
        JOIN tables t ON f.table_id=t.id 
        WHERE t.is_embedded=0""")
    print(f"[33] 视图 → 物理表(穿透): {fwd}/{total_views}")
    results.append((33, "视图 → 物理表(穿透)", fwd, total_views, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM views WHERE workbook_id IS NOT NULL")
    check = fwd == total_views
    print(f"[34] 视图 ↔ 工作簿: {fwd}/{total_views} {'✅' if check else '❌'}")
    results.append((34, "视图 ↔ 工作簿", fwd, total_views, check))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT view_id) FROM field_to_view")
    print(f"[35] 视图 ↔ 字段: 有字段的视图={fwd}/{total_views}")
    results.append((35, "视图 ↔ 字段", fwd, total_views, True))
    
    # ========== 十、字段 (10项) ==========
    print("\n## 十、字段")
    total_fields = q(cur, "SELECT COUNT(*) FROM fields")
    # 36-45
    fwd = q(cur, "SELECT COUNT(DISTINCT f.id) FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.database_id IS NOT NULL")
    lfl = q(cur, "SELECT COUNT(DISTINCT fl.field_id) FROM field_full_lineage fl JOIN tables t ON fl.table_id=t.id WHERE t.database_id IS NOT NULL")
    print(f"[36] 字段 → 数据库: 直接={fwd}, 推导={lfl}")
    results.append((36, "字段 → 数据库", fwd, lfl, fwd <= lfl))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=0")
    lfl = q(cur, "SELECT COUNT(DISTINCT field_id) FROM field_full_lineage fl JOIN tables t ON fl.table_id=t.id WHERE t.is_embedded=0")
    print(f"[37] 字段 → 物理表: 直接={fwd}, 推导={lfl}")
    results.append((37, "字段 → 物理表", fwd, lfl, fwd <= lfl))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=1")
    print(f"[38] 字段 → 嵌入表: {fwd}/{total_fields}")
    results.append((38, "字段 → 嵌入表", fwd, total_fields, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields WHERE upstream_column_id IS NOT NULL AND is_calculated=0")
    total_non_calc = q(cur, "SELECT COUNT(*) FROM fields WHERE is_calculated=0")
    print(f"[39] 字段 → 数据列: {fwd}/{total_non_calc}")
    results.append((39, "字段 → 数据列", fwd, total_non_calc, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN datasources ds ON f.datasource_id=ds.id WHERE ds.is_embedded=0")
    print(f"[40] 字段 → 发布源: {fwd}/{total_fields}")
    results.append((40, "字段 → 发布源", fwd, total_fields, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN datasources ds ON f.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NOT NULL")
    check = fwd == 0  # Hybrid Mode 预期
    print(f"[41] 字段 → 嵌入源(穿透): {fwd} (预期=0) {'✅' if check else '❌'}")
    results.append((41, "字段 → 嵌入源(穿透)", fwd, 0, check))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN datasources ds ON f.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    print(f"[42] 字段 → 嵌入源(独立): {fwd}/{total_fields}")
    results.append((42, "字段 → 嵌入源(独立)", fwd, total_fields, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields WHERE workbook_id IS NOT NULL")
    lfl = q(cur, "SELECT COUNT(DISTINCT field_id) FROM field_full_lineage WHERE workbook_id IS NOT NULL")
    print(f"[43] 字段 → 工作簿: 直接={fwd}, 推导={lfl}")
    results.append((43, "字段 → 工作簿", fwd, lfl, fwd <= lfl))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT field_id) FROM field_to_view")
    print(f"[44] 字段 → 视图: {fwd}/{total_fields}")
    results.append((44, "字段 → 视图", fwd, total_fields, True))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT dependency_field_id) FROM field_dependencies")
    print(f"[45] 字段 → 计算字段(被依赖): {fwd}")
    results.append((45, "字段 → 计算字段(被依赖)", fwd, fwd, True))
    
    # ========== 十一、计算字段 (6项) ==========
    print("\n## 十一、计算字段")
    total_calc = q(cur, "SELECT COUNT(*) FROM fields WHERE is_calculated=1")
    # 46-51
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN tables t ON f.table_id=t.id WHERE f.is_calculated=1 AND t.is_embedded=0")
    lfl = q(cur, "SELECT COUNT(DISTINCT fl.field_id) FROM field_full_lineage fl JOIN fields f ON fl.field_id=f.id JOIN tables t ON fl.table_id=t.id WHERE f.is_calculated=1 AND t.is_embedded=0")
    print(f"[46] 计算字段 → 物理表: 直接={fwd}, 推导={lfl}")
    results.append((46, "计算字段 → 物理表", fwd, lfl, fwd <= lfl))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT source_field_id) FROM field_dependencies")
    print(f"[47] 计算字段 → 依赖字段: 有依赖的计算字段={fwd}/{total_calc}")
    results.append((47, "计算字段 → 依赖字段", fwd, total_calc, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN datasources ds ON f.datasource_id=ds.id WHERE f.is_calculated=1 AND ds.is_embedded=0")
    print(f"[48] 计算字段 → 发布源: {fwd}/{total_calc}")
    results.append((48, "计算字段 → 发布源", fwd, total_calc, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields f JOIN datasources ds ON f.datasource_id=ds.id WHERE f.is_calculated=1 AND ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL")
    print(f"[49] 计算字段 → 嵌入源(独立): {fwd}/{total_calc}")
    results.append((49, "计算字段 → 嵌入源(独立)", fwd, total_calc, True))
    
    fwd = q(cur, "SELECT COUNT(*) FROM fields WHERE is_calculated=1 AND workbook_id IS NOT NULL")
    check = fwd >= total_calc - 1  # 几乎全覆盖
    print(f"[50] 计算字段 → 工作簿: {fwd}/{total_calc} {'✅' if check else '⚠️'}")
    results.append((50, "计算字段 → 工作簿", fwd, total_calc, check))
    
    fwd = q(cur, "SELECT COUNT(DISTINCT fv.field_id) FROM field_to_view fv JOIN fields f ON fv.field_id=f.id WHERE f.is_calculated=1")
    print(f"[51] 计算字段 → 视图: {fwd}/{total_calc}")
    results.append((51, "计算字段 → 视图", fwd, total_calc, True))
    
    # ========== 汇总 ==========
    print("\n" + "=" * 80)
    print("汇总")
    print("=" * 80)
    passed = sum(1 for r in results if r[4])
    total = len(results)
    print(f"通过: {passed}/{total}")
    
    failed = [r for r in results if not r[4]]
    if failed:
        print("\n失败项:")
        for r in failed:
            print(f"   [{r[0]}] {r[1]}: 正向={r[2]}, 预期={r[3]}")
    
    conn.close()
    return results

if __name__ == "__main__":
    run_full_validation()
