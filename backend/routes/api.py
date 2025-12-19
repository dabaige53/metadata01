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
    
    return [{'name': d.dependency_name, 'id': d.dependency_field_id} for d in deps]


def get_duplicate_formulas(session, formula):
    """
    按需查询：获取与给定公式相同的其他指标
    替代 build_metric_index 的 formula_map 功能
    """
    if not formula:
        return []
        
    formula_clean = formula.strip()
    duplicates = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    ).filter(CalculatedField.formula == formula_clean).all()
    
    return [{
        'id': f.id,
        'name': f.name,
        'datasourceId': f.datasource_id,
        'formula': c.formula
    } for f, c in duplicates]


def build_metric_index(session):
    """
    构建指标和字段的全局索引 (基于数据库持久化数据)
    注意：此函数加载全量数据，仅在必要时调用（如列表页需要批量计算）
    对于详情页，请使用 get_field_usage_by_name / get_metric_dependencies 等按需查询函数
    """
    # 建立 Name -> ID 映射
    all_fields = session.query(Field).all()
    field_id_map = {f.name: {'id': f.id, 'name': f.name, 'datasourceId': f.datasource_id} for f in all_fields}
    
    # 1. 构建公式索引 (Duplicate Detection)
    calc_results = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    ).all()
    
    formula_map = defaultdict(list)
    calc_field_map = {}  # field_id -> formula
    
    for field, calc in calc_results:
        if calc.formula:
            formula_clean = calc.formula.strip()
            m_info = {
                'id': field.id, 
                'name': field.name, 
                'datasourceId': field.datasource_id,
                'formula': formula_clean
            }
            formula_map[formula_clean].append(m_info)
            calc_field_map[field.id] = formula_clean

    # 2. 构建血缘索引 (基于 FieldDependency 表)
    field_usage = defaultdict(list)  # field_name -> [metric_info]
    metric_deps = defaultdict(list)  # metric_id -> [field_info]
    
    dependencies = session.query(FieldDependency, Field).join(
        Field, FieldDependency.source_field_id == Field.id
    ).all()
    
    for dep, source_field in dependencies:
        m_info = {
            'id': source_field.id,
            'name': source_field.name,
            'datasourceId': source_field.datasource_id,
            'formula': calc_field_map.get(source_field.id, '')
        }
        
        if dep.dependency_name:
            field_usage[dep.dependency_name].append(m_info)
        
        dep_info = {'name': dep.dependency_name, 'id': dep.dependency_field_id}
        metric_deps[source_field.id].append(dep_info)
    
    return field_usage, metric_deps, formula_map, field_id_map

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
    page_size = min(page_size, 10000)  # 限制最大页大小
    
    field_usage, _, _, _ = build_metric_index(session)
    query = session.query(Field)
    
    # 应用筛选
    if role:
        query = query.filter(Field.role == role)
    if data_type:
        query = query.filter(Field.data_type == data_type)
    if has_description:
        if has_description.lower() == 'true':
            query = query.filter(Field.description != None, Field.description != '')
        elif has_description.lower() == 'false':
            query = query.filter((Field.description == None) | (Field.description == ''))

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

    # --- 开始：计算全局 Facet 统计 (不受分页影响) ---
    facets = {}
    # 1. 角色统计
    role_counts = session.query(Field.role, func.count(Field.id)).filter(Field.id.in_(query.with_entities(Field.id))).group_by(Field.role).all()
    facets['role'] = {str(r or 'unknown'): c for r, c in role_counts}
    # 2. 数据类型统计
    type_counts = session.query(Field.data_type, func.count(Field.id)).filter(Field.id.in_(query.with_entities(Field.id))).group_by(Field.data_type).all()
    facets['data_type'] = {str(t or 'unknown'): c for t, c in type_counts}
    # 3. 有无描述统计
    desc_true = query.filter(Field.description != None, Field.description != '').count()
    desc_false = total - desc_true
    facets['hasDescription'] = {'true': desc_true, 'false': desc_false}
    # --- 结束：计算全局 Facet 统计 ---
    
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
    获取指标列表，支持分页和精确的依赖关系
    
    指标定义：计算字段 (is_calculated=True) 
    - 业务指标：role='measure' 的计算字段（如：利润率、同比增长）
    - 技术计算：role='dimension' 的计算字段（如：年份提取、分类合并）
    
    筛选参数:
    - metric_type: 'business' (仅度量) / 'technical' (仅维度) / 'all' (全部)
    - role: 'measure' / 'dimension'
    """
    session = g.db_session
    search = request.args.get('search', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'desc')
    metric_type = request.args.get('metric_type', 'all')  # 新增：指标类型筛选
    role_filter = request.args.get('role', '')  # 新增：角色筛选
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)  # 限制最大页大小
    
    field_usage, metric_deps, formula_map, _ = build_metric_index(session)
    
    query = session.query(Field, CalculatedField).join(
        CalculatedField, Field.id == CalculatedField.field_id
    )
    
    # 指标类型筛选
    if metric_type == 'business':
        query = query.filter(Field.role == 'measure')
    elif metric_type == 'technical':
        query = query.filter(Field.role == 'dimension')
    
    # 角色筛选
    if role_filter:
        query = query.filter(Field.role == role_filter)
    
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
            if calc.formula and isinstance(calc.formula, str):
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
