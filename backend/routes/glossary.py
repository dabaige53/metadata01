from flask import Blueprint, request, jsonify, g
from sqlalchemy import or_
from backend.models import (
    Glossary, TermEnum, 
    UniqueRegularField, UniqueCalculatedField, 
    DBTable, Datasource, Workbook, View,
    Project, TableauUser
)
from datetime import datetime
from . import api_bp

@api_bp.route('/glossary', methods=['GET'])
def get_glossary_items():
    """获取术语列表"""
    search = request.args.get('search', '')
    element = request.args.get('element', 'all')
    
    query = g.db_session.query(Glossary)
    
    # 搜索过滤
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Glossary.term.ilike(search_term),
                Glossary.definition.ilike(search_term)
            )
        )
    
    # 元素类型过滤
    if element and element != 'all':
        query = query.filter(Glossary.element == element)
        
    # 分页参数
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 50, type=int)
    offset = (page - 1) * page_size
    
    # 获取总数
    total = query.count()
    
    # 排序并分页
    query = query.order_by(Glossary.term.asc())
    items = query.limit(page_size).offset(offset).all()
    
    return jsonify({
        "items": [item.to_dict() for item in items],
        "total": total,
        "page": page,
        "page_size": page_size
    })

@api_bp.route('/glossary/sync', methods=['POST'])
def sync_glossary():
    """从元数据同步生成术语"""
    session = g.db_session
    added_count = 0
    updated_count = 0
    
    # 定义同步源
    sync_sources = [
        {
            'model': UniqueRegularField,
            'element': 'field',
            'category': '原始字段',
            'term_field': 'name', # 优先使用 caption但在 UniqueRegularField 中主要是 name/upstream_column_name
            'desc_field': 'description'
        },
        {
            'model': UniqueCalculatedField,
            'element': 'metric',
            'category': '计算字段',
            'term_field': 'name',
            'desc_field': 'description'
        },
        {
            'model': DBTable,
            'element': 'table', 
            'category': '数据表',
            'term_field': 'name',
            'desc_field': 'description'
        },
        {
            'model': Datasource,
            'element': 'datasource',
            'category': '数据源',
            'term_field': 'name',
            'desc_field': 'description'
        },
        {
            'model': Workbook,
            'element': 'workbook',
            'category': '工作簿',
            'term_field': 'name',
            'desc_field': 'description'
        },
        {
            'model': View,
            'element': 'view',
            'category': '视图',
            'term_field': 'name',
            'desc_field': None # View 没有 description 字段
        },
        {
            'model': Project,
            'element': 'project',
            'category': '项目',
            'term_field': 'name',
            'desc_field': 'description'
        },
        {
            'model': TableauUser,
            'element': 'user',
            'category': '用户',
            'term_field': 'name',
            'desc_field': None # User 没有 description
        }
    ]
    
    for source in sync_sources:
        model = source['model']
        records = session.query(model).all()
        
        for record in records:
            # 获取术语名称
            term_name = getattr(record, source['term_field'], None)
            
            # 特殊处理：对于字段，如果有 caption 且不为空，也可以考虑作为术语，目前先用 name
            # 对于 UniqueRegularField，name 通常是 upstream_column_name
            
            if not term_name:
                continue
                
            # 获取描述
            description = None
            if source['desc_field'] and hasattr(record, source['desc_field']):
                description = getattr(record, source['desc_field'])
            
            if not description:
                description = f"系统自动同步的{source['category']}: {term_name}"
            
            # 查找是否存在
            item = session.query(Glossary).filter_by(term=term_name, element=source['element']).first()
            
            if item:
                # 更新描述 (如果原来的描述只是默认的，或者为空)
                if not item.definition or item.definition.startswith("系统自动同步"):
                    if description and not description.startswith("系统自动同步"):
                        item.definition = description
                        item.updated_at = datetime.utcnow()
                        updated_count += 1
            else:
                # 创建新术语
                try:
                    new_item = Glossary(
                        term=term_name,
                        definition=description,
                        category=source['category'],
                        element=source['element']
                    )
                    session.add(new_item)
                    added_count += 1
                except Exception as e:
                    print(f"Error adding term {term_name}: {e}")
                    session.rollback()
                    continue
                    
    session.commit()
    
    return jsonify({
        "status": "success",
        "added": added_count,
        "updated": updated_count,
        "message": f"同步完成: 新增 {added_count} 条, 更新 {updated_count} 条"
    })
