"""
字段分表迁移脚本 V4
三层去重策略：
1. 有 upstream_column_id → 按 upstream_column_id 去重
2. 有 table_id → 按 (table_id, name) 去重  
3. 有 datasource_id → 按 (datasource_id, name) 去重
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

def cleanup_tables(session):
    print("🧹 清理旧表...")
    for t in ['regular_fields', 'unique_regular_fields', 'unique_calculated_fields', 
              'calculated_fields', 'regular_field_to_view', 'calc_field_to_view', 
              'calc_field_dependencies', 'regular_field_full_lineage', 'calc_field_full_lineage']:
        try:
            session.execute(text(f'DROP TABLE IF EXISTS {t}'))
        except: pass
    session.commit()

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
    """三层去重策略"""
    print("\n[1/4] 迁移原始字段（三层去重）...")
    
    rows = session.execute(text("""
        SELECT * FROM fields 
        WHERE is_calculated = 0 OR is_calculated IS NULL
    """)).mappings().all()
    
    print(f"  - 待处理实例: {len(rows)}")
    
    unique_map = {} 
    new_unique_records = []
    new_instance_records = []
    
    stats = {'col': 0, 'table': 0, 'ds': 0}
    
    for row in rows:
        # 三层去重策略
        if row['upstream_column_id']:
            # 策略1: 按 upstream_column_id 去重
            key = f"col::{row['upstream_column_id']}"
            stats['col'] += 1
        elif row['table_id']:
            # 策略2: 按 (table_id, name) 去重
            key = f"table::{row['table_id']}::{row['name']}"
            stats['table'] += 1
        elif row['datasource_id']:
            # 策略3: 按 (datasource_id, name) 去重
            key = f"ds::{row['datasource_id']}::{row['name']}"
            stats['ds'] += 1
        else:
            # 无法去重，当作独立
            key = f"orphan::{row['id']}"
        
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
    
    if new_unique_records:
        session.bulk_insert_mappings(UniqueRegularField, new_unique_records)
    if new_instance_records:
        session.bulk_insert_mappings(RegularField, new_instance_records)
    
    print(f"  - 去重策略分布: 物理列={stats['col']}, 表={stats['table']}, 数据源={stats['ds']}")
    print(f"  ✅ 原始字段: {len(new_instance_records)} 实例 -> {len(new_unique_records)} 标准字段")
    return len(new_instance_records)

def migrate_calculated_fields(session):
    """计算字段去重：(formula_hash, datasource_id 穿透后)"""
    print("\n[2/4] 迁移计算字段...")
    
    # 获取嵌入式数据源→发布式数据源映射
    ds_penetration = {}
    ds_rows = session.execute(text("""
        SELECT id, source_published_datasource_id FROM datasources WHERE source_published_datasource_id IS NOT NULL
    """)).fetchall()
    for ds_id, source_id in ds_rows:
        ds_penetration[ds_id] = source_id
    
    rows = session.execute(text("SELECT * FROM fields WHERE is_calculated = 1")).mappings().all()
    print(f"  - 待处理实例: {len(rows)}")
    
    unique_map = {}
    new_unique_records = []
    new_instance_records = []
    
    for row in rows:
        formula = row['formula'] or ''
        formula_hash = get_formula_hash(formula)
        
        # 穿透到发布式数据源
        ds_id = row['datasource_id']
        if ds_id and ds_id in ds_penetration:
            ds_id = ds_penetration[ds_id]
        
        # 去重键: (formula_hash, 穿透后的datasource_id)
        key = f"{formula_hash}::{ds_id or 'none'}"
        
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

    print(f"  ✅ 计算字段: {len(new_instance_records)} 实例 -> {len(new_unique_records)} 标准指标")
    return len(new_instance_records)

def migrate_relations(session):
    print("\n[3/4] 迁移关联关系...")
    
    session.execute(text("""
        INSERT INTO regular_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
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
    
    session.execute(text("""
        INSERT INTO regular_field_full_lineage (
            field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path
        )
        SELECT fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
    """))
    
    session.execute(text("""
        INSERT INTO calc_field_full_lineage (
            field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path
        )
        SELECT fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE f.is_calculated = 1
    """))
    
    print("  ✅ 血缘数据迁移完成")

def main():
    print("🚀 开始四表架构迁移 V4...")
    print("三层去重策略：")
    print("  1. 有 upstream_column_id → 按物理列去重（跨数据源）")
    print("  2. 有 table_id → 按 (table_id, name) 去重")
    print("  3. 有 datasource_id → 按 (datasource_id, name) 去重")
    
    session, engine = get_session()
    
    try:
        cleanup_tables(session)
        create_tables(engine)
        
        migrate_regular_fields(session)
        migrate_calculated_fields(session)
        migrate_relations(session)
        migrate_lineage(session)
        
        session.commit()
        print("\n✨ 迁移完成！")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    main()
