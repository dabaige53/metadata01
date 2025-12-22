"""
应用配置
"""
import os
from pathlib import Path

# 加载 .env 文件（如果存在）
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())


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
    PORT = int(os.environ.get('PORT', 8101))
    
    # Tableau 配置 (吉祥航空 Tableau Server)
    TABLEAU_BASE_URL = os.environ.get('TABLEAU_BASE_URL', 'http://tbi.juneyaoair.com')
    TABLEAU_USERNAME = os.environ.get('TABLEAU_USERNAME', '')
    TABLEAU_PASSWORD = os.environ.get('TABLEAU_PASSWORD', '')
    TABLEAU_PAT_NAME = os.environ.get('TABLEAU_PAT_NAME', '')
    TABLEAU_PAT_SECRET = os.environ.get('TABLEAU_PAT_SECRET', '')
