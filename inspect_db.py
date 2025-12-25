
import sqlite3
import os

db_path = 'data/metadata.db'

def inspect_db():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check fields count
    try:
        cursor.execute("SELECT COUNT(*) FROM fields;")
        count = cursor.fetchone()[0]
        print(f"Table 'fields' has {count} rows.")
    except sqlite3.OperationalError as e:
        print(f"Error querying fields: {e}")

    # Check regular_fields count
    try:
        cursor.execute("SELECT COUNT(*) FROM regular_fields;")
        count = cursor.fetchone()[0]
        print(f"Table 'regular_fields' has {count} rows.")
    except sqlite3.OperationalError as e:
        print(f"Error querying regular_fields: {e}")

    conn.close()

if __name__ == "__main__":
    inspect_db()
