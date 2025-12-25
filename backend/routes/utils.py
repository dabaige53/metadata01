"""
通用工具函数和辅助模块
供各路由模块共享使用
"""
import re
from collections import defaultdict
from typing import Optional
from flask import g
from sqlalchemy import func, case
from ..models import (
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    CalculatedField, Metric, MetricVariant, MetricDuplicate,
    TableauUser, Project, FieldDependency, Glossary, TermEnum
)
from ..config import Config


def build_tableau_url(asset_type: str, path: Optional[str] = None, uri: Optional[str] = None, 
                      luid: Optional[str] = None, asset_id: Optional[str] = None, 
                      vizportal_url_id: Optional[str] = None) -> Optional[str]:
    """
    构建 Tableau Server 在线查看 URL
    
    参数:
        asset_type: 资产类型 ('view', 'workbook', 'datasource', 'database', 'table')
        path: 视图路径
        uri: 资产 URI (备用)
        luid: 资产的 LUID
        asset_id: 资产 ID
        vizportal_url_id: Vizportal URL ID (最准确的 ID，优先使用)
    
    返回:
        Tableau Server 在线查看 URL，或 None
    """
    base_url = Config.TABLEAU_BASE_URL.rstrip('/')
    
    if asset_type == 'view' and path:
        if path.startswith('/'):
            return f"{base_url}{path}"
        else:
            return f"{base_url}/views/{path}"
    
    if asset_type == 'workbook':
        if path:
            if path.startswith('/'):
                return f"{base_url}{path}"
            else:
                return f"{base_url}/views/{path}"
        return None
    
    if asset_type == 'datasource':
        if vizportal_url_id:
            return f"{base_url}/#/datasources/{vizportal_url_id}/askData"
        if uri and '/' in uri:
            parts = uri.split('/')
            if len(parts) >= 2:
                ds_id = parts[-1]
                return f"{base_url}/#/datasources/{ds_id}/askData"
        if luid:
            return f"{base_url}/#/datasources/{luid}/askData"
    
    if asset_type == 'database':
        db_id = asset_id or luid
        if db_id:
            return f"{base_url}/#/catalog/databases/{db_id}/tables"
    
    if asset_type == 'table':
        table_id = asset_id or luid
        if table_id:
            return f"{base_url}/#/catalog/tables/{table_id}/columns"
    
    if asset_type == 'project':
        project_id = luid or asset_id
        if project_id:
            return f"{base_url}/#/projects/{project_id}"
    
    return None


def apply_sorting(query, model, sort_key, order):
    """通用排序逻辑"""
    if not sort_key or sort_key == 'undefined': 
        return query
    attr = None
    if hasattr(model, sort_key):
        attr = getattr(model, sort_key)
    
    if sort_key == 'usageCount' and model == Field:
        return query  # Handle in Python or complex join
    
    if attr:
        query = query.order_by(attr.desc() if order == 'desc' else attr.asc())
    return query


def get_field_usage_by_name(session, field_name):
    """
    按需查询：获取指定字段被哪些指标引用
    """
    deps = session.query(Field, Datasource, CalculatedField, Workbook).join(
        FieldDependency, Field.id == FieldDependency.source_field_id
    ).outerjoin(
        Datasource, Field.datasource_id == Datasource.id
    ).outerjoin(
        Workbook, Field.workbook_id == Workbook.id
    ).outerjoin(
        CalculatedField, Field.id == CalculatedField.id
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
