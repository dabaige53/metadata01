"""
血缘关系接口路由模块
包含血缘查询和 Mermaid 图形化接口
"""
import re
from flask import jsonify, request, g
from sqlalchemy import text
from . import api_bp
from .utils import build_tableau_url
from ..models import Field, CalculatedField, Datasource, Workbook, View, DBTable, DBColumn, FieldDependency, Database

# ==================== 血缘关系接口 ====================

@api_bp.route('/lineage/<item_type>/<item_id>')
def get_lineage(item_type, item_id):
    """获取血缘关系 - 增强版（含上游列追溯）"""
    session = g.db_session
    upstream = []
    downstream = []
    
    if item_type == 'field':
        field = session.query(Field).filter(Field.id == item_id).first()
        if field:
            # 上游：原始数据库列（最上游）
            if field.upstream_column:
                upstream.append({
                    'type': 'column', 
                    'id': field.upstream_column.id,
                    'name': field.upstream_column.name,
                    'remote_type': field.upstream_column.remote_type,
                    'table_name': field.upstream_column.table.name if field.upstream_column.table else None
                })
            
            # 上游：所属表
            if field.table:
                upstream.append({
                    'type': 'table', 
                    'id': field.table.id,
                    'name': field.table.name, 
                    'schema': field.table.schema,
                    'database_name': field.table.database.name if field.table.database else None
                })
            
            # 下游：数据源
            if field.datasource:
                downstream.append({
                    'type': 'datasource', 
                    'id': field.datasource.id,
                    'name': field.datasource.name
                })
            
            # 下游：视图
            for view in field.views:
                downstream.append({
                    'type': 'view', 
                    'id': view.id,
                    'name': view.name,
                    'workbook_name': view.workbook.name if view.workbook else None
                })
    
    elif item_type == 'table':
        table = session.query(DBTable).filter(DBTable.id == item_id).first()
        if table:
            if table.database:
                upstream.append({'type': 'database', 'name': table.database.name})
            for ds in table.datasources:
                downstream.append({'type': 'datasource', 'name': ds.name})
    
    elif item_type == 'datasource':
        ds = session.query(Datasource).filter(Datasource.id == item_id).first()
        if ds:
            for table in ds.tables:
                upstream.append({'type': 'table', 'name': table.name, 'schema': table.schema})
            for wb in ds.workbooks:
                downstream.append({'type': 'workbook', 'name': wb.name})
    
    return jsonify({
        'upstream': upstream, 
        'downstream': downstream,
        'labels': {
            'lineage_source': field.lineage_source if item_type == 'field' and field else None,
            'penetration_status': field.penetration_status if item_type == 'field' and field else None
        }
    })


# ==================== 全局搜索接口 ====================

@api_bp.route('/search')
def global_search():
    """全局跨资产类型搜索"""
    session = g.db_session
    q = request.args.get('q', '').strip()
    limit = request.args.get('limit', 20, type=int)
    
    if not q or len(q) < 2:
        return jsonify({'error': '搜索关键词至少需要2个字符'}), 400
    
    search_pattern = f'%{q}%'
    results = {
        'fields': [],
        'tables': [],
        'datasources': [],
        'workbooks': [],
        'metrics': []
    }
    
    # 搜索字段
    fields = session.query(Field).filter(
        (Field.name.ilike(search_pattern)) | 
        (Field.description.ilike(search_pattern))
    ).limit(limit).all()
    results['fields'] = [{
        'id': f.id,
        'name': f.name,
        'type': 'field',
        'description': f.description or '',
        'source': f.datasource.name if f.datasource else (f.table.name if f.table else '-')
    } for f in fields]
    
    # 搜索表
    tables = session.query(DBTable).filter(
        DBTable.name.ilike(search_pattern)
    ).limit(limit).all()
    results['tables'] = [{
        'id': t.id,
        'name': t.name,
        'type': 'table',
        'schema': t.schema or '',
        'database': t.database.name if t.database else '-'
    } for t in tables]
    
    # 搜索数据源
    datasources = session.query(Datasource).filter(
        Datasource.name.ilike(search_pattern)
    ).limit(limit).all()
    results['datasources'] = [{
        'id': ds.id,
        'name': ds.name,
        'type': 'datasource',
        'project': ds.project_name or '',
        'owner': ds.owner or ''
    } for ds in datasources]
    
    # 搜索工作簿
    workbooks = session.query(Workbook).filter(
        Workbook.name.ilike(search_pattern)
    ).limit(limit).all()
    results['workbooks'] = [{
        'id': wb.id,
        'name': wb.name,
        'type': 'workbook',
        'project': wb.project_name or '',
        'owner': wb.owner or ''
    } for wb in workbooks]
    
    # 搜索指标（计算字段）
    metrics = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.id
    ).filter(
        (Field.name.ilike(search_pattern)) |
        (CalculatedField.formula.ilike(search_pattern))
    ).limit(limit).all()
    results['metrics'] = [{
        'id': f.id,
        'name': f.name,
        'type': 'metric',
        'formula': c.formula[:50] + '...' if c.formula and len(c.formula) > 50 else (c.formula or ''),
        'datasource': f.datasource.name if f.datasource else '-'
    } for f, c in metrics]
    
    # 总数统计
    total = sum(len(v) for v in results.values())
    
    return jsonify({
        'query': q,
        'total': total,
        'results': results
    })


# ==================== 增强血缘接口（支持 Mermaid 图形化）====================

@api_bp.route('/lineage/graph/<item_type>/<item_id>')
def get_lineage_graph(item_type, item_id):
    """获取血缘关系 - 返回 Mermaid 图形化格式"""
    session = g.db_session
    nodes = []
    edges = []
    
    def add_node(id, name, type, is_center=False):
        style = 'center' if is_center else type
        nodes.append({'id': id, 'name': name, 'type': type, 'style': style})
    
    def add_edge(from_id, to_id, label=''):
        edges.append({'from': from_id, 'to': to_id, 'label': label})
    
    if item_type == 'field':
        field = session.query(Field).filter(Field.id == item_id).first()
        if field:
            add_node(field.id, field.name, 'field', is_center=True)
            
            # 上游：表
            if field.table:
                add_node(field.table.id, field.table.name, 'table')
                add_edge(field.table.id, field.id, '包含')
            
            # 上游：数据源
            if field.datasource:
                add_node(field.datasource.id, field.datasource.name, 'datasource')
                add_edge(field.datasource.id, field.id, '定义')
            
            # 下游：视图
            for view in field.views[:10]:
                add_node(view.id, view.name, 'view')
                add_edge(field.id, view.id, '使用于')
                if view.workbook:
                    add_node(view.workbook_id, view.workbook.name, 'workbook')
                    add_edge(view.id, view.workbook_id, '属于')
    
    elif item_type == 'metric':
        result = session.query(Field, CalculatedField).join(
            CalculatedField, Field.id == CalculatedField.id
        ).filter(Field.id == item_id).first()
        
        if result:
            field, calc = result
            add_node(field.id, field.name, 'metric', is_center=True)
            
            # 上游：数据源
            if field.datasource:
                add_node(field.datasource.id, field.datasource.name, 'datasource')
                add_edge(field.datasource.id, field.id, '定义')
            
            # 上游：依赖字段
            if calc.formula and isinstance(calc.formula, str):
                refs = re.findall(r'\[(.*?)\]', calc.formula)
                for ref_name in list(set(refs))[:5]:
                    dep_field = session.query(Field).filter(Field.name == ref_name).first()
                    if dep_field:
                        add_node(dep_field.id, dep_field.name, 'field')
                        add_edge(dep_field.id, field.id, '依赖')
            
            # 下游：视图
            for view in field.views[:5]:
                add_node(view.id, view.name, 'view')
                add_edge(field.id, view.id, '使用于')
    elif item_type == 'datasource':
        ds = session.query(Datasource).filter(Datasource.id == item_id).first()
        if ds:
            add_node(ds.id, ds.name, 'datasource', is_center=True)
            
            # 上游：表
            for table in ds.tables[:10]:
                add_node(table.id, table.name, 'table')
                add_edge(table.id, ds.id, '来源')
            
            # 下游：工作簿
            for wb in ds.workbooks[:10]:
                add_node(wb.id, wb.name, 'workbook')
                add_edge(ds.id, wb.id, '使用')

    elif item_type == 'table':
        table = session.query(DBTable).filter(DBTable.id == item_id).first()
        if table:
            add_node(table.id, table.name, 'table', is_center=True)
            
            # Upstream: Database
            if table.database:
                add_node(table.database.id, table.database.name, 'database')
                add_edge(table.database.id, table.id, '存储于')

            # Downstream: Datasources
            for ds in table.datasources:
                add_node(ds.id, ds.name, 'datasource')
                add_edge(table.id, ds.id, '提供数据')

            # Downstream: Fields (Direct)
            for f in table.fields[:10]:
                add_node(f.id, f.name, 'field')
                add_edge(table.id, f.id, '包含')

    elif item_type == 'workbook':
        wb = session.query(Workbook).filter(Workbook.id == item_id).first()
        if wb:
            add_node(wb.id, wb.name, 'workbook', is_center=True)
            
            # Upstream: Datasources
            for ds in wb.datasources:
                add_node(ds.id, ds.name, 'datasource')
                add_edge(ds.id, wb.id, '支持')

            # Downstream: Views
            for v in wb.views:
                add_node(v.id, v.name, 'view')
                add_edge(wb.id, v.id, '包含')

    elif item_type == 'view':
        view = session.query(View).filter(View.id == item_id).first()
        if view:
            add_node(view.id, view.name, 'view', is_center=True)
            
            # Upstream: Workbook
            if view.workbook:
                add_node(view.workbook.id, view.workbook.name, 'workbook')
                add_edge(view.workbook.id, view.id, '包含')
            
            # Upstream: Fields/Metrics usage
            # Distinct data sources via fields
            ds_seen = set()
            for f in view.fields:
                if f.datasource and f.datasource.id not in ds_seen:
                    ds_seen.add(f.datasource.id)
                    add_node(f.datasource.id, f.datasource.name, 'datasource')
                    add_edge(f.datasource.id, view.id, '数据来源')
    
    elif item_type == 'database':
        db = session.query(Database).filter(Database.id == item_id).first()
        if db:
            add_node(db.id, db.name, 'database', is_center=True)
            # Downstream: Tables
            for t in db.tables[:15]:
                add_node(t.id, t.name, 'table')
                add_edge(db.id, t.id, '包含')
    
    # 生成 Mermaid 代码
    mermaid_code = "graph LR\n"
    
    # 样式定义
    style_map = {
        'field': '([{}])',
        'metric': '{{{}}}',
        'table': '[{}]',
        'datasource': '[({})]',
        'workbook': '(({}))' ,
        'view': '>{}]'
    }
    
    node_ids = set()
    for node in nodes:
        nid = node['id'][:8]  # 简化 ID
        if nid not in node_ids:
            node_ids.add(nid)
            shape = style_map.get(node['type'], '[{}]')
            mermaid_code += f"    {nid}{shape.format(node['name'][:20])}\n"
    
    for edge in edges:
        from_id = edge['from'][:8]
        to_id = edge['to'][:8]
        label = edge['label']
        mermaid_code += f"    {from_id} -->|{label}| {to_id}\n"
    
    return jsonify({
        'nodes': nodes,
        'edges': edges,
        'mermaid': mermaid_code
    })


@api_bp.route('/lineage/sankey')
def get_lineage_sankey():
    """获取全局血缘桑基图数据 - 按 data_lineage_sankey.html 结构展示（不含僵尸字段）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 获取完整的统计数据
    stats_data = session.execute(text("""
        SELECT
            -- 数据库
            (SELECT COUNT(*) FROM databases) as db_count,
            
            -- 表统计: 非嵌入式、嵌入式、孤立
            (SELECT COUNT(*) FROM tables WHERE is_embedded = 0 OR is_embedded IS NULL) as table_normal,
            (SELECT COUNT(*) FROM tables WHERE is_embedded = 1) as table_embedded,
            (SELECT COUNT(*) FROM tables t 
             LEFT JOIN table_to_datasource td ON t.id = td.table_id 
             WHERE td.datasource_id IS NULL) as table_orphan,
            
            -- 已发布数据源: 正常、孤立、CustomSQL
            (SELECT COUNT(*) FROM datasources d
             WHERE (d.is_embedded = 0 OR d.is_embedded IS NULL)
             AND EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = d.id)) as ds_normal,
            (SELECT COUNT(*) FROM datasources d 
             WHERE (d.is_embedded = 0 OR d.is_embedded IS NULL)
             AND NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = d.id)) as ds_orphan,
            (SELECT COUNT(*) FROM datasources WHERE contains_unsupported_custom_sql = 1) as ds_custom_sql,
            
            -- 嵌入式数据源: 引用已发布、直连物理表
            (SELECT COUNT(*) FROM datasources WHERE is_embedded = 1 AND source_published_datasource_id IS NOT NULL AND source_published_datasource_id != '') as ds_embed_ref,
            (SELECT COUNT(*) FROM datasources WHERE is_embedded = 1 AND (source_published_datasource_id IS NULL OR source_published_datasource_id = '')) as ds_embed_direct,
            
            -- 原生字段(总数)
            (SELECT COUNT(*) FROM regular_fields) as field_total,
            
            -- 计算字段(总数)
            (SELECT COUNT(*) FROM calculated_fields) as calc_total,
            
            -- 工作簿和视图
            (SELECT COUNT(*) FROM workbooks) as workbook_count,
            (SELECT COUNT(*) FROM views) as view_count
    """)).fetchone()
    
    # 解构数据
    db_count = stats_data[0] or 0
    table_normal = stats_data[1] or 0
    table_embedded = stats_data[2] or 0
    table_orphan = stats_data[3] or 0
    ds_normal = stats_data[4] or 0
    ds_orphan = stats_data[5] or 0
    ds_custom_sql = stats_data[6] or 0
    ds_embed_ref = stats_data[7] or 0
    ds_embed_direct = stats_data[8] or 0
    field_total = stats_data[9] or 0
    calc_total = stats_data[10] or 0
    workbook_count = stats_data[11] or 0
    view_count = stats_data[12] or 0
    
    # 节点定义 - 完全按照 data_lineage_sankey.html 结构（不含僵尸字段）
    nodes = [
        # Layer 0: 数据库
        {'name': f'数据库 ({db_count})', 'depth': 0, 'itemStyle': {'color': '#3b82f6'}},
        
        # Layer 1: 数据表
        {'name': f'非嵌入式表 ({table_normal})', 'depth': 1, 'itemStyle': {'color': '#3b82f6'}},
        {'name': f'嵌入式表 ({table_embedded})', 'depth': 1, 'itemStyle': {'color': '#a855f7'}},
        {'name': f'孤立表 ({table_orphan})', 'depth': 1, 'itemStyle': {'color': '#f43f5e'}},
        
        # Layer 2: 已发布数据源
        {'name': f'正常发布数据源 ({ds_normal})', 'depth': 2, 'itemStyle': {'color': '#3b82f6'}},
        {'name': f'孤立发布数据源 ({ds_orphan})', 'depth': 2, 'itemStyle': {'color': '#f43f5e'}},
        {'name': f'CustomSQL数据源 ({ds_custom_sql})', 'depth': 2, 'itemStyle': {'color': '#f59e0b'}},
        
        # Layer 3: 嵌入式数据源
        {'name': f'嵌入式:引用已发布 ({ds_embed_ref})', 'depth': 3, 'itemStyle': {'color': '#a855f7'}},
        {'name': f'嵌入式:直连物理表 ({ds_embed_direct})', 'depth': 3, 'itemStyle': {'color': '#a855f7'}},
        
        # Layer 4: 原生字段
        {'name': f'原生字段 ({field_total:,})', 'depth': 4, 'itemStyle': {'color': '#3b82f6'}},
        
        # Layer 5: 计算字段
        {'name': f'计算字段 ({calc_total:,})', 'depth': 5, 'itemStyle': {'color': '#3b82f6'}},
        
        # Layer 6: 工作簿
        {'name': f'工作簿 ({workbook_count})', 'depth': 6, 'itemStyle': {'color': '#3b82f6'}},
        
        # Layer 7: 视图
        {'name': f'视图 ({view_count:,})', 'depth': 7, 'itemStyle': {'color': '#3b82f6'}}
    ]
    
    # 链接定义
    links = [
        # Layer 0→1: 数据库 → 表
        {'source': 0, 'target': 1, 'value': max(1, table_normal)},
        {'source': 0, 'target': 2, 'value': max(1, table_embedded)},
        {'source': 0, 'target': 3, 'value': max(1, table_orphan)},
        
        # Layer 1→2: 非嵌入式表 → 已发布数据源
        {'source': 1, 'target': 4, 'value': max(1, ds_normal)},
        {'source': 1, 'target': 5, 'value': max(1, ds_orphan)},
        
        # Layer 1→3: 嵌入式表 → 嵌入式数据源(直连型)
        {'source': 2, 'target': 8, 'value': max(1, ds_embed_direct)},
        
        # Layer 2→3: 已发布数据源 → 嵌入式数据源(引用型)
        {'source': 4, 'target': 7, 'value': max(1, ds_embed_ref)},
        
        # Layer 2→4 & 3→4: 数据源 → 原生字段
        {'source': 4, 'target': 9, 'value': max(1, field_total // 3)},
        {'source': 7, 'target': 9, 'value': max(1, field_total // 3)},
        {'source': 8, 'target': 9, 'value': max(1, field_total // 3)},
        
        # Layer 4→5: 原生字段 → 计算字段
        {'source': 9, 'target': 10, 'value': max(1, calc_total)},
        
        # Layer 4→6 & 5→6: 字段 → 工作簿
        {'source': 9, 'target': 11, 'value': max(1, field_total // 2)},
        {'source': 10, 'target': 11, 'value': max(1, calc_total)},
        
        # Layer 6→7: 工作簿 → 视图
        {'source': 11, 'target': 12, 'value': max(1, view_count)}
    ]
    
    # 统计信息
    stats = {
        'databases': db_count,
        'tables': {
            'total': table_normal + table_embedded + table_orphan,
            'normal': table_normal,
            'embedded': table_embedded,
            'orphan': table_orphan
        },
        'datasources': {
            'total': ds_normal + ds_orphan + ds_custom_sql + ds_embed_ref + ds_embed_direct,
            'normal': ds_normal,
            'orphan': ds_orphan,
            'custom_sql': ds_custom_sql,
            'embedded_ref': ds_embed_ref,
            'embedded_direct': ds_embed_direct
        },
        'fields': {
            'total': field_total
        },
        'calculated_fields': {
            'total': calc_total
        },
        'workbooks': workbook_count,
        'views': view_count
    }
    
    return jsonify({
        'nodes': nodes,
        'links': links,
        'stats': stats
    })


@api_bp.route('/governance/merge', methods=['POST'])
def merge_metrics(): return jsonify({'error': '只读模式，治理操作已禁用'}), 405

@api_bp.route('/governance/deprecate', methods=['POST'])
def deprecate_metrics(): return jsonify({'error': '只读模式，治理操作已禁用'}), 405

@api_bp.route('/governance/cleanup', methods=['POST'])
def cleanup_fields(): return jsonify({'error': '只读模式，治理操作已禁用'}), 405


