"""
数据库迁移脚本：添加血缘标签字段
为关联表和字段表添加 lineage_source、penetration_status、created_at 字段
"""
import sqlite3
import os
from datetime import datetime

# 数据库路径
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'metadata.db')


def migrate():
    """执行迁移"""
    print(f"📦 开始迁移数据库: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("❌ 数据库文件不存在")
        return False
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 定义需要添加字段的表和字段
    migrations = [
        # 关联表添加 lineage_source 和 created_at
        ("table_to_datasource", "lineage_source", "VARCHAR(20) DEFAULT 'api'"),
        ("table_to_datasource", "created_at", "DATETIME"),
        ("datasource_to_workbook", "lineage_source", "VARCHAR(20) DEFAULT 'api'"),
        ("datasource_to_workbook", "created_at", "DATETIME"),
        ("field_to_view", "lineage_source", "VARCHAR(20) DEFAULT 'api'"),
        ("field_to_view", "created_at", "DATETIME"),
        ("dashboard_to_sheet", "lineage_source", "VARCHAR(20) DEFAULT 'api'"),
        ("dashboard_to_sheet", "created_at", "DATETIME"),
        
        # 字段表添加血缘标签
        ("fields", "lineage_source", "VARCHAR(20) DEFAULT 'api'"),
        ("fields", "penetration_status", "VARCHAR(20) DEFAULT 'not_applicable'"),
        ("regular_fields", "lineage_source", "VARCHAR(20) DEFAULT 'api'"),
        ("regular_fields", "penetration_status", "VARCHAR(20) DEFAULT 'not_applicable'"),
    ]
    
    success_count = 0
    skip_count = 0
    
    for table_name, column_name, column_def in migrations:
        try:
            # 检查表是否存在
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
            if not cursor.fetchone():
                print(f"⚠️  表 {table_name} 不存在，跳过")
                skip_count += 1
                continue
            
            # 检查列是否已存在
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [col[1] for col in cursor.fetchall()]
            
            if column_name in columns:
                print(f"✓  {table_name}.{column_name} 已存在，跳过")
                skip_count += 1
                continue
            
            # 添加列
            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}"
            cursor.execute(sql)
            print(f"✅ 添加 {table_name}.{column_name}")
            success_count += 1
            
        except Exception as e:
            print(f"❌ 迁移 {table_name}.{column_name} 失败: {e}")
    
    # 提交更改
    conn.commit()
    conn.close()
    
    print(f"\n📊 迁移完成: 成功 {success_count}, 跳过 {skip_count}")
    return True


def set_default_values():
    """为现有记录设置默认值"""
    print("\n🔧 设置默认值...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 更新关联表的 created_at
    tables = ["table_to_datasource", "datasource_to_workbook", "field_to_view", "dashboard_to_sheet"]
    now = datetime.utcnow().isoformat()
    
    for table in tables:
        try:
            cursor.execute(f"UPDATE {table} SET created_at = ? WHERE created_at IS NULL", (now,))
            affected = cursor.rowcount
            if affected > 0:
                print(f"✅ 更新 {table}.created_at: {affected} 条记录")
        except Exception as e:
            print(f"⚠️  更新 {table} 失败: {e}")
    
    conn.commit()
    conn.close()
    print("✓  默认值设置完成")


if __name__ == '__main__':
    migrate()
    set_default_values()
    print("\n🎉 血缘标签迁移完成！")
