"""
Tableau 元数据治理平台 - Flask 应用
"""
from flask import Flask, render_template
from .config import Config
from .models import get_engine, get_session


def create_app(config_class=Config):
    """应用工厂函数"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 创建数据库引擎和会话
    engine = get_engine(config_class.DATABASE_PATH)
    
    # 存储到 app 上下文
    app.engine = engine
    
    # 注册数据库会话
    @app.before_request
    def before_request():
        from flask import g
        g.db_session = get_session(engine)
    
    @app.teardown_request
    def teardown_request(exception=None):
        from flask import g
        session = g.pop('db_session', None)
        if session is not None:
            session.close()
    
    # 注册蓝图
    from .routes import api_bp
    app.register_blueprint(api_bp, url_prefix='/api')
    
    # 主页路由
    @app.route('/')
    def index():
        return render_template('index.html')
    
    # Demo 页面路由 - Figma 设计稿还原
    @app.route('/demo')
    def demo():
        return render_template('demo.html')
    
    return app
