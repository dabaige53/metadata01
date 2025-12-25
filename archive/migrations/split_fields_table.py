"""
字段分表迁移脚本
将 fields 表拆分为 regular_fields 和 calculated_fields_entity 两张独立表
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from backend.config import Config
from backend.models import (
    Base, RegularField, CalculatedFieldEntity, CalcFieldDependency,
    RegularFieldFullLineage, CalcFieldFullLineage,
    regular_field_to_view, calc_field_to_view
)


def get_session():
    """获取数据库会话"""
    engine = create_engine(f'sqlite:///{Config.DATABASE_PATH}', echo=False)
    Session = sessionmaker(bind=engine)
    return Session(), engine


def create_new_tables(engine):
    """创建新表结构"""
    print("📦 创建新表结构...")
    
    # 只创建新表，不影响旧表
    Base.metadata.create_all(engine, tables=[
        RegularField.__table__,
        CalculatedFieldEntity.__table__,
        CalcFieldDependency.__table__,
        RegularFieldFullLineage.__table__,
        CalcFieldFullLineage.__table__,
        regular_field_to_view,
        calc_field_to_view
    ])
    
    print("  ✅ 新表创建完成")


def migrate_regular_fields(session):
    """迁移原始字段到 regular_fields 表"""
    print("\n📤 迁移原始字段...")
    
    # 统计源表数据
    count_sql = text("SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL")
    source_count = session.execute(count_sql).scalar()
    print(f"  源表字段数: {source_count}")
    
    # 检查目标表是否已有数据
    existing_sql = text("SELECT COUNT(*) FROM regular_fields")
    try:
        existing_count = session.execute(existing_sql).scalar()
        if existing_count > 0:
            print(f"  ⚠️ 目标表已有 {existing_count} 条记录，跳过迁移")
            return existing_count
    except Exception:
        pass  # 表可能不存在
    
    # 执行迁移
    migrate_sql = text("""
        INSERT INTO regular_fields (
            id, name, data_type, remote_type, description,
            table_id, upstream_column_id, upstream_column_name,
            datasource_id, workbook_id,
            role, aggregation, is_hidden, folder_name,
            fully_qualified_name, caption, semantic_role, default_format,
            remote_field_id, remote_field_name,
            created_at, updated_at, usage_count
        )
        SELECT 
            id, name, data_type, remote_type, description,
            table_id, upstream_column_id, upstream_column_name,
            datasource_id, workbook_id,
            role, aggregation, is_hidden, folder_name,
            fully_qualified_name, caption, semantic_role, default_format,
            remote_field_id, remote_field_name,
            created_at, updated_at, usage_count
        FROM fields 
        WHERE is_calculated = 0 OR is_calculated IS NULL
    """)
    
    session.execute(migrate_sql)
    session.commit()
    
    # 验证迁移
    migrated_count = session.execute(text("SELECT COUNT(*) FROM regular_fields")).scalar()
    print(f"  ✅ 迁移完成: {migrated_count} 条原始字段")
    
    return migrated_count


def migrate_calculated_fields(session):
    """迁移计算字段到 calculated_fields_entity 表"""
    print("\n📤 迁移计算字段...")
    
    # 统计源表数据
    count_sql = text("SELECT COUNT(*) FROM fields WHERE is_calculated = 1")
    source_count = session.execute(count_sql).scalar()
    print(f"  源表计算字段数: {source_count}")
    
    # 检查目标表是否已有数据
    existing_sql = text("SELECT COUNT(*) FROM calculated_fields_entity")
    try:
        existing_count = session.execute(existing_sql).scalar()
        if existing_count > 0:
            print(f"  ⚠️ 目标表已有 {existing_count} 条记录，跳过迁移")
            return existing_count
    except Exception:
        pass
    
    # 执行迁移（联结 calculated_fields 表获取额外信息）
    migrate_sql = text("""
        INSERT INTO calculated_fields_entity (
            id, name, data_type, description,
            formula, formula_hash, complexity_score,
            datasource_id, workbook_id, table_id,
            role, is_hidden, folder_name,
            fully_qualified_name, caption,
            dependency_count, usage_count, reference_count,
            has_duplicates, duplicate_count,
            created_at, updated_at
        )
        SELECT 
            f.id, f.name, f.data_type, f.description,
            COALESCE(f.formula, cf.formula), cf.formula_hash, COALESCE(cf.complexity_score, 0),
            f.datasource_id, f.workbook_id, f.table_id,
            f.role, f.is_hidden, f.folder_name,
            f.fully_qualified_name, f.caption,
            COALESCE(cf.dependency_count, 0), COALESCE(f.usage_count, 0), COALESCE(cf.reference_count, 0),
            COALESCE(cf.has_duplicates, 0), COALESCE(cf.duplicate_count, 0),
            f.created_at, f.updated_at
        FROM fields f
        LEFT JOIN calculated_fields cf ON f.id = cf.field_id
        WHERE f.is_calculated = 1
    """)
    
    session.execute(migrate_sql)
    session.commit()
    
    # 验证迁移
    migrated_count = session.execute(text("SELECT COUNT(*) FROM calculated_fields_entity")).scalar()
    print(f"  ✅ 迁移完成: {migrated_count} 条计算字段")
    
    return migrated_count


def migrate_field_to_view(session):
    """迁移字段-视图关联关系"""
    print("\n📤 迁移字段-视图关联...")
    
    # 迁移原始字段关联
    regular_sql = text("""
        INSERT INTO regular_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
    """)
    
    try:
        session.execute(text("SELECT COUNT(*) FROM regular_field_to_view")).scalar()
        # 表存在且可能有数据
    except Exception:
        pass
    
    try:
        session.execute(regular_sql)
        regular_count = session.execute(text("SELECT COUNT(*) FROM regular_field_to_view")).scalar()
        print(f"  ✅ 原始字段-视图关联: {regular_count} 条")
    except Exception as e:
        print(f"  ⚠️ 原始字段-视图迁移失败: {e}")
        regular_count = 0
    
    # 迁移计算字段关联
    calc_sql = text("""
        INSERT INTO calc_field_to_view (field_id, view_id)
        SELECT fv.field_id, fv.view_id 
        FROM field_to_view fv
        JOIN fields f ON fv.field_id = f.id
        WHERE f.is_calculated = 1
    """)
    
    try:
        session.execute(calc_sql)
        calc_count = session.execute(text("SELECT COUNT(*) FROM calc_field_to_view")).scalar()
        print(f"  ✅ 计算字段-视图关联: {calc_count} 条")
    except Exception as e:
        print(f"  ⚠️ 计算字段-视图迁移失败: {e}")
        calc_count = 0
    
    session.commit()
    return regular_count, calc_count


def migrate_field_dependencies(session):
    """迁移字段依赖关系"""
    print("\n📤 迁移字段依赖关系...")
    
    # 从 field_dependencies 迁移到 calc_field_dependencies
    migrate_sql = text("""
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
    """)
    
    try:
        session.execute(migrate_sql)
        count = session.execute(text("SELECT COUNT(*) FROM calc_field_dependencies")).scalar()
        print(f"  ✅ 依赖关系迁移: {count} 条")
        session.commit()
        return count
    except Exception as e:
        print(f"  ⚠️ 依赖关系迁移失败: {e}")
        session.rollback()
        return 0


def migrate_full_lineage(session):
    """迁移完整血缘表"""
    print("\n📤 迁移完整血缘表...")
    
    # 迁移原始字段血缘
    regular_sql = text("""
        INSERT INTO regular_field_full_lineage (
            field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path
        )
        SELECT 
            fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
    """)
    
    try:
        session.execute(regular_sql)
        regular_count = session.execute(text("SELECT COUNT(*) FROM regular_field_full_lineage")).scalar()
        print(f"  ✅ 原始字段血缘: {regular_count} 条")
    except Exception as e:
        print(f"  ⚠️ 原始字段血缘迁移失败: {e}")
        regular_count = 0
    
    # 迁移计算字段血缘
    calc_sql = text("""
        INSERT INTO calc_field_full_lineage (
            field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path
        )
        SELECT 
            fl.field_id, fl.table_id, fl.datasource_id, fl.workbook_id, fl.lineage_type, fl.lineage_path
        FROM field_full_lineage fl
        JOIN fields f ON fl.field_id = f.id
        WHERE f.is_calculated = 1
    """)
    
    try:
        session.execute(calc_sql)
        calc_count = session.execute(text("SELECT COUNT(*) FROM calc_field_full_lineage")).scalar()
        print(f"  ✅ 计算字段血缘: {calc_count} 条")
    except Exception as e:
        print(f"  ⚠️ 计算字段血缘迁移失败: {e}")
        calc_count = 0
    
    session.commit()
    return regular_count, calc_count


def verify_migration(session):
    """验证迁移结果"""
    print("\n🔍 验证迁移结果...")
    
    # 原始字段对比
    original_regular = session.execute(text(
        "SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL"
    )).scalar()
    new_regular = session.execute(text("SELECT COUNT(*) FROM regular_fields")).scalar()
    
    # 计算字段对比
    original_calc = session.execute(text(
        "SELECT COUNT(*) FROM fields WHERE is_calculated = 1"
    )).scalar()
    new_calc = session.execute(text("SELECT COUNT(*) FROM calculated_fields_entity")).scalar()
    
    print(f"\n  📊 迁移统计:")
    print(f"     原始字段: 源={original_regular} → 目标={new_regular} {'✅' if original_regular == new_regular else '❌'}")
    print(f"     计算字段: 源={original_calc} → 目标={new_calc} {'✅' if original_calc == new_calc else '❌'}")
    
    is_valid = (original_regular == new_regular) and (original_calc == new_calc)
    
    if is_valid:
        print("\n  ✅ 迁移验证通过！")
    else:
        print("\n  ❌ 迁移验证失败，数据不一致")
    
    return is_valid


def main():
    """主函数"""
    print("=" * 60)
    print("📊 字段分表迁移工具")
    print("=" * 60)
    print(f"数据库路径: {Config.DATABASE_PATH}")
    
    session, engine = get_session()
    
    try:
        # Step 1: 创建新表
        create_new_tables(engine)
        
        # Step 2: 迁移原始字段
        migrate_regular_fields(session)
        
        # Step 3: 迁移计算字段
        migrate_calculated_fields(session)
        
        # Step 4: 迁移字段-视图关联
        migrate_field_to_view(session)
        
        # Step 5: 迁移字段依赖
        migrate_field_dependencies(session)
        
        # Step 6: 迁移完整血缘
        migrate_full_lineage(session)
        
        # Step 7: 验证迁移
        is_valid = verify_migration(session)
        
        print("\n" + "=" * 60)
        if is_valid:
            print("🎉 分表迁移完成！")
        else:
            print("⚠️ 迁移完成但存在数据差异，请检查")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
