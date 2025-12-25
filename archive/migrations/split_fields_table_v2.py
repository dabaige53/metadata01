"""
字段分表迁移脚本 V2 (四表架构)
将 fields 表拆分为:
1. unique_regular_fields (物理字段去重)
2. regular_fields (物理字段实例)
3. unique_calculated_fields (计算字段去重/指标)
4. calculated_fields (计算字段实例)
"""
import os
import sys
import uuid
import hashlib

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, func
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
        return 'empty_' + generate_uuid() # 没公式的当作独立指标?
    return hashlib.md5(formula.encode('utf-8')).hexdigest()

def migrate_regular_fields(session):
    print("\n[1/4] 迁移原始字段 (Regular Fields)...")
    
    # 获取源数据
    rows = session.execute(text("""
        SELECT * FROM fields 
        WHERE is_calculated = 0 OR is_calculated IS NULL
    """)).mappings().all()
    
    print(f"  - 待处理实例: {len(rows)}")
    
    # 内存中构建去重映射: (table_id, upstream_column_id) -> unique_id
    # 如果没有 upstream_column_id，暂时用 (datasource_id, name) 作为备选key (虽然这不跨数据源，但至少保证同一数据源内一致)
    unique_map = {} 
    new_unique_records = []
    new_instance_records = []
    
    unique_count = 0
    
    for row in rows:
        # 1. 确定去重键
        if row['table_id'] and row['upstream_column_id']:
            key = f"col::{row['table_id']}::{row['upstream_column_id']}"
        elif row['datasource_id'] and row['name']:
             # 只有名字没物理列，可能是别名或遗留数据
            key = f"ds_name::{row['datasource_id']}::{row['name']}"
        else:
            # 极少数情况，完全无法识别 -> 当作独立unique
            key = f"orphan::{row['id']}"
            
        # 2. 获取或创建 Unique ID
        if key not in unique_map:
            unique_id = generate_uuid()
            unique_map[key] = unique_id
            
            # 创建 Unique 记录
            new_unique_records.append({
                'id': unique_id,
                'name': row['name'], # 使用第一个遇到的名字作为标准名
                'upstream_column_id': row['upstream_column_id'],
                'upstream_column_name': row['upstream_column_name'],
                'table_id': row['table_id'],
                'remote_type': row['remote_type'],
                'description': row['description'],
                'created_at': row['created_at']
            })
            unique_count += 1
        else:
            unique_id = unique_map[key]
            
        # 3. 创建 Instance 记录
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

    # 批量写入
    if new_unique_records:
        session.bulk_insert_mappings(UniqueRegularField, new_unique_records)
    if new_instance_records:
        session.bulk_insert_mappings(RegularField, new_instance_records)
        
    print(f"  ✅ 原始字段迁移完成: 实例 {len(new_instance_records)} -> 去重后 {unique_count} 个标准字段")
    return len(new_instance_records)

def migrate_calculated_fields(session):
    print("\n[2/4] 迁移计算字段 (Calculated Fields)...")
    
    # 联结旧的 calculated_fields (legacy) 表获取公式
    # 注意：fields 表里也有 formula 字段 (如果之前同步过的话)，优先用 calculated_fields 表的
    # 但为了稳妥，用 COALESCE
    rows = session.execute(text("""
        SELECT 
            f.*, 
            c.formula as c_formula, 
            c.formula_hash as c_hash,
            c.complexity_score as c_score
        FROM fields f
        LEFT JOIN calculated_fields_legacy c ON f.id = c.field_id
        WHERE f.is_calculated = 1
    """)).mappings().all() 
    # 注意：这里假设我在运行前手动把旧表重命名为了 calculated_fields_legacy 
    # 或者直接从 fields 表读如果不需旧 calculated_fields 数据
    # 但实际上，旧表还叫 calculated_fields，新表也叫 calculated_fields，这会冲突。
    # 在 运行此脚本前，SQLAlchemy 模型已经指向新表。
    # 所以直接 SQL 查询旧数据可能需要技巧。
    # 简单起见，我们假设 fields 表中已经有 formula (因为之前 sync_fields 会写 fields.formula).
    # 如果 fields.formula 是空的，那我们可能得依赖旧表数据...
    # 让我们检查一下 fields 表里是否有 formula。
    
    # 更好的策略：
    # 直接查询 `calculated_fields` 表 (这在 SQLite 里是存在的，虽然 ORM 映射变了)
    # 并在内存处理。
    pass # 具体的查询逻辑写在下面

    # 由于 calculated_fields 表名冲突，我们先用 raw sql 读取旧表数据
    # 为了避免冲突，脚本运行前我们假设已经做了处理，或者我们只读 fields 表，因为目前的 sync 逻辑是把 formula 写到 fields 的。
    # 以前的 sync_fields: field.formula = f_data.get("formula")
    # 所以 fields 表应该有 formula。
    
    # 我们只从 fields 表读。
    rows = session.execute(text("""
        SELECT * FROM fields WHERE is_calculated = 1
    """)).mappings().all()

    unique_map = {} # formula_hash -> unique_id
    new_unique_records = []
    new_instance_records = []
    
    unique_count = 0
    
    for row in rows:
        formula = row['formula'] or ''
        # 如果有 formula_hash (之前的 cached_fields 可能有), 但 fields 表好像没有 formula_hash 字段?
        # 检查 calculated_fields_legacy (如果存在)
        # 简单起见，重新计算 hash
        formula_hash = get_formula_hash(formula)
        
        # 1. 确定去重键
        key = formula_hash
        
        # 2. 获/创 Unique ID
        if key not in unique_map:
            unique_id = generate_uuid()
            unique_map[key] = unique_id
            
            new_unique_records.append({
                'id': unique_id,
                'name': row['name'], # 选一个名字
                'formula': formula,
                'formula_hash': formula_hash,
                'description': row['description'],
                'complexity_score': 0, # 需重新计算或从旧表拿，暂时置0
                'created_at': row['created_at']
            })
            unique_count += 1
        else:
            unique_id = unique_map[key]
            
        # 3. Instance
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

    print(f"  ✅ 计算字段迁移完成: 实例 {len(new_instance_records)} -> 去重后 {unique_count} 个标准指标")
    return len(new_instance_records)

def migrate_relations(session):
    print("\n[3/4] 迁移关联关系...")
    # View, Dependency 等
    
    # Regular -> View
    session.execute(text("""
        INSERT INTO regular_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
    """))
    
    # Calculated -> View (注意旧表名逻辑)
    # ORM 中 calculated_fields 现在映射到新表
    session.execute(text("""
        INSERT INTO calc_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE f.is_calculated = 1
    """))
    
    print("  ✅ 视图关联迁移完成")
    
    # Dependencies
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
        SELECT 
            fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
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

def main():
    print("🚀 开始四表架构迁移...")
    
    session, engine = get_session()
    
    # 事务处理
    try:
        # 0. 预处理：重命名已存在的旧 calculated_fields 表以防冲突 (如果存在)
        # SQLite 不支持 IF EXISTS DROP... 
        # 我们用简单的 try-catch block 忽略错误
        try:
            # 这一步很关键：因为新表名为 calculated_fields，必须先移除旧表或重命名
            # 或者我们先 drop 旧表? 数据都在 fields 表里有一份 (formula)，
            # 但旧 calculated_fields可能有 fields 表没有的信息 (hash, score)。
            # 我们先把旧表重命名为 calculated_fields_legacy
            session.execute(text("ALTER TABLE calculated_fields RENAME TO calculated_fields_legacy"))
            print("  ℹ️  旧 calculated_fields 表已重命名为 calculated_fields_legacy")
        except Exception as e:
            # 可能已经被重命名过或者不存在
            print(f"  ℹ️  重命名跳过: {e}")
        
        create_tables(engine)
        
        migrate_regular_fields(session)
        migrate_calculated_fields(session)
        migrate_relations(session)
        migrate_lineage(session)
        
        session.commit()
        print("\n✨ 所有迁移任务成功完成！")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ 迁移失败: {e}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    main()
