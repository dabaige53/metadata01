"""
字段分表迁移脚本 V3
新去重逻辑：
- 原始字段：(table_id, name) 去重
- 计算字段：(formula_hash, datasource_id) 去重
"""
import os
import sys
import uuid
import hashlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.config import Config
from backend.models import (
    Base, UniqueRegularField, RegularField, 
    UniqueCalculatedField, CalculatedField,
    CalcFieldDependency, RegularFieldFullLineage, CalcFieldFullLineage,
    regular_field_to_view, calc_field_to_view
)

def get_session():
    engine = create_engine(f'sqlite:///{Config.DATABASE_PATH}', echo=False)
    Session = sessionmaker(bind=engine)
    return Session(), engine

def create_tables(engine):
    print("📦 创建四表架构...")
    Base.metadata.create_all(engine, tables=[
        UniqueRegularField.__table__,
        RegularField.__table__,
        UniqueCalculatedField.__table__,
        CalculatedField.__table__,
        CalcFieldDependency.__table__,
        RegularFieldFullLineage.__table__,
        CalcFieldFullLineage.__table__,
        regular_field_to_view,
        calc_field_to_view
    ])

def generate_uuid():
    return str(uuid.uuid4())

def get_formula_hash(formula):
    if not formula:
        return 'empty_' + generate_uuid()
    return hashlib.md5(formula.encode('utf-8')).hexdigest()

def migrate_regular_fields(session):
    """原始字段去重：(table_id, name)"""
    print("\n[1/4] 迁移原始字段...")
    
    rows = session.execute(text("""
        SELECT * FROM fields 
        WHERE is_calculated = 0 OR is_calculated IS NULL
    """)).mappings().all()
    
    print(f"  - 待处理实例: {len(rows)}")
    
    # 只处理有 table_id 的字段
    rows_with_table = [r for r in rows if r['table_id']]
    rows_without_table = [r for r in rows if not r['table_id']]
    
    print(f"  - 有 table_id: {len(rows_with_table)}, 无 table_id: {len(rows_without_table)}")
    
    # 去重映射: (table_id, name) -> unique_id
    unique_map = {} 
    new_unique_records = []
    new_instance_records = []
    
    for row in rows_with_table:
        # 去重键: (table_id, name)
        key = f"{row['table_id']}::{row['name']}"
        
        if key not in unique_map:
            unique_id = generate_uuid()
            unique_map[key] = unique_id
            
            new_unique_records.append({
                'id': unique_id,
                'name': row['name'],
                'upstream_column_id': row['upstream_column_id'],
                'upstream_column_name': row['upstream_column_name'],
                'table_id': row['table_id'],
                'remote_type': row['remote_type'],
                'description': row['description'],
                'created_at': row['created_at']
            })
        else:
            unique_id = unique_map[key]
            
        new_instance_records.append({
            'id': row['id'],
            'unique_id': unique_id,
            'name': row['name'],
            'data_type': row['data_type'],
            'remote_type': row['remote_type'],
            'description': row['description'],
            'table_id': row['table_id'],
            'upstream_column_id': row['upstream_column_id'],
            'upstream_column_name': row['upstream_column_name'],
            'datasource_id': row['datasource_id'],
            'workbook_id': row['workbook_id'],
            'role': row['role'],
            'aggregation': row['aggregation'],
            'is_hidden': row['is_hidden'],
            'folder_name': row['folder_name'],
            'fully_qualified_name': row['fully_qualified_name'],
            'caption': row['caption'],
            'semantic_role': row['semantic_role'],
            'default_format': row['default_format'],
            'remote_field_id': row['remote_field_id'],
            'remote_field_name': row['remote_field_name'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at'],
            'usage_count': row['usage_count']
        })
    
    # 无 table_id 的字段暂不迁移（需要先修复同步逻辑）
    print(f"  ⚠️  跳过 {len(rows_without_table)} 个无 table_id 的字段")
    
    if new_unique_records:
        session.bulk_insert_mappings(UniqueRegularField, new_unique_records)
    if new_instance_records:
        session.bulk_insert_mappings(RegularField, new_instance_records)
        
    print(f"  ✅ 原始字段迁移: {len(new_instance_records)} 实例 -> {len(new_unique_records)} 标准字段")
    return len(new_instance_records), len(rows_without_table)

def migrate_calculated_fields(session):
    """计算字段去重：(formula_hash, datasource_id)"""
    print("\n[2/4] 迁移计算字段...")
    
    rows = session.execute(text("""
        SELECT * FROM fields WHERE is_calculated = 1
    """)).mappings().all()
    
    print(f"  - 待处理实例: {len(rows)}")
    
    # 去重映射: (formula_hash, datasource_id) -> unique_id
    unique_map = {}
    new_unique_records = []
    new_instance_records = []
    
    for row in rows:
        formula = row['formula'] or ''
        formula_hash = get_formula_hash(formula)
        ds_id = row['datasource_id'] or row['table_id'] or 'none'
        
        # 去重键: (formula_hash, datasource_id)
        key = f"{formula_hash}::{ds_id}"
        
        if key not in unique_map:
            unique_id = generate_uuid()
            unique_map[key] = unique_id
            
            new_unique_records.append({
                'id': unique_id,
                'name': row['name'],
                'formula': formula,
                'formula_hash': formula_hash,
                'description': row['description'],
                'complexity_score': 0,
                'created_at': row['created_at']
            })
        else:
            unique_id = unique_map[key]
            
        new_instance_records.append({
            'id': row['id'],
            'unique_id': unique_id,
            'name': row['name'],
            'data_type': row['data_type'],
            'description': row['description'],
            'formula': formula,
            'formula_hash': formula_hash,
            'complexity_score': 0,
            'datasource_id': row['datasource_id'],
            'workbook_id': row['workbook_id'],
            'table_id': row['table_id'],
            'role': row['role'],
            'is_hidden': row['is_hidden'],
            'folder_name': row['folder_name'],
            'fully_qualified_name': row['fully_qualified_name'],
            'caption': row['caption'],
            'usage_count': row['usage_count'],
            'created_at': row['created_at'],
            'updated_at': row['updated_at']
        })
        
    if new_unique_records:
        session.bulk_insert_mappings(UniqueCalculatedField, new_unique_records)
    if new_instance_records:
        session.bulk_insert_mappings(CalculatedField, new_instance_records)

    print(f"  ✅ 计算字段迁移: {len(new_instance_records)} 实例 -> {len(new_unique_records)} 标准指标")
    return len(new_instance_records)

def migrate_relations(session):
    print("\n[3/4] 迁移关联关系...")
    
    # 只迁移有 table_id 的原始字段的视图关联
    session.execute(text("""
        INSERT INTO regular_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
          AND f.table_id IS NOT NULL
    """))
    
    session.execute(text("""
        INSERT INTO calc_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE f.is_calculated = 1
    """))
    
    print("  ✅ 视图关联迁移完成")
    
    session.execute(text("""
        INSERT INTO calc_field_dependencies (
            source_field_id, 
            dependency_regular_field_id,
            dependency_calc_field_id,
            dependency_name, 
            dependency_type
        )
        SELECT 
            fd.source_field_id,
            CASE WHEN dep.is_calculated = 0 OR dep.is_calculated IS NULL 
                 THEN fd.dependency_field_id ELSE NULL END,
            CASE WHEN dep.is_calculated = 1 
                 THEN fd.dependency_field_id ELSE NULL END,
            fd.dependency_name,
            fd.dependency_type
        FROM field_dependencies fd
        LEFT JOIN fields dep ON fd.dependency_field_id = dep.id
        WHERE fd.source_field_id IN (SELECT id FROM fields WHERE is_calculated = 1)
    """))
    
    print("  ✅ 依赖关系迁移完成")

def migrate_lineage(session):
    print("\n[4/4] 迁移血缘数据...")
    
    # 只迁移有 table_id 的原始字段的血缘
    session.execute(text("""
        INSERT INTO regular_field_full_lineage (
            field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path
        )
        SELECT 
            fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
          AND f.table_id IS NOT NULL
    """))
    
    session.execute(text("""
        INSERT INTO calc_field_full_lineage (
            field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path
        )
        SELECT 
            fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE f.is_calculated = 1
    """))
    
    print("  ✅ 血缘数据迁移完成")

def cleanup_tables(session):
    """清理之前创建的表"""
    print("🧹 清理旧表...")
    for t in ['regular_fields', 'unique_regular_fields', 'unique_calculated_fields', 
              'regular_field_to_view', 'calc_field_to_view', 'calc_field_dependencies', 
              'regular_field_full_lineage', 'calc_field_full_lineage']:
        try:
            session.execute(text(f'DROP TABLE IF EXISTS {t}'))
        except: pass
    # 注意：不删除 calculated_fields，因为它现在是新的实例表
    # 如果需要重建，先删除再创建
    try:
        session.execute(text('DROP TABLE IF EXISTS calculated_fields'))
    except: pass
    session.commit()

def main():
    print("🚀 开始四表架构迁移 V3...")
    print("新去重逻辑：")
    print("  - 原始字段: (table_id, name)")
    print("  - 计算字段: (formula_hash, datasource_id)")
    
    session, engine = get_session()
    
    try:
        # 0. 清理旧表
        cleanup_tables(session)
        
        # 1. 创建新表
        create_tables(engine)
        
        # 2. 迁移
        regular_count, skipped = migrate_regular_fields(session)
        calc_count = migrate_calculated_fields(session)
        migrate_relations(session)
        migrate_lineage(session)
        
        session.commit()
        
        print("\n" + "=" * 50)
        print("✨ 迁移完成！")
        print(f"  原始字段: {regular_count} 实例已迁移, {skipped} 跳过(无table_id)")
        print(f"  计算字段: {calc_count} 实例已迁移")
        print("=" * 50)
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ 迁移失败: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    main()
