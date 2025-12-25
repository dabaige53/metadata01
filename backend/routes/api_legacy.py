"""
REST API 路由 (Legacy 模块)
保留未迁移到独立子模块的路由
注意：数据库和数据表接口已迁移到 databases.py 和 tables.py

已迁移的模块:
- databases.py: /databases, /databases/<id>
- tables.py: /tables, /tables/<id>, /tables/governance/*
"""
from flask import jsonify, request, g
from sqlalchemy import func, case
from ..models import (
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    CalculatedField, Metric, MetricVariant, MetricDuplicate,
    TableauUser, Project, FieldDependency, Glossary, TermEnum
)
from ..config import Config

# 从 __init__.py 导入共享的蓝图（不再创建新蓝图）
from . import api_bp
from .utils import build_tableau_url, apply_sorting, get_field_usage_by_name


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
        UNION ALL SELECT 'tables', COUNT(*) FROM tables WHERE is_embedded = 0 OR is_embedded IS NULL
        UNION ALL SELECT 'fields', COUNT(*) FROM unique_regular_fields
        UNION ALL SELECT 'metrics', COUNT(*) FROM unique_calculated_fields
        UNION ALL SELECT 'datasources', COUNT(*) FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL
        UNION ALL SELECT 'workbooks', COUNT(*) FROM workbooks
        UNION ALL SELECT 'views', COUNT(*) FROM views
        UNION ALL SELECT 'projects', COUNT(*) FROM projects
        UNION ALL SELECT 'users', COUNT(*) FROM tableau_users
        UNION ALL SELECT 'orphanedFields', COUNT(*) 
                  FROM fields f 
                  WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id)
        UNION ALL SELECT 'uniqueFields', COUNT(*) FROM unique_regular_fields
        UNION ALL SELECT 'uniqueMetrics', COUNT(*) FROM unique_calculated_fields
    """)).fetchall()
    
    stats_map = {row[0]: row[1] for row in stats_rows}
    
    stats = {
        'databases': stats_map.get('databases', 0),
        'tables': stats_map.get('tables', 0),
        'fields': stats_map.get('fields', 0),
        'uniqueFields': stats_map.get('uniqueFields', 0),  # 去重后的标准字段数
        'calculatedFields': stats_map.get('metrics', 0), # 兼容旧版统计
        'datasources': stats_map.get('datasources', 0),
        'workbooks': stats_map.get('workbooks', 0),
        'views': stats_map.get('views', 0),
        'metrics': stats_map.get('metrics', 0),
        'uniqueMetrics': stats_map.get('uniqueMetrics', 0),  # 去重后的标准指标数
        'duplicateMetrics': 0,
        'orphanedFields': stats_map.get('orphanedFields', 0),
        'projects': stats_map.get('projects', 0),
        'users': stats_map.get('users', 0)
    }
    
    return jsonify(stats)


# 注意：辅助函数已迁移到 utils.py
import re
from collections import defaultdict
from typing import Optional

@api_bp.route('/dashboard/analysis')
def get_dashboard_analysis():
    """获取仪表盘分析数据 - 性能优化版（合并查询）"""
    session = g.db_session
    import datetime
    from sqlalchemy import text
    
    stats_rows = session.execute(text("""
        SELECT 'fields' as entity, COUNT(*) as cnt FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL
        UNION ALL SELECT 'metrics', COUNT(*) FROM fields WHERE is_calculated = 1 AND (role = 'measure' OR role IS NULL)
        UNION ALL SELECT 'tables', COUNT(*) FROM tables WHERE is_embedded = 0 OR is_embedded IS NULL
        UNION ALL SELECT 'datasources', COUNT(*) FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL
        UNION ALL SELECT 'workbooks', COUNT(*) FROM workbooks
        UNION ALL SELECT 'views', COUNT(*) FROM views
    """)).fetchall()
    
    analysis_stats_map = {row[0]: row[1] for row in stats_rows}
    total_fields = analysis_stats_map.get('fields', 0)
    total_metrics = analysis_stats_map.get('metrics', 0)
    total_tables = analysis_stats_map.get('tables', 0)
    total_datasources = analysis_stats_map.get('datasources', 0)
    total_workbooks = analysis_stats_map.get('workbooks', 0)
    total_views = analysis_stats_map.get('views', 0)
    
    # 防御性定义，防止后续逻辑中使用旧变量名
    total_calc_fields = total_metrics
    
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
    
    # ===== 5. 重复公式统计 =====
    # 5.1 获取 Top 10 用于展示（使用独立的 calculated_fields 表，通过 id 计数）
    dupe_formulas = session.query(
        CalculatedField.formula, func.count(CalculatedField.id).label('cnt')
    ).filter(
        CalculatedField.formula != None,
        CalculatedField.formula != ''
    ).group_by(CalculatedField.formula)\
     .having(func.count(CalculatedField.id) > 1)\
     .order_by(func.count(CalculatedField.id).desc())\
     .limit(10).all()
    
    duplicate_formulas_top = [
        {'formula': f[:80] + '...' if len(f) > 80 else f, 'count': c}
        for f, c in dupe_formulas
    ]
    
    # 5.2 获取全量重复公式统计（修复：不再只统计 Top 10）
    total_duplicate_result = session.execute(text("""
        SELECT SUM(cnt - 1) FROM (
            SELECT formula, COUNT(*) as cnt 
            FROM calculated_fields 
            WHERE formula IS NOT NULL AND formula != ''
            GROUP BY formula 
            HAVING cnt > 1
        )
    """)).scalar()
    total_duplicate_formulas = total_duplicate_result or 0
    
    # ===== 6. 复杂度分布 =====
    # 阈值定义: low <= 1 (低价值重命名), medium 2-7, high > 7
    complexity_results = session.query(
        case(
            (CalculatedField.complexity_score <= 1, 'low'),
            (CalculatedField.complexity_score <= 7, 'medium'),
            else_='high'
        ).label('level'),
        func.count(CalculatedField.id)
    ).group_by('level').all()
    complexity_distribution = {level: cnt for level, cnt in complexity_results}
    
    # ===== 7. 问题检测与质量分析 - 合并为单条查询 =====
    
    # 7.1 描述覆盖率 - 使用单条 SQL 获取所有实体的描述/认证统计
    coverage_stats = session.execute(text("""
        SELECT 'fields' as entity, 
               COUNT(*) as total,
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as with_desc,
               0 as certified
        FROM fields WHERE is_calculated = 0 OR is_calculated IS NULL
        UNION ALL
        SELECT 'tables', COUNT(*), 
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               SUM(CASE WHEN is_certified = 1 THEN 1 ELSE 0 END)
        FROM tables WHERE is_embedded = 0 OR is_embedded IS NULL
        UNION ALL
        SELECT 'datasources', COUNT(*), 
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               SUM(CASE WHEN is_certified = 1 THEN 1 ELSE 0 END)
        FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL
        UNION ALL
        SELECT 'workbooks', COUNT(*), 
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               0
        FROM workbooks
        UNION ALL
        SELECT 'metrics', 
               COUNT(*),
               SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END),
               0
        FROM fields WHERE is_calculated = 1 AND (role = 'measure' OR role IS NULL)
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
    metric_cov = build_cov_result('metrics')
    ds_cov = build_cov_result('datasources')
    wb_cov = build_cov_result('workbooks')

    # 7.4 陈旧资产统计 - 合并为单条查询
    thirty_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=30)
    ninety_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=90)
    
    issue_stats = session.execute(text("""
        SELECT
            (SELECT COUNT(*) FROM datasources 
             WHERE has_extract = 1 AND extract_last_refresh_time < :thirty_days AND (is_embedded = 0 OR is_embedded IS NULL)) as stale_ds,
            (SELECT COUNT(*) FROM datasources 
             WHERE has_extract = 1 AND extract_last_refresh_time < :ninety_days AND (is_embedded = 0 OR is_embedded IS NULL)) as dead_ds,
            (SELECT COUNT(*) FROM fields 
             WHERE (description IS NULL OR description = '') AND (is_calculated = 0 OR is_calculated IS NULL)) as missing_desc,
            (SELECT COUNT(*) FROM tables t 
             LEFT JOIN table_to_datasource td ON t.id = td.table_id 
             WHERE td.datasource_id IS NULL AND (t.is_embedded = 0 OR t.is_embedded IS NULL)) as orphaned_tables,
            (SELECT COUNT(*) FROM fields 
             WHERE (description IS NULL OR description = '') AND is_calculated = 1 AND (role = 'measure' OR role IS NULL)) as calc_no_desc
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
        CalculatedField, Field.id == CalculatedField.id
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
            'metrics': total_metrics,
            'calculated_fields': total_metrics, # 兼容
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
# 注意：已迁移到 databases.py

# ==================== 数据表接口 ====================
# 注意：已迁移到 tables.py


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

    # 下游：引用此列的 Tableau 字段（通过 upstream_column_id）
    downstream_fields = session.query(Field).filter(Field.upstream_column_id == column_id).all()
    data['downstream_fields'] = [{
        'id': f.id,
        'name': f.name,
        'datasource_id': f.datasource_id,
        'datasource_name': f.datasource.name if f.datasource else None,
        'workbook_id': f.workbook_id,
        'workbook_name': f.workbook.name if f.workbook else None,
        'is_calculated': f.is_calculated
    } for f in downstream_fields]
    data['downstream_field_count'] = len(downstream_fields)

    return jsonify(data)

# ==================== 数据源接口 ====================

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
        'owner_distribution': owner_dist,
        'tableau_url': build_tableau_url('project', luid=project.luid, asset_id=project.id)
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
    raw_calcs = session.query(CalculatedField.id, CalculatedField.formula).all()
    
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
