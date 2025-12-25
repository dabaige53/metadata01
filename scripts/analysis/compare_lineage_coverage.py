#!/usr/bin/env python3
"""
血缘覆盖率前后端差异对比分析脚本
对比 analyze_lineage.py 的统计口径与前端 API 实际返回的血缘范围
"""

import sqlite3
import json

DB_PATH = "metadata.db"

def run():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("=" * 60)
    print("血缘覆盖率前后端差异对比分析")
    print("=" * 60)
    
    # ============================================================
    # 差异点 1: fields.table_id vs field_full_lineage.table_id
    # ============================================================
    print("\n## 差异点 1: 字段表关联统计口径差异")
    print("   analyze_lineage.py 使用: fields.table_id (直接关联)")
    print("   前端 API 使用: field_full_lineage.table_id (预计算推导)")
    
    # 脚本口径
    cur.execute("SELECT count(*) FROM fields WHERE table_id IS NOT NULL")
    direct_table = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM fields")
    total_fields = cur.fetchone()[0]
    print(f"\n   直接关联 (fields.table_id IS NOT NULL): {direct_table}/{total_fields} ({direct_table/total_fields*100:.1f}%)")
    
    # 前端口径
    cur.execute("SELECT count(DISTINCT field_id) FROM field_full_lineage WHERE table_id IS NOT NULL")
    lineage_table = cur.fetchone()[0]
    print(f"   推导关联 (field_full_lineage): {lineage_table}/{total_fields} ({lineage_table/total_fields*100:.1f}%)")
    
    print(f"\n   >>> 差距: {lineage_table - direct_table} 个字段通过数据源推导获得了表关联")
    
    # ============================================================
    # 差异点 2: 字段工作簿关联
    # ============================================================
    print("\n## 差异点 2: 字段工作簿关联统计口径差异")
    print("   analyze_lineage.py 使用: fields.workbook_id (直接关联)")
    print("   前端 API 使用: field_full_lineage.workbook_id (预计算推导)")
    
    cur.execute("SELECT count(*) FROM fields WHERE workbook_id IS NOT NULL")
    direct_wb = cur.fetchone()[0]
    print(f"\n   直接关联 (fields.workbook_id): {direct_wb}/{total_fields} ({direct_wb/total_fields*100:.1f}%)")
    
    cur.execute("SELECT count(DISTINCT field_id) FROM field_full_lineage WHERE workbook_id IS NOT NULL")
    lineage_wb = cur.fetchone()[0]
    print(f"   推导关联 (field_full_lineage): {lineage_wb}/{total_fields} ({lineage_wb/total_fields*100:.1f}%)")
    
    print(f"\n   >>> 差距: {lineage_wb - direct_wb} 个字段通过数据源推导获得了工作簿关联")
    
    # ============================================================
    # 差异点 3: table_to_datasource 写入完整性
    # ============================================================
    print("\n## 差异点 3: table_to_datasource 关联表完整性")
    cur.execute("SELECT count(*) FROM table_to_datasource")
    td_count = cur.fetchone()[0]
    cur.execute("SELECT count(DISTINCT table_id) FROM table_to_datasource")
    td_tables = cur.fetchone()[0]
    cur.execute("SELECT count(DISTINCT datasource_id) FROM table_to_datasource")
    td_ds = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM tables")
    total_tables = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM datasources")
    total_ds = cur.fetchone()[0]
    
    print(f"   关联记录数: {td_count}")
    print(f"   涉及表数: {td_tables}/{total_tables} ({td_tables/total_tables*100:.1f}%)")
    print(f"   涉及数据源数: {td_ds}/{total_ds} ({td_ds/total_ds*100:.1f}%)")
    
    # 检查无关联的发布数据源
    cur.execute("""
        SELECT name FROM datasources 
        WHERE is_embedded=0 
        AND id NOT IN (SELECT DISTINCT datasource_id FROM table_to_datasource)
    """)
    orphan_ds = cur.fetchall()
    print(f"\n   无表关联的发布数据源 ({len(orphan_ds)}个):")
    for r in orphan_ds[:5]:
        print(f"     - {r[0]}")
    if len(orphan_ds) > 5:
        print(f"     ... 及其他 {len(orphan_ds)-5} 个")
    
    # ============================================================
    # 差异点 4: 前端接口使用"按名称聚合"
    # ============================================================
    print("\n## 差异点 4: 前端接口按名称聚合血缘")
    print("   get_field_detail API 查询逻辑:")
    print("   SELECT ... FROM fields f JOIN field_full_lineage fl ... WHERE f.name = :field_name")
    print("   这意味着：前端展示的是【所有同名字段】的聚合血缘，而非单个字段的血缘")
    
    # 抽样验证
    cur.execute("""
        SELECT name, count(*) as cnt 
        FROM fields 
        GROUP BY name 
        HAVING cnt > 1 
        ORDER BY cnt DESC 
        LIMIT 5
    """)
    dup_names = cur.fetchall()
    print(f"\n   同名字段样本 (会在前端聚合展示):")
    for r in dup_names:
        print(f"     - 字段名 '{r[0]}' 有 {r[1]} 个实例")
    
    # ============================================================
    # 结论
    # ============================================================
    print("\n" + "=" * 60)
    print("结论与建议")
    print("=" * 60)
    print("""
1. analyze_lineage.py 使用的是【直接关联】统计口径 (fields.table_id)，
   而前端使用的是【预计算推导】血缘 (field_full_lineage)，两者存在显著差异。
   
2. 实际业务覆盖率应以 field_full_lineage 为准，因为它包含了通过
   datasource -> table 链路推导的间接关联。

3. 建议在分析报告中明确标注统计口径，而非简单称之为"覆盖率异常"。

4. 无表关联的发布数据源(Custom SQL)是客观业务现象，无法通过代码修复。
""")
    
    conn.close()

if __name__ == "__main__":
    run()
