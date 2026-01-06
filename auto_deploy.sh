#!/bin/bash
# Tableau 元数据治理平台 - 一键自动化部署脚本
# 用法: chmod +x auto_deploy.sh && ./auto_deploy.sh

set -e  # 遇错即停

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=========================================="
echo "Tableau 元数据治理平台 - 自动化部署"
echo "=========================================="

# Step 1: 创建虚拟环境
echo ""
echo "[1/7] 创建 Python 虚拟环境..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ 虚拟环境已创建"
else
    echo "✓ 虚拟环境已存在，跳过"
fi

# Step 2: 安装 Python 依赖
echo ""
echo "[2/7] 安装 Python 依赖..."
./venv/bin/pip install --upgrade pip -q
./venv/bin/pip install -r requirements.txt -q
echo "✓ Python 依赖安装完成"

# Step 3: 安装前端依赖
echo ""
echo "[3/7] 安装前端依赖..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install --silent
    echo "✓ 前端依赖安装完成"
else
    echo "✓ node_modules 已存在，跳过"
fi
cd ..

# Step 4: 检查 .env 配置
echo ""
echo "[4/7] 检查环境配置..."
if [ ! -f ".env" ]; then
    echo "⚠️  未找到 .env 文件，创建模板..."
    cat > .env << 'ENVEOF'
TABLEAU_BASE_URL=http://your-tableau-server.com
TABLEAU_PAT_NAME=your_pat_name
TABLEAU_PAT_SECRET=your_pat_secret
ENVEOF
    echo "❌ 请编辑 .env 文件填入真实的 Tableau 连接信息后重新运行"
    exit 1
else
    echo "✓ .env 配置文件存在"
fi

# Step 5: 初始化数据库（自动，无交互）
echo ""
echo "[5/7] 初始化数据库..."
mkdir -p data
if [ ! -f "data/metadata.db" ]; then
    ./venv/bin/python -c "
from backend.models import Base, get_engine, init_db
from backend.config import Config
import os
os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
engine = get_engine(Config.DATABASE_PATH)
init_db(engine)
print('✓ 数据库初始化完成')
"
else
    echo "✓ 数据库已存在，跳过初始化"
fi

# Step 6: 同步 Tableau 数据
echo ""
echo "[6/7] 同步 Tableau 元数据..."
./venv/bin/python backend/tableau_sync.py --skip-usage
echo "✓ 数据同步完成"

# Step 7: 构建前端生产版本
echo ""
echo "[7/7] 构建前端生产版本..."
cd frontend
npm run build
cd ..
echo "✓ 前端构建完成"

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "启动命令:"
echo "  生产模式: ./venv/bin/python deploy.py --skip-build"
echo "  开发模式: ./venv/bin/python dev.py"
echo ""
echo "访问地址: http://localhost:3200"
echo ""
