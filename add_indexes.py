import os
import sys
import sqlite3
from backend.config import Config

def add_indexes():
    print("=" * 60)
    print("  数据库索引优化工具")
    print("=" * 60)
    
    db_path = Config.DATABASE_PATH
    if not os.path.exists(db_path):
        print(f"❌ 数据库未找到: {db_path}")
        return

    print(f"连接数据库: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    indexes = [
        # Fields 表
        ("idx_fields_table_id", "fields", "table_id"),
        ("idx_fields_datasource_id", "fields", "datasource_id"),
        ("idx_fields_workbook_id", "fields", "workbook_id"),
        ("idx_fields_name", "fields", "name"),
        ("idx_fields_data_type", "fields", "data_type"),
        ("idx_fields_role", "fields", "role"),
        
        # Tables 表
        ("idx_tables_database_id", "tables", "database_id"),
        ("idx_tables_name", "tables", "name"),
        
        # Datasources 表
        ("idx_datasources_name", "datasources", "name"),
        
        # Workbooks 表
        ("idx_workbooks_name", "workbooks", "name"),
        
        # Views 表
        ("idx_views_workbook_id", "views", "workbook_id"),
        
        # Calculated Fields 表
        ("idx_calc_fields_field_id", "calculated_fields", "field_id"),
        
        # Field Dependency 表
        ("idx_field_dep_source", "field_dependencies", "source_field_id"),
        ("idx_field_dep_name", "field_dependencies", "dependency_name"),
        
        # 关联表 (复合索引)
        ("idx_table_ds_tid", "table_to_datasource", "table_id"),
        ("idx_table_ds_did", "table_to_datasource", "datasource_id"),
        ("idx_ds_wb_did", "datasource_to_workbook", "datasource_id"),
        ("idx_ds_wb_wid", "datasource_to_workbook", "workbook_id"),
        ("idx_field_view_fid", "field_to_view", "field_id"),
        ("idx_field_view_vid", "field_to_view", "view_id")
    ]

    print("\n开始添加索引...")
    count = 0
    skipped = 0
    
    for idx_name, table, column in indexes:
        try:
            # 检查索引是否已存在
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='index' AND name='{idx_name}'")
            if cursor.fetchone():
                print(f"  ⚪ [跳过] 索引已存在: {idx_name} ({table}.{column})")
                skipped += 1
                continue
                
            print(f"  🔵 [创建] {idx_name} on {table}({column})...", end="", flush=True)
            cursor.execute(f"CREATE INDEX {idx_name} ON {table} ({column})")
            print(" 完成")
            count += 1
        except Exception as e:
            print(f"\n  ❌ 错误: {str(e)}")

    conn.commit()
    conn.close()
    
    print("\n" + "-" * 60)
    print(f"完成! 新增索引: {count}, 跳过: {skipped}")
    print("=" * 60)

if __name__ == "__main__":
    add_indexes()
