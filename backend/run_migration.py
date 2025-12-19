#!/usr/bin/env python3
"""
数据库迁移执行脚本
自动执行 backend/migrations 目录下的所有 SQL 迁移文件
"""

import sqlite3
import os
import sys
from pathlib import Path

def run_migration(db_path, migration_file):
    """执行单个迁移文件"""
    print(f"正在执行迁移: {migration_file.name}")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # SQLite 不支持在单个事务中执行多个触发器/ALTER TABLE 命令
        # 这里分割语句执行
        # 注意: 这里使用简单的分号分割，如果 SQL 内部包含分号(如触发器说明)则需更复杂的解析
        statements = [s.strip() for s in sql.split(';') if s.strip()]
        for stmt in statements:
            try:
                cursor.execute(stmt)
            except sqlite3.OperationalError as e:
                # 忽略 "duplicate column name" 错误，以便脚本可以幂等运行
                if "duplicate column name" in str(e).lower() or "already exists" in str(e).lower():
                    print(f"  [跳过] {str(e)}")
                else:
                    raise e
        
        conn.commit()
        print(f"✅ 成功执行: {migration_file.name}")
    except Exception as e:
        print(f"❌ 迁移失败 {migration_file.name}: {e}")
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals():
            conn.close()
    return True

def main():
    # 基础路径
    base_dir = Path(__file__).parent.parent
    db_path = base_dir / 'metadata.db'
    migrations_dir = base_dir / 'backend' / 'migrations'
    
    if not db_path.exists():
        print(f"错误: 找不到数据库文件 {db_path}")
        sys.exit(1)
        
    if not migrations_dir.exists():
        print(f"错误: 找不到迁移目录 {migrations_dir}")
        sys.exit(1)
        
    # 获取并排序迁移文件
    migration_files = sorted(migrations_dir.glob('*.sql'))
    
    if not migration_files:
        print("未发现迁移文件。")
        return
        
    print(f"目标数据库: {db_path}")
    print(f"发现 {len(migration_files)} 个迁移文件。正在开始迁移...\n")
    
    success_count = 0
    for m_file in migration_files:
        if run_migration(db_path, m_file):
            success_count += 1
        else:
            print("\n🚨 迁移过程中断。")
            sys.exit(1)
            
    print(f"\n🎉 迁移完成! 成功执行 {success_count}/{len(migration_files)} 个脚本。")

if __name__ == '__main__':
    main()
