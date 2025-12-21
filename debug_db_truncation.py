import sqlite3

def test_truncation():
    conn = sqlite3.connect('metadata.db')
    cursor = conn.cursor()
    
    # Create a test string longer than 255 chars
    long_string = "a" * 300
    
    # Try updating the specific problem record (or a dummy one) to see if it truncates
    # We'll use a transaction and rollback
    try:
        print(f"Testing update with string length: {len(long_string)}")
        
        # Target the specific ID from the issue
        target_id = 'c28b31d9-67e6-4262-a220-766f6a97371f'
        
        cursor.execute("UPDATE fields SET name = ?, formula = ? WHERE id = ?", (long_string, long_string, target_id))
        
        cursor.execute("SELECT name, formula FROM fields WHERE id = ?", (target_id,))
        row = cursor.fetchone()
        
        if row:
            name_len = len(row[0])
            formula_len = len(row[1])
            print(f"Stored name length: {name_len}")
            print(f"Stored formula length: {formula_len}")
            
            if name_len == 300 and formula_len == 300:
                print("✅ SQLite did NOT truncate the data.")
            else:
                print(f"❌ Data WAS truncated. Name: {name_len}, Formula: {formula_len}")
        else:
            print("Record not found to update.")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.rollback()
        conn.close()

if __name__ == "__main__":
    test_truncation()
