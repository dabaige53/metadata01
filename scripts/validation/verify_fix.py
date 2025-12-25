
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from flask import Flask, g
from models import init_db, Field, CalculatedField, Datasource, View, Workbook, DBTable, DBColumn
from sqlalchemy import create_engine, text, case
from sqlalchemy.orm import sessionmaker, selectinload, joinedload
from config import Config

def verify_field_aggregation():
    print("\n[验证] 字段聚合逻辑 (Measure Names)...")
    
    # 模拟环境
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 1. 查找 :Measure Names 的一个实例
        field = session.query(Field).filter(Field.name == ':Measure Names').first()
        if not field:
            print("❌ 未找到 :Measure Names 字段")
            return

        print(f"当前字段: {field.name} (ID: {field.id})")
        print(f"Table ID: {field.table_id}")

        # 2. 执行新逻辑
        siblings = []
        if field.table_id:
            print("使用旧逻辑 (有 table_id)")
        else:
            print("✅ 使用新逻辑 (无 table_id，按名称聚合)")
            siblings = session.query(Field).filter(
                Field.name == field.name,
                Field.table_id == None
            ).options(selectinload(Field.datasource)).limit(100).all()
        
        print(f"找到同名字段数: {len(siblings)}")
        
        related_datasources = []
        ds_ids = set()
        
        # 当前
        if field.datasource:
            ds_ids.add(field.datasource.id)
            related_datasources.append(field.datasource.name)

        # 兄弟
        for sib in siblings:
            if sib.datasource and sib.datasource.id not in ds_ids:
                ds_ids.add(sib.datasource.id)
                related_datasources.append(sib.datasource.name)
        
        print(f"聚合后关联数据源数: {len(related_datasources)}")
        if len(related_datasources) > 1:
            print("✅ 聚合成功！关联数据源示例:", related_datasources[:3])
        else:
            print("⚠️ 聚合结果数量较少，请检查数据。")

    except Exception as e:
        print(f"❌ 错误: {e}")
    finally:
        session.close()

def verify_metric_aggregation():
    print("\n[验证] 指标聚合逻辑...")
    
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 1. 找一个有同名定义的指标
        # 先找 formula_hash 重复的
        sql = """
            SELECT field_id FROM calculated_fields 
            WHERE formula_hash IN (
                SELECT formula_hash FROM calculated_fields 
                GROUP BY formula_hash HAVING COUNT(*) > 1
            ) LIMIT 1
        """
        metric_id = session.execute(text(sql)).scalar()
        
        if not metric_id:
            print("⚠️ 未找到有重复定义的指标，无法验证聚合")
            return

        field = session.query(Field).get(metric_id)
        calc_field = session.query(CalculatedField).filter_by(field_id=metric_id).first()
        
        print(f"测试指标: {field.name} (ID: {field.id})")

        # 2. 查找相似指标
        similar = []
        if calc_field.formula_hash:
            similar_results = session.query(Field, CalculatedField).join(
                CalculatedField, Field.id == CalculatedField.field_id
            ).options(
                selectinload(Field.datasource),
                selectinload(Field.views)
            ).filter(
                CalculatedField.formula_hash == calc_field.formula_hash,
                Field.id != field.id
            ).all()

            for s_field, s_calc in similar_results:
                similar.append({
                    'id': s_field.id,
                    'datasourceId': s_field.datasource_id,
                    'datasourceName': s_field.datasource.name if s_field.datasource else 'Unknown',
                    'usedInViews': s_field.views
                })
        
        print(f"找到相似指标数: {len(similar)}")

        # 3. 聚合数据源
        ds_ids = set()
        if field.datasource:
            ds_ids.add(field.datasource_id)
        
        unique_ds_count = 1
        for sim in similar:
            if sim['datasourceId'] and sim['datasourceId'] not in ds_ids:
                ds_ids.add(sim['datasourceId'])
                unique_ds_count += 1
        
        print(f"聚合后数据源总数: {unique_ds_count}")
        if unique_ds_count > 1:
            print("✅ 聚合成功！")
        else:
            print("⚠️ 未发现跨数据源的同名指标。")

    except Exception as e:
        print(f"❌ 错误: {e}")
    finally:
        session.close()

if __name__ == '__main__':
    verify_field_aggregation()
    verify_metric_aggregation()
