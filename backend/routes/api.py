"""
REST API 路由
提供元数据查询和治理操作接口
"""
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func, case
from ..models import (
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    CalculatedField, Metric, MetricVariant, MetricDuplicate,
    TableauUser, Project, FieldDependency
)

api_bp = Blueprint('api', __name__)


# ==================== 统计接口 ====================

@api_bp.route('/stats')
def get_stats():
    """获取全局统计数据 - 性能优化版"""
    session = g.db_session
    from sqlalchemy import text
    
    # 使用 UNION ALL 合并所有 COUNT 查询
    # 对于 orphanedFields，使用 NOT EXISTS 子查询比 JOIN 更直观（且在 SQLite 中通常性能相当）
    stats_rows = session.execute(text("""
        SELECT 'databases' as key, COUNT(*) as cnt FROM databases
        UNION ALL SELECT 'tables', COUNT(*) FROM tables
        UNION ALL SELECT 'fields', COUNT(*) FROM fields
        UNION ALL SELECT 'calculatedFields', COUNT(*) FROM calculated_fields
        UNION ALL SELECT 'datasources', COUNT(*) FROM datasources
        UNION ALL SELECT 'workbooks', COUNT(*) FROM workbooks
        UNION ALL SELECT 'views', COUNT(*) FROM views
        UNION ALL SELECT 'projects', COUNT(*) FROM projects
        UNION ALL SELECT 'users', COUNT(*) FROM tableau_users
        UNION ALL SELECT 'orphanedFields', COUNT(*) 
                  FROM fields f 
                  WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id)
    """)).fetchall()
    
    stats_map = {row[0]: row[1] for row in stats_rows}
    
    # 指标数量 = 计算字段数量
    calc_count = stats_map.get('calculatedFields', 0)
    
    stats = {
        'databases': stats_map.get('databases', 0),
        'tables': stats_map.get('tables', 0),
        'fields': stats_map.get('fields', 0),
        'calculatedFields': calc_count,
        'datasources': stats_map.get('datasources', 0),
        'workbooks': stats_map.get('workbooks', 0),
        'views': stats_map.get('views', 0),
        'metrics': calc_count,
        'duplicateMetrics': 0,
        'orphanedFields': stats_map.get('orphanedFields', 0),
        'projects': stats_map.get('projects', 0),
        'users': stats_map.get('users', 0)
    }
    
    return jsonify(stats)


import re
from collections import defaultdict

# ==================== 辅助函数：指标索引构建（优化版） ====================

def get_field_usage_by_name(session, field_name):
    """
    按需查询：获取指定字段被哪些指标引用
    替代 build_metric_index 的 field_usage 功能
    """
    deps = session.query(FieldDependency, Field).join(
        Field, FieldDependency.source_field_id == Field.id
    ).filter(FieldDependency.dependency_name == field_name).all()
    
    result = []
    for dep, source_field in deps:
        result.append({
            'id': source_field.id,
            'name': source_field.name,
            'datasourceId': source_field.datasource_id
        })
    return result


def get_metric_dependencies(session, metric_id):
    """
    按需查询：获取指定指标依赖的字段列表
    替代 build_metric_index 的 metric_deps 功能
    """
    deps = session.query(FieldDependency).filter(
        FieldDependency.source_field_id == metric_id
    ).all()
    
# ========== 辅助函数移除 (已由预计算字段替代) ==========
# build_metric_index, get_field_usage_by_name, get_metric_dependencies, get_duplicate_formulas 已废弃

# ==================== 仪表盘分析接口 ====================

@api_bp.route('/dashboard/analysis')
def get_dashboard_analysis():
    """获取仪表盘分析数据 - 性能优化版（合并查询）"""
    session = g.db_session
    import datetime
    from sqlalchemy import text
    
    # ===== 1. 基础统计 - 合并为单条查询 =====
    
    # 使用 UNION ALL 合并多个 COUNT 查询为一次数据库往返
    basic_stats = session.execute(text("""
        SELECT 'fields' as entity, COUNT(*) as cnt FROM fields
        UNION ALL SELECT 'calc_fields', COUNT(*) FROM calculated_fields
        UNION ALL SELECT 'tables', COUNT(*) FROM tables
        UNION ALL SELECT 'datasources', COUNT(*) FROM datasources
        UNION ALL SELECT 'workbooks', COUNT(*) FROM workbooks
        UNION ALL SELECT 'views', COUNT(*) FROM views
    """)).fetchall()
    
    stats_map = {row[0]: row[1] for row in basic_stats}
    total_fields = stats_map.get('fields', 0)
    total_calc_fields = stats_map.get('calc_fields', 0)
    total_tables = stats_map.get('tables', 0)
    total_datasources = stats_map.get('datasources', 0)
    total_workbooks = stats_map.get('workbooks', 0)
    total_views = stats_map.get('views', 0)
    
    # ===== 2. 字段来源分布 - 使用 CASE 聚合 =====
    field_source_stats = session.execute(text("""
        SELECT 
            SUM(CASE WHEN datasource_id IS NOT NULL THEN 1 ELSE 0 END) as from_ds,
            SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as from_table,
            SUM(CASE WHEN workbook_id IS NOT NULL THEN 1 ELSE 0 END) as from_wb,
            SUM(CASE WHEN datasource_id IS NULL AND table_id IS NULL AND workbook_id IS NULL THEN 1 ELSE 0 END) as orphan
        FROM fields
    """)).fetchone()
    
    from_datasource = field_source_stats[0] or 0
    from_table = field_source_stats[1] or 0
    from_workbook = field_source_stats[2] or 0
    orphan_fields = field_source_stats[3] or 0
    
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
    
    # ===== 7. 问题检测与质量分析 - 合并为单条查询 =====
    
    # 7.1 描述覆盖率 - 使用单条 SQL 获取所有实体的描述/认证统计
    coverage_stats = session.execute(text("""
        SELECT 'fields' as entity, 
               COUNT(*) as total,
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as with_desc,
               0 as certified
        FROM fields
        UNION ALL
        SELECT 'tables', COUNT(*), 
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               SUM(CASE WHEN is_certified = 1 THEN 1 ELSE 0 END)
        FROM tables
        UNION ALL
        SELECT 'datasources', COUNT(*), 
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               SUM(CASE WHEN is_certified = 1 THEN 1 ELSE 0 END)
        FROM datasources
        UNION ALL
        SELECT 'workbooks', COUNT(*), 
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               0
        FROM workbooks
        UNION ALL
        SELECT 'calc_fields', 
               (SELECT COUNT(*) FROM calculated_fields),
               (SELECT COUNT(*) FROM calculated_fields cf 
                JOIN fields f ON cf.field_id = f.id 
                WHERE f.description IS NOT NULL AND f.description != ''),
               0
    """)).fetchall()
    
    cov_map = {row[0]: {'total': row[1], 'with_desc': row[2] or 0, 'certified': row[3] or 0} for row in coverage_stats}
    
    def build_cov_result(entity_key):
        data = cov_map.get(entity_key, {'total': 0, 'with_desc': 0, 'certified': 0})
        total = data['total'] or 0
        with_desc = data['with_desc'] or 0
        certified = data['certified'] or 0
        return {
            'with_description': with_desc,
            'total': total,
            'coverage_rate': round(with_desc / total * 100, 1) if total > 0 else 0,
            'certified': certified,
            'certification_rate': round(certified / total * 100, 1) if total > 0 else 0
        }
    
    field_cov = build_cov_result('fields')
    table_cov = build_cov_result('tables')
    metric_cov = build_cov_result('calc_fields')
    ds_cov = build_cov_result('datasources')
    wb_cov = build_cov_result('workbooks')

    # 7.4 陈旧资产统计 - 合并为单条查询
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    ninety_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=90)
    
    issue_stats = session.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM datasources 
             WHERE has_extract = 1 AND extract_last_refresh_time < :thirty_days) as stale_ds,
            (SELECT COUNT(*) FROM datasources 
             WHERE has_extract = 1 AND extract_last_refresh_time < :ninety_days) as dead_ds,
            (SELECT COUNT(*) FROM fields 
             WHERE description IS NULL OR description = '') as missing_desc,
            (SELECT COUNT(*) FROM tables t 
             LEFT JOIN table_to_datasource td ON t.id = td.table_id 
             WHERE td.datasource_id IS NULL) as orphaned_tables,
            (SELECT COUNT(*) FROM calculated_fields cf 
             JOIN fields f ON cf.field_id = f.id 
             WHERE f.description IS NULL OR f.description = '') as calc_no_desc
    """), {'thirty_days': thirty_days_ago, 'ninety_days': ninety_days_ago}).fetchone()
    
    stale_ds_count = issue_stats[0] or 0
    dead_ds_count = issue_stats[1] or 0
    missing_desc_count = issue_stats[2] or 0
    orphaned_tables = issue_stats[3] or 0
    calc_no_desc = issue_stats[4] or 0
    
    issues = {
        'missing_description': missing_desc_count,
        'missing_desc_ratio': round(missing_desc_count / total_fields * 100, 1) if total_fields else 0,
        'stale_datasources': stale_ds_count,
        'dead_datasources': dead_ds_count,
        'duplicate_formulas': total_duplicate_formulas,
        'orphaned_tables': orphaned_tables,
        'calc_field_no_desc': calc_no_desc,
        'field_coverage_rate': field_cov['coverage_rate']
    }
    
    quality_metrics = {
        'field_coverage': field_cov,
        'table_coverage': table_cov,
        'metric_coverage': metric_cov,
        'datasource_coverage': ds_cov,
        'workbook_coverage': wb_cov
    }


    
    # ===== 8. 健康度计算（改进版 - 维度细分） =====
    
    # 1. 完整性 (Completeness)
    # 综合表、字段、指标的描述覆盖率
    completeness_score = (table_cov['coverage_rate'] * 0.2 + field_cov['coverage_rate'] * 0.5 + metric_cov['coverage_rate'] * 0.3)
    
    # 2. 时效性 (Timeliness)
    # 无过期数据源 = 100分，每发现一个严重过期(90天)扣10分，普通过期(30天)扣5分
    timeliness_deduction = (dead_ds_count * 10) + ((stale_ds_count - dead_ds_count) * 5)
    timeliness_score = max(0, 100 - timeliness_deduction)
    
    # 3. 一致性 (Consistency)
    # 无重复公式 = 100分
    consistency_score = max(0, 100 - (total_duplicate_formulas * 5))
    
    # 4. 有效性 (Validity)
    # 孤立表每5个扣1分
    validity_score = max(0, 100 - (orphaned_tables // 5))
    
    # 5. 规范性 (Standardization) - 新增
    # 认证率作为规范性指标
    standardization_score = (ds_cov['certification_rate'] * 0.6 + table_cov['certification_rate'] * 0.4)
    
    # 综合健康分 (加权平均)
    # 完整性 25%, 规范性 20%, 一致性 20%, 有效性 15%, 时效性 20%
    score = (completeness_score * 0.25) + (standardization_score * 0.20) + (consistency_score * 0.20) + (validity_score * 0.15) + (timeliness_score * 0.20)
    score = int(score)

    # 维度得分详情
    governance_scores = {
        'completeness': int(completeness_score),
        'timeliness': int(timeliness_score),
        'consistency': int(consistency_score),
        'validity': int(validity_score),
        'standardization': int(standardization_score)
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
        'quality_metrics': quality_metrics,  # 新增：质量指标详情
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
    """获取数据库列表 - 性能优化版"""
    session = g.db_session
    search = request.args.get('search', '')
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy import text
    
    # 使用 selectinload 预加载 tables 关系，避免 N+1
    query = session.query(Database).options(
        selectinload(Database.tables)
    )

    if search: 
        query = query.filter(Database.name.ilike(f'%{search}%'))

    databases = query.all()
    
    # 预先查询所有相关统计（一次性获取所有数据库的字段和数据源统计）
    db_ids = [db.id for db in databases]
    if db_ids:
        # 获取每个数据库关联的字段数和数据源数
        # 获取每个数据库关联的字段数和数据源数
        from sqlalchemy import bindparam
        stmt = text("""
            SELECT 
                t.database_id,
                COUNT(DISTINCT f.id) as field_count,
                COUNT(DISTINCT td.datasource_id) as ds_count
            FROM tables t
            LEFT JOIN fields f ON t.id = f.table_id
            LEFT JOIN table_to_datasource td ON t.id = td.table_id
            WHERE t.database_id IN :db_ids
            GROUP BY t.database_id
        """)
        stmt = stmt.bindparams(bindparam('db_ids', expanding=True))
        stats = session.execute(stmt, {'db_ids': list(db_ids)}).fetchall()
        stats_map = {row[0]: {'fields': row[1], 'ds': row[2]} for row in stats}
    else:
        stats_map = {}
    
    results = []
    for db in databases:
        data = db.to_dict()
        data['table_count'] = len(db.tables)
        data['table_names'] = [t.name for t in db.tables[:10]]
        db_stats = stats_map.get(db.id, {'fields': 0, 'ds': 0})
        data['datasource_count'] = db_stats['ds']
        data['total_field_count'] = db_stats['fields']
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
    """获取数据表列表 - 性能优化版"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'asc')
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    offset = (page - 1) * page_size
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy import text
    
    # 使用 selectinload 预加载关联数据
    query = session.query(DBTable).options(
        selectinload(DBTable.fields),
        selectinload(DBTable.columns),
        selectinload(DBTable.datasources),
        selectinload(DBTable.database)
    )
    
    if search: 
        query = query.filter(DBTable.name.ilike(f'%{search}%'))
    
    if sort in ['name', 'schema']:
        query = apply_sorting(query, DBTable, sort, order)
    
    tables = query.limit(page_size).offset(offset).all()
    
    # 预查询工作簿统计
    table_ids = [t.id for t in tables]
    # 预查询工作簿统计
    table_ids = [t.id for t in tables]
    if table_ids:
        from sqlalchemy import bindparam
        stmt = text("""
            SELECT td.table_id, COUNT(DISTINCT dw.workbook_id) as wb_count
            FROM table_to_datasource td
            JOIN datasource_to_workbook dw ON td.datasource_id = dw.datasource_id
            WHERE td.table_id IN :table_ids
            GROUP BY td.table_id
        """)
        stmt = stmt.bindparams(bindparam('table_ids', expanding=True))
        wb_stats = session.execute(stmt, {'table_ids': list(table_ids)}).fetchall()
        wb_map = {row[0]: row[1] for row in wb_stats}
    else:
        wb_map = {}
    
    results = []
    for t in tables:
        data = t.to_dict()
        data['field_count'] = len(t.fields)
        data['column_count'] = len(t.columns) if t.columns else 0
        data['datasource_count'] = len(t.datasources) if t.datasources else 0
        data['workbook_count'] = wb_map.get(t.id, 0)
        
        # 字段预览（使用已预加载的数据）
        param_fields = t.fields
        measures = [f.name for f in param_fields if f.role == 'measure'][:5]
        dimensions = [f.name for f in param_fields if f.role != 'measure'][:5]
        data['preview_fields'] = {'measures': measures, 'dimensions': dimensions}
        results.append(data)

    if sort == 'field_count':
        results.sort(key=lambda x: x.get('field_count', 0), reverse=(order == 'desc'))

    return jsonify({
        'items': results,
        'total': query.count(),
        'page': page,
        'page_size': page_size
    })

@api_bp.route('/tables/<table_id>')
def get_table_detail(table_id):
    """获取单表详情 - 完整上下文（含原始列、字段、数据源关联）"""
    session = g.db_session
    table = session.query(DBTable).filter(DBTable.id == table_id).first()
    if not table:
        return jsonify({'error': 'Not found'}), 404

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
        # 按需查询字段引用情况（替代全量索引）
        f_data['used_by_metrics'] = get_field_usage_by_name(session, f.name)
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
    """获取数据源列表 - 性能优化版"""
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'asc')
    
    from sqlalchemy.orm import selectinload
    from sqlalchemy import text
    
    # 使用 selectinload 预加载关联数据
    query = session.query(Datasource).options(
        selectinload(Datasource.tables),
        selectinload(Datasource.fields),
        selectinload(Datasource.workbooks)
    )
    
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
    total_count = query.count()
    offset = (page - 1) * page_size
    
    datasources = query.limit(page_size).offset(offset).all()
    
    # 预查询视图统计（仅针对当前页的数据源）
    ds_ids = [ds.id for ds in datasources]
    if ds_ids:
        from sqlalchemy import bindparam
        stmt = text("""
            SELECT dw.datasource_id, COUNT(v.id) as view_count
            FROM datasource_to_workbook dw
            JOIN views v ON dw.workbook_id = v.workbook_id
            WHERE dw.datasource_id IN :ds_ids
            GROUP BY dw.datasource_id
        """)
        stmt = stmt.bindparams(bindparam('ds_ids', expanding=True))
        view_stats = session.execute(stmt, {'ds_ids': list(ds_ids)}).fetchall()
        view_map = {row[0]: row[1] for row in view_stats}
    else:
        view_map = {}

    results = []
    for ds in datasources:
        data = ds.to_dict()
        data['table_count'] = len(ds.tables)
        data['field_count'] = len(ds.fields)
        data['workbook_count'] = len(ds.workbooks)
        data['view_count'] = view_map.get(ds.id, 0)
        # 优化：不返回完整的关联对象列表，仅返回数量以减少 payload
        # 如果前端需要详情，应使用详情接口
        results.append(data)

    return jsonify({
        'items': results,
        'total': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': (total_count + page_size - 1) // page_size
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
        # 按需查询字段引用情况
        f_data['used_by_metrics'] = get_field_usage_by_name(session, f.name)
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
    
    wb = session.query(Workbook).filter(Workbook.id == wb_id).first()
    if not wb:
        return jsonify({'error': 'Not found'}), 404
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
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    
    offset = (page - 1) * page_size
    query = session.query(View)
    total = query.count()
    
    views = query.limit(page_size).offset(offset).all()
    
    return jsonify({
        'items': [v.to_dict() for v in views],
        'total': total,
        'page': page,
        'page_size': page_size
    })


@api_bp.route('/views/<view_id>')
def get_view_detail(view_id):
    """获取视图详情 - 完整上下文"""
    session = g.db_session
    
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
    
    # ========== SQLAlchemy Core 直查 (跳过 ORM 对象实例化) ==========
    from sqlalchemy import text
    
    # 构建动态 WHERE 条件
    conditions = []
    params = {}
    
    if role:
        conditions.append("f.role = :role")
        params['role'] = role
    if data_type:
        conditions.append("f.data_type = :data_type")
        params['data_type'] = data_type
    if has_description:
        if has_description.lower() == 'true':
            conditions.append("f.description IS NOT NULL AND f.description != ''")
        elif has_description.lower() == 'false':
            conditions.append("(f.description IS NULL OR f.description = '')")
    if search:
        conditions.append("(f.name LIKE :search OR f.description LIKE :search)")
        params['search'] = f'%{search}%'
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # 1. 统计查询 (总数 + 有描述数)
    stats_sql = f"""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN f.description IS NOT NULL AND f.description != '' THEN 1 ELSE 0 END) as has_desc
        FROM fields f
        {where_clause}
    """
    stats = session.execute(text(stats_sql), params).first()
    total = stats.total or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 2. Facet 统计
    facets = {}
    
    role_sql = f"SELECT f.role, COUNT(*) FROM fields f {where_clause} GROUP BY f.role"
    role_counts = session.execute(text(role_sql), params).fetchall()
    facets['role'] = {str(r or 'unknown'): c for r, c in role_counts}
    
    type_sql = f"SELECT f.data_type, COUNT(*) FROM fields f {where_clause} GROUP BY f.data_type"
    type_counts = session.execute(text(type_sql), params).fetchall()
    facets['data_type'] = {str(t or 'unknown'): c for t, c in type_counts}
    
    facets['hasDescription'] = {'true': stats.has_desc or 0, 'false': total - (stats.has_desc or 0)}
    
    # 3. 数据查询 (Core 直查, 跳过 ORM)
    # 构建排序
    order_clause = "ORDER BY f.name ASC"
    if sort == 'usageCount':
        order_clause = f"ORDER BY f.usage_count {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'name':
        order_clause = f"ORDER BY f.name {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'data_type':
        order_clause = f"ORDER BY f.data_type {'DESC' if order == 'desc' else 'ASC'}"
    
    offset = (page - 1) * page_size
    params['limit'] = page_size
    params['offset'] = offset
    
    data_sql = f"""
        SELECT 
            f.id, f.name, f.data_type, f.remote_type, f.description,
            f.role, f.aggregation, f.is_calculated, f.is_hidden,
            f.usage_count, f.metric_usage_count,
            f.datasource_id, f.table_id, f.workbook_id,
            d.name as datasource_name,
            t.name as table_name
        FROM fields f
        LEFT JOIN datasources d ON f.datasource_id = d.id
        LEFT JOIN tables t ON f.table_id = t.id
        {where_clause}
        {order_clause}
        LIMIT :limit OFFSET :offset
    """
    rows = session.execute(text(data_sql), params).fetchall()
    
    # 4. 构建结果 (直接字典, 无 ORM 对象)
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
            'isCalculated': row.is_calculated or False,
            'isHidden': row.is_hidden or False,
            'usageCount': row.usage_count or 0,
            'used_by_metrics_count': row.metric_usage_count or 0,
            'used_by_metrics': [],
            'used_in_views': [],
            'hasDescription': bool(row.description and row.description.strip()),
            'datasourceId': row.datasource_id,
            'datasourceName': row.datasource_name or '-',
            'tableId': row.table_id,
            'tableName': row.table_name or '-',
            'workbookId': row.workbook_id
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
    """获取单个字段详情 - 性能优化版（使用预加载）"""
    session = g.db_session
    from sqlalchemy.orm import selectinload
    
    # 使用 eager loading 一次性获取所有关联数据，避免 N+1 查询
    # 包含了视图、工作簿、数据源、表、上游列等所有深层关系
    field = session.query(Field).options(
        selectinload(Field.views).selectinload(View.workbook),
        selectinload(Field.table),
        selectinload(Field.datasource).selectinload(Datasource.tables), # 预加载数据源及其上游表
        selectinload(Field.workbook),
        selectinload(Field.upstream_column).selectinload(DBColumn.table)
    ).filter(Field.id == field_id).first()

    if not field:
        return jsonify({'error': 'Not found'}), 404

    data = field.to_dict()
    
    # ========== 上游列信息 ==========
    if field.upstream_column:
        data['upstream_column_info'] = {
            'id': field.upstream_column.id,
            'name': field.upstream_column.name,
            'remote_type': field.upstream_column.remote_type,
            'description': field.upstream_column.description,
            'is_certified': field.upstream_column.is_certified,
            'table_id': field.upstream_column.table_id,
            'table_name': field.upstream_column.table.name if field.upstream_column.table else None
        }

    # 所属表信息
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
        # 通过数据源追溯上游表
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

    # 使用该字段的指标 (按需查询)
    data['used_by_metrics'] = get_field_usage_by_name(session, field.name)

    # 使用该字段的视图（已预加载，无 N+1）
    views_data = []
    workbooks_set = {}
    for v in field.views:
        # 这里 v.workbook 已经预加载了，不会触发新查询
        wb_name = v.workbook.name if v.workbook else None
        
        views_data.append({
            'id': v.id,
            'name': v.name,
            'view_type': v.view_type,
            'workbook_id': v.workbook_id,
            'workbook_name': wb_name
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
        if calc_field.formula and isinstance(calc_field.formula, str):
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
    """
    获取指标列表 - SQLAlchemy Core 直查版 (极致性能)
    
    指标定义：计算字段 (is_calculated=True) 
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
    
    # ========== SQLAlchemy Core 直查 ==========
    from sqlalchemy import text
    
    # 构建动态 WHERE 条件
    conditions = []
    params = {}
    
    if metric_type == 'business':
        conditions.append("f.role = 'measure'")
    elif metric_type == 'technical':
        conditions.append("f.role = 'dimension'")
    
    if role_filter:
        conditions.append("f.role = :role_filter")
        params['role_filter'] = role_filter
    
    if search:
        conditions.append("(f.name LIKE :search OR cf.formula LIKE :search)")
        params['search'] = f'%{search}%'
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # 1. 统计查询
    stats_sql = f"""
        SELECT COUNT(*) as total
        FROM fields f
        INNER JOIN calculated_fields cf ON f.id = cf.field_id
        {where_clause}
    """
    stats = session.execute(text(stats_sql), params).first()
    total = stats.total or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 2. 构建排序
    order_clause = "ORDER BY f.name ASC"
    if sort == 'complexity':
        order_clause = f"ORDER BY cf.complexity_score {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'referenceCount':
        order_clause = f"ORDER BY cf.reference_count {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'name':
        order_clause = f"ORDER BY f.name {'DESC' if order == 'desc' else 'ASC'}"
    
    # 3. 数据查询
    offset = (page - 1) * page_size
    params['limit'] = page_size
    params['offset'] = offset
    
    data_sql = f"""
        SELECT 
            f.id, f.name, f.description, f.role, f.data_type, f.usage_count,
            f.datasource_id, d.name as datasource_name,
            cf.formula, cf.complexity_score, cf.reference_count,
            cf.has_duplicates, cf.duplicate_count, cf.dependency_count
        FROM fields f
        INNER JOIN calculated_fields cf ON f.id = cf.field_id
        LEFT JOIN datasources d ON f.datasource_id = d.id
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
            'role': row.role,
            'dataType': row.data_type,
            'complexity': row.complexity_score or 0,
            'referenceCount': row.reference_count or 0,
            'datasourceName': row.datasource_name or '-',
            'datasourceId': row.datasource_id,
            'similarMetrics': [],
            'dependencyFields': [],
            'dependencyCount': row.dependency_count or 0,
            'usedInViews': [],
            'usageCount': row.usage_count or 0,
            'hasDuplicate': row.has_duplicates or False,
            'duplicateCount': row.duplicate_count or 0
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
    """获取单条指标详情 - 高性能版（使用预计算字段和索引）"""
    session = g.db_session
    from sqlalchemy.orm import joinedload, selectinload

    result = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    ).options(
        joinedload(Field.datasource).selectinload(Datasource.tables).joinedload(DBTable.database),
        selectinload(Field.views).joinedload(View.workbook)
    ).filter(Field.id == metric_id).first()

    if not result:
        return jsonify({'error': 'Not found'}), 404

    field, calc_field = result
    
    # 1. 查找相似指标 (使用 formula_hash 快速查重)
    similar = []
    if calc_field.formula_hash:
        similar_results = session.query(Field, CalculatedField).join(
            CalculatedField, Field.id == CalculatedField.field_id
        ).filter(
            CalculatedField.formula_hash == calc_field.formula_hash,
            Field.id != field.id
        ).all()
        
        for s_field, s_calc in similar_results:
            similar.append({
                'id': s_field.id,
                'name': s_field.name,
                'datasource_name': s_field.datasource.name if s_field.datasource else 'Unknown',
                'usage_count': s_field.usage_count or 0
            })

    # 2. 获取依赖字段 (Lineage)
    dependencies = []
    deps = session.query(FieldDependencies).filter(FieldDependencies.source_field_id == field.id).all()
    for d in deps:
        dependencies.append({
            'name': d.dependency_name,
            'id': d.dependency_field_id
        })

    # 3. 数据源及上游表信息
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
        for t in field.datasource.tables:
            upstream_tables.append({
                'id': t.id,
                'name': t.name,
                'schema': t.schema,
                'database_name': t.database.name if t.database else None
            })

    # 2. 查找相似指标 (使用 formula_hash 快速查重)
    similar = []
    if calc_field.formula_hash:
        similar_results = session.query(Field, CalculatedField).join(
            CalculatedField, Field.id == CalculatedField.field_id
        ).options(
            selectinload(Field.datasource),
            selectinload(Field.views).joinedload(View.workbook)
        ).filter(
            CalculatedField.formula_hash == calc_field.formula_hash,
            Field.id != field.id
        ).all()
        
        for s_field, s_calc in similar_results:
            dup_views = []
            dup_workbooks = {}
            for v in (s_field.views or []):
                dup_views.append({
                    'id': v.id,
                    'name': v.name,
                    'view_type': v.view_type,
                    'workbook_id': v.workbook_id,
                    'workbook_name': v.workbook.name if v.workbook else 'Unknown'
                })
                if v.workbook and v.workbook_id not in dup_workbooks:
                    dup_workbooks[v.workbook_id] = {
                        'id': v.workbook.id,
                        'name': v.workbook.name,
                        'project_name': v.workbook.project_name,
                        'owner': v.workbook.owner
                    }
            similar.append({
                'id': s_field.id,
                'name': s_field.name,
                'datasourceName': s_field.datasource.name if s_field.datasource else 'Unknown',
                'datasourceId': s_field.datasource_id,
                'usageCount': s_field.usage_count or 0,
                'usedInViews': dup_views,
                'usedInWorkbooks': list(dup_workbooks.values())
            })

    # 3. 获取依赖字段 (Lineage)
    dependencies = []
    if calc_field.formula and isinstance(calc_field.formula, str):
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

    # 4. 获取被引用情况（视图和工作簿）
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
    """获取血缘关系 - 增强版（含上游列追溯）"""
    session = g.db_session
    upstream = []
    downstream = []
    
    if item_type == 'field':
        field = session.query(Field).filter(Field.id == item_id).first()
        if field:
            # 上游：原始数据库列（最上游）
            if field.upstream_column:
                upstream.append({
                    'type': 'column', 
                    'id': field.upstream_column.id,
                    'name': field.upstream_column.name,
                    'remote_type': field.upstream_column.remote_type,
                    'table_name': field.upstream_column.table.name if field.upstream_column.table else None
                })
            
            # 上游：所属表
            if field.table:
                upstream.append({
                    'type': 'table', 
                    'id': field.table.id,
                    'name': field.table.name, 
                    'schema': field.table.schema,
                    'database_name': field.table.database.name if field.table.database else None
                })
            
            # 下游：数据源
            if field.datasource:
                downstream.append({
                    'type': 'datasource', 
                    'id': field.datasource.id,
                    'name': field.datasource.name
                })
            
            # 下游：视图
            for view in field.views:
                downstream.append({
                    'type': 'view', 
                    'id': view.id,
                    'name': view.name,
                    'workbook_name': view.workbook.name if view.workbook else None
                })
    
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
    """获取血缘关系 - 返回 Mermaid 图形化格式（上下最多 2 层）"""
    session = g.db_session

    # 为避免巨大图，限制每层返回数量（可通过 query 参数调小/调大，但强制上限）
    limit_level1 = request.args.get('limit1', 10, type=int)
    limit_level2 = request.args.get('limit2', 10, type=int)
    limit_level1 = max(1, min(limit_level1, 30))
    limit_level2 = max(1, min(limit_level2, 30))

    nodes_by_key = {}
    edges_set = set()
    edges = []

    def add_node(node_id, name, node_type, is_center=False):
        if not node_id:
            return
        key = (node_type, node_id)
        existing = nodes_by_key.get(key)
        if existing:
            # 如果后续发现是中心节点，提升样式
            if is_center and existing.get('style') != 'center':
                existing['style'] = 'center'
            return
        nodes_by_key[key] = {
            'id': node_id,
            'name': name or '-',
            'type': node_type,
            'style': 'center' if is_center else node_type
        }

    def add_edge(from_id, to_id, label=''):
        if not from_id or not to_id:
            return
        key = (from_id, to_id, label or '')
        if key in edges_set:
            return
        edges_set.add(key)
        edges.append({'from': from_id, 'to': to_id, 'label': label or ''})

    def node_code(node_id: str) -> str:
        # Mermaid 节点 ID 不建议以数字开头；统一加前缀并截断
        return f"n{(node_id or '')[:8]}"

    def fetchone_dict(stmt: str, params: dict, expanding_params=None):
        from sqlalchemy import text, bindparam
        t = text(stmt)
        if expanding_params:
            for k in expanding_params:
                t = t.bindparams(bindparam(k, expanding=True))
        row = session.execute(t, params).mappings().first()
        return dict(row) if row else None
    
    def fetchall_dict(stmt: str, params: dict, expanding_params=None):
        from sqlalchemy import text, bindparam
        t = text(stmt)
        if expanding_params:
            for k in expanding_params:
                t = t.bindparams(bindparam(k, expanding=True))
        rows = session.execute(t, params).mappings().all()
        return [dict(r) for r in rows]

    # ========== 数据库 ==========
    if item_type == 'database':
        db = session.query(Database).filter(Database.id == item_id).first()
        if not db:
            return jsonify({'error': 'Not found'}), 404
        add_node(db.id, db.name, 'database', is_center=True)

        tables = fetchall_dict(
            """
            SELECT id, name, schema, database_id
            FROM tables
            WHERE database_id = :db_id
            ORDER BY name
            LIMIT :limit1
            """,
            {'db_id': db.id, 'limit1': limit_level1}
        )
        table_ids = []
        for t in tables:
            add_node(t['id'], t.get('name'), 'table')
            add_edge(db.id, t['id'], '包含')
            table_ids.append(t['id'])

        if table_ids:
            # 下游第二层：表 -> 数据源（去重后限制）
            ds_rows = fetchall_dict(
                """
                SELECT td.table_id AS table_id, ds.id AS datasource_id, ds.name AS datasource_name
                FROM table_to_datasource td
                JOIN datasources ds ON ds.id = td.datasource_id
                WHERE td.table_id IN :table_ids
                ORDER BY ds.name
                LIMIT :limit2
                """,
                {'table_ids': list(table_ids), 'limit2': limit_level2},
                expanding_params=['table_ids']
            )
            for r in ds_rows:
                add_node(r['datasource_id'], r.get('datasource_name'), 'datasource')
                add_edge(r['table_id'], r['datasource_id'], '来源')

    # ========== 数据表 ==========
    elif item_type == 'table':
        table = session.query(DBTable).filter(DBTable.id == item_id).first()
        if not table:
            return jsonify({'error': 'Not found'}), 404
        add_node(table.id, table.name, 'table', is_center=True)

        # 上游第一层：数据库
        if table.database_id:
            db = session.query(Database).filter(Database.id == table.database_id).first()
            if db:
                add_node(db.id, db.name, 'database')
                add_edge(db.id, table.id, '包含')

        # 下游第一层：数据源
        ds_rows = fetchall_dict(
            """
            SELECT ds.id AS datasource_id, ds.name AS datasource_name
            FROM table_to_datasource td
            JOIN datasources ds ON ds.id = td.datasource_id
            WHERE td.table_id = :table_id
            ORDER BY ds.name
            LIMIT :limit1
            """,
            {'table_id': table.id, 'limit1': limit_level1}
        )
        ds_ids = []
        for r in ds_rows:
            add_node(r['datasource_id'], r.get('datasource_name'), 'datasource')
            add_edge(table.id, r['datasource_id'], '来源')
            ds_ids.append(r['datasource_id'])

        # 下游第二层：数据源 -> 工作簿
        if ds_ids:
            wb_rows = fetchall_dict(
                """
                SELECT dw.datasource_id AS datasource_id, wb.id AS workbook_id, wb.name AS workbook_name
                FROM datasource_to_workbook dw
                JOIN workbooks wb ON wb.id = dw.workbook_id
                WHERE dw.datasource_id IN :ds_ids
                ORDER BY wb.name
                LIMIT :limit2
                """,
                {'ds_ids': list(ds_ids), 'limit2': limit_level2},
                expanding_params=['ds_ids']
            )
            for r in wb_rows:
                add_node(r['workbook_id'], r.get('workbook_name'), 'workbook')
                add_edge(r['datasource_id'], r['workbook_id'], '使用')

    # ========== 数据源 ==========
    elif item_type == 'datasource':
        ds = session.query(Datasource).filter(Datasource.id == item_id).first()
        if not ds:
            return jsonify({'error': 'Not found'}), 404
        add_node(ds.id, ds.name, 'datasource', is_center=True)

        # 上游第一层：表
        upstream_tables = fetchall_dict(
            """
            SELECT t.id AS table_id, t.name AS table_name, t.schema AS schema, t.database_id AS database_id, db.name AS database_name
            FROM table_to_datasource td
            JOIN tables t ON t.id = td.table_id
            LEFT JOIN databases db ON db.id = t.database_id
            WHERE td.datasource_id = :ds_id
            ORDER BY t.name
            LIMIT :limit1
            """,
            {'ds_id': ds.id, 'limit1': limit_level1}
        )

        db_ids = set()
        for t in upstream_tables:
            add_node(t['table_id'], t.get('table_name'), 'table')
            add_edge(t['table_id'], ds.id, '来源')
            if t.get('database_id'):
                db_ids.add((t.get('database_id'), t.get('database_name')))

        # 上游第二层：数据库 -> 表
        for db_id, db_name in list(db_ids)[:limit_level2]:
            add_node(db_id, db_name, 'database')
        for t in upstream_tables:
            if t.get('database_id'):
                add_edge(t['database_id'], t['table_id'], '包含')

        # 下游第一层：工作簿
        downstream_wbs = fetchall_dict(
            """
            SELECT wb.id AS workbook_id, wb.name AS workbook_name
            FROM datasource_to_workbook dw
            JOIN workbooks wb ON wb.id = dw.workbook_id
            WHERE dw.datasource_id = :ds_id
            ORDER BY wb.name
            LIMIT :limit1
            """,
            {'ds_id': ds.id, 'limit1': limit_level1}
        )
        wb_ids = []
        for wb in downstream_wbs:
            add_node(wb['workbook_id'], wb.get('workbook_name'), 'workbook')
            add_edge(ds.id, wb['workbook_id'], '使用')
            wb_ids.append(wb['workbook_id'])

        # 下游第二层：工作簿 -> 视图
        if wb_ids:
            view_rows = fetchall_dict(
                """
                SELECT v.id AS view_id, v.name AS view_name, v.workbook_id AS workbook_id
                FROM views v
                WHERE v.workbook_id IN :wb_ids
                ORDER BY v.name
                LIMIT :limit2
                """,
                {'wb_ids': list(wb_ids), 'limit2': limit_level2},
                expanding_params=['wb_ids']
            )
            for v in view_rows:
                add_node(v['view_id'], v.get('view_name'), 'view')
                add_edge(v['workbook_id'], v['view_id'], '包含')

    # ========== 工作簿 ==========
    elif item_type == 'workbook':
        wb = session.query(Workbook).filter(Workbook.id == item_id).first()
        if not wb:
            return jsonify({'error': 'Not found'}), 404
        add_node(wb.id, wb.name, 'workbook', is_center=True)

        # 上游第一层：数据源
        ds_rows = fetchall_dict(
            """
            SELECT ds.id AS datasource_id, ds.name AS datasource_name
            FROM datasource_to_workbook dw
            JOIN datasources ds ON ds.id = dw.datasource_id
            WHERE dw.workbook_id = :wb_id
            ORDER BY ds.name
            LIMIT :limit1
            """,
            {'wb_id': wb.id, 'limit1': limit_level1}
        )
        ds_ids = []
        for r in ds_rows:
            add_node(r['datasource_id'], r.get('datasource_name'), 'datasource')
            add_edge(r['datasource_id'], wb.id, '使用')
            ds_ids.append(r['datasource_id'])

        # 上游第二层：表 -> 数据源
        if ds_ids:
            table_rows = fetchall_dict(
                """
                SELECT td.datasource_id AS datasource_id, t.id AS table_id, t.name AS table_name
                FROM table_to_datasource td
                JOIN tables t ON t.id = td.table_id
                WHERE td.datasource_id IN :ds_ids
                ORDER BY t.name
                LIMIT :limit2
                """,
                {'ds_ids': list(ds_ids), 'limit2': limit_level2},
                expanding_params=['ds_ids']
            )
            for r in table_rows:
                add_node(r['table_id'], r.get('table_name'), 'table')
                add_edge(r['table_id'], r['datasource_id'], '来源')

        # 下游第一层：视图
        view_rows = fetchall_dict(
            """
            SELECT id AS view_id, name AS view_name, workbook_id AS workbook_id
            FROM views
            WHERE workbook_id = :wb_id
            ORDER BY name
            LIMIT :limit1
            """,
            {'wb_id': wb.id, 'limit1': limit_level1}
        )
        for v in view_rows:
            add_node(v['view_id'], v.get('view_name'), 'view')
            add_edge(wb.id, v['view_id'], '包含')

    # ========== 视图 ==========
    elif item_type == 'view':
        view = session.query(View).filter(View.id == item_id).first()
        if not view:
            return jsonify({'error': 'Not found'}), 404
        add_node(view.id, view.name, 'view', is_center=True)

        # 上游第一层：所属工作簿
        if view.workbook_id:
            wb = session.query(Workbook).filter(Workbook.id == view.workbook_id).first()
            if wb:
                add_node(wb.id, wb.name, 'workbook')
                add_edge(wb.id, view.id, '包含')

                # 上游第二层：数据源（通过工作簿）
                ds_rows = fetchall_dict(
                    """
                    SELECT ds.id AS datasource_id, ds.name AS datasource_name
                    FROM datasource_to_workbook dw
                    JOIN datasources ds ON ds.id = dw.datasource_id
                    WHERE dw.workbook_id = :wb_id
                    ORDER BY ds.name
                    LIMIT :limit2
                    """,
                    {'wb_id': wb.id, 'limit2': limit_level2}
                )
                for r in ds_rows:
                    add_node(r['datasource_id'], r.get('datasource_name'), 'datasource')
                    add_edge(r['datasource_id'], wb.id, '使用')

    # ========== 字段 / 指标 ==========
    elif item_type in ('field', 'metric'):
        # metric 在系统中本质是 is_calculated 的 Field
        field = session.query(Field).filter(Field.id == item_id).first()
        if not field:
            return jsonify({'error': 'Not found'}), 404
        if item_type == 'metric':
            calc = session.query(CalculatedField).filter(CalculatedField.field_id == field.id).first()
            if not calc:
                return jsonify({'error': 'Not found'}), 404
        add_node(field.id, field.name, 'metric' if item_type == 'metric' else 'field', is_center=True)

        # 上游第一层：数据源
        if field.datasource_id:
            ds = session.query(Datasource).filter(Datasource.id == field.datasource_id).first()
            if ds:
                add_node(ds.id, ds.name, 'datasource')
                add_edge(ds.id, field.id, '定义')

                # 如果字段没有直接关联表，则通过数据源追溯上游表（作为第二层）
                if not field.table_id:
                    upstream_tables = fetchall_dict(
                        """
                        SELECT t.id AS table_id, t.name AS table_name
                        FROM table_to_datasource td
                        JOIN tables t ON t.id = td.table_id
                        WHERE td.datasource_id = :ds_id
                        ORDER BY t.name
                        LIMIT :limit2
                        """,
                        {'ds_id': ds.id, 'limit2': limit_level2}
                    )
                    for t in upstream_tables:
                        add_node(t['table_id'], t.get('table_name'), 'table')
                        add_edge(t['table_id'], ds.id, '来源')

        # 上游第一层：所属表（如有）
        if field.table_id:
            table = session.query(DBTable).filter(DBTable.id == field.table_id).first()
            if table:
                add_node(table.id, table.name, 'table')
                add_edge(table.id, field.id, '来源')

                # 上游第二层：数据库
                if table.database_id:
                    db = session.query(Database).filter(Database.id == table.database_id).first()
                    if db:
                        add_node(db.id, db.name, 'database')
                        add_edge(db.id, table.id, '包含')

        # 上游第一层（仅 metric）：依赖字段
        if item_type == 'metric':
            dep_rows = fetchall_dict(
                """
                SELECT fd.dependency_field_id AS field_id, COALESCE(f.name, fd.dependency_name) AS field_name
                FROM field_dependencies fd
                LEFT JOIN fields f ON f.id = fd.dependency_field_id
                WHERE fd.source_field_id = :field_id
                ORDER BY field_name
                LIMIT :limit1
                """,
                {'field_id': field.id, 'limit1': limit_level1}
            )
            for r in dep_rows:
                if not r.get('field_id'):
                    continue
                add_node(r['field_id'], r.get('field_name'), 'field')
                add_edge(r['field_id'], field.id, '依赖')

        # 下游第一层：使用该字段/指标的视图
        view_rows = fetchall_dict(
            """
            SELECT v.id AS view_id, v.name AS view_name, v.workbook_id AS workbook_id, wb.name AS workbook_name
            FROM field_to_view fv
            JOIN views v ON v.id = fv.view_id
            LEFT JOIN workbooks wb ON wb.id = v.workbook_id
            WHERE fv.field_id = :field_id
            ORDER BY v.name
            LIMIT :limit1
            """,
            {'field_id': field.id, 'limit1': limit_level1}
        )
        workbook_ids = {}
        for v in view_rows:
            add_node(v['view_id'], v.get('view_name'), 'view')
            add_edge(field.id, v['view_id'], '使用于')
            if v.get('workbook_id'):
                workbook_ids[v['workbook_id']] = v.get('workbook_name') or '-'

        # 下游第二层：视图 -> 工作簿（影响分析维度）
        for wb_id, wb_name in list(workbook_ids.items())[:limit_level2]:
            add_node(wb_id, wb_name, 'workbook')
        for v in view_rows:
            if v.get('workbook_id'):
                add_edge(v['view_id'], v['workbook_id'], '属于')

    else:
        return jsonify({'error': 'Unsupported type'}), 400

    nodes = list(nodes_by_key.values())

    # 生成 Mermaid 代码
    mermaid_code = "graph LR\n"

    # 样式定义（尽量使用 Mermaid 原生安全形状）
    style_map = {
        'database': '[({})]',    # cylinder
        'table': '[{}]',
        'datasource': '[[{}]]',
        'workbook': '(({}))',
        'view': '([{}])',
        'field': '({})',
        'metric': '{{{}}}'
    }

    # 节点声明
    for node in nodes:
        mid = node_code(node['id'])
        shape = style_map.get(node['type'], '[{}]')
        label = (node.get('name') or '-')[:24].replace('\n', ' ')
        mermaid_code += f"    {mid}{shape.format(label)}\n"

    # 边声明
    for edge in edges:
        from_id = node_code(edge['from'])
        to_id = node_code(edge['to'])
        label = (edge.get('label') or '').replace('\n', ' ')
        if label:
            mermaid_code += f"    {from_id} -->|{label}| {to_id}\n"
        else:
            mermaid_code += f"    {from_id} --> {to_id}\n"

    return jsonify({'nodes': nodes, 'edges': edges, 'mermaid': mermaid_code})


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


@api_bp.route('/quality/duplicates')
def get_duplicate_metrics():
    """识别重复指标：相同公式但名称不同，或同名同公式但在不同位置"""
    session = g.db_session
    from sqlalchemy import text, bindparam
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    # 第一步：只查询公式和ID，避免加载全量 Field 对象
    # 这比查询所有对象要快得多，内存占用也小
    raw_calcs = session.query(CalculatedField.field_id, CalculatedField.formula).all()
    
    formula_groups = defaultdict(list)
    
    # 在内存中进行公式标准化和分组
    for field_id, formula in raw_calcs:
        if not formula:
            continue
        normalized_formula = " ".join(formula.split()).strip()
        formula_groups[normalized_formula].append((field_id, formula))
    
    # 筛选出重复项
    duplicates_list = []
    for norm_formula, items in formula_groups.items():
        if len(items) < 2:
            continue
        duplicates_list.append({
            'normalized_formula': norm_formula,
            'original_formula': items[0][1],
            'count': len(items),
            'item_ids': [x[0] for x in items]
        })
        
    # 排序
    duplicates_list.sort(key=lambda x: x['count'], reverse=True)
    
    # 分页
    total = len(duplicates_list)
    start = (page - 1) * page_size
    end = start + page_size
    paged_dups = duplicates_list[start:end]
    
    # 第二步：仅查询当前页所需的详细 Field 信息
    if paged_dups:
        all_needed_ids = []
        for d in paged_dups:
            all_needed_ids.extend(d['item_ids'])
            
        # 批量获取 Field 详情
        from sqlalchemy import bindparam
        stmt = text("SELECT id, name, datasource_id FROM fields WHERE id IN :ids")
        stmt = stmt.bindparams(bindparam('ids', expanding=True))
        fields_info = session.execute(stmt, {'ids': list(all_needed_ids)}).fetchall()
        field_map = {row.id: {'name': row.name, 'ds_id': row.datasource_id} for row in fields_info}
        
        # 还需要获取 Datasource 名称
        ds_ids = set(f['ds_id'] for f in field_map.values() if f['ds_id'])
        ds_map = {}
        if ds_ids:
            stmt_ds = text("SELECT id, name, project_name FROM datasources WHERE id IN :ids")
            stmt_ds = stmt_ds.bindparams(bindparam('ids', expanding=True))
            ds_rows = session.execute(stmt_ds, {'ids': list(ds_ids)}).fetchall()
            ds_map = {row.id: {'name': row.name, 'project': row.project_name} for row in ds_rows}
            
        # 组装最终结果
        final_results = []
        for group in paged_dups:
            group_items = []
            names = set()
            
            for fid in group['item_ids']:
                f_info = field_map.get(fid)
                if not f_info: 
                    continue
                
                ds_info = ds_map.get(f_info.get('ds_id')) or {}
                
                group_items.append({
                    'id': fid,
                    'name': f_info['name'],
                    'formula': group['original_formula'], # 简化，使用组内第一个公式
                    'datasource_name': ds_info.get('name', 'Unknown'),
                    'project_name': ds_info.get('project', 'Unknown')
                })
                names.add(f_info['name'])
            
            final_results.append({
                'formula': group['original_formula'],
                'normalized_formula': group['normalized_formula'],
                'type': 'NAME_VARIANT' if len(names) > 1 else 'LOCATION_VARIANT',
                'count': group['count'],
                'items': group_items
            })
    else:
        final_results = []
    
    return jsonify({
        'items': final_results,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size
    })
