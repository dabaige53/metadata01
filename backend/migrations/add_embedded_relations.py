#!/usr/bin/env python3
"""
数据库迁移脚本：添加嵌入式数据源关联字段

执行方式：
    python3 backend/migrations/add_embedded_relations.py
"""

import sqlite3
import os

# 获取数据库路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'metadata.db')

def migrate():
    """添加嵌入式数据源关联字段"""
    print(f"📦 连接数据库: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. 为 datasources 表添加 source_published_datasource_id 字段
    try:
        cursor.execute("""
            ALTER TABLE datasources 
            ADD COLUMN source_published_datasource_id TEXT
        """)
        print("✅ datasources 表添加 source_published_datasource_id 字段成功")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("⏭️  datasources.source_published_datasource_id 字段已存在，跳过")
        else:
            raise e
    
    # 2. 为 fields 表添加 remote_field_id 字段
    try:
        cursor.execute("""
            ALTER TABLE fields 
            ADD COLUMN remote_field_id TEXT
        """)
        print("✅ fields 表添加 remote_field_id 字段成功")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("⏭️  fields.remote_field_id 字段已存在，跳过")
        else:
            raise e
    
    # 3. 为 fields 表添加 remote_field_name 字段
    try:
        cursor.execute("""
            ALTER TABLE fields 
            ADD COLUMN remote_field_name TEXT
        """)
        print("✅ fields 表添加 remote_field_name 字段成功")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("⏭️  fields.remote_field_name 字段已存在，跳过")
        else:
            raise e
    
    conn.commit()
    conn.close()
    print("\n🎉 迁移完成!")

if __name__ == "__main__":
    migrate()
