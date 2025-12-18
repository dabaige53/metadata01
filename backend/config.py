"""
应用配置
"""
import os


class Config:
    """应用配置类"""
    
    # 项目根目录
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # 数据库配置
    DATABASE_PATH = os.path.join(BASE_DIR, 'metadata.db')
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATABASE_PATH}'
    
    # Flask 配置
    SECRET_KEY = os.environ.get('SECRET_KEY', 'tableau-metadata-governance-secret-key')
    DEBUG = os.environ.get('DEBUG', 'True').lower() == 'true'
    
    # 服务器配置
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 8001))
