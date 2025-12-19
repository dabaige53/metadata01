
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config
from backend.models import Base, get_engine, init_db

def main():
    print("=" * 50)
    print("Tableau 元数据监控系统 - 安全补全表结构")
    print("=" * 50)
    
    database_path = Config.DATABASE_PATH
    print(f"\n数据库路径: {database_path}")
    
    # 创建数据库引擎
    engine = get_engine(database_path)
    
    # 初始化表结构 (create_all 会自动跳过已存在的表)
    print("\n正在检查并创建缺失的数据库表...")
    Base.metadata.create_all(engine)
    
    # 列出创建的表
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n当前共有 {len(tables)} 个表:")
    for table in tables:
        print(f"  - {table}")
    
    print("\n" + "=" * 50)
    print("数据库表结构补全完成!")
    print("=" * 50)

if __name__ == '__main__':
    main()
