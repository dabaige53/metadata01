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
    获取字段目录 - 基于 unique_regular_fields
    
    此接口已重构，直接查询 unique_regular_fields 表（标准资产），
    而不是从 fields 表动态聚合。这确保了列表数量与侧边栏统计（也是基于 unique 表）完全一致。
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
    conditions = []
    params = {}
    
    # 1. 搜索 (针对标准字段属性)
    if search:
        # 支持搜索标准名称或标准描述
        conditions.append("(urf.name LIKE :search OR urf.description LIKE :search)")
        params['search'] = f'%{search}%'
    
    # 2. 角色筛选 (针对实例属性 - 只要有一个实例匹配即可)
    # 注意：这需要在 JOIN regular_fields 后应用，或者在 WHERE 中
    if role_filter:
        conditions.append("rf.role = :role")
        params['role'] = role_filter
        
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # 构建 SQL
    # 使用 CTE 预先计算统计信息可能会更快，但直接 JOIN 也是可行的
    # 注意：GROUP_CONCAT 去重依赖于 DISTINCT
    
    # 使用 CTE 预先计算统计信息，并使用子查询获取血缘信息，避免数据膨胀
    base_sql = f"""
        WITH field_stats AS (
            SELECT 
                rf.unique_id,
                COUNT(DISTINCT rf.id) as instance_count,
                COALESCE(SUM(rf.usage_count + rf.metric_usage_count), 0) as total_usage,
                MAX(rf.role) as role,
                MAX(rf.data_type) as data_type,
                MAX(rf.remote_type) as remote_type
            FROM regular_fields rf
            GROUP BY rf.unique_id
        )
        SELECT 
            urf.id as representative_id,
            urf.name as canonical_name,
            urf.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            urf.description as description,
            fs.role,
            fs.data_type,
            fs.remote_type,
            COALESCE(fs.instance_count, 0) as instance_count,
            COALESCE(fs.total_usage, 0) as total_usage,
            
            -- 血缘信息 (使用子查询避免主查询膨胀)
            (SELECT GROUP_CONCAT(DISTINCT rfl.datasource_id || '|' || COALESCE(d.name, 'Unknown'))
             FROM regular_fields rf2
             JOIN regular_field_full_lineage rfl ON rf2.id = rfl.field_id
             LEFT JOIN datasources d ON rfl.datasource_id = d.id
             WHERE rf2.unique_id = urf.id) as datasource_info,
             
            (SELECT GROUP_CONCAT(DISTINCT rfl.workbook_id || '|' || COALESCE(w.name, 'Unknown'))
             FROM regular_fields rf2
             JOIN regular_field_full_lineage rfl ON rf2.id = rfl.field_id
             LEFT JOIN workbooks w ON rfl.workbook_id = w.id
             WHERE rf2.unique_id = urf.id) as workbook_info

        FROM unique_regular_fields urf
        LEFT JOIN tables t ON urf.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        LEFT JOIN field_stats fs ON fs.unique_id = urf.id
        {where_clause.replace('rf.', 'fs.')}
    """
    
    # 统计总数 (在外层统计，因为内层有 GROUP BY 或者 CTE)
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
        # 解析数据源列表
        datasources = []
        if row.datasource_info:
            for ds_pair in row.datasource_info.split(','):
                if '|' in ds_pair:
                    ds_id, ds_name = ds_pair.split('|', 1)
                    datasources.append({'id': ds_id, 'name': ds_name})

        # 解析工作簿列表
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
    
    # Role 统计 - 直接查询 unique 表关联实例表，统计各角色下的 unique field 数量
    # 注意：这里逻辑有点微妙。如果一个 unique field 既有 Dimension 又有 Measure 实例，它应该算哪边？
    # 上面的列表查询里用了 MAX(role)。为了保持一致，这里也应该用 MAX(role) 或者类似的聚合。
    # 为了简化且保持一致，我们复用类似的 CTE 逻辑
    
    role_sql = f"""
        SELECT sub.role, COUNT(*) FROM (
            SELECT fs.role
            FROM unique_regular_fields urf
            LEFT JOIN (
                SELECT unique_id, MAX(role) as role
                FROM regular_fields
                GROUP BY unique_id
            ) fs ON fs.unique_id = urf.id
            {where_clause.replace('rf.', 'fs.')}
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
    基于 unique_regular_fields 表
    """
    session = g.db_session
    from sqlalchemy import text
    
    sql = """
        SELECT 
            urf.id as representative_id,
            urf.name as canonical_name,
            urf.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            
            -- 聚合属性
            (SELECT MAX(rf.role) FROM regular_fields rf WHERE rf.unique_id = urf.id) as role,
            (SELECT MAX(rf.data_type) FROM regular_fields rf WHERE rf.unique_id = urf.id) as data_type,
            (SELECT MAX(rf.remote_type) FROM regular_fields rf WHERE rf.unique_id = urf.id) as remote_type,
            urf.description,
            
            -- 统计
            (SELECT COUNT(*) FROM regular_fields rf WHERE rf.unique_id = urf.id) as instance_count,
            (SELECT COALESCE(SUM(rf.usage_count + rf.metric_usage_count), 0) FROM regular_fields rf WHERE rf.unique_id = urf.id) as total_usage,
            
            -- 血缘
            (SELECT GROUP_CONCAT(DISTINCT d.name) FROM regular_fields rf JOIN regular_field_full_lineage rfl ON rf.id = rfl.field_id JOIN datasources d ON rfl.datasource_id = d.id WHERE rf.unique_id = urf.id) as datasource_names,
            (SELECT GROUP_CONCAT(DISTINCT rfl.datasource_id) FROM regular_fields rf JOIN regular_field_full_lineage rfl ON rf.id = rfl.field_id WHERE rf.unique_id = urf.id) as datasource_ids
            
        FROM unique_regular_fields urf
        LEFT JOIN tables t ON urf.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        WHERE (urf.description IS NULL OR urf.description = '')
        ORDER BY total_usage DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
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
            'total_usage': row.total_usage,
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
    基于 unique_regular_fields 表，筛选在任何数据源下都无使用的字段
    """
    session = g.db_session
    from sqlalchemy import text
    
    sql = """
        SELECT 
            urf.id as representative_id,
            urf.name as canonical_name,
            urf.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            
            (SELECT MAX(rf.role) FROM regular_fields rf WHERE rf.unique_id = urf.id) as role,
            (SELECT MAX(rf.data_type) FROM regular_fields rf WHERE rf.unique_id = urf.id) as data_type,
            urf.description,
            
            (SELECT COUNT(*) FROM regular_fields rf WHERE rf.unique_id = urf.id) as instance_count,
            (SELECT COALESCE(SUM(rf.usage_count + rf.metric_usage_count), 0) FROM regular_fields rf WHERE rf.unique_id = urf.id) as total_usage,
            
            (SELECT GROUP_CONCAT(DISTINCT d.name) FROM regular_fields rf JOIN regular_field_full_lineage rfl ON rf.id = rfl.field_id JOIN datasources d ON rfl.datasource_id = d.id WHERE rf.unique_id = urf.id) as datasource_names,
            (SELECT GROUP_CONCAT(DISTINCT rfl.datasource_id) FROM regular_fields rf JOIN regular_field_full_lineage rfl ON rf.id = rfl.field_id WHERE rf.unique_id = urf.id) as datasource_ids
            
        FROM unique_regular_fields urf
        LEFT JOIN tables t ON urf.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        WHERE (SELECT COALESCE(SUM(rf.usage_count + rf.metric_usage_count), 0) FROM regular_fields rf WHERE rf.unique_id = urf.id) = 0
        ORDER BY instance_count DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
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
            'description': row.description or '',
            'instance_count': row.instance_count,
            'total_usage': row.total_usage,
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
    基于 unique_regular_fields 表
    """
    session = g.db_session
    from sqlalchemy import text
    
    sql = """
        SELECT 
            urf.id as representative_id,
            urf.name as canonical_name,
            urf.table_id,
            t.name as table_name,
            t.schema as table_schema,
            db.name as database_name,
            
            (SELECT MAX(rf.role) FROM regular_fields rf WHERE rf.unique_id = urf.id) as role,
            (SELECT MAX(rf.data_type) FROM regular_fields rf WHERE rf.unique_id = urf.id) as data_type,
            urf.description,
            
            (SELECT COUNT(*) FROM regular_fields rf WHERE rf.unique_id = urf.id) as instance_count,
            (SELECT COALESCE(SUM(rf.usage_count + rf.metric_usage_count), 0) FROM regular_fields rf WHERE rf.unique_id = urf.id) as total_usage,
            
            (SELECT GROUP_CONCAT(DISTINCT d.name) FROM regular_fields rf JOIN regular_field_full_lineage rfl ON rf.id = rfl.field_id JOIN datasources d ON rfl.datasource_id = d.id WHERE rf.unique_id = urf.id) as datasource_names,
            (SELECT GROUP_CONCAT(DISTINCT rfl.datasource_id) FROM regular_fields rf JOIN regular_field_full_lineage rfl ON rf.id = rfl.field_id WHERE rf.unique_id = urf.id) as datasource_ids
            
        FROM unique_regular_fields urf
        LEFT JOIN tables t ON urf.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        WHERE (SELECT COALESCE(SUM(rf.usage_count + rf.metric_usage_count), 0) FROM regular_fields rf WHERE rf.unique_id = urf.id) > 20
        ORDER BY total_usage DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 构建结果
    items = []
    for row in rows:
        ds_ids = row.datasource_ids.split(',') if row.datasource_ids else []
        ds_names = row.datasource_names.split(',') if row.datasource_names else []
        datasources = [{'id': ds_ids[i] if i < len(ds_ids) else None, 'name': ds_names[i]} 
                       for i in range(len(ds_names))]
        
        # 计算热度等级
        usage = row.total_usage
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
            'description': row.description or '',
            'instance_count': row.instance_count,
            'total_usage': usage,
            'heat_level': heat_level,
            'datasources': datasources,
            'datasource_count': len(datasources)
        })
    
    return jsonify({
        'total_count': len(items),
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
        order_clause = f"ORDER BY (rf.usage_count + rf.metric_usage_count) {'DESC' if order == 'desc' else 'ASC'}"
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
            rf.usage_count, rf.metric_usage_count, rf.unique_id,
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
            'metricUsageCount': row.metric_usage_count or 0,
            'totalUsage': (row.usage_count or 0) + (row.metric_usage_count or 0),
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
    """获取单个字段详情 - 优先查询 unique_regular_fields (标准字段)"""
    session = g.db_session
    from sqlalchemy import text
    
    # 1. 尝试查询 Unique Field (标准字段)
    unique_sql = """
        SELECT 
            urf.id, urf.name, urf.description, urf.remote_type,
            urf.table_id, urf.upstream_column_id, urf.created_at,
            t.name as table_name, t.schema as table_schema,
            db.name as database_name, db.id as database_id,
            -- 获取一个实例的血缘标签
            (SELECT rf.lineage_source FROM regular_fields rf WHERE rf.unique_id = urf.id LIMIT 1) as lineage_source,
            (SELECT rf.penetration_status FROM regular_fields rf WHERE rf.unique_id = urf.id LIMIT 1) as penetration_status
        FROM unique_regular_fields urf
        LEFT JOIN tables t ON urf.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        WHERE urf.id = :field_id
    """
    unique_row = session.execute(text(unique_sql), {'field_id': field_id}).first()
    
    unique_id = None
    representative_field_id = None
    vizportal_url_id = None
    data = {}

    if unique_row:
        # ========== CASE A: 是标准字段 ID ==========
        unique_id = unique_row.id
        
        # 聚合统计信息 (从 regular_fields)
        stats_sql = """
            SELECT 
                COUNT(*) as instance_count,
                COALESCE(SUM(usage_count + metric_usage_count), 0) as total_usage,
                MAX(role) as role,
                MAX(data_type) as data_type,
                MAX(aggregation) as aggregation,
                MAX(id) as max_id
            FROM regular_fields
            WHERE unique_id = :unique_id
        """
        stats = session.execute(text(stats_sql), {'unique_id': unique_id}).first()
        representative_field_id = stats.max_id if stats else None
        
        data = {
            'id': unique_row.id,
            'uniqueId': unique_row.id,
            'name': unique_row.name,
            'description': unique_row.description or '',
            'remoteType': unique_row.remote_type,
            'role': stats.role if stats else None,
            'data_type': stats.data_type if stats else None,
            'aggregation': stats.aggregation if stats else None,
            'isCalculated': False,
            'isHidden': False, 
            'usageCount': stats.total_usage if stats else 0,
            'instanceCount': stats.instance_count if stats else 0,
            'createdAt': str(unique_row.created_at) if unique_row.created_at else None,
            'tableId': unique_row.table_id,
            'tableName': unique_row.table_name or '-',
            'tableSchema': unique_row.table_schema,
            'databaseId': unique_row.database_id,
            'databaseName': unique_row.database_name,
            'datasourceId': None,
            'datasourceName': '多数据源聚合',
            'workbookId': None,
            'workbookName': None,
            # 血缘标签
            'lineageSource': unique_row.lineage_source if hasattr(unique_row, 'lineage_source') else None,
            'penetrationStatus': unique_row.penetration_status if hasattr(unique_row, 'penetration_status') else None,
        }
        
    else:
        # ========== CASE B: 不是标准字段 ID，尝试物理字段 ID (保留兼容性) ==========
        field_sql = """
            SELECT 
                rf.id, rf.name, rf.data_type, rf.remote_type, rf.description,
                rf.role, rf.aggregation, rf.is_hidden, rf.usage_count,
                rf.upstream_column_id, rf.table_id, rf.datasource_id, rf.workbook_id,
                rf.unique_id, rf.created_at, rf.updated_at,
                rf.lineage_source, rf.penetration_status,
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
            
        unique_id = field_row.unique_id
        representative_field_id = field_row.id
        vizportal_url_id = field_row.vizportal_url_id
        
        data = {
            'id': field_row.id,
            'uniqueId': field_row.unique_id,
            'name': field_row.name,
            'data_type': field_row.data_type,
            'remoteType': field_row.remote_type,
            'description': field_row.description or '',
            'role': field_row.role,
            'aggregation': field_row.aggregation,
            'isCalculated': False,
            'isHidden': field_row.is_hidden or False,
            'usageCount': field_row.usage_count or 0,
            'tableId': field_row.table_id,
            'tableName': field_row.table_name or '-',
            'tableSchema': field_row.table_schema,
            'datasourceId': field_row.datasource_id,
            'datasourceName': field_row.datasource_name or '-',
            'workbookId': field_row.workbook_id,
            'workbookName': field_row.workbook_name,
            'hasDescription': bool(field_row.description and field_row.description.strip()),
            'createdAt': str(field_row.created_at) if field_row.created_at else None,
            'updatedAt': str(field_row.updated_at) if field_row.updated_at else None,
            # 血缘标签
            'lineageSource': field_row.lineage_source,
            'penetrationStatus': field_row.penetration_status,
        }
        
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

    # Common Logic: Lineage & Associations (Based on Unique ID if available)
    if unique_id:
        # 1. 物理表血缘
        table_lineage = session.execute(text("""
            SELECT DISTINCT fl.table_id, t.name, t.schema, db.name as db_name, t.database_id
            FROM regular_fields rf
            JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
            JOIN tables t ON fl.table_id = t.id
            LEFT JOIN databases db ON t.database_id = db.id
            WHERE rf.unique_id = :unique_id AND fl.table_id IS NOT NULL AND t.id IS NOT NULL
        """), {'unique_id': unique_id}).fetchall()
        
        data['derived_tables'] = [{
            'id': r[0], 'name': r[1], 'schema': r[2], 'database_name': r[3], 'database_id': r[4]
        } for r in table_lineage]
        data['derivedTables'] = data['derived_tables']

        # 2. 数据源血缘
        ds_lineage = session.execute(text("""
            SELECT DISTINCT fl.datasource_id, d.name, d.project_name, d.owner, d.is_certified
            FROM regular_fields rf
            JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
            LEFT JOIN datasources d ON fl.datasource_id = d.id
            WHERE rf.unique_id = :unique_id AND fl.datasource_id IS NOT NULL AND d.id IS NOT NULL
        """), {'unique_id': unique_id}).fetchall()
        
        data['all_datasources'] = [{
            'id': r[0], 'name': r[1], 'project_name': r[2], 'owner': r[3], 'is_certified': bool(r[4]) if r[4] is not None else False
        } for r in ds_lineage]
        
        # 3. 工作簿血缘
        wb_lineage = session.execute(text("""
            SELECT DISTINCT fl.workbook_id, w.name, w.project_name, w.owner
            FROM regular_fields rf
            JOIN regular_field_full_lineage fl ON rf.id = fl.field_id
            LEFT JOIN workbooks w ON fl.workbook_id = w.id
            WHERE rf.unique_id = :unique_id AND fl.workbook_id IS NOT NULL AND w.id IS NOT NULL
        """), {'unique_id': unique_id}).fetchall()
        
        data['all_workbooks'] = [{
            'id': r[0], 'name': r[1], 'project_name': r[2], 'owner': r[3]
        } for r in wb_lineage]

        # 4. 使用该字段的视图 (聚合所有实例)
        views_result = session.execute(text("""
            SELECT DISTINCT rfv.view_id, v.name, v.view_type, v.workbook_id, w.name as wb_name, w.project_name, w.owner
            FROM regular_field_to_view rfv
            JOIN regular_fields rf ON rfv.field_id = rf.id
            JOIN views v ON rfv.view_id = v.id
            LEFT JOIN workbooks w ON v.workbook_id = w.id
            WHERE rf.unique_id = :unique_id
        """), {'unique_id': unique_id}).fetchall()
        
        # 5. 指标依赖 (聚合所有实例)
        metric_deps = session.execute(text("""
            SELECT DISTINCT cf.id, cf.name, cf.formula, cf.role, cf.data_type,
                   cf.datasource_id, d.name as ds_name, cf.workbook_id, w.name as wb_name
            FROM calc_field_dependencies cfd
            JOIN regular_fields rf ON cfd.dependency_regular_field_id = rf.id
            JOIN calculated_fields cf ON cfd.source_field_id = cf.id
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            LEFT JOIN workbooks w ON cf.workbook_id = w.id
            WHERE rf.unique_id = :unique_id
            LIMIT 100
        """), {'unique_id': unique_id}).fetchall()

    else:
        # Fallback (Unlikely to be hit if Case B succeeds, as unique_id is usually present)
        views_result = []
        metric_deps = []
        data['derived_tables'] = []
        data['derivedTables'] = []
        if 'all_datasources' not in data: data['all_datasources'] = []
        if 'all_workbooks' not in data: data['all_workbooks'] = []

    # Process Views
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
            
    # Process Metrics
    data['used_by_metrics'] = [{
        'id': row[0], 'name': row[1], 'formula': row[2], 'role': row[3], 'dataType': row[4],
        'datasourceId': row[5], 'datasourceName': row[6],
        'workbookId': row[7], 'workbookName': row[8]
    } for row in metric_deps]
    
    # Stats
    data['stats'] = {
        'view_count': len(views_data),
        'workbook_count': len(workbooks_set),
        'metric_count': len(data['used_by_metrics']),
        'datasource_count': len(data.get('all_datasources', []))
    }
    
    # Tableau URL
    if representative_field_id and not vizportal_url_id:
        # Try to fetch vizportal_url_id from the representative field's datasource
        url_sql = """
            SELECT d.vizportal_url_id 
            FROM regular_fields rf
            LEFT JOIN datasources d ON rf.datasource_id = d.id
            WHERE rf.id = :rid
        """
        res = session.execute(text(url_sql), {'rid': representative_field_id}).first()
        if res:
            vizportal_url_id = res.vizportal_url_id
            
    if vizportal_url_id:
        data['tableau_url'] = build_tableau_url('datasource', vizportal_url_id=vizportal_url_id)
    else:
        data['tableau_url'] = None
    
    return jsonify(data)



@api_bp.route('/fields/<field_id>', methods=['PUT'])
def update_field(field_id):
    """只读模式 - 禁止修改"""
    return jsonify({'error': '只读模式，禁止修改字段'}), 405


# ... (Datasource/Table routes should be updated similarly if needed, but for now focusing on Fields/Metrics) ...

