"""
工作簿接口路由模块
包含工作簿列表、详情和治理分析接口
"""
from flask import jsonify, request, g
from sqlalchemy import text, bindparam, func
from sqlalchemy.orm import selectinload
from . import api_bp
from .utils import build_tableau_url
from ..models import Workbook, Field, View

# ==================== 工作簿接口 ====================

# -------------------- 工作簿治理分析专用 API --------------------

@api_bp.route('/workbooks/governance/empty')
def get_workbooks_empty():
    """获取无视图工作簿分析（基于全量数据）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 查询视图数为0的工作簿
    sql = """
        SELECT 
            w.id, w.name, w.project_name, w.owner
        FROM workbooks w
        LEFT JOIN views v ON w.id = v.workbook_id
        GROUP BY w.id
        HAVING COUNT(v.id) = 0
        ORDER BY w.name
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = [{
        'id': row.id,
        'name': row.name,
        'project_name': row.project_name or '-',
        'owner': row.owner or '-'
    } for row in rows]
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/workbooks/governance/single-source')
def get_workbooks_single_source():
    """获取单源依赖工作簿分析（基于全量数据）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 查询只依赖一个数据源的工作簿
    sql = """
        SELECT 
            w.id, w.name, w.project_name, w.owner,
            COUNT(DISTINCT dw.datasource_id) as ds_count,
            MIN(d.name) as datasource_name,
            (SELECT COUNT(*) FROM views v WHERE v.workbook_id = w.id) as view_count
        FROM workbooks w
        LEFT JOIN datasource_to_workbook dw ON w.id = dw.workbook_id
        LEFT JOIN datasources d ON dw.datasource_id = d.id
        GROUP BY w.id
        HAVING ds_count = 1
        ORDER BY w.name
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = [{
        'id': row.id,
        'name': row.name,
        'project_name': row.project_name or '-',
        'owner': row.owner or '-',
        'datasource_name': row.datasource_name or '-',
        'view_count': row.view_count or 0
    } for row in rows]
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


# -------------------- 工作簿列表 API --------------------

@api_bp.route('/workbooks')
def get_workbooks():
    """获取工作簿列表 - 增加动态统计"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', 'name') # 默认按名称排序
    order = request.args.get('order', 'asc')
    
    query = session.query(Workbook)
    if search: query = query.filter(Workbook.name.ilike(f'%{search}%'))
    
    # SQL 级别排序
    if sort == 'viewCount':
        if order == 'desc':
            query = query.order_by(Workbook.view_count.desc())
        else:
            query = query.order_by(Workbook.view_count.asc())
    elif sort == 'name':
        if order == 'desc':
            query = query.order_by(Workbook.name.desc())
        else:
            query = query.order_by(Workbook.name.asc())
    else:
        # 默认排序
        query = query.order_by(Workbook.name.asc())

    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    offset = (page - 1) * page_size
    
    total_count = query.count()
    workbooks = query.limit(page_size).offset(offset).all()
    
    results = []
    for wb in workbooks:
        data = wb.to_dict()
        data['upstream_datasources'] = [ds.name for ds in wb.datasources]
        results.append(data)
        
    # 移除之前的内存排序逻辑 (已改为 SQL 排序)

    # Facets 统计
    from sqlalchemy import text
    facets = {}
    
    # project_name facet
    project_stats = session.execute(text("""
        SELECT project_name, COUNT(*) as cnt
        FROM workbooks
        WHERE project_name IS NOT NULL AND project_name != ''
        GROUP BY project_name
        ORDER BY cnt DESC
        LIMIT 20
    """)).fetchall()
    facets['project_name'] = {row[0]: row[1] for row in project_stats if row[0]}
        
    return jsonify({
        'items': results,
        'total': total_count,
        'page': page,
        'page_size': page_size,
        'facets': facets
    })


@api_bp.route('/workbooks/<wb_id>')
def get_workbook_detail(wb_id):
    """获取工作簿详情 - 完整上下文"""
    session = g.db_session
    
    from sqlalchemy.orm import selectinload
    
    # 预加载 views.fields 和 datasources，避免 N+1
    wb = session.query(Workbook).options(
        selectinload(Workbook.views).selectinload(View.fields),
        selectinload(Workbook.datasources)
    ).filter(Workbook.id == wb_id).first()
    
    if not wb:
        return jsonify({'error': 'Not found'}), 404
    
    data = wb.to_dict()
    
    # 关联视图列表
    views_data = []
    for v in wb.views:
        views_data.append({
            'id': v.id,
            'name': v.name,
            'view_type': v.view_type,
            'path': v.path,
            'field_count': len(v.fields) if v.fields else 0
        })
    data['views'] = views_data
    
    # 上游数据源列表
    datasources_data = []
    seen_ds_ids = set()
    for ds in wb.datasources:
        if ds.id not in seen_ds_ids:
            datasources_data.append({
                'id': ds.id,
                'name': ds.name,
                'project_name': ds.project_name,
                'owner': ds.owner,
                'is_certified': ds.is_certified,
                'has_extract': ds.has_extract,
                'is_embedded': ds.is_embedded
            })
            seen_ds_ids.add(ds.id)
    data['datasources'] = datasources_data
    
    # 上游数据表列表 (通过 Published Datasource + Direct Fields)
    tables_data = []
    seen_table_ids = set()
    
    # 1. 通过 Published Datasource 关联
    for ds in wb.datasources:
        for tbl in ds.tables:
            if tbl.id not in seen_table_ids:
                tables_data.append({
                    'id': tbl.id,
                    'name': tbl.name,
                    'schema': tbl.schema,
                    'connection_type': 'published',
                    'is_embedded': tbl.is_embedded
                })
                seen_table_ids.add(tbl.id)
                
    # 2. 通过 Direct Field 关联 (Embedded Connection)
    # 查找属于该工作簿的所有字段，如果有上游列，则关联到表
    direct_fields = session.query(Field).filter(Field.workbook_id == wb.id).filter(Field.upstream_column_id.isnot(None)).all()
    
    for f in direct_fields:
        if f.upstream_column and f.upstream_column.table:
            tbl = f.upstream_column.table
            if tbl.id not in seen_table_ids:
                tables_data.append({
                    'id': tbl.id,
                    'name': tbl.name,
                    'schema': tbl.schema,
                    'connection_type': 'embedded',
                    'is_embedded': tbl.is_embedded
                })
                seen_table_ids.add(tbl.id)
                
    data['tables'] = tables_data
    data['datasources'] = datasources_data
    
    # 收集所有视图中使用的字段
    fields_set = {}
    metrics_set = {}
    for v in wb.views:
        for f in v.fields:
            if f.id not in fields_set:
                f_data = {
                    'id': f.id,
                    'name': f.name,
                    'data_type': f.data_type,
                    'role': f.role,
                    'is_calculated': f.is_calculated
                }
                if f.is_calculated:
                    metrics_set[f.id] = f_data
                else:
                    fields_set[f.id] = f_data
    
    data['used_fields'] = list(fields_set.values())
    data['used_metrics'] = list(metrics_set.values())
    
    # 统计直接关联的所有字段 (fields.workbook_id = wb.id)
    from sqlalchemy import func
    total_field_count = session.query(func.count(Field.id)).filter(
        Field.workbook_id == wb.id, 
        Field.is_calculated == 0
    ).scalar() or 0
    total_metric_count = session.query(func.count(Field.id)).filter(
        Field.workbook_id == wb.id, 
        Field.is_calculated == 1
    ).scalar() or 0
    
    # 统计信息
    data['stats'] = {
        'view_count': len(views_data),
        'datasource_count': len(datasources_data),
        'table_count': len(tables_data),
        'field_count': len(fields_set),  # 被视图使用的字段
        'metric_count': len(metrics_set),  # 被视图使用的指标
        'total_field_count': total_field_count,  # 直接关联的所有字段
        'total_metric_count': total_metric_count  # 直接关联的所有指标
    }
    
    # 构建 Tableau Server 在线查看链接
    # 对于工作簿，使用第一个视图的路径来构建可访问的 URL
    first_view_path = None
    if wb.views:
        for v in wb.views:
            if v.path:
                first_view_path = v.path
                break
    data['tableau_url'] = build_tableau_url('workbook', path=first_view_path, uri=wb.uri, luid=wb.luid)
    
    return jsonify(data)


# -------------------- 工作簿子资源路由 --------------------

@api_bp.route('/workbooks/<wb_id>/views')
def get_workbook_views(wb_id):
    """获取工作簿包含的视图列表"""
    session = g.db_session
    wb = session.query(Workbook).filter(Workbook.id == wb_id).first()
    if not wb:
        return jsonify({'error': 'Not found'}), 404

    views_data = [{
        'id': v.id, 'name': v.name, 'view_type': v.view_type, 'path': v.path
    } for v in wb.views]
    return jsonify({'items': views_data, 'total': len(views_data)})


@api_bp.route('/workbooks/<wb_id>/datasources')
def get_workbook_datasources(wb_id):
    """获取工作簿使用的数据源列表"""
    session = g.db_session
    wb = session.query(Workbook).filter(Workbook.id == wb_id).first()
    if not wb:
        return jsonify({'error': 'Not found'}), 404

    ds_data = [{
        'id': ds.id, 'name': ds.name, 'project_name': ds.project_name, 'owner': ds.owner
    } for ds in wb.datasources]
    return jsonify({'items': ds_data, 'total': len(ds_data)})


@api_bp.route('/workbooks/<wb_id>/tables')
def get_workbook_tables(wb_id):
    """获取工作簿关联的数据表列表"""
    session = g.db_session
    wb = session.query(Workbook).filter(Workbook.id == wb_id).first()
    if not wb:
        return jsonify({'error': 'Not found'}), 404

    seen_table_ids = set()
    tables_data = []
    for ds in wb.datasources:
        for tbl in ds.tables:
            if tbl.id not in seen_table_ids:
                tables_data.append({
                    'id': tbl.id, 'name': tbl.name, 'schema': tbl.schema
                })
                seen_table_ids.add(tbl.id)
    return jsonify({'items': tables_data, 'total': len(tables_data)})


@api_bp.route('/workbooks/<wb_id>/fields')
def get_workbook_fields(wb_id):
    """获取工作簿使用的字段列表"""
    session = g.db_session
    wb = session.query(Workbook).options(
        selectinload(Workbook.views).selectinload(View.fields)
    ).filter(Workbook.id == wb_id).first()
    if not wb:
        return jsonify({'error': 'Not found'}), 404

    fields_set = {}
    for v in wb.views:
        for f in v.fields:
            if f.id not in fields_set and not f.is_calculated:
                fields_set[f.id] = {'id': f.id, 'name': f.name, 'role': f.role}
    return jsonify({'items': list(fields_set.values()), 'total': len(fields_set)})


@api_bp.route('/workbooks/<wb_id>/metrics')
def get_workbook_metrics(wb_id):
    """获取工作簿使用的指标列表"""
    session = g.db_session
    wb = session.query(Workbook).options(
        selectinload(Workbook.views).selectinload(View.fields)
    ).filter(Workbook.id == wb_id).first()
    if not wb:
        return jsonify({'error': 'Not found'}), 404

    metrics_set = {}
    for v in wb.views:
        for f in v.fields:
            if f.id not in metrics_set and f.is_calculated:
                metrics_set[f.id] = {'id': f.id, 'name': f.name, 'formula': f.formula}
    return jsonify({'items': list(metrics_set.values()), 'total': len(metrics_set)})
