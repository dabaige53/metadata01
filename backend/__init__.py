"""
Tableau 元数据治理平台 - Flask 应用
"""
from flask import Flask, g
from flask_cors import CORS
from backend.config import Config
from backend.models import get_engine, get_session


def create_app(config_class=Config):
    """应用工厂函数"""
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # 启用 CORS 支持
    CORS(app, origins=["http://localhost:3100", "http://127.0.0.1:3100"])
    
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
    
    # 全局 JSON 错误处理器 - 确保所有错误都返回 JSON 而不是 HTML
    from flask import jsonify
    from werkzeug.exceptions import HTTPException
    
    @app.errorhandler(HTTPException)
    def handle_http_exception(e):
        """处理所有 HTTP 错误，返回 JSON 格式"""
        return jsonify({
            "error": e.name,
            "message": e.description,
            "status_code": e.code
        }), e.code
    
    @app.errorhandler(Exception)
    def handle_generic_exception(e):
        """处理所有未捕获的异常，返回 JSON 格式"""
        import traceback
        app.logger.error(f"Unhandled exception: {e}\n{traceback.format_exc()}")
        return jsonify({
            "error": "Internal Server Error",
            "message": str(e),
            "status_code": 500
        }), 500
    
    @app.route('/')
    def index():
        return {"status": "ok", "message": "Tableau Metadata API is running"}
    
    return app
