
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import Config
from backend.models import Base, Database, DBTable, Datasource, Workbook, View, table_to_datasource

def verify_lineage():
    print("🔍 开始诊断元数据血缘...")
    
    engine = create_engine(f'sqlite:///{Config.DATABASE_PATH}')
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 1. 检查 table_to_datasource 表
        print("\n1. 检查 table_to_datasource 关联表:")
        count = session.query(table_to_datasource).count()
        print(f"   总记录数: {count}")
        
        if count > 0:
            sample = session.query(table_to_datasource).limit(5).all()
            print("   样本数据:")
            for row in sample:
                print(f"   - Table: {row.table_id} -> Datasource: {row.datasource_id}")
        else:
            print("   ⚠️ 警告: table_to_datasource 表为空！")
            
        # 2. 检查 Database -> Table -> Datasource 链
        print("\n2. 检查特定 Database ('ho') 的下游:")
        # 尝试模糊匹配 'ho' 数据库
        dbs = session.query(Database).filter(Database.name.ilike('%ho%')).all()
        
        if not dbs:
            print("   ❌ 未找到名称包含 'ho' 的数据库")
        else:
            for db in dbs:
                print(f"   数据库: {db.name} (ID: {db.id})")
                tables = session.query(DBTable).filter_by(database_id=db.id).all()
                print(f"   - 包含表数量: {len(tables)}")
                
                for t in tables:
                    print(f"     表: {t.name} (ID: {t.id})")
                    # 检查关联数据源
                    ds_count = session.execute(text(
                        "SELECT COUNT(*) FROM table_to_datasource WHERE table_id = :tid"
                    ), {'tid': t.id}).scalar()
                    print(f"       - 关联数据源数: {ds_count}")
                    
                    if ds_count > 0:
                        # 查具体数据源ID
                        links = session.execute(text(
                            "SELECT datasource_id FROM table_to_datasource WHERE table_id = :tid"
                        ), {'tid': t.id}).fetchall()
                        for link in links:
                            ds_id = link[0]
                            print(f"       -> 数据源 ID: {ds_id}")
                            # 查数据源对象
                            ds_obj = session.query(Datasource).filter_by(id=ds_id).first()
                            if ds_obj:
                                print(f"          名称: {ds_obj.name}")
                            else:
                                print(f"          ⚠️ 数据源对象不存在!")

        # 3. 检查 Datasource -> Workbook
        print("\n3. 检查数据源到工作簿关联:")
        # 统计有工作簿的数据源数量
        ds_wb_links = session.execute(text("SELECT COUNT(*) FROM datasource_to_workbook")).scalar()
        print(f"   总关联数: {ds_wb_links}")
        
    except Exception as e:
        print(f"❌ 诊断出错: {e}")
    finally:
        session.close()

if __name__ == "__main__":
    verify_lineage()
