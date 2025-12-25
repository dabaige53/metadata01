
import sqlite3
import os

DB_PATH = '/Users/w/Desktop/吉祥/Team/代码管理/metadata分析/metadata.db'

def cleanup_embedded_tables():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("🧹 Cleaning up garbage Embedded Tables...")
    
    # 1. Tables with No Datasource
    print("\n[1] Finding Embedded Tables with NO Datasource...")
    cursor.execute("""
        SELECT id FROM tables t 
        WHERE t.is_embedded = 1 
        AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id)
    """)
    no_ds_ids = [r[0] for r in cursor.fetchall()]
    print(f"    Found {len(no_ds_ids)} tables.")
    
    # 2. Tables with No Columns
    print("\n[2] Finding Embedded Tables with NO Columns...")
    cursor.execute("""
        SELECT id FROM tables t 
        WHERE t.is_embedded = 1 
        AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.table_id = t.id)
    """)
    no_col_ids = [r[0] for r in cursor.fetchall()]
    print(f"    Found {len(no_col_ids)} tables.")
    
    # Union of IDs to delete
    ids_to_delete = set(no_ds_ids + no_col_ids)
    print(f"\nTargeting {len(ids_to_delete)} unique Embedded Tables for deletion.")
    
    if not ids_to_delete:
        print("Nothing to clean.")
        conn.close()
        return

    # Delete Columns first (Cascade)
    # Convert set to list for chunking if needed, but sqlite handles IN clause reasonably well for <1000 items. 
    # If >1000, we might need chunking. 
    id_list = list(ids_to_delete)
    
    # Chunking just in case
    BATCH_SIZE = 500
    total_cols_deleted = 0
    total_tables_deleted = 0
    
    for i in range(0, len(id_list), BATCH_SIZE):
        chunk = id_list[i:i+BATCH_SIZE]
        placeholders = ','.join(['?'] * len(chunk))
        
        # Delete Columns
        cursor.execute(f"DELETE FROM db_columns WHERE table_id IN ({placeholders})", chunk)
        total_cols_deleted += cursor.rowcount
        
        # Delete Tables
        cursor.execute(f"DELETE FROM tables WHERE id IN ({placeholders})", chunk)
        total_tables_deleted += cursor.rowcount
        
        conn.commit()
        print(f"  - Deleted batch {i}-{min(i+BATCH_SIZE, len(id_list))}")

    print(f"\n✅ Cleanup Complete.")
    print(f"  Tables Deleted: {total_tables_deleted}")
    print(f"  Columns Deleted: {total_cols_deleted}")
    
    conn.close()

if __name__ == "__main__":
    cleanup_embedded_tables()
