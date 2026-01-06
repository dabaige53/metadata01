"""
通用工具函数和辅助模块
供各路由模块共享使用
"""

import re
from collections import defaultdict
from typing import Optional
from typing import Any, Dict, List, Union
from flask import g
from sqlalchemy import func, case
from ..models import (
    Database,
    DBTable,
    DBColumn,
    Field,
    Datasource,
    Workbook,
    View,
    CalculatedField,
    Metric,
    MetricVariant,
    MetricDuplicate,
    TableauUser,
    Project,
    FieldDependency,
    Glossary,
    TermEnum,
)
from ..config import Config


def snake_to_camel(s: str) -> str:
    """将 snake_case 转换为 camelCase"""
    components = s.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def parse_list(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def build_in_clause(prefix: str, values: List[str], params_map: dict) -> str:
    keys = []
    for idx, val in enumerate(values):
        key = f"{prefix}_{idx}"
        params_map[key] = val
        keys.append(f":{key}")
    return f"({', '.join(keys)})"


def to_camel_case(data: Union[Dict, List, Any]) -> Union[Dict, List, Any]:
    """
    递归将字典或列表中的所有 snake_case 键转换为 camelCase

    使用示例:
        result = to_camel_case({'user_name': 'test', 'created_at': '2024-01-01'})
        # 返回: {'userName': 'test', 'createdAt': '2024-01-01'}
    """
    if isinstance(data, dict):
        return {snake_to_camel(k): to_camel_case(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [to_camel_case(item) for item in data]
    else:
        return data


def build_tableau_url(
    asset_type: str,
    path: Optional[str] = None,
    uri: Optional[str] = None,
    luid: Optional[str] = None,
    asset_id: Optional[str] = None,
    vizportal_url_id: Optional[str] = None,
    is_embedded: bool = False,
    datasource_vizportal_url_id: Optional[str] = None,
    workbook_vizportal_url_id: Optional[str] = None,
    embedded_datasource_id: Optional[str] = None,
) -> Optional[str]:
    """
    构建 Tableau Server 在线查看 URL

    参数:
        asset_type: 资产类型 ('view', 'workbook', 'datasource', 'database', 'table')
        path: 视图路径
        uri: 资产 URI (备用)
        luid: 资产的 LUID
        asset_id: 资产 ID
        vizportal_url_id: Vizportal URL ID (最准确的 ID，优先使用)
        is_embedded: 是否为嵌入式资产（如嵌入式表、自定义SQL查询）
        datasource_vizportal_url_id: 关联数据源的 Vizportal URL ID（用于嵌入式表，指向已发布数据源）
        workbook_vizportal_url_id: 关联工作簿的 Vizportal URL ID（用于嵌入式表，指向嵌入式数据源）
        embedded_datasource_id: 嵌入式数据源 ID（用于嵌入式表 URL 参数）

    返回:
        Tableau Server 在线查看 URL，或 None
    """
    base_url = Config.TABLEAU_BASE_URL.rstrip("/")

    if asset_type == "view" and path:
        if path.startswith("/"):
            return f"{base_url}{path}"
        else:
            return f"{base_url}/views/{path}"

    if asset_type == "workbook":
        if path:
            if path.startswith("/"):
                return f"{base_url}{path}"
            else:
                return f"{base_url}/views/{path}"
        return None

    if asset_type == "datasource":
        if vizportal_url_id:
            return f"{base_url}/#/datasources/{vizportal_url_id}/askData"
        if uri and "/" in uri:
            parts = uri.split("/")
            if len(parts) >= 2:
                ds_id = parts[-1]
                return f"{base_url}/#/datasources/{ds_id}/askData"
        if luid:
            return f"{base_url}/#/datasources/{luid}/askData"

    if asset_type == "database":
        db_id = asset_id or luid
        if db_id:
            return f"{base_url}/#/catalog/databases/{db_id}/tables"

    if asset_type == "table":
        # 嵌入式表如果包含 luid，说明在 Catalog 中有独立实体，可以直接访问
        # 只有没有 luid 的嵌入式表（如自定义SQL查询），才需要通过关联数据源访问
        if is_embedded and not luid:
            # 场景1: 属于嵌入式数据源 -> 链接到所属工作簿的血缘页面
            if workbook_vizportal_url_id and embedded_datasource_id:
                return f"{base_url}/#/workbooks/{workbook_vizportal_url_id}/lineage/fields?embeddedDataSource={embedded_datasource_id}"

            # 场景2: 属于已发布数据源 -> 链接到数据源页面
            if datasource_vizportal_url_id:
                return f"{base_url}/#/datasources/{datasource_vizportal_url_id}/askData"

            # 场景3: 信息不足
            return None

        # 普通表或有 LUID 的嵌入式表，使用标准 Catalog 链接
        # 重要：Catalog URL 通常使用内部元数据 ID (asset_id)，而非 REST API LUID
        # 所以这里优先使用 asset_id
        table_id = asset_id or luid
        if table_id:
            return f"{base_url}/#/catalog/tables/{table_id}/columns"

    if asset_type == "project":
        # 优先使用 vizportal_url_id
        if vizportal_url_id:
            return f"{base_url}/#/projects/{vizportal_url_id}"

        project_id = luid or asset_id
        if project_id:
            return f"{base_url}/#/projects/{project_id}"

    return None


def apply_sorting(query, model, sort_key, order):
    """通用排序逻辑"""
    if not sort_key or sort_key == "undefined":
        return query
    attr = None
    if hasattr(model, sort_key):
        attr = getattr(model, sort_key)

    if sort_key == "usageCount" and model == Field:
        return query  # Handle in Python or complex join

    if attr:
        query = query.order_by(attr.desc() if order == "desc" else attr.asc())
    return query


def get_field_usage_by_name(session, field_name):
    """
    按需查询：获取指定字段被哪些指标引用
    """
    deps = (
        session.query(Field, Datasource, CalculatedField, Workbook)
        .join(FieldDependency, Field.id == FieldDependency.source_field_id)
        .outerjoin(Datasource, Field.datasource_id == Datasource.id)
        .outerjoin(Workbook, Field.workbook_id == Workbook.id)
        .outerjoin(CalculatedField, Field.id == CalculatedField.id)
        .filter(FieldDependency.dependency_name == field_name)
        .all()
    )

    result = []
    for f, ds, cf, wb in deps:
        result.append(
            {
                "id": f.id,
                "name": f.name,
                "datasourceId": f.datasource_id,
                "datasourceName": ds.name if ds else None,
                "workbookId": f.workbook_id,
                "workbookName": wb.name if wb else None,
                "description": f.description,
                "formula": cf.formula if cf else None,
                "role": f.role,
                "dataType": f.data_type,
            }
        )
    return result
