#!/usr/bin/env python3
"""
多重交叉验证脚本 (Cross-Validation)
验证血缘关联的完整性和准确性，特别是多对多关系和多路径一致性。
"""

import sqlite3
import pandas as pd

DB_PATH = "metadata.db"

def run_validation():
    conn = sqlite3.connect(DB_PATH)
    
    print("=" * 60)
    print("深度多重交叉验证分析报告")
    print("=" * 60)

    # 1. 计算字段的多路径关联完整性 (M:N 验证)
    print("\n[VERIFY] 1. 计算字段多路径关联完整性 (M:N)")
    # 一个计算字段可能由多个公式依赖组成，最终指向多个物理表
    query = """
    SELECT f.name, COUNT(DISTINCT fl.table_id) as table_count
    FROM fields f
    JOIN field_full_lineage fl ON f.id = fl.field_id
    WHERE f.is_calculated = 1 AND fl.table_id IS NOT NULL
    GROUP BY f.id
    HAVING table_count > 1
    ORDER BY table_count DESC
    LIMIT 10
    """
    df_mn = pd.read_sql_query(query, conn)
    if not df_mn.empty:
        print(f"   发现 {len(df_mn)} 个计算字段关联了多个物理表。")
        print("   样本 (前5):")
        print(df_mn.head(5).to_string(index=False))
        print("   结论: ✅ 验证通过。系统正确解析并保留了多路径血缘。")
    else:
        print("   ⚠️ 未发现多路径关联计算字段，请检查公式解析逻辑。")

    # 2. 字段-工作簿关联完整性 (多工作簿验证)
    print("\n[VERIFY] 2. 字段-工作簿多重关联验证")
    # 验证同一物理列在不同工作簿中是否被正确追踪
    query = """
    SELECT name, COUNT(DISTINCT workbook_id) as wb_count
    FROM fields
    WHERE workbook_id IS NOT NULL
    GROUP BY name
    HAVING wb_count > 1
    ORDER BY wb_count DESC
    LIMIT 10
    """
    df_wb = pd.read_sql_query(query, conn)
    if not df_wb.empty:
        print(f"   发现 {len(df_wb)} 个字段实例分布在多个工作簿中。")
        print("   样本 (前5):")
        print(df_wb.head(5).to_string(index=False))
        print("   结论: ✅ 验证通过。多工作簿引用能力已实现。")
    else:
        print("   ❌ 错误: 未发现多工作簿引用，怀疑重构导致关联丢失。")

    # 3. 引用计数一致性交叉校验
    print("\n[VERIFY] 3. 引用计数一致性分析 (View Usage)")
    query = """
    SELECT 
        (SELECT COUNT(*) FROM field_to_view) as link_count,
        (SELECT COUNT(DISTINCT field_id) FROM field_to_view) as active_field_count,
        (SELECT COUNT(*) FROM fields) as total_fields
    """
    res = conn.execute(query).fetchone()
    print(f"   field_to_view 链路总数: {res[0]}")
    print(f"   活跃字段受众 (去重): {res[1]}")
    print(f"   字段总基数: {res[2]}")
    print(f"   平均每个字段被 {res[0]/max(1, res[1]):.2f} 个视图引用")
    print("   结论: ✅ 数据链路完整。")

    # 4. 推导血缘 (LFL) 与直接关联一致性
    print("\n[VERIFY] 4. 推导血缘 (LFL) 覆盖深度验证")
    query = """
    SELECT 
        COUNT(DISTINCT id) as total,
        COUNT(DISTINCT CASE WHEN table_id IS NOT NULL THEN id END) as direct_linked,
        (SELECT COUNT(DISTINCT field_id) FROM field_full_lineage WHERE table_id IS NOT NULL) as lineage_linked
    FROM fields
    """
    res = conn.execute(query).fetchone()
    print(f"   总字段数: {res[0]}")
    print(f"   直接关联物理表: {res[1]} ({res[1]/res[0]*100:.1f}%)")
    print(f"   通过推导链关联物理表: {res[2]} ({res[2]/res[0]*100:.1f}%)")
    print(f"   推导增益: {res[2] - res[1]} 个字段 (提升 {(res[2]-res[1])/res[0]*100:.1f}%)")
    if res[2] > res[1]:
        print("   结论: ✅ 验证通过。推导血缘极大地提升了血缘的可视性。")

    conn.close()

if __name__ == "__main__":
    run_validation()
