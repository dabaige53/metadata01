
import sqlite3
import math

DB_PATH = '/Users/w/Desktop/吉祥/Team/代码管理/metadata分析/metadata.db'

def calculate_complexity(formula, dependency_count=0):
    if not formula:
        return 0
        
    score = 0
    
    # 1. Length Factor (1 pt per 50 chars)
    score += len(formula) / 50.0
    
    # 2. Structure Factor (Lines)
    score += formula.count('\n') * 0.5
    
    # 3. Keywords Factor
    keywords = {
        'FIXED': 5, 'INCLUDE': 4, 'EXCLUDE': 4,
        'REGEXP': 3, 
        'CASE': 2, 'THEN': 0.5, 'ELSE': 0.5, 'END': 0.5,
        'IF': 1, 'IIF': 1, 'ELSEIF': 1,
        'ZN': 1, 'ISNULL': 1, 'IFNULL': 1,
        'DATEPART': 1, 'DATETIME': 1, 'DATEADD': 1,
        'SPLIT': 2, 'MID': 1, 'LEFT': 1, 'RIGHT': 1
    }
    
    upper_formula = formula.upper()
    for kw, weight in keywords.items():
        score += upper_formula.count(kw) * weight
        
    # 4. Dependency Factor
    score += (dependency_count or 0) * 2.0
    
    return round(score, 1)

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("🧠 Backfilling Complexity Scores...")
    
    # Fetch all calculated fields
    cursor.execute("SELECT id, formula, dependency_count, name FROM calculated_fields")
    rows = cursor.fetchall()
    
    print(f"  Processing {len(rows)} calculated fields...")
    
    updated_count = 0
    
    for row in rows:
        formula = row['formula']
        dep_count = row['dependency_count']
        
        new_score = calculate_complexity(formula, dep_count)
        
        cursor.execute("UPDATE calculated_fields SET complexity_score = ? WHERE id = ?", (new_score, row['id']))
        updated_count += 1
        
        if updated_count % 1000 == 0:
            print(f"    - Processed {updated_count}...")
            
    conn.commit()
    print(f"✅ Complexity Score Calculation Complete.")
    print(f"  Updated {updated_count} fields.")
    
    conn.close()

if __name__ == "__main__":
    main()
