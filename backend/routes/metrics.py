"""
指标接口路由模块
包含指标列表、详情、目录和治理分析接口
"""
from flask import jsonify, request, g
from sqlalchemy import text, bindparam, func, case
from sqlalchemy.orm import selectinload
from . import api_bp
from .utils import build_tableau_url, get_field_usage_by_name
from ..models import Field, CalculatedField, Datasource, Workbook, FieldDependency, View

# ==================== 指标接口 ====================

# -------------------- 指标治理分析专用 API --------------------

@api_bp.route('/metrics/governance/unused')
def get_metrics_unused():
    """获取未使用指标分析（基于全量数据，引用数为0）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 直接从 calculated_fields 表查询（新的四表架构）
    sql = """
        SELECT 
            cf.id, cf.name, cf.datasource_id, d.name as datasource_name,
            cf.formula, cf.reference_count
        FROM calculated_fields cf
        LEFT JOIN datasources d ON cf.datasource_id = d.id
        WHERE (cf.reference_count IS NULL OR cf.reference_count = 0)
          AND (cf.usage_count IS NULL OR cf.usage_count = 0)
        ORDER BY d.name, cf.name
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
                'metrics': []
            }
        
        groups_map[ds_name]['metrics'].append({
            'id': row.id,
            'name': row.name,
            'formula': row.formula[:100] + '...' if row.formula and len(row.formula) > 100 else row.formula
        })
    
    groups = sorted(groups_map.values(), key=lambda grp: len(grp['metrics']), reverse=True)
    for grp in groups:
        grp['metric_count'] = len(grp['metrics'])
    
    return jsonify({
        'total_count': len(rows),
        'datasource_count': len(groups),
        'groups': groups
    })


@api_bp.route('/metrics/governance/complex')
def get_metrics_complex():
    """获取高复杂度指标分析（基于全量数据，公式长度 > 200 或复杂度 > 5）"""
    session = g.db_session
    from sqlalchemy import text
    
    # 直接从 calculated_fields 表查询（新的四表架构）
    sql = """
        SELECT 
            cf.id, cf.name, cf.datasource_id, d.name as datasource_name,
            cf.formula, cf.complexity_score, cf.reference_count
        FROM calculated_fields cf
        LEFT JOIN datasources d ON cf.datasource_id = d.id
        WHERE LENGTH(cf.formula) > 200 OR cf.complexity_score > 5
        ORDER BY LENGTH(cf.formula) DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = []
    for row in rows:
        formula_len = len(row.formula) if row.formula else 0
        if formula_len >= 500:
            complexity_level = '超高'
        elif formula_len >= 300:
            complexity_level = '高'
        elif formula_len >= 200:
            complexity_level = '中高'
        else:
            complexity_level = '正常'
        
        items.append({
            'id': row.id,
            'name': row.name,
            'datasource_name': row.datasource_name or '-',
            'formula_length': formula_len,
            'complexity_score': row.complexity_score or 0,
            'reference_count': row.reference_count or 0,
            'complexity_level': complexity_level
        })
    
    # 统计
    super_complex = len([x for x in items if x['formula_length'] >= 500])
    avg_length = round(sum(x['formula_length'] for x in items) / len(items)) if items else 0
    
    return jsonify({
        'total_count': len(items),
        'super_complex_count': super_complex,
        'avg_formula_length': avg_length,
        'items': items
    })


# -------------------- 指标目录 API (去重聚合) --------------------

@api_bp.route('/metrics/catalog')
def get_metrics_catalog():
    """
    获取指标目录 - 按公式哈希聚合去重（使用新的四表架构）
    
    聚合规则：按 (name + formula_hash) 分组
    返回：name, formula, role, instance_count, total_references, complexity, datasources, workbooks
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
    sort = request.args.get('sort', 'total_references')
    order = request.args.get('order', 'desc')
    
    # 构建动态条件（直接使用 calculated_fields 表）
    conditions = []
    params = {}
    
    if search:
        conditions.append("(cf.name LIKE :search OR cf.formula LIKE :search)")
        params['search'] = f'%{search}%'
    
    if role_filter:
        conditions.append("cf.role = :role")
        params['role'] = role_filter
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # 聚合查询 - 直接从 calculated_fields 表
    # 修正：使用 unique_id 进行聚合，区分不同数据源的同名指标
    # 聚合查询 - 引入 Lineage 中台表进行精准聚合 (统一卡片与详情页口径)
    # 聚合查询 - 使用子查询聚合确保口径绝对统一 (由列表项驱动血缘聚合)
    base_sql = f"""
        WITH metric_groups AS (
            SELECT 
                TRIM(name) as clean_name, 
                formula_hash,
                COUNT(DISTINCT id) as instance_count,
                COALESCE(SUM(reference_count), 0) as total_references,
                COALESCE(SUM(usage_count), 0) as total_usage,
                MAX(role) as role,
                MAX(data_type) as data_type,
                MAX(description) as description,
                MAX(complexity_score) as complexity,
                MAX(formula) as formula,
                MIN(id) as representative_id,
                MAX(unique_id) as unique_id
            FROM calculated_fields
            {where_clause.replace('cf.', '')}
            GROUP BY TRIM(name), formula_hash
        )
        SELECT 
            gs.clean_name as name,
            gs.formula_hash,
            gs.instance_count,
            gs.total_references,
            gs.total_usage,
            gs.role,
            gs.data_type,
            gs.description,
            gs.complexity,
            gs.formula,
            gs.representative_id,
            gs.unique_id,
            (SELECT GROUP_CONCAT(DISTINCT cfl.datasource_id || '|' || COALESCE(d.name, 'Unknown') || '|' || COALESCE(d.is_embedded, 0)) 
             FROM calculated_fields cf2 
             JOIN calc_field_full_lineage cfl ON cf2.id = cfl.field_id 
             LEFT JOIN datasources d ON cfl.datasource_id = d.id 
             WHERE TRIM(cf2.name) = gs.clean_name AND cf2.formula_hash = gs.formula_hash) as datasource_info,
            (SELECT GROUP_CONCAT(DISTINCT cfl.workbook_id || '|' || COALESCE(w.name, 'Unknown')) 
             FROM calculated_fields cf2 
             JOIN calc_field_full_lineage cfl ON cf2.id = cfl.field_id 
             LEFT JOIN workbooks w ON cfl.workbook_id = w.id 
             WHERE TRIM(cf2.name) = gs.clean_name AND cf2.formula_hash = gs.formula_hash) as workbook_info
        FROM metric_groups gs
    """

    
    # 统计总数
    count_sql = f"SELECT COUNT(*) FROM ({base_sql}) sub"
    total = session.execute(text(count_sql), params).scalar() or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 排序
    order_dir = 'DESC' if order == 'desc' else 'ASC'
    if sort == 'total_usage':
        order_clause = f"ORDER BY total_usage {order_dir}"
    elif sort == 'total_references':
        order_clause = f"ORDER BY total_references {order_dir}"
    elif sort == 'instance_count':
        order_clause = f"ORDER BY instance_count {order_dir}"
    elif sort == 'complexity':
        order_clause = f"ORDER BY complexity {order_dir}"
    elif sort == 'name':
        order_clause = f"ORDER BY name {order_dir}"
    else:
        # 默认优先按热度排序 (与字段目录一致)
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
        # 解析数据源列表（id|name|is_embedded,...）
        datasources = []
        has_embedded = False
        has_published = False
        if row.datasource_info:
            for ds_pair in row.datasource_info.split(','):
                parts = ds_pair.split('|')
                if len(parts) >= 2:
                    ds_id, ds_name = parts[0], parts[1]
                    is_embedded = parts[2] == '1' if len(parts) > 2 else False
                    if ds_id and ds_id != 'None':
                        datasources.append({'id': ds_id, 'name': ds_name, 'is_embedded': is_embedded})
                        if is_embedded:
                            has_embedded = True
                        else:
                            has_published = True
        
        # 解析工作簿列表（id|name,...）
        workbooks = []
        if row.workbook_info:
            for wb_pair in row.workbook_info.split(','):
                if '|' in wb_pair:
                    wb_id, wb_name = wb_pair.split('|', 1)
                    if wb_id and wb_id != 'None':
                        workbooks.append({'id': wb_id, 'name': wb_name})

        
        # 计算复杂度等级
        formula_len = len(row.formula) if row.formula else 0
        if formula_len >= 500:
            complexity_level = '超高'
        elif formula_len >= 300:
            complexity_level = '高'
        elif formula_len >= 100:
            complexity_level = '中'
        else:
            complexity_level = '低'
        
        # 构建去重键 (formula_hash 前8位)
        dedup_key = row.formula_hash[:8] + '...' if row.formula_hash and len(row.formula_hash) > 8 else (row.formula_hash or '-')
        
        # 判断是否为聚合指标
        is_aggregated = row.instance_count > 1
        
        # 判断去重方式 (根据数据源类型)
        if has_embedded and has_published:
            dedup_method = 'hash_mixed'  # 混合：既有嵌入式又有已发布
        elif has_embedded:
            dedup_method = 'hash_embedded'  # 公式哈希 + 嵌入式数据源
        else:
            dedup_method = 'hash_published'  # 公式哈希 + 已发布数据源
        
        items.append({
            'representative_id': row.representative_id,
            'unique_id': row.unique_id,
            'name': row.name,
            'formula': row.formula,
            'formula_hash': row.formula_hash,
            'dedup_key': dedup_key,  # 去重键 (hash 缩写)
            'dedup_method': dedup_method,  # 新增：去重方式
            'is_aggregated': is_aggregated,  # 是否为聚合指标
            'role': row.role,
            'data_type': row.data_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'complexity': row.complexity or 0,
            'complexity_level': complexity_level,
            'formula_length': formula_len,
            'total_references': row.total_references or 0,
            'total_usage': row.total_usage or 0,
            'usage_status': 'direct' if (row.total_usage or 0) > 0 else ('intermediate' if (row.total_references or 0) > 0 else 'unused'),
            'datasources': datasources,
            'datasource_count': len(datasources),
            'workbooks': workbooks,
            'workbook_count': len(workbooks),
            'datasource_name': datasources[0]['name'] if datasources else '-'
        })
    
    # Facets 统计
    facets = {}
    role_sql = f"""
        SELECT sub.role, COUNT(*) FROM (
            SELECT MAX(cf.role) as role
            FROM calculated_fields cf
            {where_clause}
            GROUP BY cf.unique_id
        ) sub GROUP BY sub.role
    """
    role_counts = session.execute(text(role_sql), params).fetchall()
    facets['role'] = {str(r or 'unknown'): c for r, c in role_counts}
    
    # 聚合状态统计
    agg_sql_simple = """
        SELECT 
            CASE WHEN (SELECT COUNT(*) FROM calculated_fields cf WHERE cf.unique_id = ucf.id) > 1 THEN 'true' ELSE 'false' END as is_agg,
            COUNT(*) as cnt
        FROM unique_calculated_fields ucf
        GROUP BY is_agg
    """
    agg_counts = session.execute(text(agg_sql_simple)).fetchall()
    facets['is_aggregated'] = {r[0]: r[1] for r in agg_counts}
    
    # 去重方式统计 (根据数据源类型)
    dedup_method_sql = """
        SELECT 
            CASE 
                WHEN has_embedded = 1 AND has_published = 1 THEN 'hash_mixed'
                WHEN has_embedded = 1 THEN 'hash_embedded'
                ELSE 'hash_published'
            END as dedup_method,
            COUNT(*) as cnt
        FROM (
            SELECT 
                ucf.id,
                MAX(CASE WHEN d.is_embedded = 1 THEN 1 ELSE 0 END) as has_embedded,
                MAX(CASE WHEN d.is_embedded = 0 OR d.is_embedded IS NULL THEN 1 ELSE 0 END) as has_published
            FROM unique_calculated_fields ucf
            LEFT JOIN calculated_fields cf ON cf.unique_id = ucf.id
            LEFT JOIN calc_field_full_lineage cfl ON cf.id = cfl.field_id
            LEFT JOIN datasources d ON cfl.datasource_id = d.id
            GROUP BY ucf.id
        ) sub
        GROUP BY dedup_method
    """
    dedup_counts = session.execute(text(dedup_method_sql)).fetchall()
    facets['dedup_method'] = {r[0]: r[1] for r in dedup_counts}
    
    return jsonify({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'facets': facets
    })


# -------------------- 指标目录治理 API (聚合视角) --------------------

@api_bp.route('/metrics/catalog/duplicate')
def get_metrics_catalog_duplicate():
    """
    获取同名称不同公式的重复指标分析
    
    聚合规则：按 name 分组
    筛选条件：同名下存在多个不同 formula_hash
    """
    session = g.db_session
    from sqlalchemy import text, bindparam
    
    name_stats_sql = """
        SELECT 
            TRIM(name) as name,
            COUNT(*) as instance_count,
            COUNT(DISTINCT formula_hash) as formula_count,
            COALESCE(SUM(reference_count), 0) as total_references,
            COALESCE(SUM(usage_count), 0) as total_usage
        FROM calculated_fields
        GROUP BY TRIM(name)
        HAVING formula_count > 1
        ORDER BY formula_count DESC, instance_count DESC, name
    """
    name_rows = session.execute(text(name_stats_sql)).fetchall()
    if not name_rows:
        return jsonify({
            'total_count': 0,
            'items': []
        })
    
    names = [row.name for row in name_rows]
    variants_sql = text("""
        WITH variants AS (
            SELECT 
                TRIM(name) as name,
                formula_hash,
                MAX(formula) as formula,
                COUNT(*) as instance_count,
                COALESCE(SUM(reference_count), 0) as total_references,
                COALESCE(SUM(usage_count), 0) as total_usage,
                MAX(complexity_score) as complexity,
                MAX(description) as description,
                MIN(id) as representative_id
            FROM calculated_fields
            WHERE TRIM(name) IN :names
            GROUP BY TRIM(name), formula_hash
        )
        SELECT 
            v.name,
            v.formula_hash,
            v.formula,
            v.instance_count,
            v.total_references,
            v.total_usage,
            v.complexity,
            v.description,
            v.representative_id,
            (SELECT GROUP_CONCAT(DISTINCT cfl.datasource_id || '|' || COALESCE(d.name, 'Unknown') || '|' || COALESCE(d.is_embedded, 0))
             FROM calc_field_full_lineage cfl 
             LEFT JOIN datasources d ON cfl.datasource_id = d.id 
             WHERE cfl.field_id = v.representative_id) as datasource_info,
            (SELECT GROUP_CONCAT(DISTINCT cfl.workbook_id || '|' || COALESCE(w.name, 'Unknown'))
             FROM calc_field_full_lineage cfl 
             LEFT JOIN workbooks w ON cfl.workbook_id = w.id 
             WHERE cfl.field_id = v.representative_id) as workbook_info,
            (SELECT GROUP_CONCAT(DISTINCT cfl.table_id || '|' || COALESCE(t.name, 'Unknown'))
             FROM calc_field_full_lineage cfl 
             LEFT JOIN tables t ON cfl.table_id = t.id 
             WHERE cfl.field_id = v.representative_id) as table_info
        FROM variants v
        ORDER BY v.name, v.total_references DESC, v.instance_count DESC
    """).bindparams(bindparam('names', expanding=True))
    variant_rows = session.execute(variants_sql, {'names': names}).fetchall()
    
    items_map = {
        row.name: {
            'name': row.name,
            'formula_count': row.formula_count,
            'instance_count': row.instance_count,
            'total_references': row.total_references or 0,
            'total_usage': row.total_usage or 0,
            'variants': []
        }
        for row in name_rows
    }
    
    for row in variant_rows:
        datasources = []
        if row.datasource_info:
            for ds_pair in row.datasource_info.split(','):
                parts = ds_pair.split('|')
                if len(parts) >= 2:
                    ds_id, ds_name = parts[0], parts[1]
                    is_embedded = parts[2] == '1' if len(parts) > 2 else False
                    if ds_id and ds_id != 'None':
                        datasources.append({'id': ds_id, 'name': ds_name, 'is_embedded': is_embedded})

        workbooks = []
        if row.workbook_info:
            for wb_pair in row.workbook_info.split(','):
                if '|' in wb_pair:
                    wb_id, wb_name = wb_pair.split('|', 1)
                    if wb_id and wb_id != 'None':
                        workbooks.append({'id': wb_id, 'name': wb_name})

        tables = []
        if row.table_info:
            for tb_pair in row.table_info.split(','):
                if '|' in tb_pair:
                    tb_id, tb_name = tb_pair.split('|', 1)
                    if tb_id and tb_id != 'None':
                        tables.append({'id': tb_id, 'name': tb_name})

        items_map[row.name]['variants'].append({
            'formula_hash': row.formula_hash,
            'formula': row.formula,
            'instance_count': row.instance_count,
            'total_references': row.total_references or 0,
            'total_usage': row.total_usage or 0,
            'complexity': row.complexity or 0,
            'representative_id': row.representative_id,
            'datasources': datasources,
            'datasource_count': len(datasources),
            'workbooks': workbooks,
            'workbook_count': len(workbooks),
            'tables': tables,
            'table_count': len(tables)
        })
    
    items = list(items_map.values())
    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/metrics/catalog/duplicate-formula')
def get_metrics_catalog_duplicate_formula():
    """
    获取同公式不同名称的重复指标分析
    
    聚合规则：按 formula_hash 分组
    筛选条件：同一公式存在多个不同名称
    """
    session = g.db_session
    from sqlalchemy import text
    
    sql = """
        WITH formula_groups AS (
            SELECT 
                formula_hash,
                COUNT(*) as instance_count,
                COUNT(DISTINCT TRIM(name)) as name_count,
                COALESCE(SUM(reference_count), 0) as total_references,
                COALESCE(SUM(usage_count), 0) as total_usage,
                MAX(role) as role,
                MAX(data_type) as data_type,
                MAX(description) as description,
                MAX(complexity_score) as complexity,
                MAX(formula) as formula
            FROM calculated_fields
            GROUP BY formula_hash
            HAVING name_count > 1
        )
        SELECT 
            fg.formula_hash,
            fg.instance_count,
            fg.name_count,
            fg.total_references,
            fg.total_usage,
            fg.role,
            fg.data_type,
            fg.description,
            fg.complexity,
            fg.formula,
            (SELECT cf.id FROM calculated_fields cf 
             WHERE cf.formula_hash = fg.formula_hash 
             ORDER BY cf.usage_count DESC, cf.reference_count DESC, cf.id 
             LIMIT 1) as representative_id,
            (SELECT cf.name FROM calculated_fields cf 
             WHERE cf.formula_hash = fg.formula_hash 
             ORDER BY cf.usage_count DESC, cf.reference_count DESC, cf.id 
             LIMIT 1) as representative_name,
            (SELECT GROUP_CONCAT(DISTINCT cfl.datasource_id || '|' || COALESCE(d.name, 'Unknown') || '|' || COALESCE(d.is_embedded, 0)) 
             FROM calculated_fields cf2 
             JOIN calc_field_full_lineage cfl ON cf2.id = cfl.field_id 
             LEFT JOIN datasources d ON cfl.datasource_id = d.id 
             WHERE cf2.formula_hash = fg.formula_hash) as datasource_info,
            (SELECT GROUP_CONCAT(DISTINCT cfl.workbook_id || '|' || COALESCE(w.name, 'Unknown')) 
             FROM calculated_fields cf2 
             JOIN calc_field_full_lineage cfl ON cf2.id = cfl.field_id 
             LEFT JOIN workbooks w ON cfl.workbook_id = w.id 
             WHERE cf2.formula_hash = fg.formula_hash) as workbook_info,
            (SELECT GROUP_CONCAT(DISTINCT cfl.table_id || '|' || COALESCE(t.name, 'Unknown'))
             FROM calculated_fields cf2
             JOIN calc_field_full_lineage cfl ON cf2.id = cfl.field_id
             LEFT JOIN tables t ON cfl.table_id = t.id
             WHERE cf2.formula_hash = fg.formula_hash) as table_info
        FROM formula_groups fg
        ORDER BY fg.instance_count DESC, representative_name
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = []
    for row in rows:
        datasources = []
        has_embedded = False
        has_published = False
        if row.datasource_info:
            for ds_pair in row.datasource_info.split(','):
                parts = ds_pair.split('|')
                if len(parts) >= 2:
                    ds_id, ds_name = parts[0], parts[1]
                    is_embedded = parts[2] == '1' if len(parts) > 2 else False
                    if ds_id and ds_id != 'None':
                        datasources.append({'id': ds_id, 'name': ds_name, 'is_embedded': is_embedded})
                        if is_embedded:
                            has_embedded = True
                        else:
                            has_published = True
        
        workbooks = []
        if row.workbook_info:
            for wb_pair in row.workbook_info.split(','):
                if '|' in wb_pair:
                    wb_id, wb_name = wb_pair.split('|', 1)
                    if wb_id and wb_id != 'None':
                        workbooks.append({'id': wb_id, 'name': wb_name})
        
        if has_embedded and has_published:
            dedup_method = 'hash_mixed'
        elif has_embedded:
            dedup_method = 'hash_embedded'
        else:
            dedup_method = 'hash_published'
        
        tables = []
        if row.table_info:
            for tb_pair in row.table_info.split(','):
                if '|' in tb_pair:
                    tb_id, tb_name = tb_pair.split('|', 1)
                    if tb_id and tb_id != 'None':
                        tables.append({'id': tb_id, 'name': tb_name})

        items.append({
            'representative_id': row.representative_id,
            'name': row.representative_name or '-',
            'formula': row.formula,
            'formula_hash': row.formula_hash,
            'role': row.role,
            'data_type': row.data_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'name_count': row.name_count,
            'complexity': row.complexity or 0,
            'total_references': row.total_references or 0,
            'total_usage': row.total_usage or 0,
            'datasources': datasources,
            'datasource_count': len(datasources),
            'workbooks': workbooks,
            'workbook_count': len(workbooks),
            'tables': tables,
            'table_count': len(tables),
            'dedup_method': dedup_method
        })

    if items:
        formula_hashes = [item['formula_hash'] for item in items]
        name_variants_sql = text("""
            WITH name_variants AS (
                SELECT 
                    TRIM(name) as name,
                    formula_hash,
                    MIN(id) as representative_id,
                    COUNT(*) as instance_count,
                    COALESCE(SUM(reference_count), 0) as total_references,
                    COALESCE(SUM(usage_count), 0) as total_usage,
                    MAX(complexity_score) as complexity
                FROM calculated_fields
                WHERE formula_hash IN :hashes
                GROUP BY TRIM(name), formula_hash
            )
            SELECT 
                nv.name,
                nv.formula_hash,
                nv.representative_id,
                nv.instance_count,
                nv.total_references,
                nv.total_usage,
                nv.complexity,
                (SELECT GROUP_CONCAT(DISTINCT cfl.datasource_id || '|' || COALESCE(d.name, 'Unknown') || '|' || COALESCE(d.is_embedded, 0))
                 FROM calc_field_full_lineage cfl 
                 LEFT JOIN datasources d ON cfl.datasource_id = d.id 
                 WHERE cfl.field_id = nv.representative_id) as datasource_info,
                (SELECT GROUP_CONCAT(DISTINCT cfl.workbook_id || '|' || COALESCE(w.name, 'Unknown'))
                 FROM calc_field_full_lineage cfl 
                 LEFT JOIN workbooks w ON cfl.workbook_id = w.id 
                 WHERE cfl.field_id = nv.representative_id) as workbook_info,
                (SELECT GROUP_CONCAT(DISTINCT cfl.table_id || '|' || COALESCE(t.name, 'Unknown'))
                 FROM calc_field_full_lineage cfl 
                 LEFT JOIN tables t ON cfl.table_id = t.id 
                 WHERE cfl.field_id = nv.representative_id) as table_info
            FROM name_variants nv
            ORDER BY nv.formula_hash, nv.total_references DESC, nv.instance_count DESC, nv.name
        """).bindparams(bindparam('hashes', expanding=True))

        variant_rows = session.execute(name_variants_sql, {'hashes': formula_hashes}).fetchall()
        variant_map = {}
        for row in variant_rows:
            datasources = []
            if row.datasource_info:
                for ds_pair in row.datasource_info.split(','):
                    parts = ds_pair.split('|')
                    if len(parts) >= 2:
                        ds_id, ds_name = parts[0], parts[1]
                        is_embedded = parts[2] == '1' if len(parts) > 2 else False
                        if ds_id and ds_id != 'None':
                            datasources.append({'id': ds_id, 'name': ds_name, 'is_embedded': is_embedded})

            workbooks = []
            if row.workbook_info:
                for wb_pair in row.workbook_info.split(','):
                    if '|' in wb_pair:
                        wb_id, wb_name = wb_pair.split('|', 1)
                        if wb_id and wb_id != 'None':
                            workbooks.append({'id': wb_id, 'name': wb_name})

            tables = []
            if row.table_info:
                for tb_pair in row.table_info.split(','):
                    if '|' in tb_pair:
                        tb_id, tb_name = tb_pair.split('|', 1)
                        if tb_id and tb_id != 'None':
                            tables.append({'id': tb_id, 'name': tb_name})

            variant = {
                'name': row.name,
                'representative_id': row.representative_id,
                'instance_count': row.instance_count,
                'total_references': row.total_references or 0,
                'total_usage': row.total_usage or 0,
                'complexity': row.complexity or 0,
                'datasources': datasources,
                'datasource_count': len(datasources),
                'workbooks': workbooks,
                'workbook_count': len(workbooks),
                'tables': tables,
                'table_count': len(tables)
            }
            variant_map.setdefault(row.formula_hash, []).append(variant)

        for item in items:
            item['name_variants'] = variant_map.get(item['formula_hash'], [])

    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/metrics/catalog/complex')
def get_metrics_catalog_complex():
    """
    获取高复杂度指标分析 - 聚合视角
    
    聚合规则：按 (name + formula_hash) 分组
    筛选条件：公式长度 > 100 的指标
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 直接从 calculated_fields 表查询（新的四表架构）
    sql = """
        SELECT 
            MIN(cf.id) as representative_id,
            cf.name,
            cf.formula,
            cf.formula_hash,
            MAX(cf.role) as role,
            MAX(cf.data_type) as data_type,
            MAX(cf.description) as description,
            COUNT(*) as instance_count,
            MAX(cf.complexity_score) as complexity,
            LENGTH(cf.formula) as formula_length,
            COALESCE(SUM(cf.reference_count), 0) as total_references,
            GROUP_CONCAT(DISTINCT cf.datasource_id) as datasource_ids,
            GROUP_CONCAT(DISTINCT d.name) as datasource_names,
            GROUP_CONCAT(DISTINCT cf.workbook_id) as workbook_ids,
            GROUP_CONCAT(DISTINCT w.name) as workbook_names
        FROM calculated_fields cf
        LEFT JOIN datasources d ON cf.datasource_id = d.id
        LEFT JOIN workbooks w ON cf.workbook_id = w.id
        WHERE cf.complexity_score > 10 OR LENGTH(cf.formula) > 300
        GROUP BY cf.name, cf.formula_hash
        ORDER BY cf.complexity_score DESC, formula_length DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = []
    for row in rows:
        ds_ids = row.datasource_ids.split(',') if row.datasource_ids else []
        ds_names = row.datasource_names.split(',') if row.datasource_names else []
        datasources = [{'id': ds_ids[i] if i < len(ds_ids) else None, 'name': ds_names[i]} 
                       for i in range(len(ds_names))]
        
        wb_ids = row.workbook_ids.split(',') if row.workbook_ids else []
        wb_names = row.workbook_names.split(',') if row.workbook_names else []
        workbooks = [{'id': wb_ids[i] if i < len(wb_ids) else None, 'name': wb_names[i]} 
                     for i in range(len(wb_names))]
        
        # 计算复杂度等级 (基于评分)
        score = row.complexity or 0
        if score > 20:
            complexity_level = '超高'
        elif score > 10:
            complexity_level = '高'
        elif score > 5:
            complexity_level = '中'
        else:
            complexity_level = '低'
        
        items.append({
            'representative_id': row.representative_id,
            'name': row.name,
            'formula': row.formula,
            'formula_hash': row.formula_hash,
            'role': row.role,
            'data_type': row.data_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'complexity': score,
            'complexity_level': complexity_level,
            'formula_length': row.formula_length or 0,
            'total_references': row.total_references or 0,
            'datasources': datasources,
            'datasource_count': len(datasources),
            'workbooks': workbooks,
            'workbook_count': len(workbooks)
        })
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/metrics/catalog/unused')
def get_metrics_catalog_unused():
    """
    获取未使用指标分析 - 聚合视角
    
    聚合规则：按 (name + formula_hash) 分组
    筛选条件：total_references = 0 的指标
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 直接从 calculated_fields 表查询（新的四表架构）
    # 修正：使用 unique_id 进行聚合，区分不同数据源
    sql = """
        SELECT 
            MIN(cf.id) as representative_id,
            cf.unique_id,
            MAX(cf.name) as name,
            MAX(cf.formula) as formula,
            MAX(cf.formula_hash) as formula_hash,
            MAX(cf.role) as role,
            MAX(cf.data_type) as data_type,
            MAX(cf.description) as description,
            COUNT(*) as instance_count,
            MAX(cf.complexity_score) as complexity,
            COALESCE(SUM(cf.reference_count), 0) as total_references,
            MAX(d.name) as datasource_name,
            GROUP_CONCAT(DISTINCT cf.datasource_id) as datasource_ids,
            GROUP_CONCAT(DISTINCT d.name) as datasource_names,
            GROUP_CONCAT(DISTINCT cf.workbook_id) as workbook_ids,
            GROUP_CONCAT(DISTINCT w.name) as workbook_names
        FROM calculated_fields cf
        LEFT JOIN datasources d ON cf.datasource_id = d.id
        LEFT JOIN workbooks w ON cf.workbook_id = w.id
        GROUP BY cf.unique_id
        HAVING COALESCE(SUM(cf.reference_count), 0) = 0
           AND COALESCE(SUM(cf.usage_count), 0) = 0
        ORDER BY instance_count DESC, name
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = []
    for row in rows:
        ds_ids = row.datasource_ids.split(',') if row.datasource_ids else []
        ds_names = row.datasource_names.split(',') if row.datasource_names else []
        datasources = [{'id': ds_ids[i] if i < len(ds_ids) else None, 'name': ds_names[i]} 
                       for i in range(len(ds_names))]
        
        wb_ids = row.workbook_ids.split(',') if row.workbook_ids else []
        wb_names = row.workbook_names.split(',') if row.workbook_names else []
        workbooks = [{'id': wb_ids[i] if i < len(wb_ids) else None, 'name': wb_names[i]} 
                     for i in range(len(wb_names))]
        
        items.append({
            'representative_id': row.representative_id,
            'unique_id': row.unique_id,
            'name': row.name,
            'formula': row.formula,
            'formula_hash': row.formula_hash,
            'role': row.role,
            'data_type': row.data_type,
            'description': row.description or '',
            'instance_count': row.instance_count,
            'complexity': row.complexity or 0,
            'total_references': row.total_references or 0,
            'datasources': datasources,
            'datasource_count': len(datasources),
            'workbooks': workbooks,
            'workbook_count': len(workbooks),
            'datasource_name': row.datasource_name or '-'
        })
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


# -------------------- 指标列表 API --------------------

@api_bp.route('/metrics')
def get_metrics():
    """
    获取指标列表 - 使用新的 calculated_fields 表
    
    指标定义：计算字段实例
    - 业务指标：role='measure' 的计算字段
    - 技术计算：role='dimension' 的计算字段
    """
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    metric_type = request.args.get('metric_type', 'all')
    role_filter = request.args.get('role', '')
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    
    from sqlalchemy import text
    
    # 构建动态 WHERE 条件
    conditions = []
    params = {}
    
    if metric_type == 'business':
        conditions.append("cf.role = 'measure'")
    elif metric_type == 'technical':
        conditions.append("cf.role = 'dimension'")
    
    if role_filter:
        conditions.append("cf.role = :role_filter")
        params['role_filter'] = role_filter
    
    if search:
        conditions.append("(cf.name LIKE :search OR cf.formula LIKE :search)")
        params['search'] = f'%{search}%'
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # Facets 统计
    facets_sql = f"""
        SELECT 
            'metricType' as facet_key,
            CASE WHEN cf.role = 'measure' THEN 'business' ELSE 'technical' END as facet_value,
            COUNT(*) as cnt
        FROM calculated_fields cf
        {where_clause}
        GROUP BY facet_value
        UNION ALL
        SELECT 'role', cf.role, COUNT(*)
        FROM calculated_fields cf
        {where_clause}
        WHERE cf.role IS NOT NULL
        GROUP BY cf.role
    """
    facets_rows = session.execute(text(facets_sql), params).fetchall()
    facets = {}
    for row in facets_rows:
        key, value, cnt = row
        if key not in facets:
            facets[key] = {}
        if value:
            facets[key][value] = cnt
    
    # 1. 统计查询
    stats_sql = f"""
        SELECT COUNT(*) as total FROM calculated_fields cf {where_clause}
    """
    stats = session.execute(text(stats_sql), params).first()
    total = stats.total or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 2. 构建排序
    order_clause = "ORDER BY cf.name ASC"
    if sort == 'complexity':
        order_clause = f"ORDER BY cf.complexity_score {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'referenceCount':
        order_clause = f"ORDER BY cf.reference_count {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'name':
        order_clause = f"ORDER BY cf.name {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'usageCount':
        order_clause = f"ORDER BY cf.usage_count {'DESC' if order == 'desc' else 'ASC'}"
    
    # 3. 数据查询
    offset = (page - 1) * page_size
    params['limit'] = page_size
    params['offset'] = offset
    
    data_sql = f"""
        SELECT 
            cf.id, cf.name, cf.description, cf.role, cf.data_type,
            cf.formula, cf.formula_hash, cf.complexity_score, cf.reference_count,
            cf.usage_count, cf.unique_id,
            cf.datasource_id, cf.workbook_id, cf.created_at, cf.updated_at,
            d.name as datasource_name
        FROM calculated_fields cf
        LEFT JOIN datasources d ON cf.datasource_id = d.id
        {where_clause}
        {order_clause}
        LIMIT :limit OFFSET :offset
    """
    rows = session.execute(text(data_sql), params).fetchall()
    
    # 4. 构建结果
    metrics = []
    for row in rows:
        metrics.append({
            'id': row.id,
            'name': row.name,
            'description': row.description or '',
            'formula': row.formula or '',
            'formulaHash': row.formula_hash,
            'role': row.role,
            'dataType': row.data_type,
            'complexity': row.complexity_score or 0,
            'referenceCount': row.reference_count or 0,
            'datasourceName': row.datasource_name or '-',
            'datasourceId': row.datasource_id,
            'workbookId': row.workbook_id,
            'uniqueId': row.unique_id,  # 关联的标准指标ID
            'usageCount': row.usage_count or 0,
            'createdAt': row.created_at.isoformat() if row.created_at else None,
            'updatedAt': row.updated_at.isoformat() if row.updated_at else None
        })
    
    return jsonify({
        'items': metrics,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'facets': facets
    })


@api_bp.route('/metrics/<metric_id>')
def get_metric_detail(metric_id):
    """获取单条指标详情
    
    支持两种模式：
    1. 聚合模式（默认）：显示标准指标的聚合统计，包括所有实例的汇总
    2. 实例模式（mode=instance）：显示单个计算字段实例的详情
    
    入口场景：
    - 计算字段列表卡片 → 聚合模式（传 unique_id 或 representative_id）
    - 工作簿/数据源详情→计算字段 → 实例模式（传实例 id + mode=instance）
    - 同定义指标Tab→点击实例 → 实例模式（传实例 id + mode=instance）
    """
    session = g.db_session
    from sqlalchemy import text
    from flask import request
    
    # 获取模式参数
    mode = request.args.get('mode', 'aggregate')  # 默认为聚合模式
    is_instance_mode = mode == 'instance'
    
    # ========== 实例模式：直接查询单个计算字段实例 ==========
    if is_instance_mode:
        metric_sql = """
            SELECT 
                cf.id, cf.name, cf.description, cf.role, cf.data_type,
                cf.formula, cf.formula_hash, cf.complexity_score, cf.reference_count,
                cf.usage_count, cf.unique_id, cf.dependency_count,
                cf.datasource_id, cf.workbook_id, cf.created_at, cf.updated_at,
                d.name as datasource_name, d.project_name as ds_project_name, d.owner as ds_owner, 
                d.is_certified as ds_certified, d.vizportal_url_id,
                w.name as workbook_name, w.project_name as wb_project_name, w.owner as wb_owner
            FROM calculated_fields cf
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            LEFT JOIN workbooks w ON cf.workbook_id = w.id
            WHERE cf.id = :metric_id
        """
        metric_row = session.execute(text(metric_sql), {'metric_id': metric_id}).first()
        
        if not metric_row:
            return jsonify({'error': 'Not found'}), 404
        
        # 构建实例详情数据
        data = {
            'id': metric_row.id,
            'uniqueId': metric_row.unique_id,
            'name': metric_row.name,
            'description': metric_row.description or '',
            'formula': metric_row.formula,
            'formulaHash': metric_row.formula_hash,
            'role': metric_row.role,
            'dataType': metric_row.data_type,
            'complexity': metric_row.complexity_score or 0,
            'referenceCount': metric_row.reference_count or 0,
            'usageCount': metric_row.usage_count or 0,
            'dependencyCount': metric_row.dependency_count or 0,
            'datasourceId': metric_row.datasource_id,
            'datasourceName': metric_row.datasource_name or '-',
            'workbookId': metric_row.workbook_id,
            'workbookName': metric_row.workbook_name,
            'createdAt': str(metric_row.created_at) if metric_row.created_at else None,
            'updatedAt': str(metric_row.updated_at) if metric_row.updated_at else None,
            'mode': 'instance',  # 标记为实例模式
            'instanceCount': 1,  # 实例模式只显示自己
        }
        
        # 实例模式：只查询该实例自己的依赖字段
        metric_deps = session.execute(text("""
            SELECT DISTINCT cfd.dependency_name, cfd.dependency_regular_field_id, 
                   rf.name as field_name, rf.role, rf.data_type
            FROM calc_field_dependencies cfd
            LEFT JOIN regular_fields rf ON cfd.dependency_regular_field_id = rf.id
            WHERE cfd.source_field_id = :field_id
        """), {'field_id': metric_id}).fetchall()
        
        data['dependencyFields'] = [{
            'name': row[0], 'id': row[1], 'fieldName': row[2],
            'role': row[3], 'dataType': row[4]
        } for row in metric_deps]
        
        # 实例模式：只查询该实例的视图
        views_result = session.execute(text("""
            SELECT v.id, v.name, v.view_type, v.workbook_id, w.name as wb_name, w.project_name, w.owner
            FROM calc_field_to_view cfv
            JOIN views v ON cfv.view_id = v.id
            LEFT JOIN workbooks w ON v.workbook_id = w.id
            WHERE cfv.field_id = :field_id
        """), {'field_id': metric_id}).fetchall()
        
        views_data = [{
            'id': row[0], 'name': row[1], 'view_type': row[2],
            'workbook_id': row[3], 'workbook_name': row[4]
        } for row in views_result]
        
        data['used_in_views'] = views_data
        data['usedInViews'] = views_data
        
        # 实例模式：查询依赖当前计算字段的其他计算字段（影响指标）
        used_by_metrics = session.execute(text("""
            SELECT DISTINCT cf.id, cf.name, cf.formula, cf.role, cf.data_type,
                   cf.datasource_id, d.name as ds_name, cf.workbook_id, w.name as wb_name
            FROM calc_field_dependencies cfd
            JOIN calculated_fields cf ON cfd.source_field_id = cf.id
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            LEFT JOIN workbooks w ON cf.workbook_id = w.id
            WHERE cfd.dependency_calc_field_id = :field_id
            LIMIT 100
        """), {'field_id': metric_id}).fetchall()
        
        data['used_by_metrics'] = [{
            'id': row[0], 'name': row[1], 'formula': row[2], 'role': row[3], 'dataType': row[4],
            'datasourceId': row[5], 'datasourceName': row[6],
            'workbookId': row[7], 'workbookName': row[8]
        } for row in used_by_metrics]
        
        # 实例模式：单个实例没有"同定义指标"概念，但可以显示归属的标准指标
        data['instances'] = []  # 不显示同定义指标Tab
        data['similar'] = []  # 不显示同名定义Tab
        
        # 血缘：只显示该实例的
        data['all_datasources'] = [{
            'id': metric_row.datasource_id, 'name': metric_row.datasource_name,
            'project_name': metric_row.ds_project_name, 'owner': metric_row.ds_owner,
            'is_certified': bool(metric_row.ds_certified) if metric_row.ds_certified else False
        }] if metric_row.datasource_id else []
        
        data['all_workbooks'] = [{
            'id': metric_row.workbook_id, 'name': metric_row.workbook_name,
            'project_name': metric_row.wb_project_name, 'owner': metric_row.wb_owner
        }] if metric_row.workbook_id else []
        
        # Tableau URL
        if metric_row.vizportal_url_id:
            data['tableau_url'] = build_tableau_url('datasource', vizportal_url_id=metric_row.vizportal_url_id)
        else:
            data['tableau_url'] = None
        
        # Stats
        data['stats'] = {
            'view_count': len(views_data),
            'workbook_count': 1 if metric_row.workbook_id else 0,
            'dependency_count': len(data['dependencyFields']),
            'duplicate_count': 0,
            'datasource_count': 1 if metric_row.datasource_id else 0,
            'table_count': 0
        }
        
        return jsonify(data)
    
    # ========== 聚合模式：查询标准指标的聚合统计 ==========
    # 1. 尝试查询 Unique Metric (标准指标)
    unique_sql = """
        SELECT 
            ucf.id, ucf.name, ucf.description, ucf.formula, ucf.formula_hash, 
            ucf.complexity_score, ucf.created_at
        FROM unique_calculated_fields ucf
        WHERE ucf.id = :metric_id
    """
    unique_row = session.execute(text(unique_sql), {'metric_id': metric_id}).first()
    
    unique_id = None
    representative_metric_id = None
    vizportal_url_id = None
    data = {}

    if unique_row:
        # ========== CASE A: 是标准指标 ID ==========
        unique_id = unique_row.id
        
        # 聚合统计信息
        stats_sql = """
            SELECT 
                COUNT(*) as instance_count,
                COALESCE(SUM(usage_count), 0) as total_usage,
                COALESCE(SUM(reference_count), 0) as total_references,
                MAX(role) as role,
                MAX(data_type) as data_type,
                MAX(id) as max_id
            FROM calculated_fields
            WHERE unique_id = :unique_id
        """
        stats = session.execute(text(stats_sql), {'unique_id': unique_id}).first()
        representative_metric_id = stats.max_id if stats else None
        
        data = {
            'id': unique_row.id,
            'uniqueId': unique_row.id,
            'name': unique_row.name,
            'description': unique_row.description or '',
            'formula': unique_row.formula,
            'formulaHash': unique_row.formula_hash,
            'role': stats.role if stats else None,
            'dataType': stats.data_type if stats else None,
            'complexity': unique_row.complexity_score or 0,
            'referenceCount': stats.total_references if stats else 0,
            'usageCount': stats.total_usage if stats else 0,
            'instanceCount': stats.instance_count if stats else 0,
            'createdAt': str(unique_row.created_at) if unique_row.created_at else None,
            'datasourceId': None,
            'datasourceName': '多数据源聚合',
            'workbookId': None,
            'workbookName': None,
            'mode': 'aggregate',  # 标记为聚合模式
        }
        
    else:
        # ========== CASE B: 不是标准指标 ID，尝试物理指标 ID ==========
        metric_sql = """
            SELECT 
                cf.id, cf.name, cf.description, cf.role, cf.data_type,
                cf.formula, cf.formula_hash, cf.complexity_score, cf.reference_count,
                cf.usage_count, cf.unique_id,
                cf.datasource_id, cf.workbook_id, cf.created_at, cf.updated_at,
                d.name as datasource_name, d.project_name as ds_project_name, d.owner as ds_owner, 
                d.is_certified as ds_certified, d.vizportal_url_id,
                w.name as workbook_name, w.project_name as wb_project_name, w.owner as wb_owner
            FROM calculated_fields cf
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            LEFT JOIN workbooks w ON cf.workbook_id = w.id
            WHERE cf.id = :metric_id
        """
        metric_row = session.execute(text(metric_sql), {'metric_id': metric_id}).first()
        
        if not metric_row:
            return jsonify({'error': 'Not found'}), 404
            
        unique_id = metric_row.unique_id
        representative_metric_id = metric_row.id
        vizportal_url_id = metric_row.vizportal_url_id
        
        # 聚合模式：即使传入的是实例ID，也要聚合所有同定义实例的统计
        agg_stats = session.execute(text("""
            SELECT 
                COUNT(*) as instance_count,
                COALESCE(SUM(usage_count), 0) as total_usage,
                COALESCE(SUM(reference_count), 0) as total_references
            FROM calculated_fields
            WHERE unique_id = :unique_id
        """), {'unique_id': unique_id}).first()
        
        data = {
            'id': metric_row.id,
            'uniqueId': metric_row.unique_id,
            'name': metric_row.name,
            'description': metric_row.description or '',
            'formula': metric_row.formula,
            'formulaHash': metric_row.formula_hash,
            'role': metric_row.role,
            'dataType': metric_row.data_type,
            'complexity': metric_row.complexity_score or 0,
            'referenceCount': agg_stats.total_references if agg_stats else 0,  # 聚合统计
            'usageCount': agg_stats.total_usage if agg_stats else 0,  # 聚合统计
            'instanceCount': agg_stats.instance_count if agg_stats else 1,  # 实例数量
            'datasourceId': metric_row.datasource_id,
            'datasourceName': metric_row.datasource_name or '-',
            'workbookId': metric_row.workbook_id,
            'workbookName': metric_row.workbook_name,
            'createdAt': str(metric_row.created_at) if metric_row.created_at else None,
            'updatedAt': str(metric_row.updated_at) if metric_row.updated_at else None,
            'mode': 'aggregate',  # 标记为聚合模式
        }

    formula_hash = data.get('formulaHash')
    clean_name = data['name'].strip() if data['name'] else ''
    
    # 1. 查找相似指标
    similar = []
    if formula_hash:
        # Avoid self-match if input ID was a physical ID
        # If input ID was unique ID, we should avoid matching that unique ID (which covers all its instances)
        # But 'similar' is based on formula_hash, so we just want other unique IDs or other physical IDs not in this group?
        # Let's keep it simple: filter out by current formula_hash and maybe name?
        # Ideally, we query calculated_fields.
        # Use query from original code but adapted.
        similar_result = session.execute(text("""
            SELECT cf.id, cf.name, cf.datasource_id, d.name as ds_name, cf.usage_count
            FROM calculated_fields cf
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            WHERE cf.formula_hash = :hash AND cf.unique_id != :unique_id
            LIMIT 50
        """), {'hash': formula_hash, 'unique_id': unique_id}).fetchall()
        
        for row in similar_result:
            similar.append({
                'id': row[0], 'name': row[1], 'datasourceId': row[2],
                'datasourceName': row[3] or 'Unknown', 'usageCount': row[4] or 0
            })
    data['similar'] = similar

    # Common Logic: Lineage & Associations (Based on Unique ID if available)
    if unique_id:
        # 2a. 获取同定义指标实例列表（相同 unique_id 的所有实例）
        instances_result = session.execute(text("""
            SELECT 
                cf.id, cf.name, cf.datasource_id, cf.workbook_id, 
                cf.usage_count, cf.reference_count, cf.dependency_count,
                d.name as datasource_name, d.project_name as ds_project,
                w.name as workbook_name, w.project_name as wb_project
            FROM calculated_fields cf
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            LEFT JOIN workbooks w ON cf.workbook_id = w.id
            WHERE cf.unique_id = :unique_id
            ORDER BY cf.usage_count DESC, cf.name
        """), {'unique_id': unique_id}).fetchall()
        
        data['instances'] = [{
            'id': row[0], 'name': row[1], 
            'datasourceId': row[2], 'workbookId': row[3],
            'usageCount': row[4] or 0, 'referenceCount': row[5] or 0, 'dependencyCount': row[6] or 0,
            'datasourceName': row[7] or '-', 'datasourceProject': row[8],
            'workbookName': row[9], 'workbookProject': row[10]
        } for row in instances_result]
        
        # 2. 获取依赖字段 (聚合所有实例)
        metric_deps = session.execute(text("""
            SELECT DISTINCT cfd.dependency_name, cfd.dependency_regular_field_id, 
                   rf.name as field_name, rf.role, rf.data_type
            FROM calc_field_dependencies cfd
            JOIN calculated_fields cf ON cfd.source_field_id = cf.id
            LEFT JOIN regular_fields rf ON cfd.dependency_regular_field_id = rf.id
            WHERE cf.unique_id = :unique_id
        """), {'unique_id': unique_id}).fetchall()
        
        data['dependencyFields'] = [{
            'name': row[0], 'id': row[1], 'fieldName': row[2],
            'role': row[3], 'dataType': row[4]
        } for row in metric_deps]

        # 3.1 聚合物理表血缘
        table_lineage_result = session.execute(text("""
            SELECT DISTINCT fl.table_id, t.name, t.schema, db.name as db_name, t.database_id
            FROM calculated_fields cf
            JOIN calc_field_full_lineage fl ON cf.id = fl.field_id
            JOIN tables t ON fl.table_id = t.id
            LEFT JOIN databases db ON t.database_id = db.id
            WHERE cf.unique_id = :unique_id AND fl.table_id IS NOT NULL AND t.id IS NOT NULL
        """), {'unique_id': unique_id}).fetchall()
        
        data['derived_tables'] = [{
            'id': row[0], 'name': row[1], 'schema': row[2],
            'database_name': row[3], 'database_id': row[4]
        } for row in table_lineage_result]
        data['derivedTables'] = data['derived_tables']
        
        # 3.2 聚合数据源血缘
        ds_lineage_result = session.execute(text("""
            SELECT DISTINCT fl.datasource_id, d.name, d.project_name, d.owner, d.is_certified
            FROM calculated_fields cf
            JOIN calc_field_full_lineage fl ON cf.id = fl.field_id
            LEFT JOIN datasources d ON fl.datasource_id = d.id
            WHERE cf.unique_id = :unique_id AND fl.datasource_id IS NOT NULL AND d.id IS NOT NULL
        """), {'unique_id': unique_id}).fetchall()
        
        data['all_datasources'] = [{
            'id': row[0], 'name': row[1], 'project_name': row[2],
            'owner': row[3], 'is_certified': bool(row[4]) if row[4] is not None else False
        } for row in ds_lineage_result]
        
        # 3.3 聚合工作簿血缘
        wb_lineage_result = session.execute(text("""
            SELECT DISTINCT fl.workbook_id, w.name, w.project_name, w.owner
            FROM calculated_fields cf
            JOIN calc_field_full_lineage fl ON cf.id = fl.field_id
            LEFT JOIN workbooks w ON fl.workbook_id = w.id
            WHERE cf.unique_id = :unique_id AND fl.workbook_id IS NOT NULL AND w.id IS NOT NULL
        """), {'unique_id': unique_id}).fetchall()
        
        data['all_workbooks'] = [{
            'id': row[0], 'name': row[1], 'project_name': row[2], 'owner': row[3]
        } for row in wb_lineage_result]
        
        # 3.4 聚合视图血缘
        views_result = session.execute(text("""
            SELECT DISTINCT cfv.view_id, v.name, v.view_type, v.workbook_id, w.name as wb_name, w.project_name, w.owner
            FROM calc_field_to_view cfv
            JOIN calculated_fields cf ON cfv.field_id = cf.id
            JOIN views v ON cfv.view_id = v.id
            LEFT JOIN workbooks w ON v.workbook_id = w.id
            WHERE cf.unique_id = :unique_id
        """), {'unique_id': unique_id}).fetchall()
        
        # 3.5 聚合影响指标（依赖当前计算字段的其他计算字段）
        used_by_metrics_result = session.execute(text("""
            SELECT DISTINCT cf_dep.id, cf_dep.name, cf_dep.formula, cf_dep.role, cf_dep.data_type,
                   cf_dep.datasource_id, d.name as ds_name, cf_dep.workbook_id, w.name as wb_name
            FROM calc_field_dependencies cfd
            JOIN calculated_fields cf ON cfd.dependency_calc_field_id = cf.id
            JOIN calculated_fields cf_dep ON cfd.source_field_id = cf_dep.id
            LEFT JOIN datasources d ON cf_dep.datasource_id = d.id
            LEFT JOIN workbooks w ON cf_dep.workbook_id = w.id
            WHERE cf.unique_id = :unique_id
            LIMIT 100
        """), {'unique_id': unique_id}).fetchall()
        
        # 预计算影响指标总数（聚合所有实例的 reference_count）
        impact_count_result = session.execute(text("""
            SELECT COALESCE(SUM(reference_count), 0) as total
            FROM calculated_fields
            WHERE unique_id = :unique_id
        """), {'unique_id': unique_id}).first()
        data['impact_metric_count'] = impact_count_result.total if impact_count_result else 0
        
        data['used_by_metrics'] = [{
            'id': row[0], 'name': row[1], 'formula': row[2], 'role': row[3], 'dataType': row[4],
            'datasourceId': row[5], 'datasourceName': row[6],
            'workbookId': row[7], 'workbookName': row[8]
        } for row in used_by_metrics_result]

    else:
        # Fallback
        data['dependencyFields'] = []
        data['derived_tables'] = []
        data['derivedTables'] = []
        if 'all_datasources' not in data: data['all_datasources'] = []
        if 'all_workbooks' not in data: data['all_workbooks'] = []
        views_result = []
        data['used_by_metrics'] = []
        data['impact_metric_count'] = 0

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

    # Tableau URL
    if representative_metric_id and not vizportal_url_id:
        url_sql = """
            SELECT d.vizportal_url_id 
            FROM calculated_fields cf
            LEFT JOIN datasources d ON cf.datasource_id = d.id
            WHERE cf.id = :rid
        """
        res = session.execute(text(url_sql), {'rid': representative_metric_id}).first()
        if res:
            vizportal_url_id = res.vizportal_url_id
            
    if vizportal_url_id:
        data['tableau_url'] = build_tableau_url('datasource', vizportal_url_id=vizportal_url_id)
    else:
        data['tableau_url'] = None
    
    # Stats
    data['stats'] = {
        'view_count': len(views_data),
        'workbook_count': len(data['all_workbooks']),
        'dependency_count': len(data['dependencyFields']),
        'duplicate_count': len(data['similar']),
        'datasource_count': len(data['all_datasources']),
        'table_count': len(data['derived_tables'])
    }
    
    return jsonify(data)


@api_bp.route('/metrics/<metric_id>', methods=['PUT'])
def update_metric(metric_id):
    """只读模式 - 禁止修改"""
    return jsonify({'error': '只读模式，禁止修改指标'}), 405


@api_bp.route('/metrics/<metric_id>/impact-metrics')
def get_metric_impact_metrics(metric_id):
    """获取影响指标列表 - 支持分页加载
    
    返回依赖当前计算字段的其他计算字段列表
    支持分页参数: page, page_size
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size
    
    # 1. 先确定 unique_id
    # 尝试查询是否为 unique_id
    unique_check = session.execute(text("""
        SELECT id FROM unique_calculated_fields WHERE id = :id
    """), {'id': metric_id}).first()
    
    if unique_check:
        unique_id = metric_id
    else:
        # 尝试从 calculated_fields 获取 unique_id
        cf_check = session.execute(text("""
            SELECT unique_id FROM calculated_fields WHERE id = :id
        """), {'id': metric_id}).first()
        if not cf_check:
            return jsonify({'error': 'Not found'}), 404
        unique_id = cf_check.unique_id
    
    # 2. 查询总数
    count_result = session.execute(text("""
        SELECT COUNT(DISTINCT cf_dep.id) as total
        FROM calc_field_dependencies cfd
        JOIN calculated_fields cf ON cfd.dependency_calc_field_id = cf.id
        JOIN calculated_fields cf_dep ON cfd.source_field_id = cf_dep.id
        WHERE cf.unique_id = :unique_id
    """), {'unique_id': unique_id}).first()
    total = count_result.total if count_result else 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 3. 分页查询
    rows = session.execute(text("""
        SELECT DISTINCT cf_dep.id, cf_dep.name, cf_dep.formula, cf_dep.role, cf_dep.data_type,
               cf_dep.datasource_id, d.name as ds_name, cf_dep.workbook_id, w.name as wb_name,
               cf_dep.usage_count, cf_dep.reference_count
        FROM calc_field_dependencies cfd
        JOIN calculated_fields cf ON cfd.dependency_calc_field_id = cf.id
        JOIN calculated_fields cf_dep ON cfd.source_field_id = cf_dep.id
        LEFT JOIN datasources d ON cf_dep.datasource_id = d.id
        LEFT JOIN workbooks w ON cf_dep.workbook_id = w.id
        WHERE cf.unique_id = :unique_id
        ORDER BY cf_dep.usage_count DESC, cf_dep.name
        LIMIT :limit OFFSET :offset
    """), {'unique_id': unique_id, 'limit': page_size, 'offset': offset}).fetchall()
    
    items = [{
        'id': row[0], 'name': row[1], 'formula': row[2], 'role': row[3], 'dataType': row[4],
        'datasourceId': row[5], 'datasourceName': row[6],
        'workbookId': row[7], 'workbookName': row[8],
        'usageCount': row[9] or 0, 'referenceCount': row[10] or 0
    } for row in rows]
    
    return jsonify({
        'items': items,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages
    })
