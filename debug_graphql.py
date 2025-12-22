"""
调试 Tableau GraphQL - 查看实际的 dashboard sheets 数据
"""
import sys
import os
import json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import Config
from backend.tableau_sync import TableauMetadataClient

def debug_graphql():
    base_url = os.environ.get('TABLEAU_BASE_URL', Config.TABLEAU_BASE_URL)
    username = os.environ.get('TABLEAU_USERNAME', Config.TABLEAU_USERNAME)
    password = os.environ.get('TABLEAU_PASSWORD', Config.TABLEAU_PASSWORD)
    
    client = TableauMetadataClient(base_url, username, password)
    
    if not client.sign_in():
        print("登录失败")
        return
    
    try:
        # 查询工作簿的仪表盘及其包含的 sheets
        print("\n� 查询工作簿的仪表盘及 sheets...")
        query = """
        {
            workbooks {
                name
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
            print(f"错误: {result['errors']}")
            return
        
        workbooks = result.get("data", {}).get("workbooks", [])
        print(f"获取到 {len(workbooks)} 个工作簿")
        
        # 统计有 sheets 的仪表盘
        total_dashboards = 0
        dashboards_with_sheets = 0
        total_relations = 0
        
        for wb in workbooks[:5]:  # 只显示前5个
            print(f"\n工作簿: {wb['name']}")
            dashboards = wb.get("dashboards") or []
            for db in dashboards:
                total_dashboards += 1
                sheets = db.get("sheets") or []
                if sheets:
                    dashboards_with_sheets += 1
                    total_relations += len(sheets)
                    print(f"  仪表盘: {db['name']} -> 包含 {len(sheets)} 个 sheets")
                    for s in sheets[:3]:
                        print(f"    - {s['name']}")
                else:
                    print(f"  仪表盘: {db['name']} -> 无 sheets")
        
        print(f"\n统计:")
        print(f"  总仪表盘数: {total_dashboards}")
        print(f"  有 sheets 的仪表盘: {dashboards_with_sheets}")
        print(f"  总关联关系: {total_relations}")
        
    finally:
        client.sign_out()

if __name__ == "__main__":
    debug_graphql()
