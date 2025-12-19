import requests
import json

base_url = "http://localhost:8101/api"

terms = [
    # ========== 数据库 (Database) ==========
    {
        "term": "Connection (连接)",
        "definition": "Tableau 与数据源之间的链接。可以是文件连接（Excel, CSV）或服务器连接（SQL Server, Snowflake）。",
        "category": "基础概念",
        "element": "database",
        "enums": [
            { "value": "live", "label": "实时 (Live)", "description": "直接查询底层数据库，数据始终保持最新。" },
            { "value": "extract", "label": "提取 (Extract)", "description": "将数据快照存储在本地或 Hyper 引擎中，通常性能更好但需定期刷新。" }
        ]
    },
    {
        "term": "Initial SQL (初始 SQL)",
        "definition": "建立数据库连接时自动执行的 SQL 命令，通常用于设置临时表或查询环境参数。",
        "category": "高级功能",
        "element": "database"
    },

    # ========== 数据表 (Table) ==========
    {
        "term": "Physical Layer (物理层)",
        "definition": "数据模型的底层，定义了实际的表和联接（Joins）。",
        "category": "数据模型",
        "element": "table"
    },
    {
        "term": "Logical Layer (逻辑层)",
        "definition": "数据模型的上层，定义了表之间的关系（Relationships）。",
        "category": "数据模型",
        "element": "table"
    },
    {
        "term": "Relationship (关系)",
        "definition": "在逻辑层连接两个表的一种灵活方式。Tableau 会在查询时根据可视化内容自动生成适当的联接类型。",
        "category": "数据模型",
        "element": "table",
        "enums": [
            { "value": "cardinality", "label": "基数", "description": "一对一、一对多或多对多。" },
            { "value": "referential_integrity", "label": "引用完整性", "description": "假设所有记录都匹配或允许不匹配。" }
        ]
    },
    # --- System Attributes for Table ---
    {
        "term": "Schema (模式)",
        "definition": "数据库中的命名空间，用于组织表和其他对象。在 Tableau 中通常显示为 'dbo', 'public' 等。",
        "category": "系统属性",
        "element": "table"
    },
    {
        "term": "Column Count (原始列数)",
        "definition": "数据库物理表中的列总数，反映了底层表的宽度。",
        "category": "系统属性",
        "element": "table"
    },
    {
        "term": "Field Count (字段数)",
        "definition": "Tableau 数据源中基于此表生成的字段数量，包括自动生成的字段和计算字段。",
        "category": "系统属性",
        "element": "table"
    },

    # ========== 字段字典 (Field) ==========
    {
        "term": "Dimension (维度)",
        "definition": "包含定性值（如名称、日期或地理数据）的字段。维度用于对数据进行分类、分段和揭示详细信息。",
        "category": "字段角色",
        "element": "field"
    },
    {
        "term": "Measure (度量)",
        "definition": "包含可以测量的定量数值的字段。度量通常可以进行聚合（如求和、平均值）。",
        "category": "字段角色",
        "element": "field"
    },
    {
        "term": "LOD Expression (详细级别表达式)",
        "definition": "允许在可视化详细级别之外计算值的表达式（FIXED, INCLUDE, EXCLUDE）。",
        "category": "高级计算",
        "element": "field"
    },
    {
        "term": "Continuous vs Discrete (连续与离散)",
        "definition": "字段的核心属性。连续（绿色）产生轴，离散（蓝色）产生标题。",
        "category": "数据属性",
        "element": "field",
        "enums": [
            { "value": "continuous", "label": "连续 (Green)", "description": "形成无限范围的轴。" },
            { "value": "discrete", "label": "离散 (Blue)", "description": "形成有限的表头。" }
        ]
    },
    # --- System Attributes for Field ---
    {
        "term": "Data Type (数据类型)",
        "definition": "字段存储数据的格式。",
        "category": "系统属性",
        "element": "field",
        "enums": [
            { "value": "string", "label": "字符串", "description": "文本数据" },
            { "value": "integer", "label": "整数", "description": "不带小数的数字" },
            { "value": "float", "label": "浮点数", "description": "带小数的数字" },
            { "value": "boolean", "label": "布尔值", "description": "真/假" },
            { "value": "date", "label": "日期", "description": "日期值" },
            { "value": "datetime", "label": "日期时间", "description": "包含时间的日期" }
        ]
    },
    {
        "term": "Formula (公式)",
        "definition": "用于定义计算字段逻辑的表达式。仅计算字段拥有此属性。",
        "category": "系统属性",
        "element": "field"
    },
    {
        "term": "Usage Count (热度)",
        "definition": "该字段在所有视图和工作表中被引用的总次数。用于衡量字段的重要性。",
        "category": "系统属性",
        "element": "field"
    },

    # ========== 指标库 (Metric) ==========
    {
        "term": "Aggregation (聚合)",
        "definition": "将多行数据概括为单个值的数学运算。",
        "category": "计算逻辑",
        "element": "metric",
        "enums": [
            { "value": "SUM", "label": "求和", "description": "值的总和" },
            { "value": "AVG", "label": "平均值", "description": "算术平均" },
            { "value": "COUNTD", "label": "去重计数", "description": "唯一值的数量" }
        ]
    },
    {
        "term": "Quick Table Calculation (快速表计算)",
        "definition": "基于可视化中的数据而非底层数据源进行的计算（如：差异、百分比差异、移动平均）。",
        "category": "计算逻辑",
        "element": "metric"
    },
    # --- System Attributes for Metric ---
    {
        "term": "Complexity Score (复杂度评分)",
        "definition": "系统基于计算公式的长度、嵌套层级和函数类型自动计算的评分。分数越高代表维护成本越高。",
        "category": "系统属性",
        "element": "metric"
    },
    {
        "term": "Reference Count (引用计数)",
        "definition": "该指标被其他计算字段依赖或引用的次数。反映了该指标作为中间层计算的重要性。",
        "category": "系统属性",
        "element": "metric"
    },

    # ========== 数据源 (Datasource) ==========
    {
        "term": "Published Datasource (已发布数据源)",
        "definition": "发布到 Tableau Server/Cloud 供他人重复使用的数据源。",
        "category": "资产类型",
        "element": "datasource"
    },
    {
        "term": "Data Source Filter (数据源筛选器)",
        "definition": "限制进入 Tableau 的数据量的筛选器，应用于提取或实时查询之前。",
        "category": "过滤机制",
        "element": "datasource"
    },
    # --- System Attributes for Datasource ---
    {
        "term": "Certified (已认证)",
        "definition": "标识该数据源已经过数据治理团队的验证，数据质量可信。在 UI 中通常显示为绿色对勾。",
        "category": "系统属性",
        "element": "datasource"
    },
    {
        "term": "Has Extract (有提取)",
        "definition": "标识该数据源是否创建了数据提取 (Hyper)。",
        "category": "系统属性",
        "element": "datasource"
    },
    {
        "term": "Last Refresh (最后刷新)",
        "definition": "数据提取最近一次成功刷新的时间。",
        "category": "系统属性",
        "element": "datasource"
    },

    # ========== 工作簿 (Workbook) ==========
    {
        "term": "TWBX",
        "definition": "Tableau 打包工作簿。包含工作簿 XML 定义以及源数据（提取文件、Excel 等）。",
        "category": "文件格式",
        "element": "workbook"
    },
    {
        "term": "TWB",
        "definition": "Tableau 工作簿。仅包含 XML 定义，不包含数据。",
        "category": "文件格式",
        "element": "workbook"
    },

    # ========== 视图 (View) ==========
    {
        "term": "Sheet (工作表)",
        "definition": "构建可视化的基本单元。",
        "category": "视图类型",
        "element": "view"
    },
    {
        "term": "Dashboard (仪表板)",
        "definition": "将多个工作表组合在一个视图中，用于同时监控多种数据。",
        "category": "视图类型",
        "element": "view"
    },
    {
        "term": "Story (故事)",
        "definition": "按顺序排列的一系列工作表或仪表板，用于传达信息。",
        "category": "视图类型",
        "element": "view"
    },
    {
        "term": "Mark (标记)",
        "definition": "视图中的可视元素（条形、圆形、方形等），代表数据点。",
        "category": "可视化组件",
        "element": "view"
    },
    # --- System Attributes for View ---
    {
        "term": "View Count (访问量)",
        "definition": "该视图被用户访问的总次数（基于 Tableau Server 统计）。",
        "category": "系统属性",
        "element": "view"
    },

    # ========== 项目 (Project) ==========
    {
        "term": "Project Hierarchy (项目层级)",
        "definition": "用于组织工作簿和数据源的容器结构，支持嵌套。",
        "category": "组织结构",
        "element": "project"
    },
    {
        "term": "Permissions (权限)",
        "definition": "控制用户或组对项目及其内容（查看、编辑、下载等）的访问级别。",
        "category": "安全性",
        "element": "project"
    },
    # --- System Attributes for Project ---
    {
        "term": "Owner (所有者)",
        "definition": "资产的负责人或创建者。拥有最高的管理权限。",
        "category": "系统属性",
        "element": "project"
    },

    # ========== 用户 (User) ==========
    {
        "term": "Site Role (站点角色)",
        "definition": "决定用户在 Tableau Server/Cloud 上的最大能力。",
        "category": "用户管理",
        "element": "user",
        "enums": [
            { "value": "Server Administrator", "label": "服务器管理员", "description": "拥有所有权限。" },
            { "value": "Site Administrator", "label": "站点管理员", "description": "管理特定站点的用户和内容。" },
            { "value": "Creator", "label": "Creator", "description": "可以连接数据并创建新内容。" },
            { "value": "Explorer", "label": "Explorer", "description": "可以编辑现有内容并分析数据。" },
            { "value": "Viewer", "label": "Viewer", "description": "只能查看和交互已发布的内容。" }
        ]
    }
]

def init_data():
    print(f"Initializing expanded glossary data to {base_url}...")
    success_count = 0
    fail_count = 0
    
    for term in terms:
        try:
            print(f"Creating term: [{term['element']}] {term['term']}...")
            res = requests.post(f"{base_url}/glossary", json=term)
            if res.status_code == 201:
                print(f"  Success: {res.json()['id']}")
                success_count += 1
            elif res.status_code == 409:
                print(f"  Already exists (Skipping).")
            else:
                print(f"  Failed: {res.status_code} - {res.text}")
                fail_count += 1
        except Exception as e:
            print(f"  Error: {e}")
            fail_count += 1
            
    print(f"\nInitialization complete. Added: {success_count}, Failed/Skipped: {fail_count}")

if __name__ == "__main__":
    init_data()
