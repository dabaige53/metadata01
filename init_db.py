"""
数据库初始化脚本
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import Config
from app.models import Base, get_engine, init_db


def main():
    """初始化数据库"""
    print("=" * 50)
    print("Tableau 元数据监控系统 - 数据库初始化")
    print("=" * 50)
    
    database_path = Config.DATABASE_PATH
    print(f"\n数据库路径: {database_path}")
    
    # 检查数据库是否已存在
    if os.path.exists(database_path):
        response = input("\n数据库已存在，是否重新初始化？(y/N): ")
        if response.lower() != 'y':
            print("取消初始化")
            return
        os.remove(database_path)
        print("已删除旧数据库")
    
    # 创建数据库引擎
    engine = get_engine(database_path)
    
    # 初始化表结构
    print("\n正在创建数据库表...")
    init_db(engine)
    
    # 列出创建的表
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n成功创建 {len(tables)} 个表:")
    for table in tables:
        columns = inspector.get_columns(table)
        print(f"  - {table} ({len(columns)} 个字段)")
    
    print("\n" + "=" * 50)
    print("数据库初始化完成!")
    print("=" * 50)


if __name__ == '__main__':
    main()
