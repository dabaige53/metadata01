"""
视图接口路由模块
包含视图列表、详情和治理分析接口
"""
from flask import jsonify, request, g
from sqlalchemy import text, bindparam, func
from sqlalchemy.orm import selectinload
from . import api_bp
from .utils import build_tableau_url
from ..models import View, Field, Workbook, Datasource

# ==================== 视图接口 ====================

# -------------------- 视图治理分析专用 API --------------------

@api_bp.route('/views/governance/zero-access')
def get_views_zero_access():
    """获取零访问视图分析（基于全量数据）
    
    只统计「仪表盘 + 独立Sheet」，排除被仪表盘包含的sheet，
    以保持与视图列表页面的总数一致。
    
    增强版：只统计有 luid 的视图（即 REST API 返回过访问统计的），
    排除因 luid 缺失而无法验证访问量的视图。
    
    支持 summary_only=true 参数，只返回工作簿摘要（不含具体视图列表），用于快速加载。
    """
    session = g.db_session
    from sqlalchemy import text
    
    summary_only = request.args.get('summary_only', 'false').lower() == 'true'
    
    # 查询访问量为0的视图（仅仪表盘 + 独立sheet）
    # 排除被仪表盘包含的sheet，避免重复统计
    # 🆕 增加 luid 条件：只统计有 luid 的视图（真正可验证的零访问）
    sql = """
        SELECT 
            v.id, v.name, v.view_type, v.workbook_id,
            w.name as workbook_name
        FROM views v
        LEFT JOIN workbooks w ON v.workbook_id = w.id
        WHERE (v.total_view_count IS NULL OR v.total_view_count = 0)
          AND v.luid IS NOT NULL AND v.luid != ''
          AND (
              v.view_type = 'dashboard' 
              OR (v.view_type = 'sheet' AND v.id NOT IN (SELECT sheet_id FROM dashboard_to_sheet))
          )
        ORDER BY w.name, v.name
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 按工作簿分组
    groups_map = {}
    for row in rows:
        wb_name = row.workbook_name or '未知工作簿'
        
        if wb_name not in groups_map:
            groups_map[wb_name] = {
                'workbook_name': wb_name,
                'workbook_id': row.workbook_id,
                'views': [] if not summary_only else None,  # summary_only 模式不返回视图列表
                'view_count': 0
            }
        
        groups_map[wb_name]['view_count'] += 1
        
        if not summary_only:
            groups_map[wb_name]['views'].append({
                'id': row.id,
                'name': row.name,
                'view_type': row.view_type or 'sheet'
            })
    
    groups = sorted(groups_map.values(), key=lambda grp: grp['view_count'], reverse=True)
    
    # summary_only 模式下移除空的 views 列表
    if summary_only:
        for grp in groups:
            del grp['views']
    
    return jsonify({
        'total_count': len(rows),
        'workbook_count': len(groups),
        'groups': groups
    })


@api_bp.route('/views/governance/zero-access/workbook/<workbook_id>')
def get_zero_access_views_by_workbook(workbook_id):
    """获取指定工作簿下的零访问视图列表（懒加载）"""
    session = g.db_session
    from sqlalchemy import text
    
    sql = """
        SELECT v.id, v.name, v.view_type
        FROM views v
        WHERE v.workbook_id = :workbook_id
          AND (v.total_view_count IS NULL OR v.total_view_count = 0)
          AND (
              v.view_type = 'dashboard' 
              OR (v.view_type = 'sheet' AND v.id NOT IN (SELECT sheet_id FROM dashboard_to_sheet))
          )
        ORDER BY v.name
    """
    rows = session.execute(text(sql), {'workbook_id': workbook_id}).fetchall()
    
    views = [{
        'id': row.id,
        'name': row.name,
        'view_type': row.view_type or 'sheet'
    } for row in rows]
    
    return jsonify({
        'workbook_id': workbook_id,
        'views': views,
        'count': len(views)
    })


@api_bp.route('/views/governance/hot')
def get_views_hot():
    """获取热门视图排行榜（基于全量数据，访问量 > 100）
    
    只统计「仪表盘 + 独立Sheet」，排除被仪表盘包含的sheet，
    以保持与视图列表页面的统计口径一致。
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 热门视图（仅仪表盘 + 独立sheet）
    sql = """
        SELECT 
            v.id, v.name, v.view_type, v.total_view_count,
            v.workbook_id, w.name as workbook_name
        FROM views v
        LEFT JOIN workbooks w ON v.workbook_id = w.id
        WHERE v.total_view_count > 100
          AND (
              v.view_type = 'dashboard' 
              OR (v.view_type = 'sheet' AND v.id NOT IN (SELECT sheet_id FROM dashboard_to_sheet))
          )
        ORDER BY v.total_view_count DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
    # 计算统计数据
    view_counts = [row.total_view_count for row in rows]
    max_views = max(view_counts) if view_counts else 0
    avg_views = round(sum(view_counts) / len(view_counts)) if view_counts else 0
    
    items = []
    for row in rows:
        count = row.total_view_count or 0
        if count >= 10000:
            heat_level = '超热门'
        elif count >= 1000:
            heat_level = '热门'
        elif count >= 500:
            heat_level = '活跃'
        else:
            heat_level = '常用'
        
        items.append({
            'id': row.id,
            'name': row.name,
            'viewType': row.view_type or 'sheet',
            'totalViewCount': count,
            'workbookName': row.workbook_name or '-',
            'heatLevel': heat_level
        })
    
    return jsonify({
        'totalCount': len(items),
        'maxViews': max_views,
        'avgViews': avg_views,
        'items': items
    })


# -------------------- 视图列表 API --------------------

@api_bp.route('/views')
def get_views():
    session = g.db_session
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    
    view_type = request.args.get('view_type', '')
    workbook_name = request.args.get('workbook_name', '')
    include_standalone = request.args.get('include_standalone', '')
    
    offset = (page - 1) * page_size
    base_query = session.query(View)
    query = base_query
    
    # 筛选逻辑
    if include_standalone == 'true':
        # 特殊模式：显示所有仪表盘 + 独立的 Sheet (不属于任何仪表盘)
        # 此模式通常用于"仪表盘列表" Tab
        from sqlalchemy import or_, and_, not_
        base_query = base_query.filter(
            or_(
                View.view_type == 'dashboard',
                and_(
                    View.view_type == 'sheet',
                    ~View.parent_dashboards.any()  # 不属于任何仪表盘
                )
            )
        )
        query = base_query
    
    if view_type:
        view_types = [value for value in view_type.split(',') if value]
        if include_standalone == 'true' and 'sheet' in view_types and 'dashboard' not in view_types:
            query = query.filter(View.view_type == 'sheet', ~View.parent_dashboards.any())
        elif len(view_types) == 1:
            query = query.filter(View.view_type == view_types[0])
        else:
            query = query.filter(View.view_type.in_(view_types))
    
    if workbook_name:
        workbook_names = [value for value in workbook_name.split(',') if value]
        if len(workbook_names) == 1:
            query = query.filter(View.workbook.has(Workbook.name == workbook_names[0]))
        else:
            query = query.filter(View.workbook.has(Workbook.name.in_(workbook_names)))
        
    base_total = base_query.count()
    total = query.count()
    
    # 排序
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'asc')

    if sort == 'total_view_count':
        query = query.order_by(View.total_view_count.desc() if order == 'desc' else View.total_view_count.asc())
    elif sort == 'name':
         query = query.order_by(View.name.desc() if order == 'desc' else View.name.asc())
    elif include_standalone == 'true':
        # 默认：优先显示仪表盘，然后是独立视图
        query = query.order_by(View.view_type.asc(), View.name.asc()) # dashboard < sheet
    else:
        query = query.order_by(View.name.asc())
    
    views = query.limit(page_size).offset(offset).all()
    
    # 预查询统计数据，确保列表与详情一致
    view_ids = [v.id for v in views]
    stats_map = {}
    if view_ids:
        stats_sql = text("""
            SELECT 
                fv.view_id,
                COUNT(DISTINCT CASE WHEN f.is_calculated = 0 THEN fv.field_id END) as field_count,
                COUNT(DISTINCT CASE WHEN f.is_calculated = 1 THEN fv.field_id END) as metric_count
            FROM field_to_view fv
            JOIN fields f ON fv.field_id = f.id
            WHERE fv.view_id IN :view_ids
            GROUP BY fv.view_id
        """).bindparams(bindparam('view_ids', expanding=True))
        rows = session.execute(stats_sql, {'view_ids': list(view_ids)}).fetchall()
        stats_map = {row[0]: {'field_count': row[1], 'metric_count': row[2]} for row in rows}

    # Facets 统计
    facets = {}
    
    if include_standalone == 'true':
        view_type_stats = session.execute(text("""
            SELECT v.view_type, COUNT(*) as cnt
            FROM views v
            WHERE v.view_type IS NOT NULL
              AND (
                v.view_type = 'dashboard'
                OR (v.view_type = 'sheet' AND v.id NOT IN (SELECT sheet_id FROM dashboard_to_sheet))
              )
            GROUP BY v.view_type
        """)).fetchall()
        facets['view_type'] = {row[0]: row[1] for row in view_type_stats if row[0]}
        
        workbook_stats = session.execute(text("""
            SELECT w.name as workbook_name, COUNT(*) as cnt
            FROM views v
            LEFT JOIN workbooks w ON v.workbook_id = w.id
            WHERE w.name IS NOT NULL
              AND (
                v.view_type = 'dashboard'
                OR (v.view_type = 'sheet' AND v.id NOT IN (SELECT sheet_id FROM dashboard_to_sheet))
              )
            GROUP BY w.name
            ORDER BY cnt DESC
            LIMIT 20
        """)).fetchall()
        facets['workbook_name'] = {row[0]: row[1] for row in workbook_stats if row[0]}
    else:
        view_type_stats = session.execute(text("""
            SELECT view_type, COUNT(*) as cnt
            FROM views
            WHERE view_type IS NOT NULL
            GROUP BY view_type
        """)).fetchall()
        facets['view_type'] = {row[0]: row[1] for row in view_type_stats if row[0]}
        
        workbook_stats = session.execute(text("""
            SELECT w.name as workbook_name, COUNT(*) as cnt
            FROM views v
            LEFT JOIN workbooks w ON v.workbook_id = w.id
            WHERE w.name IS NOT NULL
            GROUP BY w.name
            ORDER BY cnt DESC
            LIMIT 20
        """)).fetchall()
        facets['workbook_name'] = {row[0]: row[1] for row in workbook_stats if row[0]}
    
    results = []
    for v in views:
        data = v.to_dict()
        v_stats = stats_map.get(v.id, {})
        data['field_count'] = v_stats.get('field_count', 0)
        data['metric_count'] = v_stats.get('metric_count', 0)
        results.append(data)

    return jsonify({
        'items': results,
        'total': total,
        'base_total': base_total,
        'page': page,
        'page_size': page_size,
        'facets': facets
    })


@api_bp.route('/views/<view_id>')
def get_view_detail(view_id):
    """获取视图详情 - 完整上下文"""
    session = g.db_session
    
    from sqlalchemy.orm import selectinload
    
    # 预加载 fields 和 workbook
    view = session.query(View).options(
        selectinload(View.fields),
        selectinload(View.workbook)
    ).filter(View.id == view_id).first()
    if not view:
        return jsonify({'error': 'Not found'}), 404
    
    data = view.to_dict()
    
    # 所属工作簿信息
    if view.workbook:
        data['workbook_info'] = {
            'id': view.workbook.id,
            'name': view.workbook.name,
            'project_name': view.workbook.project_name,
            'owner': view.workbook.owner
        }
    
    # 视图中使用的字段
    fields_data = []
    metrics_data = []
    for f in view.fields:
        f_info = {
            'id': f.id,
            'name': f.name,
            'data_type': f.data_type,
            'role': f.role,
            'is_calculated': f.is_calculated,
            'formula': f.formula if f.is_calculated else None
        }
        if f.is_calculated:
            metrics_data.append(f_info)
        else:
            fields_data.append(f_info)
    
    data['used_fields'] = fields_data
    data['used_metrics'] = metrics_data
    
    # 如果是仪表盘，包含的视图列表
    if view.view_type == 'dashboard' and view.contained_sheets:
        contained_views = []
        sheets_total_views = 0
        for sheet in view.contained_sheets:
            sheet_views = sheet.total_view_count or 0
            sheets_total_views += sheet_views
            contained_views.append({
                'id': sheet.id,
                'name': sheet.name,
                'viewType': sheet.view_type,
                'totalViewCount': sheet_views,
                'path': sheet.path
            })
        data['contained_views'] = contained_views
        data['containedViewCount'] = len(contained_views)
        # 聚合访问量：仪表盘自身访问量 + 所有包含视图的访问量
        dashboard_own_views = view.total_view_count or 0
        data['aggregatedViewCount'] = dashboard_own_views + sheets_total_views
    
    # 上游血缘：通过视图使用的字段反查数据源和物理表
    from sqlalchemy import text
    upstream_result = session.execute(text("""
        SELECT DISTINCT 
            fl.datasource_id, d.name as ds_name, d.project_name, d.is_certified,
            fl.table_id, t.name as table_name, t.schema, db.name as db_name
        FROM field_to_view ftv
        JOIN field_full_lineage fl ON ftv.field_id = fl.field_id
        LEFT JOIN datasources d ON fl.datasource_id = d.id
        LEFT JOIN tables t ON fl.table_id = t.id
        LEFT JOIN databases db ON t.database_id = db.id
        WHERE ftv.view_id = :view_id
    """), {'view_id': view_id}).fetchall()
    
    # 聚合上游数据源
    upstream_datasources = {}
    upstream_tables = {}
    for row in upstream_result:
        if row[0] and row[0] not in upstream_datasources:
            upstream_datasources[row[0]] = {
                'id': row[0],
                'name': row[1],
                'project_name': row[2],
                'is_certified': bool(row[3]) if row[3] is not None else False
            }
        if row[4] and row[4] not in upstream_tables:
            upstream_tables[row[4]] = {
                'id': row[4],
                'name': row[5],
                'schema': row[6],
                'database_name': row[7]
            }
    
    data['upstream_datasources'] = list(upstream_datasources.values())
    data['upstream_tables'] = list(upstream_tables.values())
    
    # 构建 Tableau Server 在线查看链接
    data['tableau_url'] = build_tableau_url('view', path=view.path)
    
    return jsonify(data)


@api_bp.route('/views/<view_id>/usage-stats')
def get_view_usage_stats(view_id):
    """获取视图访问统计（含今日/本周增量）"""
    session = g.db_session
    from sqlalchemy import text
    from datetime import datetime, timedelta
    
    view = session.query(View).filter(View.id == view_id).first()
    if not view:
        return jsonify({'error': 'Not found'}), 404
    
    current_count = view.total_view_count or 0
    
    # 计算今日和本周增量
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    
    # 查询历史记录
    history_stmt = text("""
        SELECT total_view_count, recorded_at 
        FROM view_usage_history 
        WHERE view_id = :view_id 
        ORDER BY recorded_at DESC
    """)
    history = session.execute(history_stmt, {'view_id': view_id}).fetchall()
    
    # 计算增量
    daily_delta = 0
    weekly_delta = 0
    
    if history:
        # 找到今天之前的最近一条记录
        found_daily_baseline = False
        for h in history:
            count, recorded_at = h[0], h[1]
            if isinstance(recorded_at, str):
                recorded_at = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
            if recorded_at < today_start:
                daily_delta = current_count - count
                found_daily_baseline = True
                break
        
        # 如果没有找到今天之前的记录，说明今天是首次记录，日增量 = 当前总量
        if not found_daily_baseline:
            daily_delta = current_count
        
        # 找到一周前的最近一条记录
        found_weekly_baseline = False
        for h in history:
            count, recorded_at = h[0], h[1]
            if isinstance(recorded_at, str):
                recorded_at = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
            if recorded_at < week_ago:
                weekly_delta = current_count - count
                found_weekly_baseline = True
                break
        
        # 如果没有找到一周前的记录，用最早的记录作为基准
        if not found_weekly_baseline and history:
            oldest = history[-1]
            oldest_count = oldest[0]
            weekly_delta = current_count - oldest_count
    else:
        # 没有任何历史记录，日增量和周增量都是当前总量
        daily_delta = current_count
        weekly_delta = current_count
    
    return jsonify({
        'viewId': view_id,
        'viewName': view.name,
        'totalViewCount': current_count,
        'dailyDelta': daily_delta,
        'weeklyDelta': weekly_delta,
    })


# -------------------- 视图子资源路由 --------------------

@api_bp.route('/views/<view_id>/fields')
def get_view_fields(view_id):
    """获取视图使用的字段列表"""
    session = g.db_session
    view = session.query(View).filter(View.id == view_id).first()
    if not view:
        return jsonify({'error': 'Not found'}), 404

    fields_data = [{
        'id': f.id, 'name': f.name, 'role': f.role, 'data_type': f.data_type
    } for f in view.fields if not f.is_calculated]
    return jsonify({'items': fields_data, 'total': len(fields_data)})


@api_bp.route('/views/<view_id>/metrics')
def get_view_metrics(view_id):
    """获取视图使用的指标列表"""
    session = g.db_session
    view = session.query(View).filter(View.id == view_id).first()
    if not view:
        return jsonify({'error': 'Not found'}), 404

    metrics_data = [{
        'id': f.id, 'name': f.name, 'formula': f.formula
    } for f in view.fields if f.is_calculated]
    return jsonify({'items': metrics_data, 'total': len(metrics_data)})


@api_bp.route('/views/<view_id>/usage')
def get_view_usage_redirect(view_id):
    """Alias for /usage-stats to fix 404 errors from frontend calls"""
    return get_view_usage_stats(view_id)
