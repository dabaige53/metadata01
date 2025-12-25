"""
字段接口路由模块
包含字段列表、详情、目录和治理分析接口
"""
from flask import jsonify, request, g
from sqlalchemy import text, bindparam, func
from sqlalchemy.orm import selectinload
from . import api_bp
from .utils import build_tableau_url, get_field_usage_by_name
from ..models import Field, Datasource, View, FieldDependency, DBColumn, CalculatedField

# ==================== 字段接口 ====================

# -------------------- 字段治理分析专用 API --------------------

@api_bp.route('/fields/governance/no-description')
def get_fields_no_description():
    """获取无描述字段分析 - 按数据源分组（基于全量数据）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 查询所有无描述的非计算字段（直接在SQL层过滤）
    sql = """
        SELECT 
            f.id, f.name, f.role, f.data_type, 
            f.datasource_id, d.name as datasource_name,
            t.name as table_name
        FROM fields f
        LEFT JOIN datasources d ON f.datasource_id = d.id
        LEFT JOIN tables t ON f.table_id = t.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
          AND (f.description IS NULL OR f.description = '')
        ORDER BY d.name, f.name
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 按数据源分组
    groups_map = {}
    for row in rows:
        ds_name = row.datasource_name or '未知数据源'
        ds_id = row.datasource_id or 'unknown'
        
        if ds_name not in groups_map:
            groups_map[ds_name] = {
                'datasource_name': ds_name,
                'datasource_id': ds_id,
                'fields': []
            }
        
        groups_map[ds_name]['fields'].append({
            'id': row.id,
            'name': row.name,
            'role': row.role,
            'data_type': row.data_type,
            'table_name': row.table_name or '-'
        })
    
    # 转换为数组并按字段数降序排列
    groups = sorted(groups_map.values(), key=lambda grp: len(grp['fields']), reverse=True)
    for grp in groups:
        grp['field_count'] = len(grp['fields'])
    
    return jsonify({
        'total_count': len(rows),
        'datasource_count': len(groups),
        'groups': groups
    })


@api_bp.route('/fields/governance/orphan')
def get_fields_orphan():
    """获取孤立字段分析 - 未被任何视图使用的字段（基于全量数据）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 查询所有 usage_count = 0 的非计算字段（与字段列表保持一致）
    sql = """
        SELECT 
            f.id, f.name, f.role, f.data_type, f.is_calculated,
            f.datasource_id, d.name as datasource_name
        FROM fields f
        LEFT JOIN datasources d ON f.datasource_id = d.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
          AND (f.usage_count IS NULL OR f.usage_count = 0)
        ORDER BY d.name, f.name
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 按数据源分组
    groups_map = {}
    for row in rows:
        ds_name = row.datasource_name or '未知数据源'
        ds_id = row.datasource_id or 'unknown'
        
        if ds_name not in groups_map:
            groups_map[ds_name] = {
                'datasource_name': ds_name,
                'datasource_id': ds_id,
                'fields': []
            }
        
        groups_map[ds_name]['fields'].append({
            'id': row.id,
            'name': row.name,
            'role': row.role,
            'data_type': row.data_type,
            'is_calculated': row.is_calculated or False
        })
    
    # 转换为数组并按字段数降序排列
    groups = sorted(groups_map.values(), key=lambda grp: len(grp['fields']), reverse=True)
    for grp in groups:
        grp['field_count'] = len(grp['fields'])
    
    return jsonify({
        'total_count': len(rows),
        'datasource_count': len(groups),
        'groups': groups
    })


@api_bp.route('/fields/governance/hot')
def get_fields_hot():
    """获取热门字段排行榜（基于全量数据，usage_count > 20）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 查询所有高频使用的非计算字段（usage_count > 20）
    sql = """
        SELECT 
            f.id, f.name, f.role, f.data_type, f.is_calculated,
            f.usage_count, f.datasource_id, d.name as datasource_name
        FROM fields f
        LEFT JOIN datasources d ON f.datasource_id = d.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
          AND f.usage_count > 20
        ORDER BY f.usage_count DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 计算统计数据
    usage_counts = [row.usage_count for row in rows]
    max_usage = max(usage_counts) if usage_counts else 0
    avg_usage = round(sum(usage_counts) / len(usage_counts)) if usage_counts else 0
    
    # 构建字段列表
    fields = []
    for row in rows:
        usage = row.usage_count or 0
        # 计算热度等级
        if usage >= 200:
            heat_level = '超热门'
        elif usage >= 100:
            heat_level = '热门'
        elif usage >= 50:
            heat_level = '活跃'
        else:
            heat_level = '常用'
        
        fields.append({
            'id': row.id,
            'name': row.name,
            'usage_count': usage,
            'role': row.role,
            'data_type': row.data_type,
            'datasource_name': row.datasource_name or '-',
            'is_calculated': row.is_calculated or False,
            'heat_level': heat_level
        })
    
    return jsonify({
        'total_count': len(rows),
        'max_usage': max_usage,
        'avg_usage': avg_usage,
        'fields': fields
    })


# -------------------- 字段目录 API (去重聚合) --------------------

@api_bp.route('/fields/catalog')
def get_fields_catalog():
    """
    获取字段目录 - 按物理列聚合去重
    
    聚合规则：按 (upstream_column_name OR name) + table_id 分组
    返回：canonical_name, table_name, role, data_type, instance_count, total_usage, datasources
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 200)
    
    # 筛选参数
    search = request.args.get('search', '')
    role_filter = request.args.get('role', '')
    sort = request.args.get('sort', 'total_usage')
    order = request.args.get('order', 'desc')
    
    # 构建动态条件
    conditions = ["(f.is_calculated = 0 OR f.is_calculated IS NULL)"]
    params = {}
    
    if search:
        conditions.append("(COALESCE(f.upstream_column_name, f.name) LIKE :search)")
        params['search'] = f'%{search}%'
    
    if role_filter:
        conditions.append("f.role = :role")
        params['role'] = role_filter
    
    where_clause = "WHERE " + " AND ".join(conditions)
    
    # 聚合查询 - 使用 CTE 进行精准聚合
    base_sql = f"""
        WITH field_groups AS (
            SELECT 
                COALESCE(upstream_column_name, name) as canonical_name,
                table_id,
                COUNT(DISTINCT id) as instance_count,
                COALESCE(SUM(usage_count), 0) as total_usage,
                MAX(role) as role,
                MAX(data_type) as data_type,
                MAX(remote_type) as remote_type,
                MAX(description) as description,
                MIN(id) as representative_id,
                GROUP_CONCAT(DISTINCT id) as member_ids
            FROM fields
            {where_clause}
            GROUP BY COALESCE(upstream_column_name, name), table_id
        )
        SELECT 
            gs.*,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            GROUP_CONCAT(DISTINCT CASE WHEN rfl.datasource_id IS NOT NULL THEN rfl.datasource_id || '|' || COALESCE(d.name, 'Unknown') END) as datasource_info,
            GROUP_CONCAT(DISTINCT CASE WHEN rfl.workbook_id IS NOT NULL THEN rfl.workbook_id || '|' || COALESCE(w.name, 'Unknown') END) as workbook_info
        FROM field_groups gs
        LEFT JOIN tables t ON gs.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        JOIN fields f ON gs.canonical_name = COALESCE(f.upstream_column_name, f.name) AND gs.table_id = f.table_id
        LEFT JOIN regular_field_full_lineage rfl ON f.id = rfl.field_id
        LEFT JOIN datasources d ON rfl.datasource_id = d.id
        LEFT JOIN workbooks w ON rfl.workbook_id = w.id
        GROUP BY gs.canonical_name, gs.table_id
    """

    
    # 统计总数
    count_sql = f"SELECT COUNT(*) FROM ({base_sql}) sub"
    total = session.execute(text(count_sql), params).scalar() or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 排序
    order_dir = 'DESC' if order == 'desc' else 'ASC'
    if sort == 'total_usage':
        order_clause = f"ORDER BY total_usage {order_dir}"
    elif sort == 'instance_count':
        order_clause = f"ORDER BY instance_count {order_dir}"
    elif sort == 'name':
        order_clause = f"ORDER BY canonical_name {order_dir}"
    else:
        order_clause = f"ORDER BY total_usage {order_dir}"
    
    # 分页
    offset = (page - 1) * page_size
    params['limit'] = page_size
    params['offset'] = offset
    
    data_sql = f"{base_sql} {order_clause} LIMIT :limit OFFSET :offset"
    rows = session.execute(text(data_sql), params).fetchall()
    
    # 构建结果
    items = []
    for row in rows:
        # 解析数据源列表（新格式：id|name,id|name,...）
        datasources = []
        if row.datasource_info:
            for ds_pair in row.datasource_info.split(','):
                if '|' in ds_pair:
                    ds_id, ds_name = ds_pair.split('|', 1)
                    datasources.append({'id': ds_id, 'name': ds_name})

        # 解析工作簿列表（新格式：id|name,id|name,...）
        workbooks = []
        if row.workbook_info:
            for wb_pair in row.workbook_info.split(','):
                if '|' in wb_pair:
                    wb_id, wb_name = wb_pair.split('|', 1)
                    if wb_id and wb_id != 'None':
                        workbooks.append({'id': wb_id, 'name': wb_name})

        items.append({
            'representative_id': row.representative_id,
            'canonical_name': row.canonical_name,
            'table_id': row.table_id,
            'table_name': row.table_name or '-',
            'table_schema': row.table_schema,
            'database_name': row.database_name,
            'role': row.role,
            'data_type': row.data_type,
            'remote_type': row.remote_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'total_usage': row.total_usage or 0,
            'datasources': datasources,
            'datasource_count': len(datasources),
            'workbooks': workbooks,
            'workbook_count': len(workbooks)
        })
    
    # Facets 统计
    facets = {}
    role_sql = f"""
        SELECT sub.role, COUNT(*) FROM (
            SELECT MAX(f.role) as role
            FROM fields f
            {where_clause}
            GROUP BY COALESCE(f.upstream_column_name, f.name), f.table_id
        ) sub GROUP BY sub.role
    """
    role_counts = session.execute(text(role_sql), params).fetchall()
    facets['role'] = {str(r or 'unknown'): c for r, c in role_counts}
    
    return jsonify({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'facets': facets
    })


# -------------------- 字段目录治理 API (聚合视角) --------------------

@api_bp.route('/fields/catalog/no-description')
def get_fields_catalog_no_description():
    """
    获取无描述字段分析 - 聚合视角
    
    聚合规则：按 (upstream_column_name OR name) + table_id 分组
    筛选条件：聚合后 description 为空的字段
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 聚合查询 - 筛选无描述的聚合字段
    sql = """
        SELECT 
            MIN(f.id) as representative_id,
            COALESCE(f.upstream_column_name, f.name) as canonical_name,
            f.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            MAX(f.role) as role,
            MAX(f.data_type) as data_type,
            MAX(f.remote_type) as remote_type,
            MAX(f.description) as description,
            COUNT(*) as instance_count,
            COALESCE(SUM(f.usage_count), 0) as total_usage,
            GROUP_CONCAT(DISTINCT f.datasource_id) as datasource_ids,
            GROUP_CONCAT(DISTINCT d.name) as datasource_names
        FROM fields f
        LEFT JOIN tables t ON f.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        LEFT JOIN datasources d ON f.datasource_id = d.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
        GROUP BY COALESCE(f.upstream_column_name, f.name), f.table_id
        HAVING MAX(f.description) IS NULL OR MAX(f.description) = ''
        ORDER BY instance_count DESC, canonical_name
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 构建结果
    items = []
    for row in rows:
        ds_ids = row.datasource_ids.split(',') if row.datasource_ids else []
        ds_names = row.datasource_names.split(',') if row.datasource_names else []
        datasources = [{'id': ds_ids[i] if i < len(ds_ids) else None, 'name': ds_names[i]} 
                       for i in range(len(ds_names))]
        
        items.append({
            'representative_id': row.representative_id,
            'canonical_name': row.canonical_name,
            'table_id': row.table_id,
            'table_name': row.table_name or '-',
            'table_schema': row.table_schema,
            'database_name': row.database_name,
            'role': row.role,
            'data_type': row.data_type,
            'remote_type': row.remote_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'total_usage': row.total_usage or 0,
            'datasources': datasources,
            'datasource_count': len(datasources)
        })
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/fields/catalog/orphan')
def get_fields_catalog_orphan():
    """
    获取孤立字段分析 - 聚合视角
    
    聚合规则：按 (upstream_column_name OR name) + table_id 分组
    筛选条件：聚合后 total_usage = 0 的字段
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 聚合查询 - 筛选孤立的聚合字段（总使用次数为0）
    sql = """
        SELECT 
            MIN(f.id) as representative_id,
            COALESCE(f.upstream_column_name, f.name) as canonical_name,
            f.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            MAX(f.role) as role,
            MAX(f.data_type) as data_type,
            MAX(f.remote_type) as remote_type,
            MAX(f.description) as description,
            COUNT(*) as instance_count,
            COALESCE(SUM(f.usage_count), 0) as total_usage,
            COALESCE(SUM(f.metric_usage_count), 0) as total_metric_usage,
            GROUP_CONCAT(DISTINCT f.datasource_id) as datasource_ids,
            GROUP_CONCAT(DISTINCT d.name) as datasource_names
        FROM fields f
        LEFT JOIN tables t ON f.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        LEFT JOIN datasources d ON f.datasource_id = d.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
        GROUP BY COALESCE(f.upstream_column_name, f.name), f.table_id
        HAVING COALESCE(SUM(f.usage_count), 0) = 0 AND COALESCE(SUM(f.metric_usage_count), 0) = 0
        ORDER BY instance_count DESC, canonical_name
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 构建结果
    items = []
    for row in rows:
        ds_ids = row.datasource_ids.split(',') if row.datasource_ids else []
        ds_names = row.datasource_names.split(',') if row.datasource_names else []
        datasources = [{'id': ds_ids[i] if i < len(ds_ids) else None, 'name': ds_names[i]} 
                       for i in range(len(ds_names))]
        
        items.append({
            'representative_id': row.representative_id,
            'canonical_name': row.canonical_name,
            'table_id': row.table_id,
            'table_name': row.table_name or '-',
            'table_schema': row.table_schema,
            'database_name': row.database_name,
            'role': row.role,
            'data_type': row.data_type,
            'remote_type': row.remote_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'total_usage': row.total_usage or 0,
            'datasources': datasources,
            'datasource_count': len(datasources)
        })
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/fields/catalog/hot')
def get_fields_catalog_hot():
    """
    获取热门字段排行榜 - 聚合视角
    
    聚合规则：按 (upstream_column_name OR name) + table_id 分组
    筛选条件：聚合后 total_usage > 20 的字段
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 聚合查询 - 筛选热门的聚合字段（总使用次数 > 20）
    sql = """
        SELECT 
            MIN(f.id) as representative_id,
            COALESCE(f.upstream_column_name, f.name) as canonical_name,
            f.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            MAX(f.role) as role,
            MAX(f.data_type) as data_type,
            MAX(f.remote_type) as remote_type,
            MAX(f.description) as description,
            COUNT(*) as instance_count,
            COALESCE(SUM(f.usage_count), 0) as total_usage,
            GROUP_CONCAT(DISTINCT f.datasource_id) as datasource_ids,
            GROUP_CONCAT(DISTINCT d.name) as datasource_names
        FROM fields f
        LEFT JOIN tables t ON f.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        LEFT JOIN datasources d ON f.datasource_id = d.id
        WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
        GROUP BY COALESCE(f.upstream_column_name, f.name), f.table_id
        HAVING COALESCE(SUM(f.usage_count), 0) > 20
        ORDER BY total_usage DESC, canonical_name
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 计算统计数据
    usage_counts = [row.total_usage for row in rows]
    max_usage = max(usage_counts) if usage_counts else 0
    avg_usage = round(sum(usage_counts) / len(usage_counts)) if usage_counts else 0
    
    # 构建结果
    items = []
    for row in rows:
        ds_ids = row.datasource_ids.split(',') if row.datasource_ids else []
        ds_names = row.datasource_names.split(',') if row.datasource_names else []
        datasources = [{'id': ds_ids[i] if i < len(ds_ids) else None, 'name': ds_names[i]} 
                       for i in range(len(ds_names))]
        
        # 计算热度等级
        usage = row.total_usage or 0
        if usage >= 200:
            heat_level = '超热门'
        elif usage >= 100:
            heat_level = '热门'
        elif usage >= 50:
            heat_level = '活跃'
        else:
            heat_level = '常用'
        
        items.append({
            'representative_id': row.representative_id,
            'canonical_name': row.canonical_name,
            'table_id': row.table_id,
            'table_name': row.table_name or '-',
            'table_schema': row.table_schema,
            'database_name': row.database_name,
            'role': row.role,
            'data_type': row.data_type,
            'remote_type': row.remote_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'total_usage': usage,
            'heat_level': heat_level,
            'datasources': datasources,
            'datasource_count': len(datasources)
        })
    
    return jsonify({
        'total_count': len(items),
        'max_usage': max_usage,
        'avg_usage': avg_usage,
        'items': items
    })


# -------------------- 字段列表 API --------------------

@api_bp.route('/fields')
def get_fields():
    """获取字段列表 - 使用新的 regular_fields 表"""
    session = g.db_session
    role = request.args.get('role', '')
    data_type = request.args.get('data_type', '')
    has_description = request.args.get('hasDescription', '')
    
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    
    from sqlalchemy import text
    
    # 构建动态 WHERE 条件
    conditions = []
    params = {}
    
    if role:
        conditions.append("rf.role = :role")
        params['role'] = role
    if data_type:
        conditions.append("rf.data_type = :data_type")
        params['data_type'] = data_type
        if has_description.lower() == 'true':
            conditions.append("rf.description IS NOT NULL AND rf.description != ''")
        elif has_description.lower() == 'false':
            conditions.append("(rf.description IS NULL OR rf.description = '')")

    if search:
        conditions.append("(rf.name LIKE :search OR rf.description LIKE :search)")
        params['search'] = f'%{search}%'
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # 1. 统计查询 (总数 + 有描述数)
    stats_sql = f"""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN rf.description IS NOT NULL AND rf.description != '' THEN 1 ELSE 0 END) as has_desc
        FROM regular_fields rf
        {where_clause}
    """
    stats = session.execute(text(stats_sql), params).first()
    total = stats.total or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 2. Facet 统计
    facets = {}
    
    role_sql = f"SELECT rf.role, COUNT(*) FROM regular_fields rf {where_clause} GROUP BY rf.role"
    role_counts = session.execute(text(role_sql), params).fetchall()
    facets['role'] = {str(r or 'unknown'): c for r, c in role_counts}
    
    type_sql = f"SELECT rf.data_type, COUNT(*) FROM regular_fields rf {where_clause} GROUP BY rf.data_type"
    type_counts = session.execute(text(type_sql), params).fetchall()
    facets['data_type'] = {str(t or 'unknown'): c for t, c in type_counts}
    
    facets['hasDescription'] = {'true': stats.has_desc or 0, 'false': total - (stats.has_desc or 0)}
    
    # 3. 数据查询 (使用新表 regular_fields)
    order_clause = "ORDER BY rf.name ASC"
    if sort == 'usageCount':
        order_clause = f"ORDER BY rf.usage_count {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'name':
        order_clause = f"ORDER BY rf.name {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'data_type':
        order_clause = f"ORDER BY rf.data_type {'DESC' if order == 'desc' else 'ASC'}"
    
    offset = (page - 1) * page_size
    params['limit'] = page_size
    params['offset'] = offset
    
    data_sql = f"""
        SELECT 
            rf.id, rf.name, rf.data_type, rf.remote_type, rf.description,
            rf.role, rf.aggregation, rf.is_hidden,
            rf.usage_count, rf.unique_id,
            rf.created_at, rf.updated_at,
            rf.datasource_id, rf.table_id, rf.workbook_id,
            d.name as datasource_name,
            t.name as table_name
        FROM regular_fields rf
        LEFT JOIN datasources d ON rf.datasource_id = d.id
        LEFT JOIN tables t ON rf.table_id = t.id
        {where_clause}
        {order_clause}
        LIMIT :limit OFFSET :offset
    """
    rows = session.execute(text(data_sql), params).fetchall()
    
    # 4. 构建结果
    results = []
    for row in rows:
        results.append({
            'id': row.id,
            'name': row.name,
            'data_type': row.data_type,
            'remoteType': row.remote_type,
            'description': row.description or '',
            'role': row.role,
            'aggregation': row.aggregation,
            'isCalculated': False,  # regular_fields 都是非计算字段
            'isHidden': row.is_hidden or False,
            'usageCount': row.usage_count or 0,
            'uniqueId': row.unique_id,  # 新增：关联的标准字段ID
            'hasDescription': bool(row.description and row.description.strip()),
            'datasourceId': row.datasource_id,
            'datasourceName': row.datasource_name or '-',
            'tableId': row.table_id,
            'tableName': row.table_name or '-',
            'workbookId': row.workbook_id,
            'createdAt': row.created_at.isoformat() if row.created_at else None,
            'updatedAt': row.updated_at.isoformat() if row.updated_at else None
        })
        
    return jsonify({
        'items': results,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'facets': facets
    })


@api_bp.route('/fields/<field_id>')
def get_field_detail(field_id):
    """获取单个字段详情 - 使用新的 regular_fields 表"""
    session = g.db_session
    from sqlalchemy import text
    
    # 查询字段基本信息
    field_sql = """
        SELECT 
            rf.id, rf.name, rf.data_type, rf.remote_type, rf.description,
            rf.role, rf.aggregation, rf.is_hidden, rf.usage_count,
            rf.upstream_column_id, rf.table_id, rf.datasource_id, rf.workbook_id,
            rf.unique_id, rf.created_at, rf.updated_at,
            d.name as datasource_name, d.project_name as ds_project_name, d.owner as ds_owner, 
            d.is_certified as ds_certified, d.vizportal_url_id,
            t.name as table_name, t.schema as table_schema,
            w.name as workbook_name, w.project_name as wb_project_name, w.owner as wb_owner
        FROM regular_fields rf
        LEFT JOIN datasources d ON rf.datasource_id = d.id
        LEFT JOIN tables t ON rf.table_id = t.id
        LEFT JOIN workbooks w ON rf.workbook_id = w.id
        WHERE rf.id = :field_id
    """
    field_row = session.execute(text(field_sql), {'field_id': field_id}).first()
    
    if not field_row:
        return jsonify({'error': 'Not found'}), 404
    
    data = {
        'id': field_row.id,
        'name': field_row.name,
        'data_type': field_row.data_type,
        'remoteType': field_row.remote_type,
        'description': field_row.description or '',
        'role': field_row.role,
        'aggregation': field_row.aggregation,
        'isCalculated': False,
        'isHidden': field_row.is_hidden or False,
        'usageCount': field_row.usage_count or 0,
        'uniqueId': field_row.unique_id,
        'tableId': field_row.table_id,
        'tableName': field_row.table_name or '-',
        'tableSchema': field_row.table_schema,
        'datasourceId': field_row.datasource_id,
        'datasourceName': field_row.datasource_name or '-',
        'workbookId': field_row.workbook_id,
        'workbookName': field_row.workbook_name,
        'hasDescription': bool(field_row.description and field_row.description.strip()),
        'createdAt': field_row.created_at.isoformat() if field_row.created_at else None,
        'updatedAt': field_row.updated_at.isoformat() if field_row.updated_at else None
    }
    
    field_name = field_row.name
    
    # 1. 聚合所有「逻辑一致」字段的物理表血缘
    # 基于 unique_id 聚合，确保跨视图/工作簿的同一物理列血缘能合并
    unique_id = field_row.unique_id
    
    table_lineage_result = session.execute(text("""
        SELECT DISTINCT fl.table_id, t.name, t.schema, db.name as db_name, t.database_id
        FROM regular_fields rf
        JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
        JOIN tables t ON fl.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        WHERE rf.unique_id = :unique_id AND fl.table_id IS NOT NULL AND t.id IS NOT NULL
    """), {'unique_id': unique_id}).fetchall()
    
    if table_lineage_result:
        first_table = table_lineage_result[0]
        data['table_info'] = {
            'id': first_table[0],
            'name': first_table[1],
            'schema': first_table[2],
            'database_name': first_table[3],
            'database_id': first_table[4]
        }
        data['derived_tables'] = [{
            'id': row[0], 'name': row[1], 'schema': row[2],
            'database_name': row[3], 'database_id': row[4]
        } for row in table_lineage_result]
        data['derivedTables'] = data['derived_tables']
    else:
        data['table_info'] = None
        data['derived_tables'] = []
        data['derivedTables'] = []
    
    # 2. 聚合所有「逻辑一致」字段的数据源血缘
    ds_lineage_result = session.execute(text("""
        SELECT DISTINCT fl.datasource_id, d.name, d.project_name, d.owner, d.is_certified
        FROM regular_fields rf
        JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
        LEFT JOIN datasources d ON fl.datasource_id = d.id
        WHERE rf.unique_id = :unique_id AND fl.datasource_id IS NOT NULL AND d.id IS NOT NULL
    """), {'unique_id': unique_id}).fetchall()
    
    data['all_datasources'] = [{
        'id': row[0], 'name': row[1], 'project_name': row[2],
        'owner': row[3], 'is_certified': bool(row[4]) if row[4] is not None else False
    } for row in ds_lineage_result]
    
    # 3. 聚合所有「逻辑一致」字段的工作簿血缘
    wb_lineage_result = session.execute(text("""
        SELECT DISTINCT fl.workbook_id, w.name, w.project_name, w.owner
        FROM regular_fields rf
        JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
        LEFT JOIN workbooks w ON fl.workbook_id = w.id
        WHERE rf.unique_id = :unique_id AND fl.workbook_id IS NOT NULL AND w.id IS NOT NULL
    """), {'unique_id': unique_id}).fetchall()
    
    data['all_workbooks'] = [{
        'id': row[0], 'name': row[1], 'project_name': row[2], 'owner': row[3]
    } for row in wb_lineage_result]
    
    # 所属数据源信息
    if field_row.datasource_id:
        data['datasource_info'] = {
            'id': field_row.datasource_id,
            'name': field_row.datasource_name,
            'project_name': field_row.ds_project_name,
            'owner': field_row.ds_owner,
            'is_certified': field_row.ds_certified
        }
    elif field_row.workbook_id:
        data['datasource_info'] = {
            'id': f"embedded-{field_row.workbook_id}",
            'name': f"{field_row.workbook_name} (内部连接)",
            'project_name': field_row.wb_project_name,
            'owner': field_row.wb_owner,
            'is_certified': False,
            'is_embedded_fallback': True
        }
    else:
        data['datasource_info'] = None
    
    # 使用该字段的视图 (使用新的 regular_field_to_view 表)
    views_result = session.execute(text("""
        SELECT rfv.view_id, v.name, v.view_type, v.workbook_id, w.name as wb_name, w.project_name, w.owner
        FROM regular_field_to_view rfv
        JOIN views v ON rfv.view_id = v.id
        LEFT JOIN workbooks w ON v.workbook_id = w.id
        WHERE rfv.field_id = :field_id
    """), {'field_id': field_id}).fetchall()
    
    views_data = []
    workbooks_set = {}
    for row in views_result:
        views_data.append({
            'id': row[0], 'name': row[1], 'view_type': row[2],
            'workbook_id': row[3], 'workbook_name': row[4]
        })
        if row[3] and row[3] not in workbooks_set:
            workbooks_set[row[3]] = {
                'id': row[3], 'name': row[4], 'project_name': row[5], 'owner': row[6]
            }
    
    data['used_in_views'] = views_data
    data['used_in_workbooks'] = list(workbooks_set.values())
    data['usedInViews'] = data['used_in_views']
    data['usedInWorkbooks'] = data['used_in_workbooks']
    
    # 获取使用该字段的指标 (通过 calc_field_dependencies)
    metric_deps = session.execute(text("""
        SELECT DISTINCT cf.id, cf.name, cf.formula, cf.role, cf.data_type,
               cf.datasource_id, d.name as ds_name, cf.workbook_id, w.name as wb_name
        FROM calc_field_dependencies cfd
        JOIN calculated_fields cf ON cfd.source_field_id = cf.id
        LEFT JOIN datasources d ON cf.datasource_id = d.id
        LEFT JOIN workbooks w ON cf.workbook_id = w.id
        WHERE cfd.dependency_regular_field_id = :field_id
        LIMIT 100
    """), {'field_id': field_id}).fetchall()
    
    data['used_by_metrics'] = [{
        'id': row[0], 'name': row[1], 'formula': row[2], 'role': row[3], 'dataType': row[4],
        'datasourceId': row[5], 'datasourceName': row[6],
        'workbookId': row[7], 'workbookName': row[8]
    } for row in metric_deps]
    
    # 统计信息
    data['stats'] = {
        'view_count': len(views_data),
        'workbook_count': len(workbooks_set),
        'metric_count': len(data['used_by_metrics']),
        'datasource_count': len(data['all_datasources'])
    }
    
    # 构建 Tableau URL
    if field_row.vizportal_url_id:
        data['tableau_url'] = build_tableau_url('datasource', vizportal_url_id=field_row.vizportal_url_id)
    else:
        data['tableau_url'] = None
    
    return jsonify(data)



@api_bp.route('/fields/<field_id>', methods=['PUT'])
def update_field(field_id):
    """只读模式 - 禁止修改"""
    return jsonify({'error': '只读模式，禁止修改字段'}), 405


# ... (Datasource/Table routes should be updated similarly if needed, but for now focusing on Fields/Metrics) ...

