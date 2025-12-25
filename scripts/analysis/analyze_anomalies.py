
import sqlite3

def run_query(cur, sql):
    cur.execute(sql)
    return cur.fetchall()

def analyze_1_10():
    conn = sqlite3.connect('metadata.db')
    cur = conn.cursor()
    print("=== 分析 第1-10项：数据库/表/数据列 ===")

    # 3. 物理表 -> 数据列 (47.2%)
    print("\n3. 物理表 -> 数据列 (47.2%): 为什么一半的物理表没有列？")
    cur.execute("""
        SELECT count(*) FROM tables 
        WHERE is_embedded=0 
        AND id NOT IN (SELECT DISTINCT table_id FROM db_columns)
    """)
    orphan_count = cur.fetchone()[0]
    print(f"  没有列的物理表数量: {orphan_count}")
    cur.execute("""
        SELECT name, schema FROM tables 
        WHERE is_embedded=0 
        AND id NOT IN (SELECT DISTINCT table_id FROM db_columns)
        LIMIT 5
    """)
    print("  样本:")
    for r in cur.fetchall(): print(f"    - {r[1]}.{r[0]}")

    # 4 & 5. 覆盖率 > 100%
    print("\n4 & 5. 物理表 -> 数据源 (>100%): 验证一对多关系")
    cur.execute("""
        SELECT t.name, count(td.datasource_id) as ds_count
        FROM tables t
        JOIN table_to_datasource td ON t.id = td.table_id
        WHERE t.is_embedded=0
        GROUP BY t.id
        HAVING ds_count > 1
        LIMIT 3
    """)
    print("  多数据源引用样本:")
    for r in cur.fetchall(): print(f"    - 表 {r[0]} 被 {r[1]} 个数据源引用")

    # 7. 嵌入表 -> 物理表 (92.9%)
    print("\n7. 嵌入表 -> 物理表 (92.9%): 哪些嵌入表没穿透到物理表？")
    cur.execute("""
        SELECT name, schema FROM tables 
        WHERE is_embedded=1 AND database_id IS NULL 
        LIMIT 5
    """)
    print("  未穿透样本 (可能是 Excel/CSV/CustomSQL):")
    for r in cur.fetchall(): print(f"    - {r[1]}.{r[0]}")

    # 8. 嵌入表 -> 数据列 (37.5%)
    print("\n8. 嵌入表 -> 数据列 (37.5%): 低覆盖率原因")
    cur.execute("""
        SELECT count(*) FROM tables WHERE is_embedded=1
    """)
    total_emb = cur.fetchone()[0]
    cur.execute("""
        SELECT count(*) FROM tables 
        WHERE is_embedded=1 
        AND id IN (SELECT DISTINCT table_id FROM db_columns)
    """)
    has_col = cur.fetchone()[0]
    print(f"  嵌入表总数: {total_emb}, 有列的嵌入表: {has_col}")

    conn.close()

def analyze_11_23():
    conn = sqlite3.connect('metadata.db')
    cur = conn.cursor()
    print("\n=== 分析 第11-23项：数据列/数据源 ===")

    # 13. 数据列 -> 字段 (68.0%)
    print("\n13. 数据列 -> 字段 (68.0%): 孤鸿列分析")
    cur.execute("""
        SELECT count(*) FROM db_columns 
        WHERE id NOT IN (SELECT DISTINCT upstream_column_id FROM fields WHERE upstream_column_id IS NOT NULL)
    """)
    orphan_cols = cur.fetchone()[0]
    print(f"  没有被字段引用的原生列数量: {orphan_cols}")

    # 14. 发布源 -> 物理表 (56.1%)
    print("\n14. 发布源 -> 物理表 (56.1%): 为什么 57 个发布源中只有 32 个有关联表？")
    cur.execute("""
        SELECT name FROM datasources 
        WHERE is_embedded=0 
        AND id NOT IN (SELECT DISTINCT datasource_id FROM table_to_datasource)
        LIMIT 5
    """)
    print("  无表关联的发布源样本 (可能是 Custom SQL 或 数据提取):")
    for r in cur.fetchall(): print(f"    - {r[0]}")

    # 20. 嵌入源(独立) -> 物理表 (8.5%)
    print("\n20. 嵌入源(独立) -> 物理表 (8.5%): 低覆盖率合理性")
    cur.execute("""
        SELECT count(*) FROM datasources 
        WHERE is_embedded=1 AND source_published_datasource_id IS NULL
    """)
    total_ind_emb = cur.fetchone()[0]
    cur.execute("""
        SELECT count(*) FROM datasources ds
        JOIN table_to_datasource td ON ds.id = td.datasource_id
        JOIN tables t ON td.table_id = t.id
        WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL
        AND t.is_embedded=0
    """)
    linked_to_phys = cur.fetchone()[0]
    print(f"  独立嵌入源总数: {total_ind_emb}, 关联到物理表的数量: {linked_to_phys}")

    conn.close()

def analyze_24_35():
    conn = sqlite3.connect('metadata.db')
    cur = conn.cursor()
    print("\n=== 分析 第24-35项：工作簿/视图 ===")

    # 25. 工作簿 -> 物理表 (50.0%)
    print("\n25. 工作簿 -> 物理表 (50.0%): 覆盖率分析")
    cur.execute("""
        SELECT count(*) FROM workbooks 
        WHERE id NOT IN (
            SELECT DISTINCT dw.workbook_id 
            FROM datasource_to_workbook dw 
            JOIN table_to_datasource td ON dw.datasource_id=td.datasource_id 
            JOIN tables t ON td.table_id=t.id 
            WHERE t.is_embedded=0
        )
    """)
    orphan_wbs = cur.fetchone()[0]
    print(f"  没有关联物理表的工作簿数量: {orphan_wbs}")

    # 33. 视图 -> 物理表 (2.9%)
    print("\n33. 视图 -> 物理表 (2.9%): 为什么极低？")
    cur.execute("""
        SELECT count(*) FROM views
    """)
    total_views = cur.fetchone()[0]
    cur.execute("""
        SELECT count(DISTINCT fv.view_id) 
        FROM field_to_view fv 
        JOIN fields f ON fv.field_id=f.id 
        WHERE f.table_id IS NOT NULL
        AND f.table_id IN (SELECT id FROM tables WHERE is_embedded=0)
    """)
    linked_views = cur.fetchone()[0]
    print(f"  总视图数: {total_views}, 通过字段关联到物理表的视图数: {linked_views}")
    
    # 检查视图是否关联到了嵌入表
    cur.execute("""
        SELECT count(DISTINCT fv.view_id) 
        FROM field_to_view fv 
        JOIN fields f ON fv.field_id=f.id 
        WHERE f.table_id IS NOT NULL
        AND f.table_id IN (SELECT id FROM tables WHERE is_embedded=1)
    """)
    linked_emb_views = cur.fetchone()[0]
    print(f"  通过字段关联到嵌入表的视图数: {linked_emb_views}")

    conn.close()

def analyze_36_45():
    conn = sqlite3.connect('metadata.db')
    cur = conn.cursor()
    print("\n=== 分析 第36-45项：字段 ===")

    # 37. 字段 -> 物理表 (7.4%)
    print("\n37. 字段 -> 物理表 (7.4%): 深度原因")
    cur.execute("SELECT count(*) FROM fields")
    total_fields = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=0")
    linked_phys = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=1")
    linked_emb = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM fields WHERE table_id IS NULL")
    no_table = cur.fetchone()[0]
    print(f"  字段总数: {total_fields}")
    print(f"  关联物理表: {linked_phys} ({linked_phys/total_fields*100:.1f}%)")
    print(f"  关联嵌入表: {linked_emb} ({linked_emb/total_fields*100:.1f}%)")
    print(f"  完全无关联表: {no_table} ({no_table/total_fields*100:.1f}%)")

    # 43. 字段 -> 工作簿 (81.6%)
    print("\n43. 字段 -> 工作簿 (81.6%): 缺失样本")
    cur.execute("""
        SELECT name FROM fields 
        WHERE workbook_id IS NULL 
        LIMIT 5
    """)
    print("  无工作簿关联的字段样本:")
    for r in cur.fetchall(): print(f"    - {r[0]}")

    conn.close()

def analyze_46_51():
    conn = sqlite3.connect('metadata.db')
    cur = conn.cursor()
    print("\n=== 分析 第46-51项：计算字段 ===")

    # 46. 计算字段 -> 物理表 (22.7%)
    print("\n46. 计算字段 -> 物理表 (22.7%): 间接血缘分析")
    cur.execute("SELECT count(*) FROM fields WHERE is_calculated=1")
    total_calcs = cur.fetchone()[0]
    cur.execute("""
        SELECT count(DISTINCT field_id) 
        FROM field_full_lineage 
        WHERE table_id IS NOT NULL 
        AND field_id IN (SELECT id FROM fields WHERE is_calculated=1)
    """)
    full_lineage_linked = cur.fetchone()[0]
    print(f"  计算字段总数: {total_calcs}")
    print(f"  直接关联物理表 (table_id): {1122} (22.7%)")
    print(f"  间接关联物理表 (field_full_lineage): {full_lineage_linked} ({full_lineage_linked/total_calcs*100:.1f}%)")

    print("\n=== 深度调查：71.1% 无表字段的分布 ===")
    cur.execute("""
        SELECT ds.is_embedded, count(f.id)
        FROM fields f
        LEFT JOIN datasources ds ON f.datasource_id=ds.id
        WHERE f.table_id IS NULL
        GROUP BY ds.is_embedded
    """)
    print("  无表字段的数据源分布 (True=嵌入, False=发布, None=无源):")
    for r in cur.fetchall(): print(f"    - {r[0]}: {r[1]}")

    conn.close()

if __name__ == "__main__":
    analyze_1_10()
    analyze_11_23()
    analyze_24_35()
    analyze_36_45()
    analyze_46_51()
