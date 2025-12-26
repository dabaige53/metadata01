"""
数据源接口路由模块
包含数据源列表和详情接口
"""
from flask import jsonify, request, g
from sqlalchemy import text, bindparam
from sqlalchemy.orm import selectinload
from . import api_bp
from .utils import build_tableau_url
from ..models import Datasource, Field, View

@api_bp.route('/datasources')
def get_datasources():
    """获取数据源列表 - 性能优化版"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'asc')
    is_embedded = request.args.get('is_embedded', None)  # 新增: 嵌入式筛选
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy import text
    
    # 使用 selectinload 预加载关联数据
    query = session.query(Datasource).options(
        selectinload(Datasource.tables),
        selectinload(Datasource.fields),
        selectinload(Datasource.workbooks)
    )
    
    # 嵌入式筛选
    if is_embedded is not None:
        is_emb = is_embedded == '1' or is_embedded.lower() == 'true'
        query = query.filter(Datasource.is_embedded == is_emb)
    
    if search: 
        query = query.filter(Datasource.name.ilike(f'%{search}%'))
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    
    # 排序
    if sort == 'name':
        query = query.order_by(Datasource.name.desc() if order == 'desc' else Datasource.name.asc())
    elif sort == 'project_name':
        query = query.order_by(Datasource.project_name.desc() if order == 'desc' else Datasource.project_name.asc())
    elif sort == 'table_count':
        query = query.order_by(Datasource.table_count.desc() if order == 'desc' else Datasource.table_count.asc())
    elif sort == 'workbook_count':
        query = query.order_by(Datasource.workbook_count.desc() if order == 'desc' else Datasource.workbook_count.asc())
    elif sort == 'last_refresh':
        query = query.order_by(Datasource.extract_last_refresh_time.desc() if order == 'desc' else Datasource.extract_last_refresh_time.asc())
    else:
        # 默认排序
        query = query.order_by(Datasource.name.asc())

    total_count = query.count()
    offset = (page - 1) * page_size
    
    datasources = query.limit(page_size).offset(offset).all()
    
    # 预查询各项统计（仅针对当前页的数据源，统一口径）
    ds_ids = [ds.id for ds in datasources]
    view_map = {}
    wb_map = {}
    table_map = {}
    
    if ds_ids:
        from sqlalchemy import bindparam
        # 1. 视图统计
        stmt_view = text("""
            SELECT dw.datasource_id, COUNT(v.id) as view_count
            FROM datasource_to_workbook dw
            JOIN views v ON dw.workbook_id = v.workbook_id
            WHERE dw.datasource_id IN :ds_ids
            GROUP BY dw.datasource_id
        """).bindparams(bindparam('ds_ids', expanding=True))
        view_stats = session.execute(stmt_view, {'ds_ids': list(ds_ids)}).fetchall()
        view_map = {row[0]: row[1] for row in view_stats}
        
        # 2. 工作簿统计
        stmt_wb = text("""
            SELECT datasource_id, COUNT(workbook_id) as wb_count
            FROM datasource_to_workbook
            WHERE datasource_id IN :ds_ids
            GROUP BY datasource_id
        """).bindparams(bindparam('ds_ids', expanding=True))
        wb_stats = session.execute(stmt_wb, {'ds_ids': list(ds_ids)}).fetchall()
        wb_map = {row[0]: row[1] for row in wb_stats}
        
        # 3. 物理表统计 - 分别统计嵌入表和原始表
        stmt_tbl = text("""
            SELECT 
                td.datasource_id, 
                SUM(CASE WHEN t.is_embedded = 1 THEN 1 ELSE 0 END) as embedded_count,
                SUM(CASE WHEN t.is_embedded = 0 OR t.is_embedded IS NULL THEN 1 ELSE 0 END) as regular_count
            FROM table_to_datasource td
            JOIN tables t ON td.table_id = t.id
            WHERE td.datasource_id IN :ds_ids
            GROUP BY td.datasource_id
        """).bindparams(bindparam('ds_ids', expanding=True))
        tbl_stats = session.execute(stmt_tbl, {'ds_ids': list(ds_ids)}).fetchall()
        table_map = {row[0]: {'embedded': row[1], 'regular': row[2]} for row in tbl_stats}
 
    results = []
    for ds in datasources:
        data = ds.to_dict()
        # 优先使用动态统计数据，确保与详情页及工作流一致
        tbl_info = table_map.get(ds.id, {'embedded': 0, 'regular': 0})
        data['embedded_table_count'] = tbl_info['embedded'] if isinstance(tbl_info, dict) else 0
        data['regular_table_count'] = tbl_info['regular'] if isinstance(tbl_info, dict) else 0
        data['table_count'] = data['embedded_table_count'] + data['regular_table_count']
        data['field_count'] = ds.field_count or 0 # 字段数量目前主表相对准确
        data['workbook_count'] = wb_map.get(ds.id, ds.workbook_count or 0)
        data['view_count'] = view_map.get(ds.id, 0)
        # 优化：不返回完整的关联对象列表，仅返回数量以减少 payload
        # 如果前端需要详情，应使用详情接口
        results.append(data)

    # Facets 统计
    facets = {}
    
    # is_certified facet
    cert_stats = session.execute(text("""
        SELECT 
            CASE WHEN is_certified = 1 THEN 'true' ELSE 'false' END as certified,
            COUNT(*) as cnt
        FROM datasources
        GROUP BY is_certified
    """)).fetchall()
    facets['is_certified'] = {row[0]: row[1] for row in cert_stats}
    
    # project_name facet
    project_stats = session.execute(text("""
        SELECT project_name, COUNT(*) as cnt
        FROM datasources
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
        'total_pages': (total_count + page_size - 1) // page_size,
        'facets': facets
    })

@api_bp.route('/datasources/<ds_id>')
def get_datasource_detail(ds_id):
    """获取数据源详情 - 完整上下文（含上游表、下游工作簿）"""
    session = g.db_session
    ds = session.query(Datasource).filter(Datasource.id == ds_id).first()
    if not ds: return jsonify({'error': 'Not found'}), 404

    data = ds.to_dict()

    # 上游：连接的数据表（完整信息）
    tables_data = []
    for t in ds.tables:
        tables_data.append({
            'id': t.id,
            'name': t.name,
            'schema': t.schema,
            'full_name': t.full_name,
            'database_id': t.database_id,
            'database_name': t.database.name if t.database else None,
            'column_count': len(t.columns) if t.columns else 0,
            'is_embedded': t.is_embedded
        })
    data['tables'] = tables_data

    # 原始列数据（优先从字段的 upstream_column 反向获取，解决 Custom SQL 数据源无列的问题）
    # 方案：通过 regular_fields.upstream_column_id -> db_columns 获取实际使用的列
    from sqlalchemy import text
    columns_data = []
    seen_column_ids = set()
    
    # 方法1：从字段的 upstream_column_id 获取（推荐，覆盖 Custom SQL 场景）
    column_query = text("""
        SELECT DISTINCT 
            c.id, c.name, c.remote_type, c.description, c.is_nullable,
            c.table_id, t.name as table_name, t.is_embedded as table_is_embedded
        FROM regular_fields f
        JOIN db_columns c ON f.upstream_column_id = c.id
        LEFT JOIN tables t ON c.table_id = t.id
        WHERE f.datasource_id = :ds_id
        ORDER BY t.name, c.name
    """)
    upstream_columns = session.execute(column_query, {'ds_id': ds_id}).fetchall()
    
    for col in upstream_columns:
        if col.id not in seen_column_ids:
            seen_column_ids.add(col.id)
            columns_data.append({
                'id': col.id,
                'name': col.name,
                'remote_type': col.remote_type,
                'table_id': col.table_id,
                'table_name': col.table_name,
                'description': col.description,
                'is_nullable': col.is_nullable,
                'is_embedded': col.table_is_embedded
            })
    
    # 方法2：回退 - 如果字段没有 upstream_column，则从 table_to_datasource 关联的表获取
    if not columns_data:
        for t in ds.tables:
            for col in t.columns:
                if col.id not in seen_column_ids:
                    seen_column_ids.add(col.id)
                    columns_data.append({
                        'id': col.id,
                        'name': col.name,
                        'remote_type': col.remote_type,
                        'table_id': t.id,
                        'table_name': t.name,
                        'description': col.description,
                        'is_nullable': col.is_nullable,
                        'is_embedded': t.is_embedded
                    })
    
    data['columns'] = columns_data

    # 下游：使用此数据源的工作簿
    workbooks_data = []
    for wb in ds.workbooks:
        workbooks_data.append({
            'id': wb.id,
            'name': wb.name,
            'project_name': wb.project_name,
            'owner': wb.owner,
            'view_count': len(wb.views) if wb.views else 0
        })
    data['workbooks'] = workbooks_data

    # 下游：由此衍生的嵌入式数据源副本 (v2.1 新增)
    # 仅当当前数据源为“已发布数据源”时才查询
    if not ds.is_embedded:
        embedded_copies = session.query(Datasource).filter(
            Datasource.source_published_datasource_id == ds.id,
            Datasource.is_embedded == True
        ).all()
        
        embedded_data = []
        for emb in embedded_copies:
            # 尝试找到关联的工作簿
            wb_info = {}
            if emb.workbooks and len(emb.workbooks) > 0:
                wb = emb.workbooks[0]
                wb_info = {'id': wb.id, 'name': wb.name}
                
            embedded_data.append({
                'id': emb.id,
                'name': emb.name,
                'workbook': wb_info,
                'field_count': len(emb.fields)
            })
        data['embedded_datasources'] = embedded_data

    # 字段列表（性能优化：限制返回数量，精简数据格式）
    # 注意：对于大数据源，完整字段列表通过分页 API 获取
    FIELD_LIMIT = 10000  # 提升详情页展示上限，解决前端列表被截断的问题 (原为100)
    
    full_fields = []
    metrics_list = []
    field_count = 0
    metric_count = 0
    
    # 🔧 嵌入式数据源字段修复：引用发布式则从发布式获取字段列表
    source_fields = ds.fields
    if ds.is_embedded and ds.source_published_datasource_id:
        published_ds = session.query(Datasource).filter_by(
            id=ds.source_published_datasource_id
        ).first()
        if published_ds:
            source_fields = published_ds.fields
    
    for f in source_fields:
        # 精简的字段摘要（避免返回完整对象和 N+1 查询）
        # 增加上游表信息用于前端分组显示
        summary = {
            'id': f.id,
            'name': f.name,
            'role': f.role,
            'data_type': f.data_type or f.remote_type,
            'description': f.description[:100] if f.description else '',
            'usage_count': f.usage_count or 0,
            'is_calculated': f.is_calculated or False,
            # 上游表信息（用于分组）
            'upstream_table_id': f.table_id,
            'upstream_table_name': f.table.name if f.table else None,
            'upstream_column_name': f.upstream_column.name if f.upstream_column else None,
            # 来源信息（用于聚合后展示）
            'workbook_id': f.workbook_id,
            'workbook_name': f.workbook.name if f.workbook else None,
            'datasource_id': f.datasource_id,
            'datasource_name': f.datasource.name if f.datasource else None,
            'is_embedded_ds': f.datasource.is_embedded if f.datasource else False
        }
        
        if f.is_calculated:
            metric_count += 1
            if len(metrics_list) < FIELD_LIMIT:
                metrics_list.append(summary)
        else:
            field_count += 1
            if len(full_fields) < FIELD_LIMIT:
                full_fields.append(summary)

    data['full_fields'] = full_fields
    data['metrics'] = metrics_list
    data['has_more_fields'] = field_count > FIELD_LIMIT
    data['has_more_metrics'] = metric_count > FIELD_LIMIT
    data['total_field_count'] = field_count
    data['total_metric_count'] = metric_count

    # 统计信息
    data['stats'] = {
        'table_count': len(ds.tables),
        'workbook_count': len(ds.workbooks),
        'field_count': field_count,  # 使用实际总数，非限制后的返回数
        'metric_count': metric_count  # 使用实际总数，非限制后的返回数
    }
    
    # 构建 Tableau Server 在线查看链接
    data['tableau_url'] = build_tableau_url('datasource', uri=ds.uri, luid=ds.luid, vizportal_url_id=ds.vizportal_url_id)

    return jsonify(data)


# -------------------- 数据源子资源路由 --------------------

@api_bp.route('/datasources/<ds_id>/fields')
def get_datasource_fields(ds_id):
    """获取数据源关联的字段列表"""
    session = g.db_session
    ds = session.query(Datasource).filter(Datasource.id == ds_id).first()
    if not ds:
        return jsonify({'error': 'Not found'}), 404

    fields_data = [{
        'id': f.id, 'name': f.name, 'role': f.role, 'data_type': f.data_type,
        'description': f.description, 'is_calculated': f.is_calculated
    } for f in ds.fields if not f.is_calculated]
    return jsonify({'items': fields_data, 'total': len(fields_data)})


@api_bp.route('/datasources/<ds_id>/workbooks')
def get_datasource_workbooks(ds_id):
    """获取数据源关联的工作簿列表"""
    session = g.db_session
    ds = session.query(Datasource).filter(Datasource.id == ds_id).first()
    if not ds:
        return jsonify({'error': 'Not found'}), 404

    wb_data = [{
        'id': wb.id, 'name': wb.name, 'project_name': wb.project_name, 'owner': wb.owner
    } for wb in ds.workbooks]
    return jsonify({'items': wb_data, 'total': len(wb_data)})
