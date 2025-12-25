"""
血缘关系接口路由模块
包含血缘查询和 Mermaid 图形化接口
"""
import re
from flask import jsonify, request, g
from sqlalchemy import text
from . import api_bp
from .utils import build_tableau_url
from ..models import Field, CalculatedField, Datasource, Workbook, View, DBTable, DBColumn, FieldDependency

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
    
    return jsonify({'upstream': upstream, 'downstream': downstream})


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


@api_bp.route('/governance/merge', methods=['POST'])
def merge_metrics(): return jsonify({'error': '只读模式，治理操作已禁用'}), 405

@api_bp.route('/governance/deprecate', methods=['POST'])
def deprecate_metrics(): return jsonify({'error': '只读模式，治理操作已禁用'}), 405

@api_bp.route('/governance/cleanup', methods=['POST'])
def cleanup_fields(): return jsonify({'error': '只读模式，治理操作已禁用'}), 405


