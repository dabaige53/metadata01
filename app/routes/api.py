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


# ==================== 辅助函数：生成丰富元数据 ====================
import random
import time

def enrich_data(item_dict, item_type):
    """为数据对象添加模拟的丰富元数据，用于 UI 展示"""
    
    # 模拟所有者
    owners = ['Data Team', 'BI Team', 'John Doe', 'Alice Smith', 'Bob Johnson']
    item_dict['owner'] = random.choice(owners)
    
    # 模拟标签
    all_tags = ['High Usage', 'Certified', 'PII', 'Sensitive', 'Tier 1', 'Deprecated', 'New', 'Core']
    # 随机取 0-3 个标签
    item_dict['tags'] = random.sample(all_tags, k=random.randint(0, 3))
    
    # 模拟更新时间 (最近 30 天)
    days_ago = random.randint(0, 30)
    item_dict['last_updated'] = f"{days_ago} days ago"
    
    # 特定类型的扩展字段
    if item_type == 'table':
        item_dict['row_count'] = random.randint(1000, 10000000)
        item_dict['size'] = f"{random.randint(10, 5000)} MB"
        item_dict['tier'] = random.choice(['Tier 1', 'Tier 2', 'Tier 3'])
        
    elif item_type == 'database':
        item_dict['tier'] = 'Critical'
        
    elif item_type == 'field':
        item_dict['is_primary_key'] = (random.random() < 0.1) # 10% 概率
        item_dict['is_nullable'] = (random.random() < 0.3)
        
    return item_dict

# ==================== 数据库接口 ====================

@api_bp.route('/databases')
def get_databases():
    """获取数据库列表"""
    session = g.db_session
    
    # 查询参数
    search = request.args.get('search', '')
    connection_type = request.args.get('type', 'all')
    
    query = session.query(Database)
    if search:
        query = query.filter(Database.name.ilike(f'%{search}%'))
    if connection_type != 'all':
        query = query.filter(Database.connection_type == connection_type)
    
    databases = query.all()
    
    # 转换为字典并增强数据
    results = []
    for db in databases:
        data = db.to_dict()
        data['table_names'] = [t.name for t in db.tables[:10]] # 预览前10个表
        results.append(enrich_data(data, 'database'))
        
    return jsonify(results)


# ==================== 数据表接口 ====================

@api_bp.route('/tables')
def get_tables():
    """获取数据表列表"""
    session = g.db_session
    
    search = request.args.get('search', '')
    database_id = request.args.get('database_id', '')
    
    query = session.query(DBTable)
    if search:
        query = query.filter(DBTable.name.ilike(f'%{search}%'))
    if database_id:
        query = query.filter(DBTable.database_id == database_id)
    
    tables = query.limit(100).all()
    
    results = []
    for t in tables:
        data = t.to_dict()
        # 预览关键字段 (优先显示度量)
        measures = [f.name for f in t.fields if f.role == 'measure'][:5]
        dimensions = [f.name for f in t.fields if f.role != 'measure'][:5]
        data['preview_fields'] = {'measures': measures, 'dimensions': dimensions}
        results.append(enrich_data(data, 'table'))
        
    return jsonify(results)


# ==================== 字段接口 ====================

@api_bp.route('/fields')
def get_fields():
    """获取字段列表"""
    session = g.db_session
    
    search = request.args.get('search', '')
    is_calculated = request.args.get('isCalculated', 'all')
    role = request.args.get('role', 'all')
    
    query = session.query(Field)
    
    if search:
        query = query.filter(
            (Field.name.ilike(f'%{search}%')) | 
            (Field.description.ilike(f'%{search}%'))
        )
    
    if is_calculated == 'true':
        query = query.filter(Field.is_calculated == True)
    elif is_calculated == 'false':
        query = query.filter(Field.is_calculated == False)
    
    if role != 'all':
        query = query.filter(Field.role == role)
    
    fields = query.limit(100).all()
    
    results = []
    for f in fields:
        results.append(enrich_data(f.to_dict(), 'field'))
        
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
        data['connected_tables'] = [t.name for t in ds.tables[:5]]
        results.append(enrich_data(data, 'datasource'))
        
    return jsonify(results)


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
        # 获取关联的数据源名称
        data['upstream_datasources'] = [ds.name for ds in wb.datasources[:5]]
        results.append(enrich_data(data, 'workbook'))
        
    return jsonify(results)


# ==================== 视图接口 ====================
@api_bp.route('/views')
def get_views():
    session = g.db_session
    query = session.query(View).limit(100)
    return jsonify([v.to_dict() for v in query.all()])


# ==================== 指标接口 ====================
# 指标数据来源于计算字段（度量值），这是实际的业务指标

@api_bp.route('/metrics')
def get_metrics():
    """获取指标列表 - 使用计算字段（度量值）作为指标"""
    session = g.db_session
    search = request.args.get('search', '')
    role = request.args.get('role', 'all')
    
    query = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    )
    
    if search:
        query = query.filter((Field.name.ilike(f'%{search}%')) | (CalculatedField.formula.ilike(f'%{search}%')))
    if role != 'all':
        query = query.filter(Field.role == role)
    
    results = query.limit(100).all()
    
    metrics = []
    for field, calc_field in results:
        datasource_name = field.datasource.name if field.datasource else '-'
        data = {
            'id': field.id,
            'name': field.name,
            'description': field.description or '',
            'formula': calc_field.formula or '',
            'role': field.role,
            'dataType': field.data_type,
            'complexity': calc_field.complexity_score or 0,
            'referenceCount': calc_field.reference_count or 0,
            'datasourceName': datasource_name,
            'datasourceId': field.datasource_id
        }
        metrics.append(enrich_data(data, 'metric'))
    
    return jsonify(metrics)


@api_bp.route('/metrics/<metric_id>', methods=['PUT'])
def update_metric(metric_id):
    return jsonify({'error': 'Not implemented'}), 501


# ==================== 血缘关系接口 ====================

@api_bp.route('/lineage/<item_type>/<item_id>')
def get_lineage(item_type, item_id):
    """获取血缘关系"""
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
