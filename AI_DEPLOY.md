# AI 生产环境部署指南

> **目标读者**: AI Agent  
> **用途**: 在全新环境中自动化部署 Tableau 元数据治理平台  
> **原则**: 所有步骤可直接执行，无需人工干预

---

## 0. 前置检查（必须通过）

```bash
# 检查环境依赖（全部返回版本号即可继续）
python3 --version   # 需要 3.10+
node --version      # 需要 18+
npm --version       # 需要 9+

# 如果缺少依赖，根据系统安装：
# macOS: brew install python@3.11 node
# Ubuntu: apt install python3.11 nodejs npm
# CentOS: dnf install python3.11 nodejs
```

---

## 1. 自动化完整部署（生产环境）

### 方式 A: 一键脚本（推荐）

将以下内容保存为 `auto_deploy.sh` 并执行：

```bash
#!/bin/bash
set -e  # 遇错即停

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "=========================================="
echo "Tableau 元数据治理平台 - 自动化部署"
echo "=========================================="

# Step 1: 创建虚拟环境
echo ""
echo "[1/6] 创建 Python 虚拟环境..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ 虚拟环境已创建"
else
    echo "✓ 虚拟环境已存在，跳过"
fi

# Step 2: 安装 Python 依赖
echo ""
echo "[2/6] 安装 Python 依赖..."
./venv/bin/pip install --upgrade pip -q
./venv/bin/pip install -r requirements.txt -q
echo "✓ Python 依赖安装完成"

# Step 3: 安装前端依赖
echo ""
echo "[3/6] 安装前端依赖..."
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
echo "[4/6] 检查环境配置..."
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
echo "[5/6] 初始化数据库..."
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
echo "[6/6] 同步 Tableau 元数据..."
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
```

执行方式：
```bash
chmod +x auto_deploy.sh
./auto_deploy.sh
```

---

### 方式 B: 分步执行命令

```bash
# ========== Step 1: 环境准备 ==========
cd /path/to/metadata
python3 -m venv venv
source venv/bin/activate

# ========== Step 2: 安装依赖 ==========
pip install --upgrade pip
pip install -r requirements.txt
cd frontend && npm install && cd ..

# ========== Step 3: 配置 Tableau 连接 ==========
# 必须修改为真实值！
cat > .env << 'EOF'
TABLEAU_BASE_URL=http://your-tableau-server.com
TABLEAU_PAT_NAME=your_pat_name  
TABLEAU_PAT_SECRET=your_pat_secret
EOF

# ========== Step 4: 自动初始化数据库 ==========
mkdir -p data
venv/bin/python -c "
from backend.models import Base, get_engine, init_db
from backend.config import Config
import os
os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
engine = get_engine(Config.DATABASE_PATH)
init_db(engine)
print('数据库初始化完成')
"

# ========== Step 5: 同步 Tableau 数据 ==========
venv/bin/python backend/tableau_sync.py

# ========== Step 6: 构建前端 ==========
cd frontend && npm run build && cd ..

# ========== Step 7: 启动生产服务 ==========
venv/bin/python deploy.py --skip-build
```

---

## 2. 生产环境启动

```bash
# 生产模式启动（推荐，性能提升 10-50x）
venv/bin/python deploy.py

# 跳过前端构建直接启动（已构建过）
venv/bin/python deploy.py --skip-build

# 后台守护进程模式
nohup venv/bin/python deploy.py --skip-build > logs/production.log 2>&1 &

# 停止服务
venv/bin/python deploy.py stop
```

---

## 3. 服务管理

### 启动/停止

| 命令                                     | 说明                  |
| ---------------------------------------- | --------------------- |
| `venv/bin/python deploy.py`              | 生产模式（构建+启动） |
| `venv/bin/python deploy.py --skip-build` | 生产模式（仅启动）    |
| `venv/bin/python deploy.py stop`         | 停止服务              |
| `venv/bin/python dev.py`                 | 开发模式（热重载）    |
| `venv/bin/python dev.py -d`              | 开发模式（后台）      |
| `venv/bin/python dev.py stop`            | 停止开发服务          |

### 端口配置

| 服务 | 默认端口 | 环境变量                |
| ---- | -------- | ----------------------- |
| 前端 | 3200     | `FRONTEND_PORT`         |
| 后端 | 8201     | `PORT` / `BACKEND_PORT` |

---

## 4. 数据管理

### 数据库操作

```bash
# 自动初始化数据库（无交互，生产环境推荐）
venv/bin/python -c "
from backend.models import Base, get_engine, init_db
from backend.config import Config
import os
os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
engine = get_engine(Config.DATABASE_PATH)
init_db(engine)
print('数据库初始化完成')
"

# 重置数据库（删除后重建）
rm -f data/metadata.db
venv/bin/python -c "
from backend.models import get_engine, init_db
from backend.config import Config
engine = get_engine(Config.DATABASE_PATH)
init_db(engine)
"

# 备份数据库
cp data/metadata.db data/metadata_backup_$(date +%Y%m%d_%H%M%S).db
```

### 数据同步

```bash
# 完整同步（含视图使用统计，约 5-10 分钟）
venv/bin/python backend/tableau_sync.py

# 快速同步（跳过使用统计，约 2-3 分钟）
venv/bin/python backend/tableau_sync.py --skip-usage

# 仅同步使用统计
venv/bin/python backend/tableau_sync.py --usage-only

# 定时同步（crontab 示例，每天凌晨 2 点）
# 0 2 * * * cd /path/to/metadata && ./venv/bin/python backend/tableau_sync.py >> logs/sync.log 2>&1
```

---

## 5. 健康检查

```bash
# 一键健康检查脚本
venv/bin/python -c "
import requests
import sqlite3
import sys

errors = []

# 检查后端 API
try:
    r = requests.get('http://localhost:8201/api/stats', timeout=5)
    if r.status_code == 200 and 'total_assets' in r.json():
        print('✓ 后端 API 正常')
    else:
        errors.append('后端 API 响应异常')
except Exception as e:
    errors.append(f'后端 API 不可达: {e}')

# 检查前端
try:
    r = requests.get('http://localhost:3200', timeout=5)
    if r.status_code == 200:
        print('✓ 前端服务正常')
    else:
        errors.append(f'前端返回 {r.status_code}')
except Exception as e:
    errors.append(f'前端服务不可达: {e}')

# 检查数据库
try:
    conn = sqlite3.connect('data/metadata.db')
    cur = conn.cursor()
    cur.execute('SELECT COUNT(*) FROM workbooks')
    count = cur.fetchone()[0]
    conn.close()
    if count > 0:
        print(f'✓ 数据库正常 (工作簿: {count})')
    else:
        errors.append('数据库为空，需要同步数据')
except Exception as e:
    errors.append(f'数据库异常: {e}')

if errors:
    print('')
    print('❌ 发现问题:')
    for err in errors:
        print(f'  - {err}')
    sys.exit(1)
else:
    print('')
    print('✅ 所有检查通过')
"
```

---

## 6. 故障排除

### 端口冲突

```bash
# 查看端口占用
lsof -i:3200 -i:8201

# 强制清理
venv/bin/python dev.py stop
kill -9 $(lsof -ti:3200) 2>/dev/null || true
kill -9 $(lsof -ti:8201) 2>/dev/null || true
```

### 依赖问题

```bash
# Python 依赖重装
rm -rf venv
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Node 依赖重装
cd frontend
rm -rf node_modules package-lock.json .next
npm install
npm run build
cd ..
```

### Tableau 连接失败

```bash
# 验证连接配置
venv/bin/python -c "
from backend.services.tableau_client import TableauMetadataClient
client = TableauMetadataClient()
try:
    client.authenticate()
    print('✓ Tableau 连接成功')
except Exception as e:
    print(f'❌ 连接失败: {e}')
    print('请检查 .env 中的 TABLEAU_BASE_URL, TABLEAU_PAT_NAME, TABLEAU_PAT_SECRET')
"
```

### 数据库损坏

```bash
# 完整重建
rm -f data/metadata.db
venv/bin/python -c "
from backend.models import get_engine, init_db
from backend.config import Config
engine = get_engine(Config.DATABASE_PATH)
init_db(engine)
"
venv/bin/python backend/tableau_sync.py
```

---

## 7. 目录结构

```
metadata/
├── frontend/                 # Next.js 前端
│   ├── src/app/              # 页面组件
│   ├── .next/                # 构建产物（生产模式需要）
│   └── package.json
├── backend/                  # Flask 后端
│   ├── routes/               # API 路由
│   ├── services/             # 业务逻辑
│   ├── models.py             # ORM 模型
│   └── config.py             # 配置
├── data/
│   └── metadata.db           # SQLite 数据库
├── logs/                     # 日志目录
├── .env                      # 环境配置（必须创建）
├── dev.py                    # 开发启动脚本
├── deploy.py                 # 生产部署脚本
└── requirements.txt          # Python 依赖
```

---

## 8. 环境变量参考

| 变量                 | 必填 | 默认值 | 说明                       |
| -------------------- | ---- | ------ | -------------------------- |
| `TABLEAU_BASE_URL`   | ✓    | -      | Tableau Server 地址        |
| `TABLEAU_PAT_NAME`   | ✓    | -      | Personal Access Token 名称 |
| `TABLEAU_PAT_SECRET` | ✓    | -      | Personal Access Token 密钥 |
| `PORT`               | -    | 8201   | 后端端口                   |
| `FRONTEND_PORT`      | -    | 3200   | 前端端口                   |
| `DEBUG`              | -    | True   | 调试模式                   |

---

## 9. 部署成功验证

```bash
# 执行此命令，输出全部为 ✓ 即部署成功
curl -s http://localhost:8201/api/stats | python3 -c "import sys,json; print('✓ API' if 'total_assets' in json.load(sys.stdin) else '✗ API')" && \
curl -s -o /dev/null -w '✓ 前端 (%{http_code})\n' http://localhost:3200 && \
sqlite3 data/metadata.db "SELECT '✓ 数据库 (工作簿: ' || COUNT(*) || ')' FROM workbooks;"
```

---

**生产环境访问地址**: http://localhost:3200  
**内网访问**: 启动时会显示内网 IP
