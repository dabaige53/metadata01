"""
REST API 路由
提供元数据查询和治理操作接口
"""
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func
from ..models import (
    Database, DBTable, Field, Datasource, Workbook, View,
    CalculatedField, Metric, MetricVariant, MetricDuplicate
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
        'orphanedFields': session.query(Field).outerjoin(Field.views).filter(View.id == None).count()
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
    metric_deps = {}                 # metric_id -> [field_info]
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
            
            
    return field_usage, metric_deps, formula_map, field_id_map

# ==================== 仪表盘分析接口 ====================

@api_bp.route('/dashboard/analysis')
def get_dashboard_analysis():
    """获取仪表盘分析数据 - 基于真实数据的聚合分析"""
    session = g.db_session
    
    # 1. 治理健康度指标
    score = 100
    
    missing_desc_count = session.query(Field).filter((Field.description == None) | (Field.description == '')).count()
    
    import datetime
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    stale_ds_count = session.query(Datasource).filter(
        Datasource.has_extract == True,
        Datasource.extract_last_refresh_time < thirty_days_ago
    ).count()
    
    duplicate_metrics_count = session.query(MetricDuplicate).count()
    if duplicate_metrics_count == 0:
        dupes = session.query(CalculatedField.formula, func.count(CalculatedField.field_id))\
            .group_by(CalculatedField.formula)\
            .having(func.count(CalculatedField.field_id) > 1).all()
        duplicate_metrics_count = sum([c-1 for f, c in dupes])

    score -= (missing_desc_count * 0.1)
    score -= (stale_ds_count * 5)
    score -= (duplicate_metrics_count * 2)
    score = max(0, min(100, int(score)))
    
    # 2. 核心资产 Top N
    top_fields = session.query(Field).outerjoin(Field.views)\
        .group_by(Field.id)\
        .order_by(func.count(View.id).desc())\
        .limit(5).all()
        
    top_fields_data = [{
        'id': f.id, 
        'name': f.name, 
        'usage': len(f.views),
        'table': f.table.name if f.table else (f.datasource.name if f.datasource else '-')
    } for f in top_fields]

    issues = {
        'missing_description': missing_desc_count,
        'stale_datasources': stale_ds_count,
        'duplicate_metrics': duplicate_metrics_count,
        'orphaned_tables': session.query(DBTable).outerjoin(DBTable.datasources).filter(Datasource.id == None).count()
    }
    
    total_assets = session.query(Field).count() + session.query(DBTable).count() + session.query(Metric).count()
    
    return jsonify({
        'health_score': score,
        'issues': issues,
        'top_fields': top_fields_data,
        'total_assets': total_assets
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
    """获取数据库列表"""
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
        results.append(data)
        
    return jsonify(results)


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
    """获取单表详情，包含完整字段列表和指标引用情况"""
    session = g.db_session
    table = session.query(DBTable).filter(DBTable.id == table_id).first()
    if not table:
        return jsonify({'error': 'Not found'}), 404
        
    # 构建索引以查找字段引用
    field_usage, _, _, _ = build_metric_index(session)
    
    data = table.to_dict()
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
    return jsonify(data)


# ==================== 数据源接口 ====================

@api_bp.route('/datasources')
def get_datasources():
    """获取数据源列表"""
    session = g.db_session
    search = request.args.get('search', '')
    query = session.query(Datasource)
    if search: query = query.filter(Datasource.name.ilike(f'%{search}%'))
    datasources = query.all()
    
    results = []
    for ds in datasources:
        data = ds.to_dict()
        data['connected_tables'] = [t.name for t in ds.tables[:10]]
        data['field_count'] = len(ds.fields)
        results.append(data)
        
    return jsonify(results)

@api_bp.route('/datasources/<ds_id>')
def get_datasource_detail(ds_id):
    """获取数据源详情"""
    session = g.db_session
    ds = session.query(Datasource).filter(Datasource.id == ds_id).first()
    if not ds: return jsonify({'error': 'Not found'}), 404
    
    field_usage, _, _, _ = build_metric_index(session)
    
    data = ds.to_dict()
    data['connected_tables'] = [t.name for t in ds.tables]
    
    full_fields = []
    for f in ds.fields:
        f_data = f.to_dict()
        f_data['used_by_metrics'] = field_usage.get(f.name, [])
        full_fields.append(f_data)
    
    data['full_fields'] = full_fields
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


# ==================== 视图接口 ====================
@api_bp.route('/views')
def get_views():
    session = g.db_session
    query = session.query(View).limit(100)
    return jsonify([v.to_dict() for v in query.all()])


# ==================== 字段接口 ====================

@api_bp.route('/fields')
def get_fields():
    """获取字段列表，包含深度使用情况"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    
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

    fields = query.limit(200).all()
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
        data['usageCount'] = len(views) # 校准 usageCount
        
        results.append(data)
        
    return jsonify(results)


@api_bp.route('/fields/<field_id>', methods=['PUT'])
def update_field(field_id):
    """更新字段信息"""
    session = g.db_session
    field = session.query(Field).filter(Field.id == field_id).first()
    if not field: return jsonify({'error': '字段不存在'}), 404
    data = request.json
    if 'description' in data: field.description = data['description']
    if 'formula' in data and field.is_calculated: field.formula = data['formula']
    session.commit()
    return jsonify(field.to_dict())


# ... (Datasource/Table routes should be updated similarly if needed, but for now focusing on Fields/Metrics) ...

# ==================== 指标接口 ====================

@api_bp.route('/metrics')
def get_metrics():
    """获取指标列表，包含精确的依赖关系"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    
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
        
    results = query.limit(200).all()
    
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
            'referenceCount': len(refs), # 使用真实视图引用数
            'datasourceName': datasource_name,
            'datasourceId': field.datasource_id,
            'similarMetrics': similar,
            'dependencyFields': dependencies,
            'usedInViews': refs
        })
    
    return jsonify(metrics)


@api_bp.route('/metrics/<metric_id>', methods=['PUT'])
def update_metric(metric_id):
    return jsonify({'error': 'Not implemented'}), 501


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

# ==================== 治理操作接口 (Empty Stubs) ====================
@api_bp.route('/governance/merge', methods=['POST'])
def merge_metrics(): return jsonify({'success': True})

@api_bp.route('/governance/deprecate', methods=['POST'])
def deprecate_metrics(): return jsonify({'success': True})

@api_bp.route('/governance/cleanup', methods=['POST'])
def cleanup_fields(): return jsonify({'success': True})
