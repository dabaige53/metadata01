import sys
import os
import sqlite3
sys.path.insert(0, os.getcwd())

from backend.config import Config

print("Migrating database schema...")
database_path = Config.DATABASE_PATH

conn = sqlite3.connect(database_path)
cursor = conn.cursor()

try:
    # Check if column exists
    cursor.execute("PRAGMA table_info(glossary)")
    columns = [info[1] for info in cursor.fetchall()]
    
    if 'element' not in columns:
        print("Adding 'element' column to glossary table...")
        cursor.execute("ALTER TABLE glossary ADD COLUMN element TEXT")
        conn.commit()
        print("Column added successfully.")
    else:
        print("'element' column already exists.")

except Exception as e:
    print(f"Error during migration: {e}")
    conn.rollback()
finally:
    conn.close()
