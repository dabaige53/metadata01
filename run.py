"""
Tableau 元数据监控系统 - 启动入口
"""
import os
import sys

# 确保项目根目录在 Python 路径中
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.config import Config
from app.models import get_engine, init_db

def main():
    """启动应用"""
    print("=" * 60)
    print("  Tableau 元数据监控系统")
    print("=" * 60)
    
    # 检查数据库是否存在，如果不存在则初始化
    if not os.path.exists(Config.DATABASE_PATH):
        print("\n📦 首次运行，正在初始化数据库...")
        engine = get_engine(Config.DATABASE_PATH)
        init_db(engine)
        print("✅ 数据库初始化完成")
    
    # 创建 Flask 应用
    app = create_app()
    
    print(f"\n🌐 服务器启动中...")
    print(f"   地址: http://localhost:{Config.PORT}")
    print(f"   数据库: {Config.DATABASE_PATH}")
    print("\n💡 提示: 首次使用请点击 '同步数据' 按钮加载数据")
    print("=" * 60)
    
    # 启动服务器
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )


if __name__ == '__main__':
    main()
