"""
数据库迁移脚本 - 添加预计算统计字段
运行方式: python3 backend/migrate_stats.py
"""
import os
import sys
import sqlite3

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config


def migrate():
    """执行迁移：添加预计算统计字段"""
    print("=" * 50)
    print("数据库迁移 - 添加预计算统计字段")
    print("=" * 50)
    
    db_path = Config.DATABASE_PATH
    print(f"\n数据库路径: {db_path}")
    
    if not os.path.exists(db_path):
        print("❌ 数据库不存在，请先运行 init_db.py")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 定义需要添加的列
    migrations = [
        # Workbook 表
        ("workbooks", "view_count", "INTEGER DEFAULT 0"),
        ("workbooks", "datasource_count", "INTEGER DEFAULT 0"),
        ("workbooks", "field_count", "INTEGER DEFAULT 0"),
        ("workbooks", "metric_count", "INTEGER DEFAULT 0"),
        # Datasource 表
        ("datasources", "table_count", "INTEGER DEFAULT 0"),
        ("datasources", "workbook_count", "INTEGER DEFAULT 0"),
        ("datasources", "field_count", "INTEGER DEFAULT 0"),
        ("datasources", "metric_count", "INTEGER DEFAULT 0"),
    ]
    
    success_count = 0
    skip_count = 0
    
    for table, column, col_type in migrations:
        try:
            # 检查列是否已存在
            cursor.execute(f"PRAGMA table_info({table})")
            columns = [row[1] for row in cursor.fetchall()]
            
            if column in columns:
                print(f"  ⏩ {table}.{column} 已存在，跳过")
                skip_count += 1
                continue
            
            # 添加新列
            sql = f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"
            cursor.execute(sql)
            print(f"  ✅ 添加 {table}.{column}")
            success_count += 1
            
        except Exception as e:
            print(f"  ❌ 添加 {table}.{column} 失败: {e}")
    
    conn.commit()
    conn.close()
    
    print(f"\n迁移完成: 新增 {success_count} 列, 跳过 {skip_count} 列")
    print("=" * 50)
    return True


if __name__ == "__main__":
    migrate()
