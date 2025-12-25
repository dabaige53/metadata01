
import sqlite3

DB_PATH = '/Users/w/Desktop/吉祥/Team/代码管理/metadata分析/metadata.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("📊 Updating Datasource Statistics...")
    
    # 1. Update table_count
    print("  Updating table_count...")
    cursor.execute("""
        UPDATE datasources 
        SET table_count = (
            SELECT COUNT(*) 
            FROM table_to_datasource 
            WHERE table_to_datasource.datasource_id = datasources.id
        )
    """)
    conn.commit()
    
    # 2. Update workbook_count
    print("  Updating workbook_count...")
    cursor.execute("""
        UPDATE datasources 
        SET workbook_count = (
            SELECT COUNT(*) 
            FROM datasource_to_workbook 
            WHERE datasource_to_workbook.datasource_id = datasources.id
        )
    """)
    conn.commit()
    
    # 3. Update field_count
    print("  Updating field_count...")
    cursor.execute("""
        UPDATE datasources 
        SET field_count = (
            SELECT COUNT(*) 
            FROM fields 
            WHERE fields.datasource_id = datasources.id
        )
    """)
    conn.commit()
    
    # 4. Update metric_count (Calculated Fields)
    # Using calculated_fields table and linking via datasource_id
    # Note: calculated_fields usually have datasource_id too.
    print("  Updating metric_count...")
    cursor.execute("""
        UPDATE datasources 
        SET metric_count = (
            SELECT COUNT(*) 
            FROM calculated_fields 
            WHERE calculated_fields.datasource_id = datasources.id
        )
    """)
    conn.commit()
    
    print("✅ Stats Update Complete.")
    conn.close()

if __name__ == "__main__":
    main()
