"""
数据库迁移脚本 V2
用于添加 FieldDependency 表和其他缺失表，而不重置现有数据
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import Config
from backend.models import Base, get_engine, FieldDependency, Metric, MetricVariant, MetricDuplicate

def main():
    print("=" * 50)
    print("Tableau 元数据监控系统 - 数据库迁移 (V2)")
    print("=" * 50)
    
    database_path = Config.DATABASE_PATH
    print(f"\n数据库路径: {database_path}")
    
    # 创建数据库引擎
    engine = get_engine(database_path)
    
    # 使用 create_all，它会自动忽略已存在的表，只创建缺失的表
    print("\n正在更新表结构...")
    Base.metadata.create_all(engine)
    
    # 验证表是否存在
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n当前数据库表 ({len(tables)}):")
    expected_tables = ['field_dependencies', 'metrics', 'metric_variants']
    all_exist = True
    
    for table in tables:
        print(f"  - {table}")
    
    print("\n验证新表:")
    for t in expected_tables:
        if t in tables:
            print(f"  ✅ {t} 已存在")
        else:
            print(f"  ❌ {t} 未创建")
            all_exist = False
            
    if all_exist:
        print("\n✅ 迁移成功！数据库结构已更新。")
    else:
        print("\n⚠️ 迁移可能未完全成功，请检查日志。")

if __name__ == '__main__':
    main()
