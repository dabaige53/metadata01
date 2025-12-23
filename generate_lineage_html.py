#!/usr/bin/env python3
"""
数据血缘全景图生成器

从 metadata.db 数据库动态查询资产统计，生成 ECharts Sankey 图的 HTML 文件。

用法:
    python3 generate_lineage_html.py [--output docs/data_lineage_sankey.html]
"""

import argparse
import os
from sqlalchemy import create_engine, text

# 默认数据库路径
DEFAULT_DB_PATH = os.path.join(os.path.dirname(__file__), 'metadata.db')
DEFAULT_OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'docs', 'data_lineage_sankey.html')


def fetch_lineage_stats(db_path: str) -> dict:
    """从数据库查询血缘统计数据"""
    engine = create_engine(f'sqlite:///{db_path}')
    
    with engine.connect() as conn:
        stats = {}
        
        # ===== Layer 1: 数据库层 =====
        stats['databases'] = conn.execute(text("SELECT COUNT(*) FROM databases")).scalar()
        stats['tables_total'] = conn.execute(text("SELECT COUNT(*) FROM tables")).scalar()
        stats['columns'] = conn.execute(text("SELECT COUNT(*) FROM db_columns")).scalar()
        
        # 孤立表（未被任何数据源引用）
        stats['tables_orphaned'] = conn.execute(text("""
            SELECT COUNT(*) FROM tables t
            LEFT JOIN table_to_datasource td ON t.id = td.table_id
            WHERE td.datasource_id IS NULL
        """)).scalar()
        stats['tables_connected'] = stats['tables_total'] - stats['tables_orphaned']
        
        # ===== Layer 2: 数据源层 =====
        stats['datasources_total'] = conn.execute(text("SELECT COUNT(*) FROM datasources")).scalar()
        stats['datasources_embedded'] = conn.execute(text("SELECT COUNT(*) FROM datasources WHERE is_embedded = 1")).scalar()
        stats['datasources_published'] = conn.execute(text("SELECT COUNT(*) FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL")).scalar()
        
        # 已发布但孤立的数据源（有表但未被工作簿使用）
        stats['datasources_pub_orphaned'] = conn.execute(text("""
            SELECT COUNT(*) FROM datasources d
            LEFT JOIN datasource_to_workbook dw ON d.id = dw.datasource_id
            WHERE dw.workbook_id IS NULL AND (d.is_embedded = 0 OR d.is_embedded IS NULL)
        """)).scalar()
        
        # 断链数据源（已发布但无表关联） - 仅统计非嵌入式
        stats['datasources_broken'] = conn.execute(text("""
            SELECT COUNT(*) FROM datasources d
            WHERE (d.is_embedded = 0 OR d.is_embedded IS NULL)
            AND d.id NOT IN (SELECT DISTINCT datasource_id FROM table_to_datasource)
        """)).scalar()
        
        # Custom SQL 数据源 (断链的子集)
        stats['datasources_custom_sql'] = conn.execute(text("""
            SELECT COUNT(*) FROM datasources d
            WHERE (d.is_embedded = 0 OR d.is_embedded IS NULL)
            AND d.contains_unsupported_custom_sql = 1
        """)).scalar()
        
        # 健康的已发布数据源 = 已发布 - 孤立 - 断链
        stats['datasources_pub_healthy'] = max(0, stats['datasources_published'] - stats['datasources_pub_orphaned'] - stats['datasources_broken'])
        
        # ===== Layer 3: 字段层 =====
        stats['fields_total'] = conn.execute(text("SELECT COUNT(*) FROM fields")).scalar()
        stats['fields_native'] = conn.execute(text("SELECT COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL")).scalar()
        stats['fields_calculated'] = conn.execute(text("SELECT COUNT(*) FROM fields WHERE is_calculated = 1")).scalar()
        
        # 字段使用统计
        stats['fields_native_used_in_calc'] = conn.execute(text("""
            SELECT COUNT(DISTINCT dependency_field_id) 
            FROM field_dependencies fd
            JOIN fields f ON fd.dependency_field_id = f.id
            WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
        """)).scalar() or 0
        
        stats['fields_native_used_in_view'] = conn.execute(text("""
            SELECT COUNT(DISTINCT f.id)
            FROM fields f
            JOIN field_to_view fv ON f.id = fv.field_id
            WHERE f.is_calculated = 0 OR f.is_calculated IS NULL
        """)).scalar() or 0
        
        stats['fields_native_unused'] = conn.execute(text("""
            SELECT COUNT(*) FROM fields f
            WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
            AND f.id NOT IN (SELECT field_id FROM field_to_view)
            AND f.id NOT IN (SELECT dependency_field_id FROM field_dependencies WHERE dependency_field_id IS NOT NULL)
        """)).scalar() or 0
        
        stats['fields_calc_used'] = conn.execute(text("""
            SELECT COUNT(DISTINCT f.id)
            FROM fields f
            JOIN field_to_view fv ON f.id = fv.field_id
            WHERE f.is_calculated = 1
        """)).scalar() or 0
        
        stats['fields_calc_unused'] = conn.execute(text("""
            SELECT COUNT(*) FROM fields f
            WHERE f.is_calculated = 1
            AND f.id NOT IN (SELECT field_id FROM field_to_view)
            AND f.id NOT IN (SELECT dependency_field_id FROM field_dependencies WHERE dependency_field_id IS NOT NULL)
        """)).scalar() or 0
        
        # ===== Layer 4: 展示层 =====
        stats['workbooks'] = conn.execute(text("SELECT COUNT(*) FROM workbooks")).scalar()
        stats['views'] = conn.execute(text("SELECT COUNT(*) FROM views")).scalar()
        
    return stats


def generate_html(stats: dict) -> str:
    """根据统计数据生成 HTML 内容"""
    
    # 格式化数字（添加千位分隔符）
    def fmt(n):
        return f"{n:,}"
    
    html_template = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Tableau 数据血缘全景图</title>
    <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ 
            min-height: 100vh;
            padding: 24px; 
            font-family: 'Inter', 'PingFang SC', -apple-system, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }}
        .container {{
            max-width: 1800px;
            margin: 0 auto;
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            padding: 32px;
            min-height: calc(100vh - 48px);
            display: flex;
            flex-direction: column;
        }}
        h1 {{ 
            text-align: center; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0 0 24px 0; 
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }}
        
        /* 统计卡片 - 玻璃拟态 */
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 16px;
            margin-bottom: 24px;
        }}
        .stat-card {{
            background: linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%);
            border: 1px solid rgba(102,126,234,0.2);
            padding: 20px;
            border-radius: 16px;
            text-align: center;
            transition: all 0.3s ease;
        }}
        .stat-card:hover {{
            transform: translateY(-4px);
            box-shadow: 0 12px 24px -8px rgba(102,126,234,0.3);
        }}
        .stat-val {{ 
            font-size: 32px; 
            font-weight: 700; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}
        .stat-label {{ 
            font-size: 13px; 
            color: #64748b; 
            margin-top: 6px;
            font-weight: 500;
        }}
        
        /* 图例 */
        .legend {{ 
            display: flex; 
            justify-content: center; 
            gap: 24px; 
            padding: 16px 24px; 
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-radius: 12px; 
            margin-bottom: 16px;
            border: 1px solid #e2e8f0;
        }}
        .legend-item {{ 
            display: flex; 
            align-items: center; 
            gap: 8px; 
            font-size: 13px; 
            color: #475569;
            font-weight: 500;
        }}
        .dot {{ 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }}
        
        /* 图表容器 - 固定高度 */
        #sankey-chart {{ 
            flex: 1;
            width: 100%; 
            min-height: 700px;
            height: 700px;
        }}

        /* 术语定义 */
        .glossary {{
            margin-top: 24px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
        }}
        .glossary h2 {{ 
            font-size: 18px; 
            margin-bottom: 16px; 
            color: #1e293b;
            font-weight: 600;
        }}
        .glossary-grid {{
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
        }}
        .glossary-card {{
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 16px;
            transition: all 0.2s ease;
        }}
        .glossary-card:hover {{
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }}
        .glossary-title {{
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            color: #334155;
        }}
        .glossary-desc {{
            font-size: 12px;
            color: #64748b;
            line-height: 1.5;
        }}
        .badge {{
            padding: 3px 8px;
            border-radius: 6px;
            color: white;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .badge-healthy {{ background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); }}
        .badge-embedded {{ background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); }}
        .badge-orphan {{ background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); }}
        .badge-broken {{ background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Tableau 数据资产血缘流向图</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-val">{fmt(stats['databases'])}</div>
                <div class="stat-label">数据库</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">{fmt(stats['datasources_total'])}</div>
                <div class="stat-label">数据源总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">{fmt(stats['fields_total'])}</div>
                <div class="stat-label">字段总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">{fmt(stats['workbooks'])}</div>
                <div class="stat-label">工作簿</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">{fmt(stats['views'])}</div>
                <div class="stat-label">视图</div>
            </div>
        </div>
        
        <div class="legend">
            <div class="legend-item"><div class="dot" style="background: #228be6;"></div>正常关联</div>
            <div class="legend-item"><div class="dot" style="background: #be4bdb;"></div>嵌入式</div>
            <div class="legend-item"><div class="dot" style="background: #fa5252;"></div>孤立/未使用</div>
            <div class="legend-item"><div class="dot" style="background: #fab005;"></div>断链 (Custom SQL)</div>
        </div>

        <div id="sankey-chart"></div>

        <div class="glossary">
            <h2>📊 资产定义说明</h2>
            <div class="glossary-grid">
                <div class="glossary-card">
                    <div class="glossary-title">
                        <span class="badge badge-healthy">正常</span> 已发布数据源
                    </div>
                    <div class="glossary-desc">
                        发布在 Tableau Server 上的独立数据源，已关联物理表并被工作簿使用。
                    </div>
                </div>
                <div class="glossary-card">
                    <div class="glossary-title">
                        <span class="badge badge-embedded">嵌入</span> 嵌入式数据源
                    </div>
                    <div class="glossary-desc">
                        定义在工作簿内部的数据源。关联表来自 Metadata API 血缘穿透功能。
                    </div>
                </div>
                <div class="glossary-card">
                    <div class="glossary-title">
                        <span class="badge badge-orphan">孤立</span> 孤立数据源
                    </div>
                    <div class="glossary-desc">
                        已发布且关联了表，但没有被任何工作簿使用，属于闲置资源。
                    </div>
                </div>
                <div class="glossary-card">
                    <div class="glossary-title">
                        <span class="badge badge-broken">断链</span> Custom SQL 数据源
                    </div>
                    <div class="glossary-desc">
                        包含自定义 SQL 的数据源，Metadata API 无法解析其上游物理表 (已知局限)。
                    </div>
                </div>
                <div class="glossary-card">
                    <div class="glossary-title">
                        <span class="badge badge-orphan">孤立</span> 僵尸字段
                    </div>
                    <div class="glossary-desc">
                        既没有参与计算，也没有被任何视图展示的冗余字段，会拖慢加载速度。
                    </div>
                </div>
                <div class="glossary-card">
                    <div class="glossary-title">
                        <span class="badge badge-orphan">孤立</span> 孤立表
                    </div>
                    <div class="glossary-desc">
                        已被采集到元数据中，但没有被任何 Tableau 数据源引用的数据库表。
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        var chartDom = document.getElementById('sankey-chart');
        var myChart = echarts.init(chartDom);
        var option;

        // Colors - 更现代的配色
        const C_HEALTHY = '#3b82f6';  // 蓝色
        const C_EMBEDDED = '#a855f7'; // 紫色
        const C_ORPHAN = '#f43f5e';   // 红色
        const C_BROKEN = '#f59e0b';   // 柑橙色

        const data = [
            // Layer 1: Databases
            {{ name: '数据库 ({fmt(stats["databases"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 0 }},
            
            // Layer 2: Tables
            {{ name: '已关联表 ({fmt(stats["tables_connected"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 1 }},
            {{ name: '孤立表 ({fmt(stats["tables_orphaned"])})', itemStyle: {{ color: C_ORPHAN }}, depth: 1 }},

            // Layer 3: Datasources
            {{ name: '正常发布数据源 ({fmt(stats["datasources_pub_healthy"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 2 }},
            {{ name: '嵌入式数据源 ({fmt(stats["datasources_embedded"])})', itemStyle: {{ color: C_EMBEDDED }}, depth: 2 }},
            {{ name: '孤立数据源 ({fmt(stats["datasources_pub_orphaned"])})', itemStyle: {{ color: C_ORPHAN }}, depth: 2 }},
            {{ name: 'Custom SQL 数据源 ({fmt(stats["datasources_broken"])})', itemStyle: {{ color: C_BROKEN }}, depth: 2 }},

            // Layer 4: Fields (Native)
            {{ name: '原生字段:用于计算 ({fmt(stats["fields_native_used_in_calc"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 3 }},
            {{ name: '原生字段:直接展示 ({fmt(stats["fields_native_used_in_view"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 3 }},
            {{ name: '原生僵尸字段 ({fmt(stats["fields_native_unused"])})', itemStyle: {{ color: C_ORPHAN }}, depth: 3 }},
            
            // Layer 5: Fields (Calculated)
            {{ name: '计算字段:被使用 ({fmt(stats["fields_calc_used"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 4 }},
            {{ name: '计算僵尸字段 ({fmt(stats["fields_calc_unused"])})', itemStyle: {{ color: C_ORPHAN }}, depth: 4 }},

            // Layer 6: Workbooks
            {{ name: '工作簿 ({fmt(stats["workbooks"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 5 }},

            // Layer 7: Views
            {{ name: '视图 ({fmt(stats["views"])})', itemStyle: {{ color: C_HEALTHY }}, depth: 6 }}
        ];

        const links = [
            // DB -> Tables
            {{ source: '数据库 ({fmt(stats["databases"])})', target: '已关联表 ({fmt(stats["tables_connected"])})', value: {stats["tables_connected"]} }},
            {{ source: '数据库 ({fmt(stats["databases"])})', target: '孤立表 ({fmt(stats["tables_orphaned"])})', value: {max(1, stats["tables_orphaned"])} }},

            // Tables -> Datasources
            {{ source: '已关联表 ({fmt(stats["tables_connected"])})', target: '正常发布数据源 ({fmt(stats["datasources_pub_healthy"])})', value: {stats["datasources_pub_healthy"]} }},
            {{ source: '已关联表 ({fmt(stats["tables_connected"])})', target: '嵌入式数据源 ({fmt(stats["datasources_embedded"])})', value: {stats["datasources_embedded"]} }},
            {{ source: '已关联表 ({fmt(stats["tables_connected"])})', target: '孤立数据源 ({fmt(stats["datasources_pub_orphaned"])})', value: {stats["datasources_pub_orphaned"]} }},
            
            // Custom SQL 没有上游表连线（独立节点）

            // Datasources -> Fields (简化：按比例分配)
            {{ source: '正常发布数据源 ({fmt(stats["datasources_pub_healthy"])})', target: '原生字段:用于计算 ({fmt(stats["fields_native_used_in_calc"])})', value: {max(1, stats["fields_native_used_in_calc"] // 3)} }},
            {{ source: '正常发布数据源 ({fmt(stats["datasources_pub_healthy"])})', target: '原生字段:直接展示 ({fmt(stats["fields_native_used_in_view"])})', value: {max(1, stats["fields_native_used_in_view"] // 3)} }},
            {{ source: '正常发布数据源 ({fmt(stats["datasources_pub_healthy"])})', target: '原生僵尸字段 ({fmt(stats["fields_native_unused"])})', value: {max(1, stats["fields_native_unused"] // 4)} }},
            
            {{ source: '嵌入式数据源 ({fmt(stats["datasources_embedded"])})', target: '原生字段:用于计算 ({fmt(stats["fields_native_used_in_calc"])})', value: {max(1, stats["fields_native_used_in_calc"] * 2 // 3)} }},
            {{ source: '嵌入式数据源 ({fmt(stats["datasources_embedded"])})', target: '原生字段:直接展示 ({fmt(stats["fields_native_used_in_view"])})', value: {max(1, stats["fields_native_used_in_view"] * 2 // 3)} }},
            {{ source: '嵌入式数据源 ({fmt(stats["datasources_embedded"])})', target: '原生僵尸字段 ({fmt(stats["fields_native_unused"])})', value: {max(1, stats["fields_native_unused"] * 3 // 4)} }},

            // Native -> Calculated
            {{ source: '原生字段:用于计算 ({fmt(stats["fields_native_used_in_calc"])})', target: '计算字段:被使用 ({fmt(stats["fields_calc_used"])})', value: {max(1, stats["fields_calc_used"])} }},
            {{ source: '原生字段:用于计算 ({fmt(stats["fields_native_used_in_calc"])})', target: '计算僵尸字段 ({fmt(stats["fields_calc_unused"])})', value: {max(1, stats["fields_calc_unused"] // 2)} }},

            // Fields -> Workbook
            {{ source: '原生字段:直接展示 ({fmt(stats["fields_native_used_in_view"])})', target: '工作簿 ({fmt(stats["workbooks"])})', value: {max(1, stats["fields_native_used_in_view"])} }},
            {{ source: '计算字段:被使用 ({fmt(stats["fields_calc_used"])})', target: '工作簿 ({fmt(stats["workbooks"])})', value: {max(1, stats["fields_calc_used"])} }},

            // Workbook -> Views
            {{ source: '工作簿 ({fmt(stats["workbooks"])})', target: '视图 ({fmt(stats["views"])})', value: {stats["views"]} }}
        ];

        option = {{
            tooltip: {{
                trigger: 'item',
                triggerOn: 'mousemove',
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: [12, 16],
                textStyle: {{
                    color: '#334155',
                    fontSize: 13
                }},
                extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 8px;'
            }},
            series: [
                {{
                    type: 'sankey',
                    data: data,
                    links: links,
                    top: 40,
                    bottom: 40,
                    left: 60,
                    right: 200,
                    nodeWidth: 20,
                    nodeGap: 14,
                    emphasis: {{
                        focus: 'adjacency',
                        itemStyle: {{
                            shadowBlur: 20,
                            shadowColor: 'rgba(0,0,0,0.3)'
                        }}
                    }},
                    nodeAlign: 'left',
                    layoutIterations: 64,
                    lineStyle: {{
                        color: 'gradient',
                        curveness: 0.5,
                        opacity: 0.4
                    }},
                    label: {{
                        position: 'right',
                        color: '#334155',
                        fontFamily: 'Inter, Arial, sans-serif',
                        fontSize: 12,
                        fontWeight: 500,
                        padding: [0, 0, 0, 8],
                        formatter: function(params) {{
                            return params.name;
                        }}
                    }},
                    itemStyle: {{
                        borderRadius: 4,
                        borderWidth: 0
                    }}
                }}
            ]
        }};

        myChart.setOption(option);
        
        window.addEventListener('resize', function() {{
            myChart.resize();
        }});
    </script>
</body>
</html>'''
    
    return html_template


def main():
    parser = argparse.ArgumentParser(description='生成数据血缘全景图 HTML')
    parser.add_argument('--db', default=DEFAULT_DB_PATH, help='SQLite 数据库路径')
    parser.add_argument('--output', '-o', default=DEFAULT_OUTPUT_PATH, help='输出 HTML 文件路径')
    args = parser.parse_args()
    
    print(f"📊 数据血缘全景图生成器")
    print(f"   数据库: {args.db}")
    print(f"   输出文件: {args.output}")
    
    # 1. 查询统计数据
    print("\n⏳ 正在查询数据库...")
    stats = fetch_lineage_stats(args.db)
    
    print(f"   ✅ 统计完成:")
    print(f"      - 数据库: {stats['databases']}")
    print(f"      - 数据表: {stats['tables_total']} (已关联: {stats['tables_connected']}, 孤立: {stats['tables_orphaned']})")
    print(f"      - 数据源: {stats['datasources_total']} (发布: {stats['datasources_published']}, 嵌入: {stats['datasources_embedded']})")
    print(f"      - 字段: {stats['fields_total']} (原生: {stats['fields_native']}, 计算: {stats['fields_calculated']})")
    print(f"      - 工作簿: {stats['workbooks']}, 视图: {stats['views']}")
    
    # 2. 生成 HTML
    print("\n⏳ 正在生成 HTML...")
    html_content = generate_html(stats)
    
    # 3. 写入文件
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"\n✅ 血缘图已生成: {args.output}")
    print(f"   👉 在浏览器中打开该文件查看交互式图表")


if __name__ == '__main__':
    main()
