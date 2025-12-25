"""
数据库接口路由模块
包含数据库列表和详情接口
"""
from flask import jsonify, request, g
from sqlalchemy.orm import selectinload
from sqlalchemy import text, bindparam
from . import api_bp
from .utils import build_tableau_url
from ..models import Database


@api_bp.route('/databases')
def get_databases():
    """获取数据库列表 - 性能优化版"""
    session = g.db_session
    search = request.args.get('search', '')
    
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
    
    # 构建 Tableau Catalog 在线链接
    data['tableau_url'] = build_tableau_url('database', asset_id=db.id, luid=db.luid)

    return jsonify(data)
