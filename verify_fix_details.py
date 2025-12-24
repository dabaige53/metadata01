
import sqlite3

def check_fix_details():
    try:
        conn = sqlite3.connect('metadata.db')
        cur = conn.cursor()
        
        print("=== 计算字段修复详情验证 ===")
        
        # 1. 检查计算字段的总数
        cur.execute("SELECT COUNT(*) FROM fields WHERE is_calculated=1")
        total_calcs = cur.fetchone()[0]
        print(f"计算字段总数: {total_calcs}")
        
        if total_calcs == 0:
            print("没有计算字段，跳过分析。")
            return

        # 2. 检查 workbook_id 覆盖率 (本次修复核心)
        cur.execute("SELECT COUNT(*) FROM fields WHERE is_calculated=1 AND workbook_id IS NOT NULL")
        has_wb = cur.fetchone()[0]
        print(f"有 workbook_id 的计算字段: {has_wb} ({has_wb/total_calcs*100:.1f}%)")
        
        # 3. 检查 datasource_id 覆盖率
        cur.execute("SELECT COUNT(*) FROM fields WHERE is_calculated=1 AND datasource_id IS NOT NULL")
        has_ds = cur.fetchone()[0]
        print(f"有 datasource_id 的计算字段: {has_ds} ({has_ds/total_calcs*100:.1f}%)")
        
        # 4. 检查 table_id 直接关联覆盖率
        cur.execute("SELECT COUNT(*) FROM fields WHERE is_calculated=1 AND table_id IS NOT NULL")
        has_table = cur.fetchone()[0]
        print(f"有 table_id (直接) 的计算字段: {has_table} ({has_table/total_calcs*100:.1f}%)")

        # 5. 检查 field_full_lineage 表中的覆盖率 (间接/推导)
        # 注意 field_full_lineage 可能包含多条路径，我们关心有多少个 field_id 被覆盖
        cur.execute("""
            SELECT COUNT(DISTINCT field_id) 
            FROM field_full_lineage 
            WHERE table_id IS NOT NULL 
            AND field_id IN (SELECT id FROM fields WHERE is_calculated=1)
        """)
        has_lineage_table = cur.fetchone()[0]
        print(f"有物理表血缘 (field_full_lineage) 的计算字段: {has_lineage_table} ({has_lineage_table/total_calcs*100:.1f}%)")

        # 6. 抽样检查无 table 血缘的计算字段，看看它们的 datasource 情况
        print("\n--- 抽样分析：无物理表血缘的计算字段 ---")
        cur.execute("""
            SELECT f.id, f.name, f.datasource_id, f.workbook_id, ds.is_embedded
            FROM fields f
            LEFT JOIN datasources ds ON f.datasource_id = ds.id
            WHERE f.is_calculated=1 
            AND f.id NOT IN (
                SELECT DISTINCT field_id FROM field_full_lineage WHERE table_id IS NOT NULL
            )
            LIMIT 5
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"Field: {r[1]} (ID: {r[0]})")
            print(f"  Canvas DS ID: {r[2]}, Is Embedded: {r[4]}")
            print(f"  Workbook ID: {r[3]}")
            
            # 检查这个数据源是否有表关联
            if r[2]:
                cur.execute("SELECT count(*) FROM table_to_datasource WHERE datasource_id=?", (r[2],))
                ds_tables = cur.fetchone()[0]
                print(f"  关联表数量 (table_to_datasource): {ds_tables}")
            print("-" * 30)

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    check_fix_details()
