"""
后端路由模块初始化
按业务领域拆分的模块化路由注册

模块结构:
- utils.py: 公共工具函数
- databases.py: 数据库接口
- tables.py: 数据表接口
- datasources.py: 数据源接口
- workbooks.py: 工作簿接口
- views.py: 视图接口
- fields.py: 字段接口
- metrics.py: 指标接口
- lineage.py: 血缘接口
- api_legacy.py: 剩余接口（统计、搜索、质量、项目、用户等）
"""

from flask import Blueprint

# 创建主 API 蓝图
api_bp = Blueprint("api", __name__)

# 导入公共工具模块
from . import utils

# 导入已迁移的子模块（这些模块会向 api_bp 注册路由）
from . import databases
from . import tables
from . import datasources
from . import workbooks
from . import views
from . import fields
from . import metrics
from . import glossary
from . import lineage
from . import sync

# 导入原 api_legacy.py 中剩余的路由
from . import api_legacy
