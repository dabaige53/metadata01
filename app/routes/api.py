"""
REST API 路由
提供元数据查询和治理操作接口
"""
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func, case
from ..models import (
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    CalculatedField, Metric, MetricVariant, MetricDuplicate,
    TableauUser, Project
)

api_bp = Blueprint('api', __name__)


# ==================== 统计接口 ====================

@api_bp.route('/stats')
def get_stats():
    """获取全局统计数据"""
    session = g.db_session
    
    # 计算字段数量（作为指标/度量）
    calc_fields_count = session.query(CalculatedField).count()
    
    stats = {
        'databases': session.query(Database).count(),
        'tables': session.query(DBTable).count(),
        'fields': session.query(Field).count(),
        'calculatedFields': calc_fields_count,
        'datasources': session.query(Datasource).count(),
        'workbooks': session.query(Workbook).count(),
        'views': session.query(View).count(),
        'metrics': calc_fields_count,  # 指标数量 = 计算字段数量
        'duplicateMetrics': 0,  # 暂不计算重复
        'orphanedFields': session.query(Field).outerjoin(Field.views).filter(View.id == None).count(),
        'projects': session.query(Project).count(),
        'users': session.query(TableauUser).count()
    }
    
    return jsonify(stats)


import re
from collections import defaultdict

# ==================== 辅助函数：指标索引构建 ====================
def build_metric_index(session):
    """
    构建指标和字段的全局索引，用于快速查找引用关系。
    返回:
    1. field_id_map: {field_name: field_obj} (辅助查找)
    2. field_usage: {field_name: [metric_info]} (字段被哪些指标使用)
    3. metric_deps: {metric_id: [field_info]} (指标依赖哪些字段)
    4. formula_map: {formula: [metric_info]} (公式重复检测)
    """
    # 预加载所有字段，建立 Name -> ID 映射 (注意：重名问题暂取第一个，实际应结合 DataSource)
    all_fields = session.query(Field).all()
    field_id_map = {f.name: {'id': f.id, 'name': f.name, 'datasourceId': f.datasource_id} for f in all_fields}

    # 获取所有计算字段 (Metrics)
    results = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    ).all()
    
    field_usage = defaultdict(list)  # field_name -> [metric_info]
    metric_deps = defaultdict(list)  # metric_id -> [field_info]
    formula_map = defaultdict(list)  # formula -> [metric_info]
    
    for field, calc in results:
        m_info = {
            'id': field.id, 
            'name': field.name, 
            'datasourceId': field.datasource_id,
            'formula': calc.formula
        }
        
        if calc.formula:
            formula_clean = calc.formula.strip()
            # 存入公式索引，用于查重
            formula_map[formula_clean].append(m_info)
            
            # 解析依赖: [Sales] -> Sales
            refs = re.findall(r'\[(.*?)\]', formula_clean)
            unique_refs = list(set(refs))
            
            deps = []
            for ref_name in unique_refs:
                # 记录该字段被当前指标使用
                field_usage[ref_name].append(m_info)
                
                # 记录当前指标依赖该字段 (尝试解析为 ID)
                if ref_name in field_id_map:
                    deps.append(field_id_map[ref_name])
                else:
                    deps.append({'name': ref_name, 'id': None}) # 未找到对应 ID
            # 写入指标依赖索引
            metric_deps[field.id] = deps
            
    return field_usage, metric_deps, formula_map, field_id_map

# ==================== 仪表盘分析接口 ====================

@api_bp.route('/dashboard/analysis')
def get_dashboard_analysis():
    """获取仪表盘分析数据 - 基于真实数据的深度聚合分析"""
    session = g.db_session
    import datetime
    
    # ===== 1. 基础统计 =====
    total_fields = session.query(Field).count()
    total_calc_fields = session.query(CalculatedField).count()
    total_tables = session.query(DBTable).count()
    total_datasources = session.query(Datasource).count()
    total_workbooks = session.query(Workbook).count()
    total_views = session.query(View).count()
    
    # ===== 2. 字段来源分布 =====
    from_datasource = session.query(Field).filter(Field.datasource_id != None).count()
    from_table = session.query(Field).filter(Field.table_id != None).count()
    from_workbook = session.query(Field).filter(Field.workbook_id != None).count()
    orphan_fields = session.query(Field).filter(
        Field.datasource_id == None,
        Field.table_id == None,
        Field.workbook_id == None
    ).count()
    
    field_source_distribution = {
        'datasource': from_datasource,
        'table': from_table,
        'workbook': from_workbook,
        'orphan': orphan_fields
    }
    
    # ===== 3. 数据类型分布 =====
    type_results = session.query(
        Field.data_type, func.count(Field.id)
    ).group_by(Field.data_type).all()
    data_type_distribution = {(t or 'unknown'): c for t, c in type_results}
    
    # ===== 4. 角色分布（度量/维度） =====
    role_results = session.query(
        Field.role, func.count(Field.id)
    ).group_by(Field.role).all()
    role_distribution = {(r or 'unknown'): c for r, c in role_results}
    
    # ===== 5. 重复公式 Top 10 =====
    dupe_formulas = session.query(
        CalculatedField.formula, func.count(CalculatedField.field_id).label('cnt')
    ).filter(
        CalculatedField.formula != None,
        CalculatedField.formula != ''
    ).group_by(CalculatedField.formula)\
     .having(func.count(CalculatedField.field_id) > 1)\
     .order_by(func.count(CalculatedField.field_id).desc())\
     .limit(10).all()
    
    duplicate_formulas_top = [
        {'formula': f[:80] + '...' if len(f) > 80 else f, 'count': c}
        for f, c in dupe_formulas
    ]
    total_duplicate_formulas = sum([c - 1 for f, c in dupe_formulas])
    
    # ===== 6. 复杂度分布 =====
    complexity_results = session.query(
        case(
            (CalculatedField.complexity_score <= 3, 'low'),
            (CalculatedField.complexity_score <= 7, 'medium'),
            else_='high'
        ).label('level'),
        func.count(CalculatedField.field_id)
    ).group_by('level').all()
    complexity_distribution = {level: cnt for level, cnt in complexity_results}
    
    # ===== 7. 问题检测 =====
    missing_desc_count = session.query(Field).filter(
        (Field.description == None) | (Field.description == '')
    ).count()
    
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    stale_ds_count = session.query(Datasource).filter(
        Datasource.has_extract == True,
        Datasource.extract_last_refresh_time < thirty_days_ago
    ).count()
    
    orphaned_tables = session.query(DBTable).outerjoin(DBTable.datasources)\
        .filter(Datasource.id == None).count()
    
    # 计算字段无描述比例
    calc_no_desc = session.query(CalculatedField).join(
        Field, CalculatedField.field_id == Field.id
    ).filter((Field.description == None) | (Field.description == '')).count()
    
    issues = {
        'missing_description': missing_desc_count,
        'missing_desc_ratio': round(missing_desc_count / total_fields * 100, 1) if total_fields else 0,
        'stale_datasources': stale_ds_count,
        'duplicate_formulas': total_duplicate_formulas,
        'orphaned_tables': orphaned_tables,
        'calc_field_no_desc': calc_no_desc
    }
    
    # ===== 8. 健康度计算（改进版 - 维度细分） =====
    
    # 1. 完整性 (Completeness)
    # - 字段描述缺失率 (权重 60%)
    # - 计算字段描述缺失率 (权重 40%)
    field_desc_ratio = (missing_desc_count / total_fields) if total_fields else 0
    calc_desc_ratio = (calc_no_desc / total_calc_fields) if total_calc_fields else 0
    completeness_score = max(0, 100 - (field_desc_ratio * 100 * 0.6 + calc_desc_ratio * 100 * 0.4))
    
    # 2. 时效性 (Timeliness)
    # - 停更数据源 (每个扣 5 分)
    timeliness_score = max(0, 100 - (stale_ds_count * 5))
    
    # 3. 一致性 (Consistency)
    # - 重复公式 (每个扣 2 分)
    consistency_score = max(0, 100 - (total_duplicate_formulas * 2))
    
    # 4. 有效性 (Validity)
    # - 孤立表 (每个扣 2 分)
    # - 孤立字段 (每个扣 1 分 - 权重低因为可能是中间字段)
    validity_score = max(0, 100 - (orphaned_tables * 2) - (orphan_fields * 0.5))
    
    # 综合健康分 (加权平均)
    # 完整性 30%, 一致性 30%, 有效性 20%, 时效性 20%
    score = (completeness_score * 0.3) + (consistency_score * 0.3) + (validity_score * 0.2) + (timeliness_score * 0.2)
    score = int(score)

    # 维度得分详情
    governance_scores = {
        'completeness': int(completeness_score),
        'timeliness': int(timeliness_score),
        'consistency': int(consistency_score),
        'validity': int(validity_score)
    }
    
    # ===== 9. 热点资产 Top 10（基于计算字段被引用次数） =====
    top_metrics = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    ).order_by(CalculatedField.reference_count.desc()).limit(10).all()
    
    top_fields_data = [{
        'id': f.id,
        'name': f.name,
        'usage': c.reference_count or 0,
        'complexity': c.complexity_score or 0,
        'source': f.datasource.name if f.datasource else '-'
    } for f, c in top_metrics]
    
    # 如果计算字段引用不够，补充普通字段
    if len(top_fields_data) < 10:
        regular_fields = session.query(Field).filter(
            ~Field.id.in_([f['id'] for f in top_fields_data])
        ).limit(10 - len(top_fields_data)).all()
        for f in regular_fields:
            top_fields_data.append({
                'id': f.id,
                'name': f.name,
                'usage': 0,
                'complexity': 0,
                'source': f.datasource.name if f.datasource else (f.table.name if f.table else '-')
            })
    
    # ===== 10. 最近同步信息 =====
    from ..models import SyncLog
    last_sync = session.query(SyncLog).order_by(SyncLog.started_at.desc()).first()
    sync_info = None
    if last_sync:
        sync_info = {
            'status': last_sync.status,
            'time': last_sync.started_at.isoformat() if last_sync.started_at else None,
            'records': last_sync.records_synced
        }
    
    return jsonify({
        'health_score': score,
        'governance_scores': governance_scores,
        'issues': issues,
        'top_fields': top_fields_data,
        'total_assets': {
            'fields': total_fields,
            'calculated_fields': total_calc_fields,
            'tables': total_tables,
            'datasources': total_datasources,
            'workbooks': total_workbooks,
            'views': total_views
        },
        'field_source_distribution': field_source_distribution,
        'data_type_distribution': data_type_distribution,
        'role_distribution': role_distribution,
        'complexity_distribution': complexity_distribution,
        'duplicate_formulas_top': duplicate_formulas_top,
        'last_sync': sync_info
    })

def apply_sorting(query, model, sort_key, order):
    """通用排序逻辑"""
    if not sort_key or sort_key == 'undefined': return query
    attr = None
    if hasattr(model, sort_key):
        attr = getattr(model, sort_key)
    
    if sort_key == 'usageCount' and model == Field:
         return query # Handle in Python or complex join
    
    if attr:
        query = query.order_by(attr.desc() if order == 'desc' else attr.asc())
    return query

# ==================== 数据库接口 ====================

@api_bp.route('/databases')
def get_databases():
    """获取数据库列表 - 增强版"""
    session = g.db_session
    search = request.args.get('search', '')
    query = session.query(Database)

    if search: query = query.filter(Database.name.ilike(f'%{search}%'))

    databases = query.all()
    results = []
    for db in databases:
        data = db.to_dict()
        data['table_count'] = len(db.tables)
        data['table_names'] = [t.name for t in db.tables[:10]]
        # 统计关联的数据源数量
        connected_ds = set()
        total_fields = 0
        for t in db.tables:
            total_fields += len(t.fields) if t.fields else 0
            for ds in t.datasources:
                connected_ds.add(ds.id)
        data['datasource_count'] = len(connected_ds)
        data['total_field_count'] = total_fields
        results.append(data)

    return jsonify(results)


@api_bp.route('/databases/<db_id>')
def get_database_detail(db_id):
    """获取数据库详情 - 完整上下文"""
    session = g.db_session

    db = session.query(Database).filter(Database.id == db_id).first()
    if not db:
        return jsonify({'error': 'Not found'}), 404

    data = db.to_dict()

    # 包含的表列表（完整信息）
    tables_data = []
    for t in db.tables:
        tables_data.append({
            'id': t.id,
            'name': t.name,
            'schema': t.schema,
            'full_name': t.full_name,
            'field_count': len(t.fields) if t.fields else 0,
            'column_count': len(t.columns) if t.columns else 0,
            'is_embedded': t.is_embedded,
            'datasource_count': len(t.datasources) if t.datasources else 0
        })
    data['tables'] = tables_data

    # 统计信息
    total_fields = sum(len(t.fields) for t in db.tables)
    total_columns = sum(len(t.columns) for t in db.tables)
    connected_datasources = set()
    for t in db.tables:
        for ds in t.datasources:
            connected_datasources.add(ds.id)

    data['stats'] = {
        'table_count': len(db.tables),
        'total_fields': total_fields,
        'total_columns': total_columns,
        'connected_datasource_count': len(connected_datasources)
    }

    return jsonify(data)


# ==================== 数据表接口 ====================

@api_bp.route('/tables')
def get_tables():
    """获取数据表列表"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'asc')
    
    query = session.query(DBTable)
    if search: query = query.filter(DBTable.name.ilike(f'%{search}%'))
    
    if sort in ['name', 'schema']:
        query = apply_sorting(query, DBTable, sort, order)
    
    tables = query.limit(200).all()
    results = []
    for t in tables:
        data = t.to_dict()
        data['field_count'] = len(t.fields)
        data['column_count'] = len(t.columns) if t.columns else 0
        data['datasource_count'] = len(t.datasources) if t.datasources else 0
        # 统计使用此表的工作簿数量
        workbook_ids = set()
        for ds in t.datasources:
            for wb in ds.workbooks:
                workbook_ids.add(wb.id)
        data['workbook_count'] = len(workbook_ids)
        # 字段预览
        param_fields = t.fields
        if not param_fields and t.datasources:
            for ds in t.datasources:
                if ds.fields:
                    param_fields = ds.fields
                    data['field_count_derived'] = len(ds.fields)
                    break
        measures = [f.name for f in param_fields if f.role == 'measure'][:5]
        dimensions = [f.name for f in param_fields if f.role != 'measure'][:5]
        data['preview_fields'] = {'measures': measures, 'dimensions': dimensions}
        results.append(data)

    if sort == 'field_count':
        results.sort(key=lambda x: x.get('field_count', 0), reverse=(order == 'desc'))

    return jsonify(results)

@api_bp.route('/tables/<table_id>')
def get_table_detail(table_id):
    """获取单表详情 - 完整上下文（含原始列、字段、数据源关联）"""
    session = g.db_session
    table = session.query(DBTable).filter(DBTable.id == table_id).first()
    if not table:
        return jsonify({'error': 'Not found'}), 404

    # 构建索引以查找字段引用
    field_usage, _, _, _ = build_metric_index(session)

    data = table.to_dict()

    # 所属数据库信息
    if table.database:
        data['database_info'] = {
            'id': table.database.id,
            'name': table.database.name,
            'connection_type': table.database.connection_type,
            'host_name': table.database.host_name
        }

    # 原始数据库列（DBColumn）- 未经Tableau改写的原始字段
    columns_data = []
    for col in table.columns:
        columns_data.append({
            'id': col.id,
            'name': col.name,
            'remote_type': col.remote_type,
            'description': col.description,
            'is_nullable': col.is_nullable,
            'is_certified': col.is_certified
        })
    data['columns'] = columns_data

    # Tableau字段（可能经过重命名/计算）
    full_fields = []
    source_fields = table.fields
    data['source_type'] = 'direct'

    if not source_fields and table.datasources:
        source_fields = []
        data['source_type'] = 'derived'
        for ds in table.datasources:
            source_fields.extend(ds.fields)

    for f in source_fields:
        f_data = f.to_dict()
        f_data['used_by_metrics'] = field_usage.get(f.name, [])
        if data['source_type'] == 'derived' and f.datasource:
            f_data['via_datasource'] = f.datasource.name
        full_fields.append(f_data)

    data['full_fields'] = full_fields

    # 关联的数据源列表
    datasources_data = []
    for ds in table.datasources:
        datasources_data.append({
            'id': ds.id,
            'name': ds.name,
            'project_name': ds.project_name,
            'owner': ds.owner,
            'is_certified': ds.is_certified,
            'has_extract': ds.has_extract
        })
    data['datasources'] = datasources_data

    # 统计信息
    data['stats'] = {
        'column_count': len(table.columns),
        'field_count': len(full_fields),
        'datasource_count': len(table.datasources)
    }

    return jsonify(data)


# ==================== 数据源接口 ====================

@api_bp.route('/datasources')
def get_datasources():
    """获取数据源列表 - 增强版"""
    session = g.db_session
    search = request.args.get('search', '')
    query = session.query(Datasource)
    if search: query = query.filter(Datasource.name.ilike(f'%{search}%'))
    datasources = query.all()

    results = []
    for ds in datasources:
        data = ds.to_dict()
        data['connected_tables'] = [t.name for t in ds.tables[:10]]
        data['table_count'] = len(ds.tables)
        data['field_count'] = len(ds.fields)
        data['workbook_count'] = len(ds.workbooks)
        # 统计指标数量
        metric_count = sum(1 for f in ds.fields if f.is_calculated)
        data['metric_count'] = metric_count
        # 统计视图数量
        view_count = 0
        for wb in ds.workbooks:
            view_count += len(wb.views) if wb.views else 0
        data['view_count'] = view_count
        results.append(data)

    return jsonify(results)

@api_bp.route('/datasources/<ds_id>')
def get_datasource_detail(ds_id):
    """获取数据源详情 - 完整上下文（含上游表、下游工作簿）"""
    session = g.db_session
    ds = session.query(Datasource).filter(Datasource.id == ds_id).first()
    if not ds: return jsonify({'error': 'Not found'}), 404

    field_usage, _, _, _ = build_metric_index(session)

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
            'column_count': len(t.columns) if t.columns else 0
        })
    data['tables'] = tables_data

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

    # 字段列表（含指标引用）
    full_fields = []
    metrics_list = []
    for f in ds.fields:
        f_data = f.to_dict()
        f_data['used_by_metrics'] = field_usage.get(f.name, [])
        if f.is_calculated:
            metrics_list.append(f_data)
        else:
            full_fields.append(f_data)

    data['full_fields'] = full_fields
    data['metrics'] = metrics_list

    # 统计信息
    data['stats'] = {
        'table_count': len(ds.tables),
        'workbook_count': len(ds.workbooks),
        'field_count': len(full_fields),
        'metric_count': len(metrics_list)
    }

    return jsonify(data)


# ==================== 工作簿接口 ====================

@api_bp.route('/workbooks')
def get_workbooks():
    """获取工作簿列表"""
    session = g.db_session
    search = request.args.get('search', '')
    query = session.query(Workbook)
    if search: query = query.filter(Workbook.name.ilike(f'%{search}%'))
    workbooks = query.all()
    
    results = []
    for wb in workbooks:
        data = wb.to_dict()
        data['upstream_datasources'] = [ds.name for ds in wb.datasources]
        results.append(data)
        
    return jsonify(results)


@api_bp.route('/workbooks/<wb_id>')
def get_workbook_detail(wb_id):
    """获取工作簿详情 - 完整上下文"""
    session = g.db_session
    field_usage, _, _, _ = build_metric_index(session)
    
    wb = session.query(Workbook).filter(Workbook.id == wb_id).first()
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
    for ds in wb.datasources:
        datasources_data.append({
            'id': ds.id,
            'name': ds.name,
            'project_name': ds.project_name,
            'owner': ds.owner,
            'is_certified': ds.is_certified,
            'has_extract': ds.has_extract
        })
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
    
    return jsonify(data)


# ==================== 视图接口 ====================
@api_bp.route('/views')
def get_views():
    session = g.db_session
    query = session.query(View).limit(100)
    return jsonify([v.to_dict() for v in query.all()])


@api_bp.route('/views/<view_id>')
def get_view_detail(view_id):
    """获取视图详情 - 完整上下文"""
    session = g.db_session
    field_usage, _, _, _ = build_metric_index(session)
    
    view = session.query(View).filter(View.id == view_id).first()
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
    
    return jsonify(data)


# ==================== 字段接口 ====================

@api_bp.route('/fields')
def get_fields():
    """获取字段列表，支持分页和深度使用情况"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 200)  # 限制最大页大小
    
    field_usage, _, _, _ = build_metric_index(session)
    query = session.query(Field)
    
    if search:
        query = query.filter((Field.name.ilike(f'%{search}%')) | (Field.description.ilike(f'%{search}%')))
        
    if sort in ['name', 'data_type', 'updated_at']:
        query = apply_sorting(query, Field, sort, order)
        
    if sort == 'usageCount':
        query = query.outerjoin(Field.views).group_by(Field.id)
        if order == 'desc': query = query.order_by(func.count(View.id).desc())
        else: query = query.order_by(func.count(View.id).asc())

    # 计算总数
    total = query.count()
    total_pages = (total + page_size - 1) // page_size
    
    # 分页查询
    offset = (page - 1) * page_size
    fields = query.offset(offset).limit(page_size).all()
    
    results = []
    for f in fields:
        data = f.to_dict()
        # 关联指标使用
        data['used_by_metrics'] = field_usage.get(f.name, [])
        
        # 关联视图使用 (Impact Analysis)
        views = []
        if f.views:
            for v in f.views:
                views.append({
                    'id': v.id, 
                    'name': v.name,
                    'workbookId': v.workbook_id,
                    'workbookName': v.workbook.name if v.workbook else 'Unknown'
                })
        data['used_in_views'] = views
        data['usageCount'] = len(views)
        data['hasDescription'] = bool(f.description and f.description.strip())  # 用于 facet 筛选
        
        results.append(data)
        
    return jsonify({
        'items': results,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages
    })


@api_bp.route('/fields/<field_id>')
def get_field_detail(field_id):
    """获取单个字段详情 - 完整上下文（含上游表追溯）"""
    session = g.db_session
    field_usage, _, _, _ = build_metric_index(session)

    field = session.query(Field).filter(Field.id == field_id).first()
    if not field:
        return jsonify({'error': 'Not found'}), 404

    data = field.to_dict()

    # 所属表信息（直接关联）
    if field.table:
        data['table_info'] = {
            'id': field.table.id,
            'name': field.table.name,
            'schema': field.table.schema,
            'database_name': field.table.database.name if field.table.database else None,
            'database_id': field.table.database_id
        }

    # 所属数据源信息
    if field.datasource:
        data['datasource_info'] = {
            'id': field.datasource.id,
            'name': field.datasource.name,
            'project_name': field.datasource.project_name,
            'owner': field.datasource.owner,
            'is_certified': field.datasource.is_certified
        }
        # 通过数据源追溯上游表（当字段没有直接table_id时）
        if not field.table and field.datasource.tables:
            upstream_tables = []
            for t in field.datasource.tables:
                upstream_tables.append({
                    'id': t.id,
                    'name': t.name,
                    'schema': t.schema,
                    'database_name': t.database.name if t.database else None,
                    'database_id': t.database_id
                })
            data['upstream_tables'] = upstream_tables

    # 所属工作簿信息
    if field.workbook:
        data['workbook_info'] = {
            'id': field.workbook.id,
            'name': field.workbook.name,
            'project_name': field.workbook.project_name,
            'owner': field.workbook.owner
        }

    # 使用该字���的指标
    data['used_by_metrics'] = field_usage.get(field.name, [])

    # 使用该字段的视图（含工作簿信息）
    views_data = []
    workbooks_set = {}
    for v in field.views:
        views_data.append({
            'id': v.id,
            'name': v.name,
            'view_type': v.view_type,
            'workbook_id': v.workbook_id,
            'workbook_name': v.workbook.name if v.workbook else None
        })
        # 收集工作簿
        if v.workbook and v.workbook_id not in workbooks_set:
            workbooks_set[v.workbook_id] = {
                'id': v.workbook.id,
                'name': v.workbook.name,
                'project_name': v.workbook.project_name,
                'owner': v.workbook.owner
            }
    data['used_in_views'] = views_data
    data['used_in_workbooks'] = list(workbooks_set.values())

    # 计算字段额外信息
    calc_field = session.query(CalculatedField).filter(
        CalculatedField.field_id == field_id
    ).first()
    if calc_field:
        data['calculated_field_info'] = {
            'formula': calc_field.formula,
            'complexity_score': calc_field.complexity_score,
            'reference_count': calc_field.reference_count
        }
        # 解析公式中引用的字段
        if calc_field.formula:
            refs = re.findall(r'\[(.*?)\]', calc_field.formula)
            unique_refs = list(set(refs))
            ref_fields = []
            for ref_name in unique_refs:
                ref_field = session.query(Field).filter(Field.name == ref_name).first()
                if ref_field:
                    ref_fields.append({
                        'id': ref_field.id,
                        'name': ref_field.name,
                        'data_type': ref_field.data_type,
                        'role': ref_field.role,
                        'is_calculated': ref_field.is_calculated
                    })
                else:
                    ref_fields.append({'name': ref_name, 'id': None})
            data['formula_references'] = ref_fields

    # 统计信息
    data['stats'] = {
        'view_count': len(views_data),
        'workbook_count': len(workbooks_set),
        'metric_count': len(data.get('used_by_metrics', []))
    }

    return jsonify(data)


@api_bp.route('/fields/<field_id>', methods=['PUT'])
def update_field(field_id):
    """只读模式 - 禁止修改"""
    return jsonify({'error': '只读模式，禁止修改字段'}), 405


# ... (Datasource/Table routes should be updated similarly if needed, but for now focusing on Fields/Metrics) ...

# ==================== 指标接口 ====================

@api_bp.route('/metrics')
def get_metrics():
    """获取指标列表，支持分页和精确的依赖关系"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 200)  # 限制最大页大小
    
    field_usage, metric_deps, formula_map, _ = build_metric_index(session)
    
    query = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    )
    
    if search:
        query = query.filter((Field.name.ilike(f'%{search}%')) | (CalculatedField.formula.ilike(f'%{search}%')))

    if sort == 'complexity':
        attr = CalculatedField.complexity_score
        query = query.order_by(attr.desc() if order == 'desc' else attr.asc())
    elif sort == 'referenceCount':
        attr = CalculatedField.reference_count
        query = query.order_by(attr.desc() if order == 'desc' else attr.asc())
    
    # 计算总数
    total = query.count()
    total_pages = (total + page_size - 1) // page_size
    
    # 分页查询
    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()
    
    metrics = []
    for field, calc_field in results:
        datasource_name = field.datasource.name if field.datasource else '-'
        formula_clean = (calc_field.formula or '').strip()
        
        # 查找相似指标 (Semantic Duplication)
        similar = []
        if formula_clean:
            # 排除自己
            similar = [m for m in formula_map.get(formula_clean, []) if m['id'] != field.id]
        
        # 获取依赖字段 (Lineage)
        dependencies = metric_deps.get(field.id, [])
        
        # 获取被引用情况 (Impact)
        refs = []
        if field.views:
            for v in field.views:
                refs.append({
                    'id': v.id, 
                    'name': v.name,
                    'workbookId': v.workbook_id,
                    'workbookName': v.workbook.name if v.workbook else 'Unknown'
                })

        metrics.append({
            'id': field.id,
            'name': field.name,
            'description': field.description or '',
            'formula': calc_field.formula or '',
            'role': field.role,
            'dataType': field.data_type,
            'complexity': calc_field.complexity_score or 0,
            'referenceCount': len(refs),
            'datasourceName': datasource_name,
            'datasourceId': field.datasource_id,
            'similarMetrics': similar,
            'dependencyFields': dependencies,
            'usedInViews': refs,
            'hasDuplicate': len(similar) > 0  # 用于 facet 筛选
        })
    
    return jsonify({
        'items': metrics,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages
    })


@api_bp.route('/metrics/<metric_id>')
def get_metric_detail(metric_id):
    """获取单条指标详情 - 完整上下文（含原始表追溯、重复指标使用情况）"""
    session = g.db_session
    field_usage, metric_deps, formula_map, _ = build_metric_index(session)

    result = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    ).filter(Field.id == metric_id).first()

    if not result:
        return jsonify({'error': 'Not found'}), 404

    field, calc_field = result
    formula_clean = (calc_field.formula or '').strip()

    # 数据源信息
    datasource_info = None
    upstream_tables = []
    if field.datasource:
        datasource_info = {
            'id': field.datasource.id,
            'name': field.datasource.name,
            'project_name': field.datasource.project_name,
            'owner': field.datasource.owner,
            'is_certified': field.datasource.is_certified
        }
        # 通过数据源追溯上游表
        for t in field.datasource.tables:
            upstream_tables.append({
                'id': t.id,
                'name': t.name,
                'schema': t.schema,
                'database_name': t.database.name if t.database else None,
                'database_id': t.database_id
            })

    # 查找相似指标（增强：含使用情况）
    similar = []
    if formula_clean:
        for m in formula_map.get(formula_clean, []):
            if m['id'] != field.id:
                # 查询该重复指标的使用情况
                dup_field = session.query(Field).filter(Field.id == m['id']).first()
                dup_views = []
                dup_workbooks = {}
                if dup_field and dup_field.views:
                    for v in dup_field.views[:5]:
                        dup_views.append({'id': v.id, 'name': v.name})
                        if v.workbook and v.workbook_id not in dup_workbooks:
                            dup_workbooks[v.workbook_id] = {
                                'id': v.workbook.id,
                                'name': v.workbook.name
                            }
                similar.append({
                    'id': m['id'],
                    'name': m['name'],
                    'datasourceName': m.get('datasourceName') or (dup_field.datasource.name if dup_field and dup_field.datasource else '-'),
                    'datasourceId': m.get('datasourceId'),
                    'usedInViews': dup_views,
                    'usedInWorkbooks': list(dup_workbooks.values())
                })

    # 获取依赖字段（增强：含上游表信息）
    dependencies = []
    if calc_field.formula:
        refs = re.findall(r'\[(.*?)\]', calc_field.formula)
        unique_refs = list(set(refs))
        for ref_name in unique_refs:
            ref_field = session.query(Field).filter(Field.name == ref_name).first()
            if ref_field:
                dep_info = {
                    'id': ref_field.id,
                    'name': ref_field.name,
                    'data_type': ref_field.data_type,
                    'role': ref_field.role,
                    'is_calculated': ref_field.is_calculated
                }
                # 追溯到表
                if ref_field.table:
                    dep_info['table_name'] = ref_field.table.name
                    dep_info['table_id'] = ref_field.table.id
                elif ref_field.datasource and ref_field.datasource.tables:
                    dep_info['upstream_tables'] = [t.name for t in ref_field.datasource.tables[:3]]
                dependencies.append(dep_info)
            else:
                dependencies.append({'name': ref_name, 'id': None})

    # 获取被引用情况（视图和工作簿）
    views_data = []
    workbooks_set = {}
    if field.views:
        for v in field.views:
            views_data.append({
                'id': v.id,
                'name': v.name,
                'view_type': v.view_type,
                'workbook_id': v.workbook_id,
                'workbook_name': v.workbook.name if v.workbook else 'Unknown'
            })
            if v.workbook and v.workbook_id not in workbooks_set:
                workbooks_set[v.workbook_id] = {
                    'id': v.workbook.id,
                    'name': v.workbook.name,
                    'project_name': v.workbook.project_name,
                    'owner': v.workbook.owner
                }

    metric_data = {
        'id': field.id,
        'name': field.name,
        'description': field.description or '',
        'formula': calc_field.formula or '',
        'role': field.role,
        'dataType': field.data_type,
        'complexity': calc_field.complexity_score or 0,
        'referenceCount': len(views_data),
        'datasourceName': datasource_info['name'] if datasource_info else '-',
        'datasourceId': field.datasource_id,
        'datasource_info': datasource_info,
        'upstream_tables': upstream_tables,
        'similarMetrics': similar,
        'dependencyFields': dependencies,
        'usedInViews': views_data,
        'usedInWorkbooks': list(workbooks_set.values()),
        'hasDuplicate': len(similar) > 0,
        'stats': {
            'view_count': len(views_data),
            'workbook_count': len(workbooks_set),
            'dependency_count': len(dependencies),
            'duplicate_count': len(similar)
        }
    }

    return jsonify(metric_data)


@api_bp.route('/metrics/<metric_id>', methods=['PUT'])
def update_metric(metric_id):
    """只读模式 - 禁止修改"""
    return jsonify({'error': '只读模式，禁止修改指标'}), 405


# ==================== 血缘关系接口 ====================

@api_bp.route('/lineage/<item_type>/<item_id>')
def get_lineage(item_type, item_id):
    """获取血缘关系 - 真实数据"""
    session = g.db_session
    upstream = []
    downstream = []
    
    if item_type == 'field':
        field = session.query(Field).filter(Field.id == item_id).first()
        if field:
            if field.table:
                upstream.append({'type': 'table', 'name': field.table.name, 'schema': field.table.schema})
            if field.datasource:
                downstream.append({'type': 'datasource', 'name': field.datasource.name})
            for view in field.views:
                downstream.append({'type': 'view', 'name': view.name})
            
            # 使用索引查找指标引用 (虽然这通常在详情页已通过 used_by_metrics 返回，但血缘图也可以用)
            # 这里为了简单，暂不重复计算，前端主要从字段属性取
    
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
        CalculatedField, Field.id == CalculatedField.field_id
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
            CalculatedField, Field.id == CalculatedField.field_id
        ).filter(Field.id == item_id).first()
        
        if result:
            field, calc = result
            add_node(field.id, field.name, 'metric', is_center=True)
            
            # 上游：数据源
            if field.datasource:
                add_node(field.datasource.id, field.datasource.name, 'datasource')
                add_edge(field.datasource.id, field.id, '定义')
            
            # 上游：依赖字段
            if calc.formula:
                refs = re.findall(r'\[(.*?)\]', calc.formula)
                for ref_name in set(refs)[:5]:
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


# ==================== 数据质量接口 ====================

@api_bp.route('/quality/overview')
def get_quality_overview():
    """获取数据质量概览 - 描述覆盖率、认证状态等"""
    session = g.db_session
    
    # 字段描述覆盖率
    total_fields = session.query(Field).count()
    fields_with_desc = session.query(Field).filter(
        Field.description != None,
        Field.description != ''
    ).count()
    field_desc_coverage = round(fields_with_desc / total_fields * 100, 1) if total_fields else 0
    
    # 数据源描述覆盖率
    total_datasources = session.query(Datasource).count()
    ds_with_desc = session.query(Datasource).filter(
        Datasource.description != None,
        Datasource.description != ''
    ).count()
    ds_desc_coverage = round(ds_with_desc / total_datasources * 100, 1) if total_datasources else 0
    
    # 数据源认证状态
    certified_ds = session.query(Datasource).filter(Datasource.is_certified == True).count()
    certification_rate = round(certified_ds / total_datasources * 100, 1) if total_datasources else 0
    
    # 表描述覆盖率
    total_tables = session.query(DBTable).count()
    tables_with_desc = session.query(DBTable).filter(
        DBTable.description != None,
        DBTable.description != ''
    ).count()
    table_desc_coverage = round(tables_with_desc / total_tables * 100, 1) if total_tables else 0
    
    # 工作簿描述覆盖率
    total_workbooks = session.query(Workbook).count()
    wb_with_desc = session.query(Workbook).filter(
        Workbook.description != None,
        Workbook.description != ''
    ).count()
    wb_desc_coverage = round(wb_with_desc / total_workbooks * 100, 1) if total_workbooks else 0
    
    # 计算综合质量分数
    quality_score = int((field_desc_coverage + ds_desc_coverage + certification_rate + table_desc_coverage) / 4)
    
    return jsonify({
        'quality_score': quality_score,
        'field_coverage': {
            'total': total_fields,
            'with_description': fields_with_desc,
            'coverage_rate': field_desc_coverage
        },
        'datasource_coverage': {
            'total': total_datasources,
            'with_description': ds_with_desc,
            'coverage_rate': ds_desc_coverage,
            'certified': certified_ds,
            'certification_rate': certification_rate
        },
        'table_coverage': {
            'total': total_tables,
            'with_description': tables_with_desc,
            'coverage_rate': table_desc_coverage
        },
        'workbook_coverage': {
            'total': total_workbooks,
            'with_description': wb_with_desc,
            'coverage_rate': wb_desc_coverage
        }
    })


@api_bp.route('/quality/uncovered-fields')
def get_uncovered_fields():
    """获取缺少描述的字段列表"""
    session = g.db_session
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    
    query = session.query(Field).filter(
        (Field.description == None) | (Field.description == '')
    )
    
    total = query.count()
    offset = (page - 1) * page_size
    fields = query.offset(offset).limit(page_size).all()
    
    results = []
    for f in fields:
        results.append({
            'id': f.id,
            'name': f.name,
            'data_type': f.data_type,
            'role': f.role,
            'datasource_name': f.datasource.name if f.datasource else '-',
            'datasource_id': f.datasource_id,
            'table_name': f.table.name if f.table else '-'
        })
    
    return jsonify({
        'items': results,
        'total': total,
        'page': page,
        'page_size': page_size
    })


@api_bp.route('/quality/uncertified-datasources')
def get_uncertified_datasources():
    """获取未认证的数据源列表"""
    session = g.db_session
    
    datasources = session.query(Datasource).filter(
        (Datasource.is_certified == False) | (Datasource.is_certified == None)
    ).all()
    
    results = []
    for ds in datasources:
        results.append({
            'id': ds.id,
            'name': ds.name,
            'project_name': ds.project_name,
            'owner': ds.owner,
            'has_description': bool(ds.description),
            'field_count': len(ds.fields),
            'workbook_count': len(ds.workbooks)
        })
    
    return jsonify({
        'items': results,
        'total': len(results)
    })


# ==================== 项目接口 ====================

@api_bp.route('/projects')
def get_projects():
    """获取项目列表及统计"""
    session = g.db_session
    
    projects = session.query(Project).all()
    
    # 统计各项目资产数量
    results = []
    for p in projects:
        # 通过 project_name 统计关联资产
        ds_count = session.query(Datasource).filter(
            Datasource.project_name == p.name
        ).count()
        wb_count = session.query(Workbook).filter(
            Workbook.project_name == p.name
        ).count()
        
        results.append({
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'datasource_count': ds_count,
            'workbook_count': wb_count,
            'total_assets': ds_count + wb_count
        })
    
    # 按资产数量排序
    results.sort(key=lambda x: x['total_assets'], reverse=True)
    
    return jsonify({
        'items': results,
        'total': len(results)
    })


@api_bp.route('/projects/<project_id>')
def get_project_detail(project_id):
    """获取项目详情 - 完整上下文（含资产分布、统计）"""
    session = g.db_session

    project = session.query(Project).filter(Project.id == project_id).first()
    if not project:
        return jsonify({'error': 'Not found'}), 404

    # 获取关联的数据源
    datasources = session.query(Datasource).filter(
        Datasource.project_name == project.name
    ).all()

    # 获取关联的工作簿
    workbooks = session.query(Workbook).filter(
        Workbook.project_name == project.name
    ).all()

    # 统计数据
    total_fields = sum(len(ds.fields) for ds in datasources)
    total_views = sum(len(wb.views) for wb in workbooks)
    certified_ds = sum(1 for ds in datasources if ds.is_certified)

    # 所有者分布
    owner_dist = {}
    for ds in datasources:
        owner = ds.owner or 'Unknown'
        owner_dist[owner] = owner_dist.get(owner, 0) + 1
    for wb in workbooks:
        owner = wb.owner or 'Unknown'
        owner_dist[owner] = owner_dist.get(owner, 0) + 1

    return jsonify({
        'id': project.id,
        'name': project.name,
        'description': project.description,
        'datasources': [{
            'id': ds.id,
            'name': ds.name,
            'owner': ds.owner,
            'is_certified': ds.is_certified,
            'has_extract': ds.has_extract,
            'field_count': len(ds.fields),
            'workbook_count': len(ds.workbooks)
        } for ds in datasources],
        'workbooks': [{
            'id': wb.id,
            'name': wb.name,
            'owner': wb.owner,
            'view_count': len(wb.views),
            'datasource_count': len(wb.datasources)
        } for wb in workbooks],
        'stats': {
            'datasource_count': len(datasources),
            'workbook_count': len(workbooks),
            'total_fields': total_fields,
            'total_views': total_views,
            'certified_datasources': certified_ds,
            'certification_rate': round(certified_ds / len(datasources) * 100, 1) if datasources else 0
        },
        'owner_distribution': owner_dist
    })


# ==================== 用户接口 ====================

@api_bp.route('/users')
def get_users():
    """获取用户列表及资产统计"""
    session = g.db_session
    
    users = session.query(TableauUser).all()
    
    results = []
    for u in users:
        # 统计用户拥有的资产
        ds_count = session.query(Datasource).filter(
            Datasource.owner == u.name
        ).count()
        wb_count = session.query(Workbook).filter(
            Workbook.owner == u.name
        ).count()
        
        results.append({
            'id': u.id,
            'name': u.name,
            'display_name': u.display_name,
            'email': u.email,
            'site_role': u.site_role,
            'datasource_count': ds_count,
            'workbook_count': wb_count,
            'total_assets': ds_count + wb_count
        })
    
    # 按资产数量排序
    results.sort(key=lambda x: x['total_assets'], reverse=True)
    
    return jsonify({
        'items': results,
        'total': len(results)
    })


@api_bp.route('/users/<user_id>')
def get_user_detail(user_id):
    """获取用户详情及拥有的资产"""
    session = g.db_session
    
    user = session.query(TableauUser).filter(TableauUser.id == user_id).first()
    if not user:
        return jsonify({'error': 'Not found'}), 404
    
    # 获取用户的数据源
    datasources = session.query(Datasource).filter(
        Datasource.owner == user.name
    ).all()
    
    # 获取用户的工作簿
    workbooks = session.query(Workbook).filter(
        Workbook.owner == user.name
    ).all()
    
    return jsonify({
        'id': user.id,
        'name': user.name,
        'display_name': user.display_name,
        'email': user.email,
        'site_role': user.site_role,
        'datasources': [{
            'id': ds.id,
            'name': ds.name,
            'project_name': ds.project_name,
            'is_certified': ds.is_certified
        } for ds in datasources],
        'workbooks': [{
            'id': wb.id,
            'name': wb.name,
            'project_name': wb.project_name,
            'view_count': len(wb.views)
        } for wb in workbooks]
    })


# ==================== 资产健康评分接口 ====================

@api_bp.route('/health/datasources')
def get_datasource_health():
    """获取数据源健康评分排名"""
    session = g.db_session
    import datetime
    
    datasources = session.query(Datasource).all()
    
    results = []
    for ds in datasources:
        # 计算健康分
        score = 100
        issues = []
        
        # 无描述 -20分
        if not ds.description:
            score -= 20
            issues.append('缺少描述')
        
        # 未认证 -15分
        if not ds.is_certified:
            score -= 15
            issues.append('未认证')
        
        # 数据刷新超过30天 -25分
        if ds.has_extract and ds.extract_last_refresh_time:
            days_since_refresh = (datetime.datetime.now(datetime.timezone.utc) - ds.extract_last_refresh_time).days if ds.extract_last_refresh_time.tzinfo else (datetime.datetime.now() - ds.extract_last_refresh_time).days
            if days_since_refresh > 30:
                score -= 25
                issues.append(f'数据过期({days_since_refresh}天)')
        
        # 无关联表 -10分
        if not ds.tables:
            score -= 10
            issues.append('无上游表')
        
        results.append({
            'id': ds.id,
            'name': ds.name,
            'project_name': ds.project_name,
            'owner': ds.owner,
            'health_score': max(0, score),
            'issues': issues,
            'is_certified': ds.is_certified,
            'has_description': bool(ds.description)
        })
    
    # 按健康分排序
    results.sort(key=lambda x: x['health_score'])
    
    return jsonify({
        'items': results,
        'total': len(results),
        'avg_score': round(sum(r['health_score'] for r in results) / len(results), 1) if results else 0
    })
