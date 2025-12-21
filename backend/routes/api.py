"""
REST API 路由
提供元数据查询和治理操作接口
"""
from flask import Blueprint, jsonify, request, g
from sqlalchemy import func, case
from ..models import (
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    CalculatedField, Metric, MetricVariant, MetricDuplicate,
    TableauUser, Project, FieldDependency, Glossary, TermEnum
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
        UNION ALL SELECT 'fields', COUNT(*) FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL
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
def get_field_usage_by_name(session, field_name):
    """
    按需查询：获取指定字段被哪些指标引用
    替代 build_metric_index 的 field_usage 功能
    """
    # Join Field, Datasource, CalculatedField, and Workbook to get rich info
    # Use outer joins because not all fields have datasource or workbook or calc info
    deps = session.query(Field, Datasource, CalculatedField, Workbook).join(
        FieldDependency, Field.id == FieldDependency.source_field_id
    ).outerjoin(
        Datasource, Field.datasource_id == Datasource.id
    ).outerjoin(
        Workbook, Field.workbook_id == Workbook.id
    ).outerjoin(
        CalculatedField, Field.id == CalculatedField.field_id
    ).filter(FieldDependency.dependency_name == field_name).all()
    
    result = []
    for f, ds, cf, wb in deps:
        result.append({
            'id': f.id,
            'name': f.name,
            'datasourceId': f.datasource_id,
            'datasourceName': ds.name if ds else None,
            'workbookId': f.workbook_id,
            'workbookName': wb.name if wb else None,
            'description': f.description,
            'formula': cf.formula if cf else None,
            'role': f.role,
            'dataType': f.data_type
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

    return jsonify({
        'items': results,
        'total': len(results),
        'page': 1,
        'page_size': len(results)
    })


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
    schema_filter = request.args.get('schema', '')
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
    
    if schema_filter:
        query = query.filter(DBTable.schema == schema_filter)
    
    # 排序
    if sort == 'name':
        query = query.order_by(DBTable.name.desc() if order == 'desc' else DBTable.name.asc())
    elif sort == 'schema':
        query = query.order_by(DBTable.schema.desc() if order == 'desc' else DBTable.schema.asc())
    
    # 总数和分页
    total_count = query.count()
    tables = query.limit(page_size).offset(offset).all()
    
    # Facets 统计 (schema)
    schema_stats = session.execute(text("""
        SELECT schema, COUNT(*) as cnt FROM tables WHERE schema IS NOT NULL GROUP BY schema
    """)).fetchall()
    facets = {
        'schema': {row[0]: row[1] for row in schema_stats if row[0]}
    }
    
    # 预查询统计数据
    table_ids = [t.id for t in tables]
    wb_map = {}
    field_stats_map = {}
    
    if table_ids:
        from sqlalchemy import bindparam
        
        # 预查询工作簿统计
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
        
        # 预查询字段统计（通过 table_to_datasource 关系链）
        field_stmt = text("""
            SELECT 
                td.table_id,
                COUNT(DISTINCT f.id) as field_count,
                COUNT(DISTINCT CASE WHEN f.role = 'measure' THEN f.id END) as measure_count,
                COUNT(DISTINCT CASE WHEN f.role != 'measure' THEN f.id END) as dimension_count
            FROM table_to_datasource td
            JOIN fields f ON td.datasource_id = f.datasource_id
            WHERE td.table_id IN :table_ids
            GROUP BY td.table_id
        """)
        field_stmt = field_stmt.bindparams(bindparam('table_ids', expanding=True))
        field_stats = session.execute(field_stmt, {'table_ids': list(table_ids)}).fetchall()
        field_stats_map = {row[0]: {'field_count': row[1], 'measure_count': row[2], 'dimension_count': row[3]} for row in field_stats}
    
    results = []
    for t in tables:
        data = t.to_dict()
        
        # 使用预查询的统计数据，如果没有则回退到直接关联
        stats = field_stats_map.get(t.id, {})
        direct_field_count = len(t.fields) if t.fields else 0
        data['field_count'] = stats.get('field_count', direct_field_count)
        data['column_count'] = len(t.columns) if t.columns else 0
        data['datasource_count'] = len(t.datasources) if t.datasources else 0
        data['workbook_count'] = wb_map.get(t.id, 0)
        
        # 字段预览（使用预查询的统计）
        measure_count = stats.get('measure_count', 0)
        dimension_count = stats.get('dimension_count', 0)
        data['preview_fields'] = {
            'measures': [f'度量字段 ({measure_count}个)'] if measure_count > 0 else [],
            'dimensions': [f'维度字段 ({dimension_count}个)'] if dimension_count > 0 else []
        }
        results.append(data)

    # 内存排序 field_count
    if sort == 'field_count':
        results.sort(key=lambda x: x.get('field_count', 0), reverse=(order == 'desc'))

    return jsonify({
        'items': results,
        'total': total_count,
        'page': page,
        'page_size': page_size,
        'facets': facets
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


# ==================== 数据库列接口 ====================

@api_bp.route('/columns/<column_id>')
def get_column_detail(column_id):
    """获取数据库原始列详情"""
    session = g.db_session
    column = session.query(DBColumn).filter(DBColumn.id == column_id).first()
    if not column:
        return jsonify({'error': 'Not found'}), 404

    data = column.to_dict()
    
    # 补充所属表和数据库信息
    if column.table:
        data['table_info'] = {
            'id': column.table.id,
            'name': column.table.name,
            'schema': column.table.schema
        }
        if column.table.database:
            data['database_info'] = {
                'id': column.table.database.id,
                'name': column.table.database.name
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
        
    return jsonify({
        'items': results,
        'total': len(results),
        'page': 1,
        'page_size': len(results)
    })


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
    
    # 排序：默认按 ID 排序，也可以按名称
    # 仪表盘在前?
    if include_standalone == 'true':
        # 优先显示仪表盘，然后是独立视图
        from sqlalchemy import desc
        query = query.order_by(View.view_type.asc(), View.name.asc()) # dashboard < sheet (alphabetically d < s)
    else:
        query = query.order_by(View.name.asc())
    
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
        for h in history:
            count, recorded_at = h[0], h[1]
            if isinstance(recorded_at, str):
                recorded_at = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
            if recorded_at < today_start:
                daily_delta = current_count - count
                break
        
        # 找到一周前的最近一条记录
        for h in history:
            count, recorded_at = h[0], h[1]
            if isinstance(recorded_at, str):
                recorded_at = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
            if recorded_at < week_ago:
                weekly_delta = current_count - count
                break
    
    return jsonify({
        'viewId': view_id,
        'viewName': view.name,
        'totalViewCount': current_count,
        'dailyDelta': daily_delta,
        'weeklyDelta': weekly_delta,
        'history': [{'count': h[0], 'recordedAt': h[1]} for h in history[:10]]  # 最近10条
    })


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
        if has_description.lower() == 'true':
            conditions.append("f.description IS NOT NULL AND f.description != ''")
        elif has_description.lower() == 'false':
            conditions.append("(f.description IS NULL OR f.description = '')")
    
    # 默认只返回非计算字段 (计算字段属于指标模块)
    conditions.append("(f.is_calculated = 0 OR f.is_calculated IS NULL)")

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
            f.created_at, f.updated_at,
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
    has_duplicate = request.args.get('hasDuplicate', '')
    
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
    
    if has_duplicate:
        if has_duplicate.lower() == 'true':
            conditions.append("cf.has_duplicates = 1")
        elif has_duplicate.lower() == 'false':
            conditions.append("(cf.has_duplicates = 0 OR cf.has_duplicates IS NULL)")
    
    if search:
        conditions.append("(f.name LIKE :search OR cf.formula LIKE :search)")
        params['search'] = f'%{search}%'
    
    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
    
    # Facets 统计
    # Facets 统计 (仅统计唯一指标定义)
    # 使用子查询先分组，再统计
    facets_sql = f"""
        SELECT 
            'metricType' as facet_key,
            CASE WHEN sub.role = 'measure' THEN 'business' ELSE 'technical' END as facet_value,
            COUNT(*) as cnt
        FROM (
            SELECT MAX(f.role) as role
            FROM fields f
            INNER JOIN calculated_fields cf ON f.id = cf.field_id
            {where_clause}
            GROUP BY f.name, cf.formula
        ) sub
        GROUP BY facet_value
        UNION ALL
        SELECT 'role', sub.role, COUNT(*)
        FROM (
            SELECT MAX(f.role) as role
            FROM fields f
            INNER JOIN calculated_fields cf ON f.id = cf.field_id
            {where_clause}
            GROUP BY f.name, cf.formula
        ) sub
        WHERE sub.role IS NOT NULL
        GROUP BY sub.role
    """
    facets_rows = session.execute(text(facets_sql)).fetchall()
    facets = {}
    for row in facets_rows:
        key, value, cnt = row
        if key not in facets:
            facets[key] = {}
        if value:
            facets[key][value] = cnt
    
    # 1. 统计查询
    stats_sql = f"""
        SELECT COUNT(*) as total FROM (
            SELECT 1
            FROM fields f
            INNER JOIN calculated_fields cf ON f.id = cf.field_id
            {where_clause}
            GROUP BY f.name, cf.formula
        ) as sub
    """
    stats = session.execute(text(stats_sql), params).first()
    total = stats.total or 0
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    
    # 2. 构建排序
    # 注意：排序字段必须使用聚合函数
    order_clause = "ORDER BY f.name ASC"
    if sort == 'complexity':
        order_clause = f"ORDER BY MAX(cf.complexity_score) {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'referenceCount':
        order_clause = f"ORDER BY SUM(cf.reference_count) {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'name':
        order_clause = f"ORDER BY f.name {'DESC' if order == 'desc' else 'ASC'}"
    elif sort == 'usageCount': # 之前的 workbook_count 排序
         order_clause = f"ORDER BY COUNT(DISTINCT f.workbook_id) {'DESC' if order == 'desc' else 'ASC'}"
    
    # 3. 数据查询
    offset = (page - 1) * page_size
    params['limit'] = page_size
    params['offset'] = offset
    
    data_sql = f"""
        SELECT 
            MIN(f.id) as id, 
            f.name, 
            MAX(f.description) as description, 
            MAX(f.role) as role, 
            MAX(f.data_type) as data_type, 
            SUM(f.usage_count) as usage_count,
            MAX(f.datasource_id) as datasource_id, 
            MAX(d.name) as datasource_name,
            MAX(f.created_at) as created_at, 
            MAX(f.updated_at) as updated_at,
            cf.formula, 
            MAX(cf.complexity_score) as complexity_score, 
            SUM(cf.reference_count) as reference_count,
            COUNT(*) as instance_count,
            MAX(cf.dependency_count) as dependency_count
        FROM fields f
        INNER JOIN calculated_fields cf ON f.id = cf.field_id
        LEFT JOIN datasources d ON f.datasource_id = d.id
        {where_clause}
        GROUP BY f.name, cf.formula
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
            'instanceCount': row.instance_count, # 相同name+formula的实例数量
            'usageCount': row.usage_count or 0,
            'hasDuplicate': False # 聚合后不再显示重复标记
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
    """获取单条指标详情 - 高性能版（使用预计算字段和索引）"""
    session = g.db_session
    from sqlalchemy.orm import joinedload, selectinload
    # Ensure explicit import if needed, though usually top-level is fine
    from ..models import FieldDependency

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

    # 2. 获取依赖字段 (Lineage)
    dependencies = []
    # Explicitly using FieldDependency imported locally to avoid any NameError
    try:
        deps = session.query(FieldDependency).filter(FieldDependency.source_field_id == field.id).all()
        for d in deps:
            dependencies.append({
                'name': d.dependency_name,
                'id': d.dependency_field_id
            })
    except Exception as e:
        print(f"Error fetching dependencies: {e}")
        # Add a dummy dependency to see if it works
        dependencies.append({'name': 'Error: ' + str(e), 'id': None})

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

    elif item_type == 'view':
        view = session.query(View).filter(View.id == item_id).first()
        if view:
            # 上游：工作簿
            if view.workbook:
                upstream.append({'type': 'workbook', 'id': view.workbook.id, 'name': view.workbook.name})

            # 上游：父级仪表盘 (如果是 Sheet)
            for dash in view.parent_dashboards:
                upstream.append({'type': 'view', 'id': dash.id, 'name': dash.name, 'subtype': 'dashboard'})

            # 上游：使用的字段 (只列前20个)
            for field in view.fields[:20]:
                 upstream.append({'type': 'field', 'id': field.id, 'name': field.name})

            # 下游：包含的工作表 (如果是 Dashboard)
            for sheet in view.contained_sheets:
                downstream.append({'type': 'view', 'id': sheet.id, 'name': sheet.name, 'subtype': 'sheet'})
    
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

    elif item_type == 'view':
        view = session.query(View).filter(View.id == item_id).first()
        if view:
            # 区分类型
            v_type = view.view_type or 'sheet'
            add_node(view.id, view.name, v_type, is_center=True)

            # 上游：工作簿
            if view.workbook:
                add_node(view.workbook.id, view.workbook.name, 'workbook')
                add_edge(view.workbook.id, view.id, '包含')

            # 上游：父级仪表盘 (如果是 Sheet)
            if v_type == 'sheet':
                for dash in view.parent_dashboards:
                    add_node(dash.id, dash.name, 'dashboard')
                    add_edge(dash.id, view.id, '包含')

            # 下游：包含的工作表 (如果是 Dashboard)
            if v_type == 'dashboard':
                for sheet in view.contained_sheets:
                    add_node(sheet.id, sheet.name, 'sheet')
                    add_edge(view.id, sheet.id, '包含')

            # 上游：使用的字段 (只列前10个，避免图太大)
            for field in view.fields[:10]:
                add_node(field.id, field.name, 'field')
                add_edge(field.id, view.id, '提供数据')
    
    # 生成 Mermaid 代码
    mermaid_code = "graph LR\n"
    
    # 样式定义
    style_map = {
        'field': '([{}])',
        'metric': '{{{}}}',
        'table': '[{}]',
        'datasource': '[({})]',
        'workbook': '(({}))' ,
        'view': '>{}]',
        'dashboard': '[[{}]]',  # 双框矩形
        'sheet': '>{}]'        # 旗帜形
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

# ==================== 术语治理接口 ====================

@api_bp.route('/glossary', methods=['GET'])
def get_glossary():
    """获取术语列表"""
    session = g.db_session
    search = request.args.get('search', '')
    category = request.args.get('category', '')
    element = request.args.get('element', '')
    
    query = session.query(Glossary)
    
    if search:
        query = query.filter(
            (Glossary.term.ilike(f'%{search}%')) | 
            (Glossary.definition.ilike(f'%{search}%'))
        )
    
    if category and category != 'all':
        query = query.filter(Glossary.category == category)

    if element and element != 'all':
        query = query.filter(Glossary.element == element)
        
    # 默认按术语名称排序
    query = query.order_by(Glossary.term.asc())
    
    items = query.all()
    return jsonify({
        'items': [item.to_dict() for item in items],
        'total': len(items)
    })


@api_bp.route('/glossary', methods=['POST'])
def create_glossary_term():
    """创建术语 (内部管理用)"""
    session = g.db_session
    data = request.json
    
    if not data or not data.get('term') or not data.get('definition'):
        return jsonify({'error': 'Missing required fields'}), 400
        
    # 检查是否存在
    existing = session.query(Glossary).filter(Glossary.term == data['term']).first()
    if existing:
        return jsonify({'error': 'Term already exists'}), 409
        
    new_term = Glossary(
        term=data['term'],
        definition=data['definition'],
        category=data.get('category', 'General'),
        element=data.get('element', 'General')
    )
    session.add(new_term)
    session.flush() # 获取 ID
    
    # 添加枚举值
    if 'enums' in data and isinstance(data['enums'], list):
        for enum_data in data['enums']:
            new_enum = TermEnum(
                glossary_id=new_term.id,
                value=enum_data['value'],
                label=enum_data.get('label', ''),
                description=enum_data.get('description', '')
            )
            session.add(new_enum)
            
    try:
        session.commit()
        return jsonify(new_term.to_dict()), 201
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500


@api_bp.route('/glossary/<int:id>', methods=['GET'])
def get_glossary_detail(id):
    """获取术语详情"""
    session = g.db_session
    item = session.query(Glossary).filter(Glossary.id == id).first()
    if not item: return jsonify({'error': 'Not found'}), 404
    return jsonify(item.to_dict())
