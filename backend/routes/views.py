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
    """
    session = g.db_session
    from sqlalchemy import text
    
    # 查询访问量为0的视图（仅仪表盘 + 独立sheet）
    # 排除被仪表盘包含的sheet，避免重复统计
    sql = """
        SELECT 
            v.id, v.name, v.view_type, v.workbook_id,
            w.name as workbook_name
        FROM views v
        LEFT JOIN workbooks w ON v.workbook_id = w.id
        WHERE (v.total_view_count IS NULL OR v.total_view_count = 0)
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
                'views': []
            }
        
        groups_map[wb_name]['views'].append({
            'id': row.id,
            'name': row.name,
            'view_type': row.view_type or 'sheet'
        })
    
    groups = sorted(groups_map.values(), key=lambda grp: len(grp['views']), reverse=True)
    for grp in groups:
        grp['view_count'] = len(grp['views'])
    
    return jsonify({
        'total_count': len(rows),
        'workbook_count': len(groups),
        'groups': groups
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
            'view_type': row.view_type or 'sheet',
            'total_view_count': count,
            'workbook_name': row.workbook_name or '-',
            'heat_level': heat_level
        })
    
    return jsonify({
        'total_count': len(items),
        'max_views': max_views,
        'avg_views': avg_views,
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
    include_standalone = request.args.get('include_standalone', '')
    
    offset = (page - 1) * page_size
    query = session.query(View)
    
    # 筛选逻辑
    if include_standalone == 'true':
        # 特殊模式：显示所有仪表盘 + 独立的 Sheet (不属于任何仪表盘)
        # 此模式通常用于"仪表盘列表" Tab
        from sqlalchemy import or_, and_, not_
        query = query.filter(
            or_(
                View.view_type == 'dashboard',
                and_(
                    View.view_type == 'sheet',
                    ~View.parent_dashboards.any()  # 不属于任何仪表盘
                )
            )
        )
    elif view_type:
        # 普通筛选
        query = query.filter(View.view_type == view_type)
        
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
    
    # Facets 统计
    from sqlalchemy import text
    facets = {}
    
    # view_type facet
    view_type_stats = session.execute(text("""
        SELECT view_type, COUNT(*) as cnt
        FROM views
        WHERE view_type IS NOT NULL
        GROUP BY view_type
    """)).fetchall()
    facets['view_type'] = {row[0]: row[1] for row in view_type_stats if row[0]}
    
    # workbook_name facet
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
    
    return jsonify({
        'items': [v.to_dict() for v in views],
        'total': total,
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
        'history': [{'count': h[0], 'recordedAt': h[1]} for h in history[:10]]  # 最近10条
    })


