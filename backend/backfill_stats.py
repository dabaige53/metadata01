"""
数据回填脚本 - 使用现有本地数据计算并填充统计字段
运行方式: python3 backend/backfill_stats.py
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config
from backend.models import get_engine, get_session, Workbook, Datasource

def backfill():
    """执行回填"""
    print("=" * 50)
    print("数据回填 - 计算统计字段 (基于现有数据)")
    print("=" * 50)
    
    db_path = Config.DATABASE_PATH
    print(f"\n数据库路径: {db_path}")
    
    if not os.path.exists(db_path):
        print("❌ 数据库不存在")
        return

    engine = get_engine(db_path)
    session = get_session(engine)
    
    try:
        # ========== Workbook 统计 ==========
        print("\n📊 计算工作簿统计...")
        workbooks = session.query(Workbook).all()
        for wb in workbooks:
            wb.view_count = len(wb.views) if wb.views else 0
            wb.datasource_count = len(wb.datasources) if wb.datasources else 0
            
            # 统计字段和指标（需查询视图中的字段）
            field_ids = set()
            metric_ids = set()
            for v in (wb.views or []):
                for f in (v.fields or []):
                    if f.is_calculated:
                        metric_ids.add(f.id)
                    else:
                        field_ids.add(f.id)
            wb.field_count = len(field_ids)
            wb.metric_count = len(metric_ids)
        
        print(f"  ✅ 更新 {len(workbooks)} 个工作簿")

        # ========== Datasource 统计 ==========
        print("\n🔗 计算数据源统计...")
        datasources = session.query(Datasource).all()
        for ds in datasources:
            ds.table_count = len(ds.tables) if ds.tables else 0
            ds.workbook_count = len(ds.workbooks) if ds.workbooks else 0
            
            field_count = 0
            metric_count = 0
            for f in (ds.fields or []):
                if f.is_calculated:
                    metric_count += 1
                else:
                    field_count += 1
            ds.field_count = field_count
            ds.metric_count = metric_count
        
        print(f"  ✅ 更新 {len(datasources)} 个数据源")
        
        session.commit()
        print("\n🎉 回填完成！")
        
    except Exception as e:
        session.rollback()
        print(f"\n❌ 回填失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    backfill()
