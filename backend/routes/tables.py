"""
数据表接口路由模块
包含数据表列表、详情和治理分析接口
"""
from flask import jsonify, request, g
from sqlalchemy import func, text, bindparam
from sqlalchemy.orm import selectinload
from . import api_bp
from .utils import build_tableau_url
from ..models import DBTable, DBColumn, Field, Database


# -------------------- 数据表治理分析专用 API --------------------

@api_bp.route('/tables/governance/unused')
def get_tables_unused():
    """获取未使用数据表分析（基于全量数据，未被任何数据源引用）"""
    session = g.db_session
    
    sql = """
        SELECT 
            t.id, t.name, t.schema, t.database_id,
            db.name as database_name,
            (SELECT COUNT(*) FROM db_columns c WHERE c.table_id = t.id) as column_count
        FROM tables t
        LEFT JOIN databases db ON t.database_id = db.id
        LEFT JOIN table_to_datasource td ON t.id = td.table_id
        WHERE td.datasource_id IS NULL
        ORDER BY t.name
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = [{
        'id': row.id,
        'name': row.name,
        'schema': row.schema or '-',
        'database_name': row.database_name or '-',
        'column_count': row.column_count or 0
    } for row in rows]
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


@api_bp.route('/tables/governance/wide')
def get_tables_wide():
    """获取宽表分析（基于全量数据，列数 > 50）"""
    session = g.db_session
    
    sql = """
        SELECT 
            t.id, t.name, t.schema, t.database_id,
            db.name as database_name,
            (SELECT COUNT(*) FROM db_columns c WHERE c.table_id = t.id) as column_count,
            (SELECT COUNT(DISTINCT td.datasource_id) FROM table_to_datasource td WHERE td.table_id = t.id) as datasource_count
        FROM tables t
        LEFT JOIN databases db ON t.database_id = db.id
        GROUP BY t.id
        HAVING column_count > 50
        ORDER BY column_count DESC
    """
    rows = session.execute(text(sql)).fetchall()
    
    items = [{
        'id': row.id,
        'name': row.name,
        'schema': row.schema or '-',
        'database_name': row.database_name or '-',
        'column_count': row.column_count or 0,
        'datasource_count': row.datasource_count or 0
    } for row in rows]
    
    return jsonify({
        'total_count': len(items),
        'items': items
    })


# -------------------- 数据表列表 API --------------------

@api_bp.route('/tables')
def get_tables():
    """获取数据表列表 - 性能优化版"""
    session = g.db_session
    search = request.args.get('search', '')
    schema_filter = request.args.get('schema', '')
    database_name = request.args.get('database_name', '')
    sort = request.args.get('sort', '')
    order = request.args.get('order', 'asc')
    is_embedded = request.args.get('is_embedded', None)

    def parse_list(value: str) -> list[str]:
        return [item.strip() for item in value.split(',') if item.strip()]
    
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    page_size = min(page_size, 10000)
    offset = (page - 1) * page_size
    
    # 使用 selectinload 预加载关联数据
    query = session.query(DBTable).options(
        selectinload(DBTable.fields),
        selectinload(DBTable.columns),
        selectinload(DBTable.datasources),
        selectinload(DBTable.database)
    )
    
    # 嵌入式筛选
    if is_embedded is not None:
        is_emb = is_embedded == '1' or is_embedded.lower() == 'true'
        query = query.filter(DBTable.is_embedded == is_emb)
    
    if search: 
        query = query.filter(DBTable.name.ilike(f'%{search}%'))
    
    if schema_filter:
        schema_values = parse_list(schema_filter)
        if len(schema_values) == 1:
            query = query.filter(DBTable.schema == schema_values[0])
        elif schema_values:
            query = query.filter(DBTable.schema.in_(schema_values))

    if database_name:
        database_values = parse_list(database_name)
        if database_values:
            query = query.join(DBTable.database)
            if len(database_values) == 1:
                query = query.filter(Database.name == database_values[0])
            else:
                query = query.filter(Database.name.in_(database_values))
    
    # 排序
    if sort == 'name':
        query = query.order_by(DBTable.name.desc() if order == 'desc' else DBTable.name.asc())
    elif sort == 'schema':
        query = query.order_by(DBTable.schema.desc() if order == 'desc' else DBTable.schema.asc())
    elif sort == 'field_count':
        query = query.outerjoin(Field, DBTable.id == Field.table_id).group_by(DBTable.id)
        if order == 'desc':
            query = query.order_by(func.count(Field.id).desc())
        else:
            query = query.order_by(func.count(Field.id).asc())

    # 总数和分页
    total_count = query.count()
    tables = query.limit(page_size).offset(offset).all()
    
    # Facets 统计
    schema_stats = session.execute(text("""
        SELECT schema, COUNT(*) as cnt FROM tables WHERE schema IS NOT NULL GROUP BY schema
    """)).fetchall()
    
    database_stats = session.execute(text("""
        SELECT d.name as database_name, COUNT(*) as cnt 
        FROM tables t
        LEFT JOIN databases d ON t.database_id = d.id
        WHERE d.name IS NOT NULL
        GROUP BY d.name
        ORDER BY cnt DESC
        LIMIT 20
    """)).fetchall()
    
    facets = {
        'schema': {row[0]: row[1] for row in schema_stats if row[0]},
        'database_name': {row[0]: row[1] for row in database_stats if row[0]}
    }
    
    # 预查询统计数据
    table_ids = [t.id for t in tables]
    wb_map = {}
    field_stats_map = {}
    
    if table_ids:
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
        
        # 预查询字段统计（支持直接和间接关联）
        field_stmt = text("""
            SELECT
                t.table_id,
                COUNT(DISTINCT t.field_id) as field_count,
                COUNT(DISTINCT CASE WHEN f.role = 'measure' THEN t.field_id END) as measure_count,
                COUNT(DISTINCT CASE WHEN f.role != 'measure' THEN t.field_id END) as dimension_count
            FROM (
                -- 方式1: 通过 table_to_datasource 关联（必须有 upstream_column_id 且属于当前表）
                SELECT td.table_id, f.id as field_id
                FROM table_to_datasource td
                JOIN fields f ON td.datasource_id = f.datasource_id
                JOIN db_columns c ON f.upstream_column_id = c.id
                WHERE td.table_id IN :table_ids
                AND c.table_id = td.table_id

                UNION

                -- 方式2: 通过 upstream_column_id 间接关联
                SELECT c.table_id, f.id as field_id
                FROM db_columns c
                JOIN fields f ON c.id = f.upstream_column_id
                WHERE c.table_id IN :table_ids AND f.table_id IS NULL
            ) t
            JOIN fields f ON t.field_id = f.id
            GROUP BY t.table_id
        """)
        field_stmt = field_stmt.bindparams(bindparam('table_ids', expanding=True))
        field_stats = session.execute(field_stmt, {'table_ids': list(table_ids)}).fetchall()
        field_stats_map = {row[0]: {'field_count': row[1], 'measure_count': row[2], 'dimension_count': row[3]} for row in field_stats}
    
    results = []
    for t in tables:
        data = t.to_dict()
        
        stats = field_stats_map.get(t.id, {})
        direct_field_count = len(t.fields) if t.fields else 0
        data['field_count'] = stats.get('field_count', direct_field_count)
        data['column_count'] = len(t.columns) if t.columns else 0
        
        # 分开统计嵌入式和已发布数据源
        all_datasources = t.datasources if t.datasources else []
        published_ds = [ds for ds in all_datasources if not ds.is_embedded]
        embedded_ds = [ds for ds in all_datasources if ds.is_embedded]
        data['datasource_count'] = len(published_ds)
        data['embedded_datasource_count'] = len(embedded_ds)
        
        data['workbook_count'] = wb_map.get(t.id, 0)
        
        measure_count = stats.get('measure_count', 0)
        dimension_count = stats.get('dimension_count', 0)
        data['preview_fields'] = {
            'measures': [f'度量字段 ({measure_count}个)'] if measure_count > 0 else [],
            'dimensions': [f'维度字段 ({dimension_count}个)'] if dimension_count > 0 else []
        }
        results.append(data)

    return jsonify({
        'items': results,
        'total': total_count,
        'page': page,
        'page_size': page_size,
        'facets': facets
    })


@api_bp.route('/tables/<table_id>')
def get_table_detail(table_id):
    """获取单表详情 - 完整上下文"""
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

    # 原始数据库列
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

    # Tableau字段（支持多种关联方式，合并所有来源）
    full_fields = []
    seen_field_ids = set()
    # 提前获取当前表的列ID集合，用于过滤不属于该表的字段
    column_ids = set(col.id for col in table.columns) if table.columns else set()

    # 1. 直接关联字段（Field.table_id = table.id）
    direct_fields = table.fields if table.fields else []
    for f in direct_fields:
        if f.id not in seen_field_ids:
            # 修复一致性：直接关联的字段也必须有有效的 upstream_column_id 且属于当前表
            if f.upstream_column_id and f.upstream_column_id in column_ids:
                f_data = f.to_dict()
                # 确保 via_datasource 有值（用于前端显示）
                if not f_data.get('via_datasource') and f.datasource:
                    f_data['via_datasource'] = f.datasource.name
                full_fields.append(f_data)
                seen_field_ids.add(f.id)

    # 2. 间接关联字段（通过 upstream_column_id -> DBColumn -> table）
    from sqlalchemy.orm import joinedload
    indirect_fields = session.query(Field).options(joinedload(Field.datasource))\
        .join(DBColumn, Field.upstream_column_id == DBColumn.id)\
        .filter(DBColumn.table_id == table.id)\
        .filter(Field.table_id.is_(None))\
        .all()
    for f in indirect_fields:
        if f.id not in seen_field_ids:
            f_data = f.to_dict()
            # 确保 via_datasource 有值
            if not f_data.get('via_datasource') and f.datasource:
                f_data['via_datasource'] = f.datasource.name
            full_fields.append(f_data)
            seen_field_ids.add(f.id)

    # 3. 通过关联的数据源获取字段（用于嵌入式表）
    # 重要：只保留 upstream_column 真正属于当前表的字段，过滤掉 JOIN 进来的其他表字段
    if table.datasources:
        for ds in table.datasources:
            for f in ds.fields:
                if f.id not in seen_field_ids:
                    # 过滤逻辑：字段必须有 upstream_column_id 且属于当前表
                    # 没有 upstream_column_id 的字段不应该关联到任何表
                    if not f.upstream_column_id:
                        continue  # 跳过没有上游列的字段
                    if f.upstream_column_id not in column_ids:
                        continue  # 跳过不属于本表的字段
                    f_data = f.to_dict()
                    f_data['via_datasource'] = ds.name
                    full_fields.append(f_data)
                    seen_field_ids.add(f.id)

    data['source_type'] = 'direct' if direct_fields else ('via_datasource' if table.datasources else 'no_fields')

    data['full_fields'] = full_fields

    # 关联的数据源列表
    datasources_data = []
    seen_ds_ids = set()
    for ds in table.datasources:
        if ds.id not in seen_ds_ids:
            datasources_data.append({
                'id': ds.id,
                'name': ds.name,
                'project_name': ds.project_name,
                'owner': ds.owner,
                'is_certified': ds.is_certified,
                'has_extract': ds.has_extract,
                'is_embedded': ds.is_embedded
            })
            seen_ds_ids.add(ds.id)
    data['datasources'] = datasources_data

    # 关联的工作簿列表
    workbooks_data = []
    seen_wb_ids = set()
    
    if table.datasources:
        for ds in table.datasources:
            for wb in ds.workbooks:
                if wb.id not in seen_wb_ids:
                    workbooks_data.append({
                        'id': wb.id,
                        'name': wb.name,
                        'project_name': wb.project_name,
                        'owner': wb.owner,
                        'connection_type': 'published'
                    })
                    seen_wb_ids.add(wb.id)
    
    direct_fields = session.query(Field).join(DBColumn, Field.upstream_column_id == DBColumn.id)\
        .filter(DBColumn.table_id == table.id)\
        .filter(Field.workbook_id.isnot(None))\
        .all()
        
    for f in direct_fields:
        if f.workbook and f.workbook.id not in seen_wb_ids:
            workbooks_data.append({
                'id': f.workbook.id,
                'name': f.workbook.name,
                'project_name': f.workbook.project_name,
                'owner': f.workbook.owner,
                'connection_type': 'embedded'
            })
            seen_wb_ids.add(f.workbook.id)
            
    data['workbooks'] = workbooks_data

    # 统计信息
    data['stats'] = {
        'column_count': len(table.columns),
        'field_count': len(full_fields),
        'datasource_count': len(datasources_data),
        'workbook_count': len(workbooks_data)
    }
    
    # 添加顶层 referenceCount 属性，供前端页眉显示
    data['referenceCount'] = len(workbooks_data)
    
    # 获取关联数据源的 vizportal_url_id 或工作簿信息（用于嵌入式表的 URL 构建）
    ds_vizportal_url_id = None
    wb_vizportal_url_id = None
    embedded_ds_id = None
    
    if table.is_embedded and table.datasources:
        for ds in table.datasources:
            # 优先处理嵌入式数据源：需要找到所属工作簿
            if ds.is_embedded:
                if ds.workbooks:
                    # 嵌入式数据源通常只属于一个工作簿
                    wb = ds.workbooks[0]
                    if wb.vizportal_url_id:
                        wb_vizportal_url_id = wb.vizportal_url_id
                        embedded_ds_id = ds.id
                        break
            # 其次处理已发布数据源
            elif ds.vizportal_url_id:
                ds_vizportal_url_id = ds.vizportal_url_id
                # 如果找到了已发布数据源，也可以break，视业务优先级而定
                # 这里假设嵌入式表如果关联了已发布数据源，优先跳转数据源
                break
    
    data['tableau_url'] = build_tableau_url(
        'table', 
        asset_id=table.id, 
        luid=table.luid,
        is_embedded=table.is_embedded or False,
        datasource_vizportal_url_id=ds_vizportal_url_id,
        workbook_vizportal_url_id=wb_vizportal_url_id,
        embedded_datasource_id=embedded_ds_id
    )

    return jsonify(data)


# -------------------- 数据表子资源路由 --------------------

@api_bp.route('/tables/<table_id>/fields')
def get_table_fields(table_id):
    """获取表关联的字段列表"""
    session = g.db_session
    table = session.query(DBTable).filter(DBTable.id == table_id).first()
    if not table:
        return jsonify({'error': 'Not found'}), 404
    
    fields_data = [f.to_dict() for f in table.fields] if table.fields else []
    return jsonify({'items': fields_data, 'total': len(fields_data)})


@api_bp.route('/tables/<table_id>/datasources')
def get_table_datasources(table_id):
    """获取表关联的数据源列表"""
    session = g.db_session
    table = session.query(DBTable).filter(DBTable.id == table_id).first()
    if not table:
        return jsonify({'error': 'Not found'}), 404
    
    ds_data = [{
        'id': ds.id, 'name': ds.name, 'project_name': ds.project_name,
        'owner': ds.owner, 'is_certified': ds.is_certified
    } for ds in table.datasources]
    return jsonify({'items': ds_data, 'total': len(ds_data)})


@api_bp.route('/tables/<table_id>/workbooks')
def get_table_workbooks(table_id):
    """获取表关联的工作簿列表"""
    session = g.db_session
    table = session.query(DBTable).filter(DBTable.id == table_id).first()
    if not table:
        return jsonify({'error': 'Not found'}), 404
    
    seen_wb_ids = set()
    workbooks_data = []
    for ds in table.datasources:
        for wb in ds.workbooks:
            if wb.id not in seen_wb_ids:
                workbooks_data.append({
                    'id': wb.id, 'name': wb.name, 'project_name': wb.project_name, 'owner': wb.owner
                })
                seen_wb_ids.add(wb.id)
    return jsonify({'items': workbooks_data, 'total': len(workbooks_data)})
