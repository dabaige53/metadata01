
import sys
import os

# Add project root to path
sys.path.append(os.getcwd())

from backend.models import get_engine, get_session, init_db, Glossary, TermEnum

def seed_glossary():
    # Fix: Point to the actual DB used by the app
    db_path = os.path.join('data', 'metadata.db')
    engine = get_engine(db_path)
    init_db(engine)  # Ensure tables exist
    session = get_session(engine)

    terms = [
        # ==============================================================================
        # 1. 核心实体 (Core Entities)
        # ==============================================================================
        {
            "term": "LUID",
            "label": "全局唯一标识符",
            "definition": "Tableau Server 分配给每个资产的 32 位 UUID（如 `384c2a5...`），是资产在系统中的身份证，用于 API 调用和精准定位。",
            "category": "核心实体",
            "element": "general"
        },
        {
            "term": "Vizportal URL ID",
            "label": "门户跳转 ID",
            "definition": "Tableau 内部用于构建前端 URL 的整数 ID。与 LUID 不同，这是用于生成 `/#/projects/123` 这种原生跳转链接的关键参数。",
            "category": "核心实体",
            "element": "workbook"
        },
        {
            "term": "Project",
            "label": "项目",
            "definition": "Tableau 中的顶层容器（类似文件系统中的文件夹），用于组织工作簿和数据源。项目可以嵌套，具有层级结构和独立的权限设置。",
            "category": "核心实体",
            "element": "project"
        },
        {
            "term": "Workbook",
            "label": "工作簿",
            "definition": "Tableau 的核心文件单元（.twb/.twbx），包含一个或多个视图 (View)、仪表板 (Dashboard) 以及与之关联的数据源连接。",
            "category": "核心实体",
            "element": "workbook"
        },
        {
            "term": "View",
            "label": "视图",
            "definition": "位于工作簿内的单个可视化图表 (Worksheet) 或由多个图表组成的仪表板 (Dashboard) 的统称。是用户查看数据的最终界面。",
            "category": "核心实体",
            "element": "view"
        },
        {
            "term": "User",
            "label": "用户",
            "definition": "Tableau Server 的注册账户。每个用户都拥有特定的站点角色（Site Role），决定了其在系统中的操作权限。",
            "category": "核心实体",
            "element": "user"
        },
         {
            "term": "Database",
            "label": "数据库",
            "definition": "物理层面的数据库实例。一个数据库包含多个数据表，通过主机地址 (Host) 和端口 (Port) 进行连接。",
            "category": "核心实体",
            "element": "database"
        },

        # ==============================================================================
        # 2. 字段与数据结构 (Fields & Schema)
        # ==============================================================================
        {
            "term": "Schema",
            "label": "模式",
            "definition": "数据库对象的集合（命名空间），用于逻辑隔离表和视图。",
            "category": "数据结构",
            "element": "database"
        },
        {
            "term": "Upstream Column",
            "label": "原始物理列",
            "definition": "数据库表中实际存在的物理列名。即便 Tableau 中将字段重命名（Caption），数据溯源追踪的终点始终是这个物理列。",
            "category": "数据结构",
            "element": "column"
        },
         {
            "term": "Remote Type",
            "label": "远程类型",
            "definition": "数据库底层的原始数据类型（如 `varchar(255)`, `tinyint(1)`, `decimal(10,2)`）。这与 Tableau 显示的逻辑类型（String/Number）可能不同。",
            "category": "数据结构",
            "element": "column"
        },
        {
            "term": "Nullable",
            "label": "可为空",
            "definition": "数据库列约束属性，标识该列是否允许存储 NULL 值。`YES` 表示允许为空，`NO` 表示必填。",
            "category": "数据结构",
            "element": "column"
        },
        {
            "term": "Dimension",
            "label": "维度",
            "definition": "包含定性值（如名称、日期、地理数据）的字段。维度主要用于对数据进行分类和分组（Group By），决定视图的详细程度。",
            "category": "数据结构",
            "element": "field"
        },
        {
            "term": "Measure",
            "label": "度量",
            "definition": "包含定量数值（如销售额、利润）的字段。度量主要用于进行聚合计算（Sum, Avg, Count）。Tableau 默认会对度量进行聚合。",
            "category": "数据结构",
            "element": "field"
        },
        {
            "term": "Caption",
            "label": "别名/标签",
            "definition": "在 Tableau 界面中显示的字段名称。它只是一个显示标签，底层仍然映射到数据库的原始物理列名。",
            "category": "数据结构",
            "element": "field"
        },
        {
            "term": "Calculation Formula",
            "label": "计算公式",
            "definition": "计算字段中定义的具体逻辑表达式（如 `SUM([Sales]) / SUM([Profit])`）。系统会解析公式以提取其依赖的上游字段。",
            "category": "数据结构",
            "element": "metric"
        },

        # ==============================================================================
        # 3. 资产属性与状态 (Attributes & Status)
        # ==============================================================================
        {
            "term": "Physical Table",
            "label": "物理表",
            "definition": "数据库中的真实表。",
            "category": "数据结构",
            "element": "table"
        },
        {
            "term": "Embedded Table",
            "label": "嵌入式表",
            "definition": "工作簿通过“嵌入式数据源”直接连接的数据库表。这些表未经过“已发布数据源”的封装，直接存在于工作簿的 XML 定义中。",
            "category": "数据结构",
            "element": "table"
        },
        {
            "term": "Custom SQL",
            "label": "自定义 SQL",
            "definition": "通过 SQL 语句定义的虚拟表，Tableau 会将其视为一张表。",
            "category": "数据结构",
            "element": "table"
        },
        {
            "term": "Connection Type",
            "label": "连接类型",
            "definition": "数据源连接的具体技术实现（如 MySQL, Oracle, Excel, Hadoop）。决定了所需的连接参数（Host/Port/Service）和图标。",
            "category": "资产属性",
            "element": "datasource"
        },
        {
            "term": "Published Data Source",
            "label": "已发布数据源",
            "definition": "作为独立资源发布到 Tableau Server 的数据源。它可以被多个工作簿复用，是单一事实来源（SSOT）的最佳实践。",
            "category": "资产属性",
            "element": "datasource"
        },
        {
            "term": "Embedded Data Source",
            "label": "嵌入式数据源",
            "definition": "仅存在于特定工作簿内部的私有数据源，外部无法访问或复用。通常是用户直接在工作簿中连接 Excel 或数据库生成的。",
            "category": "资产属性",
            "element": "datasource"
        },
        {
            "term": "Certified",
            "label": "已认证",
            "definition": "一种数据治理状态。由管理员标记为“可信”或“官方”的资产（显示绿色徽章），意味着该数据源或字段的质量已通过验证。",
            "category": "资产属性",
            "element": "datasource"
        },
        {
            "term": "Site Role",
            "label": "站点角色",
            "definition": "用户的权限级别定义。",
            "category": "资产属性",
            "element": "user",
            "enums": [
                {"value": "Creator", "label": "Creator (创建者)", "description": "最高权限，可连接数据、构建数据流、创建和发布内容。"},
                {"value": "Explorer", "label": "Explorer (探索者)", "description": "可基于现有的已发布数据源创建新内容，但无法发布外部数据源。"},
                {"value": "Viewer", "label": "Viewer (查看者)", "description": "仅可查看、订阅和交互已发布的内容，无法编辑或创建。"}
            ]
        },

        # ==============================================================================
        # 4. 血缘与治理 (Lineage & Governance)
        # ==============================================================================
        {
            "term": "Lineage Penetration",
            "label": "血缘穿透",
            "definition": "系统核心能力。当工作簿引用“已发布数据源”时，系统不只停留在数据源层面，而是自动“穿透”这层引用，直接找到底层的物理数据库表和列。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Intelligent Reconnection",
            "label": "智能重连",
            "definition": "系统核心能力。当 API 返回的血缘中断时（如字段在数据库中被重命名），系统通过名称相似度、类型匹配等算法尝试自动修复断裂的血缘路径。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Pre-computation",
            "label": "预计算",
            "definition": "性能优化机制。系统在后台同步时会预先计算好每个资产的复杂统计信息（如引用次数、影响范围），确保前端点击详情页时能毫秒级响应。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Lineage Derived",
            "label": "血缘推导",
            "definition": "当字段没有直接物理表归属时（如计算字段），系统通过 SQL 解析或数据流向分析，推导出其间接依赖的物理来源。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Impact Analysis",
            "label": "影响分析 (下游)",
            "definition": "回答“我改了这个字段，谁会挂掉？”的问题。识别修改当前资产会导致哪些下游报表、指标或数据源报错。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Dependency Analysis",
            "label": "依赖分析 (上游)",
            "definition": "回答“这个指标的数据是从哪来的？”的问题。递归查找当前资产计算逻辑所依赖的所有上游字段和表。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Orphaned",
            "label": "孤立资产",
            "definition": "数据垃圾。指没有任何上下游关联的资产（如未被任何视图使用的字段、没有任何内容的空项目）。通常建议定期清理。",
            "category": "血缘治理",
            "element": "general"
        },
        {
            "term": "Metric Duplicates",
            "label": "同名异义 (指标)",
            "definition": "指标治理风险。指名称相同但计算公式逻辑不同的指标。这通常意味着同一术语在不同部门有不同的定义（口径冲突），需要治理。",
            "category": "血缘治理",
            "element": "metric"
        },
        {
            "term": "Metric Instances",
            "label": "同义复用 (指标)",
            "definition": "指标治理机会。指计算公式逻辑完全相同，但 ID 或名称不同的指标副本。这通常意味着重复建设，可以合并为一个标准指标。",
            "category": "血缘治理",
            "element": "metric"
        },

        # ==============================================================================
        # 5. 统计与分析指标 (Statistics & Metrics)
        # ==============================================================================
        {
            "term": "Dependency Fields",
            "label": "依赖字段",
            "definition": "当前计算字段或指标在计算逻辑中直接引用的上游字段。如果上游字段被删除或修改，当前字段可能会报错。",
            "category": "血缘治理",
            "element": "field"
        },
        {
            "term": "Impact Metrics",
            "label": "影响指标",
            "definition": "当前字段被哪些下游指标所引用。修改当前字段的定义或类型，会直接影响这些指标的计算结果。",
            "category": "血缘治理",
            "element": "field"
        },
        {
            "term": "Embedded Copies",
            "label": "嵌入式副本",
            "definition": "当工作簿连接到“已发布数据源”但又对其进行了本地修改时，Tableau 会在工作簿内部创建一个该数据源的“嵌入式副本”。",
            "category": "状态与类型",
            "element": "datasource"
        },
        {
            "term": "Used Fields",
            "label": "使用字段",
            "definition": "工作簿中被实际拖拽到视图或看板中使用的字段集合。通常远少于数据源中的总字段数。",
            "category": "统计指标",
            "element": "workbook"
        },
        {
            "term": "Used Metrics",
            "label": "使用指标",
            "definition": "工作簿中被实际拖拽到视图或看板中使用的指标（度量）集合。",
            "category": "统计指标",
            "element": "workbook"
        },
        {
            "term": "View Count",
            "label": "历史总访问量",
            "definition": "自上线以来，用户在 Tableau Server 上查看该视图或工作簿的累积总次数。反映资产的长期价值。",
            "category": "统计指标",
            "element": "view"
        },
        {
            "term": "Daily Delta",
            "label": "昨日新增访问",
            "definition": "较昨日同期新增的访问次数。用于监控突发的流量增长或异常关注。",
            "category": "统计指标",
            "element": "view"
        },
        {
            "term": "Weekly Delta",
            "label": "近7日新增访问",
            "definition": "过去 7 天内新增的访问次数。反映资产近期的热门程度。",
            "category": "统计指标",
            "element": "view"
        },
        {
            "term": "Usage History",
            "label": "访问趋势图",
            "definition": "展示过去 30 天每日访问量的折线图。用于分析资产的使用规律（如是否只在月底被访问）。",
            "category": "统计指标",
            "element": "view"
        },
        {
            "term": "Hot Asset",
            "label": "热点资产",
            "definition": "系统自动判定的高价值资产。判定标准通常是：引用次数排名前 10，或近期访问量超过 100 次。",
            "category": "统计指标",
            "element": "general"
        },
        {
            "term": "Zero-Access",
            "label": "零访问/僵尸资产",
            "definition": "长期（如 90 天以上）无人访问的资产。这些资产占用服务器资源且无业务价值，建议下线。",
            "category": "统计指标",
            "element": "view"
        },
        {
            "term": "Complexity Score",
            "label": "复杂度评分",
            "definition": "针对计算字段的代码质量评分。基于 AST（抽象语法树）分析公式长度、函数嵌套深度、引用字段数计算得出。分数越高，维护越困难。",
            "category": "统计指标",
            "element": "metric"
        },
        {
            "term": "Certification Rate",
            "label": "认证率",
            "definition": "项目或文件夹的健康度指标。计算公式：(已认证资产数 / 总资产数) * 100%。",
            "category": "统计指标",
            "element": "project"
        },
        {
            "term": "Column Count",
            "label": "原始列数",
            "definition": "物理表中包含的数据库列总数。",
            "category": "统计指标",
            "element": "table"
        },
        {
            "term": "Field Count",
            "label": "逻辑字段数",
            "definition": "数据源或表中定义的 Tableau 逻辑字段总数（包含维度和度量）。一个物理列可能被拆分为多个逻辑字段。",
            "category": "统计指标",
            "element": "datasource"
        },
        {
            "term": "Table Count",
            "label": "数据表数",
            "definition": "数据库中包含的物理表或自定义 SQL 表的总数量。",
            "category": "统计指标",
            "element": "database"
        },
        {
            "term": "Total Views",
            "label": "总视图数",
            "definition": "项目或工作簿下包含的所有视图（Sheet + Dashboard）的累积总数。",
            "category": "统计指标",
            "element": "project"
        },
        {
            "term": "Total Fields",
            "label": "总字段数",
            "definition": "项目或数据源中包含的所有字段（维度 + 度量 + 计算字段）的累积总数。",
            "category": "统计指标",
            "element": "project"
        },
        {
            "term": "Certified Datasources",
            "label": "已认证数据源数",
            "definition": "项目内被标记为“已认证”的数据源数量，反映了项目数据的可信程度。",
            "category": "统计指标",
            "element": "project"
        },
        {
            "term": "Metric Count",
            "label": "计算指标数",
            "definition": "数据源中包含的计算字段 (Calculated Fields) 总数。反映了业务逻辑的复杂程度。",
            "category": "统计指标",
            "element": "datasource"
        },

        # ==============================================================================
        # 6. 前端交互 (UI/UX)
        # ==============================================================================
        {
            "term": "Detail Drawer",
            "label": "详情抽屉",
            "definition": "点击列表卡片后从右侧滑出的浮层面板，承载了资产的所有详细信息、血缘关系和统计数据。",
            "category": "界面交互",
            "element": "general"
        },
        {
            "term": "Overview Tab",
            "label": "概览页",
            "definition": "详情抽屉默认展示的第一个标签页。包含资产的名称、描述、认证状态、所有者等核心元数据。",
            "category": "界面交互",
            "element": "general"
        },
        {
            "term": "Lineage Graph",
            "label": "血缘关系图",
            "definition": "以节点和连线形式展示资产依赖关系的交互式图表。支持放大、缩小和点击节点跳转。",
            "category": "界面交互",
            "element": "general"
        }
    ]

    added_count = 0
    updated_count = 0

    for item in terms:
        # Check if exists
        db_item = session.query(Glossary).filter_by(term=item['term']).first()
        
        if db_item:
            # Update
            db_item.label = item['label']
            db_item.definition = item['definition']
            db_item.category = item['category']
            db_item.element = item['element']
            updated_count += 1
            print(f"Updated term: {item['term']} ({item['label']})")
            
            # Update Enums if present
            if 'enums' in item:
                # Clear existing
                session.query(TermEnum).filter_by(glossary_id=db_item.id).delete()
                for e in item['enums']:
                    new_enum = TermEnum(
                        glossary_id=db_item.id,
                        value=e['value'],
                        label=e['label'],
                        description=e['description']
                    )
                    session.add(new_enum)
        else:
            # Create
            new_item = Glossary(
                term=item['term'],
                label=item['label'],
                definition=item['definition'],
                category=item['category'],
                element=item['element']
            )
            session.add(new_item)
            session.flush() # get ID
            
            if 'enums' in item:
                for e in item['enums']:
                    new_enum = TermEnum(
                        glossary_id=new_item.id,
                        value=e['value'],
                        label=e['label'],
                        description=e['description']
                    )
                    session.add(new_enum)
            
            added_count += 1
            print(f"Added term: {item['term']}")

    try:
        session.commit()
        print(f"\nSuccess! Added: {added_count}, Updated: {updated_count}")
    except Exception as e:
        session.rollback()
        print(f"Error: {e}")

if __name__ == "__main__":
    seed_glossary()
