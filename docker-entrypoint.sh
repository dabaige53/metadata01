#!/bin/bash
set -e

echo "=============================================="
echo "  Tableau 元数据治理平台 - 后端启动中..."
echo "=============================================="

if [ ! -f /app/data/metadata.db ]; then
    echo "首次运行，正在初始化数据库..."
    python -c "from backend.models import get_engine, init_db; from backend.config import Config; engine = get_engine(Config.DATABASE_PATH); init_db(engine)"
    echo "数据库初始化完成"
fi

echo "数据库路径: /app/data/metadata.db"
echo "API 端口: ${PORT:-8201}"
echo "=============================================="

exec "$@"
