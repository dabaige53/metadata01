
import sqlite3

def check_counts():
    conn = sqlite3.connect('data/metadata.db')
    cursor = conn.cursor()
    
    queries = {
        'databases': "SELECT COUNT(*) FROM databases",
        'tables (non-embedded)': "SELECT COUNT(*) FROM tables WHERE is_embedded = 0 OR is_embedded IS NULL",
        'tables (all)': "SELECT COUNT(*) FROM tables",
        'fields (non-calculated)': "SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL",
        'metrics (calculated)': "SELECT COUNT(*) FROM fields WHERE is_calculated = 1 AND (role = 'measure' OR role IS NULL)",
        'fields (all)': "SELECT COUNT(*) FROM fields",
        'datasources (non-embedded)': "SELECT COUNT(*) FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL",
        'datasources (all)': "SELECT COUNT(*) FROM datasources",
        'workbooks': "SELECT COUNT(*) FROM workbooks",
        'views': "SELECT COUNT(*) FROM views",
        'unique_regular_fields': "SELECT COUNT(*) FROM unique_regular_fields",
        'unique_calculated_fields': "SELECT COUNT(*) FROM unique_calculated_fields"
    }
    
    for name, query in queries.items():
        try:
            cursor.execute(query)
            count = cursor.fetchone()[0]
            print(f"{name}: {count}")
        except Exception as e:
            print(f"{name}: Error - {e}")
            
    conn.close()

if __name__ == "__main__":
    check_counts()
