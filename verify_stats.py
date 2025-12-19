import requests
import sqlite3

def verify_stats():
    # 1. Get API stats
    url = "http://localhost:8101/api/stats"
    try:
        response = requests.get(url)
        response.raise_for_status()
        stats = response.json()
        api_field_count = stats.get('fields')
        print(f"API Field Count: {api_field_count}")
    except Exception as e:
        print(f"API Error: {e}")
        return

    # 2. Get DB stats (is_calculated = 0 or NULL)
    try:
        conn = sqlite3.connect('metadata.db')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL")
        db_field_count = cursor.fetchone()[0]
        print(f"DB Field Count (is_calculated=0): {db_field_count}")
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")
        return

    if api_field_count == db_field_count:
        print("SUCCESS: API stats match non-calculated fields count.")
    else:
        print("FAILURE: Stats mismatch.")

if __name__ == "__main__":
    verify_stats()
