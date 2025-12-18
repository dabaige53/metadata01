import os
import sys

# 设置项目根目录
project_root = "/Users/w/Desktop/吉祥/Team/代码管理/metadata分析"
sys.path.append(project_root)

from backend import create_app
from backend.models import get_engine, get_session
from backend.config import Config
from sqlalchemy import text

def test_dashboard():
    print("开始测试仪表盘分析接口...")
    app = create_app(Config)
    engine = get_engine(Config.DATABASE_PATH)
    session = get_session(engine)
    
    # 模拟 g.db_session
    class MockG:
        pass
    
    import flask
    with app.app_context():
        from flask import g
        g.db_session = session
        
        from backend.routes.api import get_dashboard_analysis
        try:
            # 直接调用函数
            response = get_dashboard_analysis()
            print("接口响应:", response.get_json())
        except Exception as e:
            print("捕获到错误:")
            import traceback
            traceback.print_exc()
        finally:
            session.close()

if __name__ == "__main__":
    test_dashboard()
