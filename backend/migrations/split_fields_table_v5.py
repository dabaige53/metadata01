"""
字段分表迁移脚本 V5
穿透继承去重策略：
- 原始字段：同数据源同名的字段继承有 upstream_column_id 的那条的去重键
- 计算字段：同数据源同名同公式的只保留一个 unique
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
    """原始字段去重：穿透继承策略"""
    print("\n[1/4] 迁移原始字段（穿透继承策略）...")
    
    rows = session.execute(text("""
        SELECT * FROM fields 
        WHERE is_calculated = 0 OR is_calculated IS NULL
    """)).mappings().all()
    
    print(f"  - 待处理实例: {len(rows)}")
    
    # 第一遍：构建继承映射 (datasource_id, name) -> upstream_column_id
    canonical_map = {}
    for row in rows:
        if row['upstream_column_id'] and row['datasource_id']:
            key = (row['datasource_id'], row['name'])
            if key not in canonical_map:
                canonical_map[key] = row['upstream_column_id']
    
    print(f"  - 构建继承映射: {len(canonical_map)} 个")
    
    # 第二遍：去重
    unique_map = {} 
    new_unique_records = []
    new_instance_records = []
    
    stats = {'col': 0, 'inherited': 0, 'table': 0, 'ds': 0}
    
    for row in rows:
        # 尝试继承
        inherited_col = None
        if row['datasource_id'] and row['name']:
            inherited_col = canonical_map.get((row['datasource_id'], row['name']))
        
        # 确定去重键
        if row['upstream_column_id']:
            key = f"col::{row['upstream_column_id']}"
            stats['col'] += 1
        elif inherited_col:
            key = f"col::{inherited_col}"  # 继承！
            stats['inherited'] += 1
        elif row['table_id']:
            key = f"table::{row['table_id']}::{row['name']}"
            stats['table'] += 1
        elif row['datasource_id']:
            key = f"ds::{row['datasource_id']}::{row['name']}"
            stats['ds'] += 1
        else:
            key = f"orphan::{row['id']}"
        
        if key not in unique_map:
            unique_id = generate_uuid()
            unique_map[key] = unique_id
            
            # 对于继承的，使用继承的 upstream_column_id
            actual_col_id = row['upstream_column_id'] or inherited_col
            
            new_unique_records.append({
                'id': unique_id,
                'name': row['name'],
                'upstream_column_id': actual_col_id,
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
    
    print(f"  - 策略分布: 物理列={stats['col']}, 继承={stats['inherited']}, 表={stats['table']}, 数据源={stats['ds']}")
    print(f"  ✅ 原始字段: {len(new_instance_records)} 实例 -> {len(new_unique_records)} 标准字段")
    return len(new_instance_records), len(new_unique_records)

def migrate_calculated_fields(session):
    """计算字段去重：同数据源同名同公式只保留一个"""
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
    
    # 去重键: (穿透后的datasource_id, name, formula_hash)
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
        
        # 去重键: (datasource_id, name, formula_hash)
        # 这样同数据源同名同公式只会产生一个 unique
        key = f"{ds_id or 'none'}::{row['name']}::{formula_hash}"
        
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
    return len(new_instance_records), len(new_unique_records)

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

def update_statistics(session):
    """更新引用计数和依赖计数"""
    print("\n[3.5/4] 更新统计信息...")
    
    # 更新引用计数 (被多少个计算字段引用)
    session.execute(text("""
        UPDATE calculated_fields SET reference_count = (
            SELECT COUNT(*) FROM calc_field_dependencies 
            WHERE calc_field_dependencies.dependency_calc_field_id = calculated_fields.id
        )
    """))
    
    # 更新依赖计数 (依赖了多少个字段)
    session.execute(text("""
        UPDATE calculated_fields SET dependency_count = (
            SELECT COUNT(*) FROM calc_field_dependencies 
            WHERE calc_field_dependencies.source_field_id = calculated_fields.id
        )
    """))
    
    print("  ✅ 统计信息更新完成")

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

def verify_no_duplicates(session):
    """验证去重后无残留重复"""
    print("\n🔍 验证去重效果...")
    
    # 原始字段：同ds同name应该只有 1 个 unique
    result = session.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT datasource_id, name, COUNT(DISTINCT unique_id) as uid_cnt
            FROM regular_fields
            GROUP BY datasource_id, name
            HAVING COUNT(DISTINCT unique_id) > 1
        )
    """)).scalar()
    
    if result == 0:
        print("  ✅ 原始字段无残留重复")
    else:
        print(f"  ⚠️ 原始字段仍有 {result} 组残留重复")
    
    # 计算字段：同ds同name同formula应该只有 1 个 unique
    result2 = session.execute(text("""
        SELECT COUNT(*) FROM (
            SELECT datasource_id, name, formula, COUNT(DISTINCT unique_id) as uid_cnt
            FROM calculated_fields
            GROUP BY datasource_id, name, formula
            HAVING COUNT(DISTINCT unique_id) > 1
        )
    """)).scalar()
    
    if result2 == 0:
        print("  ✅ 计算字段无残留重复")
    else:
        print(f"  ⚠️ 计算字段仍有 {result2} 组残留重复")
    
    return result == 0 and result2 == 0

def main():
    print("🚀 开始四表架构迁移 V5 (穿透继承策略)...")
    
    session, engine = get_session()
    
    try:
        cleanup_tables(session)
        create_tables(engine)
        
        r_inst, r_uniq = migrate_regular_fields(session)
        c_inst, c_uniq = migrate_calculated_fields(session)
        migrate_relations(session)
        update_statistics(session)
        migrate_lineage(session)
        
        session.commit()
        
        is_valid = verify_no_duplicates(session)
        
        print("\n" + "=" * 50)
        print("✨ 迁移完成！")
        print(f"  原始字段: {r_inst} 实例 -> {r_uniq} 标准字段")
        print(f"  计算字段: {c_inst} 实例 -> {c_uniq} 标准指标")
        print(f"  验证结果: {'✅ 无残留重复' if is_valid else '⚠️ 有残留重复'}")
        print("=" * 50)
        
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
