"""
同步仪表盘与工作表关联关系 - 使用独立的 GraphQL 查询
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import Config
from backend.tableau_sync import TableauMetadataClient
from backend.models import get_engine, get_session, View, dashboard_to_sheet
from sqlalchemy import select

def run_dashboard_sync():
    print("=" * 50)
    print("同步仪表盘与工作表关联关系")
    print("=" * 50)
    
    # 从环境变量获取配置
    base_url = os.environ.get('TABLEAU_BASE_URL', Config.TABLEAU_BASE_URL)
    username = os.environ.get('TABLEAU_USERNAME', Config.TABLEAU_USERNAME)
    password = os.environ.get('TABLEAU_PASSWORD', Config.TABLEAU_PASSWORD)
    
    print(f"\nTableau Server: {base_url}")
    print(f"用户名: {username}")
    
    # 初始化客户端
    client = TableauMetadataClient(base_url, username, password)
    
    if not client.sign_in():
        print("登录失败")
        return
    
    try:
        # 使用专门的 GraphQL 查询获取 dashboard-sheets 关系
        print("\n📊 获取仪表盘与 sheets 关联数据...")
        query = """
        {
            workbooks {
                dashboards {
                    id
                    name
                    sheets {
                        id
                        name
                    }
                }
            }
        }
        """
        result = client.execute_query(query)
        
        if "errors" in result:
            print(f"GraphQL 错误: {result['errors']}")
            return
        
        workbooks = result.get("data", {}).get("workbooks", [])
        print(f"  获取到 {len(workbooks)} 个工作簿")
        
        # 初始化数据库会话
        engine = get_engine(Config.DATABASE_PATH)
        session = get_session(engine)
        
        relation_count = 0
        new_count = 0
        
        for wb in workbooks:
            dashboards = wb.get("dashboards") or []
            
            for dashboard in dashboards:
                dashboard_id = dashboard.get("id")
                sheets = dashboard.get("sheets") or []
                
                for sheet in sheets:
                    sheet_id = sheet.get("id")
                    if not sheet_id:
                        continue
                    
                    relation_count += 1
                    
                    # 检查是否已存在
                    existing = session.execute(
                        select(dashboard_to_sheet).where(
                            dashboard_to_sheet.c.dashboard_id == dashboard_id,
                            dashboard_to_sheet.c.sheet_id == sheet_id
                        )
                    ).first()
                    
                    if not existing:
                        try:
                            session.execute(
                                dashboard_to_sheet.insert().values(
                                    dashboard_id=dashboard_id,
                                    sheet_id=sheet_id
                                )
                            )
                            new_count += 1
                        except Exception as e:
                            print(f"  ⚠️ 插入失败: {e}")
        
        session.commit()
        print(f"\n✅ 同步完成!")
        print(f"  发现关联关系: {relation_count}")
        print(f"  新增关联: {new_count}")
        
        # 验证结果
        total = session.execute(select(dashboard_to_sheet)).fetchall()
        print(f"  数据库中总关联数: {len(total)}")
        
        session.close()
        
    finally:
        client.sign_out()

if __name__ == "__main__":
    run_dashboard_sync()
