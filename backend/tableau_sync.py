"""
Tableau Metadata API 数据同步模块
从 Tableau Server 抓取元数据并存入本地数据库
"""
import os
import sys
import json
import requests
import hashlib
from collections import defaultdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, text
import re

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import Config
from backend.models import (
    Base, get_engine, init_db, get_session,
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    TableauUser, Project,
    table_to_datasource, datasource_to_workbook, field_to_view, CalculatedField, SyncLog,
    FieldDependency, Metric, dashboard_to_sheet
)


class TableauMetadataClient:
    """Tableau Metadata API 客户端"""
    
    def __init__(self, base_url: str, username: str = None, password: str = None, 
                 pat_name: str = None, pat_secret: str = None):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.pat_name = pat_name
        self.pat_secret = pat_secret
        self.auth_token: Optional[str] = None
        self.site_id: Optional[str] = None
        self.api_version = "3.10"
    
    def sign_in(self) -> bool:
        """登录获取认证 token (支持用户名密码或 PAT)"""
        signin_url = f"{self.base_url}/api/{self.api_version}/auth/signin"
        
        # 根据配置选择认证方式
        if self.pat_name and self.pat_secret:
            # PAT 认证
            payload = {
                "credentials": {
                    "personalAccessTokenName": self.pat_name,
                    "personalAccessTokenSecret": self.pat_secret,
                    "site": {"contentUrl": ""}
                }
            }
            print(f"  使用 PAT 认证: {self.pat_name}")
        else:
            # 用户名密码认证
            payload = {
                "credentials": {
                    "name": self.username,
                    "password": self.password,
                    "site": {"contentUrl": ""}
                }
            }
            print(f"  使用用户名密码认证: {self.username}")
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        try:
            response = requests.post(signin_url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                credentials = data.get("credentials", {})
                self.auth_token = credentials.get("token")
                self.site_id = credentials.get("site", {}).get("id")
                print(f"✅ 登录成功 (Token: {self.auth_token[:20]}...)")
                return True
            else:
                print(f"❌ 登录失败: {response.text}")
                return False
        except Exception as e:
            print(f"❌ 登录异常: {e}")
            return False
    
    def sign_out(self):
        """登出释放 token"""
        if not self.auth_token:
            return
        
        signout_url = f"{self.base_url}/api/{self.api_version}/auth/signout"
        headers = {"X-Tableau-Auth": self.auth_token}
        
        try:
            response = requests.post(signout_url, headers=headers, timeout=30)
            if response.status_code == 204:
                print("✅ 已登出")
        except Exception as e:
            print(f"登出异常: {e}")
        finally:
            self.auth_token = None
    
    def execute_query(self, query: str) -> Dict[str, Any]:
        """执行 GraphQL 查询"""
        if not self.auth_token:
            raise RuntimeError("未登录，请先调用 sign_in()")
        
        url = f"{self.base_url}/api/metadata/graphql"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Tableau-Auth": self.auth_token
        }
        
        response = requests.post(url, headers=headers, json={"query": query}, timeout=60)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise RuntimeError(f"GraphQL 查询失败: {response.status_code} - {response.text}")
    
    def fetch_views_usage(self) -> Dict[str, int]:
        """从 REST API 获取视图使用统计 (REST API)"""
        if not self.auth_token or not self.site_id:
            raise RuntimeError("未登录，请先调用 sign_in()")
        
        # REST API endpoint for views
        url = f"{self.base_url}/api/{self.api_version}/sites/{self.site_id}/views"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Tableau-Auth": self.auth_token
        }
        
        usage_map = {}
        page_number = 1
        page_size = 100
        
        print(f"  正在调用 REST API 获取访问统计: {url}")
        
        while True:
            params = {
                "pageNumber": page_number,
                "pageSize": page_size,
                "includeUsageStatistics": "true"
            }
            
            try:
                response = requests.get(url, headers=headers, params=params, timeout=30)
                
                if response.status_code != 200:
                    print(f"  ❌ REST API 获取失败: {response.status_code} - {response.text}")
                    break
                
                data = response.json()
                views = data.get("views", {}).get("view", [])
                
                if not views:
                    break
                
                for view in views:
                    luid = view.get("id")
                    usage = view.get("usage", {})
                    # usage 可能是 None，也可能没有 totalViewCount
                    if usage:
                        total_count = usage.get("totalViewCount", 0)
                        if luid:
                            usage_map[luid] = int(total_count)
                
                # Check pagination
                pagination = data.get("pagination", {})
                total_available = int(pagination.get("totalAvailable", 0))
                
                print(f"    - Page {page_number}: 获取 {len(views)} 个视图, 总进度 {len(usage_map)}/{total_available}")
                
                if len(usage_map) >= total_available or len(views) < page_size:
                    break
                    
                page_number += 1
                
            except Exception as e:
                print(f"  ❌ 获取视图统计异常: {e}")
                break
                
        return usage_map    
    def fetch_databases(self) -> List[Dict]:
        """获取所有数据库（增强版）"""
        query = """
        {
            databaseServers {
                id
                luid
                name
                connectionType
                hostName
                port
                service
                description
                isCertified
                certificationNote
            }
        }
        """
        result = self.execute_query(query)
        # 兼容处理：先尝试 databaseServers，失败则回退到 databases
        data = result.get("data", {})
        servers = data.get("databaseServers")
        if servers is not None:
            return servers
        # 回退到旧查询
        return self._fetch_databases_fallback()
    
    def _fetch_databases_fallback(self) -> List[Dict]:
        """回退：使用旧版查询获取数据库"""
        query = """
        {
            databases {
                id
                name
                connectionType
            }
        }
        """
        result = self.execute_query(query)
        return result.get("data", {}).get("databases", [])
    
    def fetch_tables(self) -> List[Dict]:
        """获取所有数据表（增强版）"""
        query = """
        {
            databaseTables {
                id
                luid
                name
                schema
                fullName
                description
                isEmbedded
                projectName
                database {
                    id
                    name
                    connectionType
                }
                columns {
                    id
                    name
                    description
                    remoteType
                    isNullable
                }
            }
        }
        """
        result = self.execute_query(query)
        
        # 检查是否有错误（某些字段可能不被支持）
        if "errors" in result:
            print(f"  ⚠️ GraphQL 警告: {result['errors']}")
            # 尝试简化查询
            return self._fetch_tables_fallback()
        
        return result.get("data", {}).get("databaseTables", [])
    
    def _fetch_tables_fallback(self) -> List[Dict]:
        """回退：使用简化查询获取表（包含列信息）"""
        query = """
        {
            databaseTables {
                id
                name
                schema
                fullName
                isEmbedded
                database {
                    id
                    name
                    connectionType
                }
                columns {
                    id
                    name
                    remoteType
                    description
                    isNullable
                }
            }
        }
        """
        result = self.execute_query(query)
        return result.get("data", {}).get("databaseTables", [])
    
    def fetch_datasources(self) -> List[Dict]:
        """获取所有已发布数据源（增强版）"""
        query = """
        {
            publishedDatasources {
                id
                luid
                name
                description
                uri
                projectName
                hasExtracts
                extractLastRefreshTime
                extractLastIncrementalUpdateTime
                extractLastUpdateTime
                isCertified
                certificationNote
                certifierDisplayName
                containsUnsupportedCustomSql
                hasActiveWarning
                createdAt
                updatedAt
                vizportalUrlId
                owner {
                    id
                    username
                    name
                }
                upstreamTables {
                    id
                    name
                }
            }
        }
        """
        result = self.execute_query(query)
        
        # 检查错误并回退
        if "errors" in result:
            print(f"  ⚠️ GraphQL 警告: {result['errors']}")
            return self._fetch_datasources_fallback()
        
        return result.get("data", {}).get("publishedDatasources", [])
    
    def _fetch_datasources_fallback(self) -> List[Dict]:
        """回退：使用简化查询获取数据源"""
        query = """
        {
            publishedDatasources {
                id
                name
                projectName
                hasExtracts
                extractLastRefreshTime
                isCertified
                owner {
                    username
                }
                upstreamTables {
                    id
                    name
                }
            }
        }
        """
        result = self.execute_query(query)
        return result.get("data", {}).get("publishedDatasources", [])
    
    def fetch_workbooks(self) -> List[Dict]:
        """获取所有工作簿（优化版：Robust Aliased Chunking + Null Owner Fallback）"""
        all_workbooks = []
        
        print(f"  正在获取工作簿列表...")
        # 1. 获取所有 ID (Safe Query)
        list_query = """
        {
            workbooks {
                id
                name
            }
        }
        """
        list_result = self.execute_query(list_query)
        if "errors" in list_result and not list_result.get("data"):
            print(f"  ⚠️ 获取工作簿列表失败: {list_result['errors']}")
            return []
            
        workbooks_meta = list_result.get("data", {}).get("workbooks") or []
        print(f"  需同步 {len(workbooks_meta)} 个工作簿详情...")
        
        # 2. 分批获取详情
        chunk_size = 10
        total = len(workbooks_meta)
        
        for i in range(0, total, chunk_size):
            chunk = workbooks_meta[i:i+chunk_size]
            
            # 尝试批量获取 (含 metadata)
            try:
                self._fetch_workbooks_chunk(chunk, all_workbooks, include_owner=True)
            except Exception as e:
                print(f"  ⚠️ 批次 {i//chunk_size + 1} 遇到错误，尝试降级重试 (不含 Owner)...")
                try:
                    self._fetch_workbooks_chunk(chunk, all_workbooks, include_owner=False)
                except Exception as e2:
                    print(f"  ❌ 批次 {i//chunk_size + 1} 彻底失败: {e2}")

            print(f"    - 工作簿: 已处理 {min(i+chunk_size, total)}/{total}")

        return all_workbooks
    
    def _fetch_workbooks_chunk(self, chunk: List[Dict], all_workbooks: List[Dict], include_owner: bool = True):
        """辅助：批量获取工作簿详情"""
        query_parts = []
        owner_field = """
                    owner {
                        id
                        username
                        name
                    }
        """ if include_owner else ""
        
        for idx, wb in enumerate(chunk):
            wb_id = wb["id"]
            query_parts.append(f"""
            wb{idx}: workbooks(filter: {{id: "{wb_id}"}}) {{
                id
                luid
                name
                description
                uri
                projectName
                createdAt
                updatedAt
                containsUnsupportedCustomSql
                vizportalUrlId
                {owner_field}
                upstreamDatasources {{
                    id
                    name
                }}
                sheets {{
                    id
                    luid
                    name
                    path
                    index
                    createdAt
                    updatedAt
                }}
                dashboards {{
                    id
                    luid
                    name
                    path
                    index
                    createdAt
                    updatedAt
                    sheets {{
                        id
                    }}
                }}
                embeddedDatasources {{
                    id
                    name
                    upstreamDatasources {{
                        id
                        name
                    }}
                    fields {{
                        id
                        name
                        description
                        ... on ColumnField {{
                            dataType
                            role
                            isHidden
                            folderName
                        }}
                        ... on CalculatedField {{
                            dataType
                            role
                            isHidden
                            folderName
                            formula
                        }}
                    }}
                }}
            }}
            """)
        
        full_query = "{" + "\n".join(query_parts) + "}"
        result = self.execute_query(full_query)
        
        # 检查是否有 strict error (导致 data 为 null)
        if "data" not in result or not result["data"]:
             # 抛出异常以触发降级
             raise Exception("Data is null, likely non-nullable field violation")
             
        data = result.get("data", {})
        
        for key, wb_list in data.items():
            if not wb_list: continue 
            wb_detail = wb_list[0]
            
            all_workbooks.append(wb_detail)
    
    def fetch_fields(self) -> List[Dict]:
        all_fields = []
        
        # 1. 获取所有数据源 ID
        print(f"  正在获取数据源列表以同步字段...")
        ds_query = """
        {
            publishedDatasources {
                id
                name
            }
            embeddedDatasources {
                id
                name
                upstreamDatasources {
                    id
                    name
                }
            }
        }
        """
        ds_result = self.execute_query(ds_query)
        if "errors" in ds_result and not ds_result.get("data"):
            print(f"  ⚠️ 获取数据源失败: {ds_result['errors']}")
            return []
            
        published = ds_result.get("data", {}).get("publishedDatasources") or []
        embedded = ds_result.get("data", {}).get("embeddedDatasources") or []
        
        # 建立嵌入式到发布映射
        embedded_to_published = {}
        for ds in embedded:
            upstreams = ds.get("upstreamDatasources") or []
            if upstreams:
                embedded_to_published[ds["id"]] = upstreams[0]["id"]

        # 分别处理两种数据源
        self._batch_fetch_fields(published, "publishedDatasources", all_fields)
        self._batch_fetch_fields(embedded, "embeddedDatasources", all_fields, embedded_to_published)
        
        print(f"  ✅ 共采集到 {len(all_fields)} 个字段")
        return all_fields

    def _batch_fetch_fields(self, datasources: List[Dict], type_name: str, all_fields: List[Dict], 
                             embedded_to_published: Dict = None):
        """批量获取字段详情 (辅助方法)"""
        if not datasources:
            return
        
        embedded_to_published = embedded_to_published or {}

        print(f"  同步 {type_name}: {len(datasources)} 个...")
        chunk_size = 10
        total = len(datasources)
        
        for i in range(0, total, chunk_size):
            chunk = datasources[i:i+chunk_size]
            
            # 动态构建 Alias Filter 查询
            query_parts = []
            for idx, ds in enumerate(chunk):
                ds_id = ds["id"]
                query_parts.append(f"""
                q{idx}: {type_name}(filter: {{id: "{ds_id}"}}) {{
                    id
                    name
                    fields {{
                        __typename
                        id
                        name
                        description
                        ... on ColumnField {{
                            dataType
                            role
                            isHidden
                            upstreamColumns {{
                                id
                                name
                                table {{
                                    id
                                }}
                            }}
                        }}
                        ... on CalculatedField {{
                            dataType
                            role
                            isHidden
                            formula
                            upstreamFields {{
                                id
                                name
                                datasource {{
                                    id
                                    name
                                }}
                            }}
                        }}
                        ... on GroupField {{
                            dataType
                            role
                            isHidden
                        }}
                    }}
                }}
                """)
            
            full_query = "{" + "\n".join(query_parts) + "}"
            
            try:
                result = self.execute_query(full_query)
                if "errors" in result:
                    print(f"  ⚠️ 批次 {i//chunk_size + 1} 部分失败: {result['errors'][0].get('message')}")
                
                data = result.get("data", {})
                if not data: continue
                
                for key, ds_list in data.items():
                    if not ds_list: continue
                    # filter查询返回的是列表，取第一个
                    ds_data = ds_list[0]
                    ds_id = ds_data.get("id")
                    ds_name = ds_data.get("name")
                    
                    # 血缘穿透：如果是嵌入式且有上游发布式，则使用发布式的 ID
                    final_ds_id = embedded_to_published.get(ds_id, ds_id)
                    
                    fields_list = ds_data.get("fields") or []
                    for field in fields_list:
                        if field and field.get("id"):
                            field["datasource_id"] = final_ds_id
                            field["datasource_name"] = ds_name
                            field["parent_datasource_id"] = ds_id  # 保留原始 ID 备用
                            all_fields.append(field)
                
                print(f"    - {type_name}: 已处理 {min(i+chunk_size, total)}/{total}")
                
            except Exception as e:
                print(f"  ❌ 批次查询异常: {e}")

    def fetch_calculated_fields(self) -> List[Dict]:
        """获取所有计算字段"""
        query = """
        {
            calculatedFields {
                id
                name
                description
                formula
                dataType
                role
                datasource {
                    id
                    name
                }
            }
        }
        """
        result = self.execute_query(query)
        
        # 检查错误
        if "errors" in result:
            print(f"  ⚠️ GraphQL 错误: {result['errors']}")
            return []
        
        data = result.get("data")
        if data is None:
            return []
        
        calc_fields = data.get("calculatedFields") or []
        
        # 尝试穿透：对于没有 datasource 或者 datasource 为嵌入式的，
        # 在返回前可以根据内部逻辑增强，但最核心的穿透已在 _batch_fetch_fields 完成。
        # 这里我们确保 cf 也携带必要的 datasource_id。
        for cf in calc_fields:
            if cf and cf.get("datasource"):
                cf["datasource_id"] = cf["datasource"].get("id")
            
        return calc_fields
    
    def fetch_views_with_fields(self) -> List[Dict]:
        """获取视图及其使用的字段（迭代优化版：通过 Filter-ID 分页采集）"""
        all_view_fields = []
        
        print(f"  正在获取视图字段关联(优化版)...")
        
        # 1. 获取所有工作簿 ID
        wb_query = """
        {
            workbooks {
                id
                name
            }
        }
        """
        wb_result = self.execute_query(wb_query)
        if "errors" in wb_result and not wb_result.get("data"):
             print(f"  ⚠️ 获取工作簿列表失败: {wb_result['errors']}")
             return []
             
        workbooks = wb_result.get("data", {}).get("workbooks") or []
        print(f"  需同步 {len(workbooks)} 个工作簿的视图关联...")
        
        # 2. 逐个工作簿查询 (或小批量)
        # 考虑到视图包含的字段引用节点可能很多，这里采用每次查 5 个工作簿
        chunk_size = 5
        total = len(workbooks)
        
        for i in range(0, total, chunk_size):
            chunk = workbooks[i:i+chunk_size]
            
            # 动态构建 Alias Filter 查询
            query_parts = []
            for idx, wb in enumerate(chunk):
                wb_id = wb["id"]
                query_parts.append(f"""
                wb{idx}: workbooks(filter: {{id: "{wb_id}"}}) {{
                    id
                    name
                    sheets {{
                        id
                        name
                        sheetFieldInstances {{
                            id
                            name
                            datasource {{
                                id
                            }}
                        }}
                    }}
                }}
                """)
            
            full_query = "{" + "\n".join(query_parts) + "}"
            
            try:
                result = self.execute_query(full_query)
                if "errors" in result:
                    print(f"  ⚠️ 批次 {i//chunk_size + 1} 部分失败: {result['errors'][0].get('message')}")
                
                data = result.get("data", {})
                if not data: continue
                
                # 解析别名结果
                for key, wb_list in data.items():
                    if not wb_list: continue
                    # workbooks 返回的是列表
                    wb_data = wb_list[0]
                    wb_id = wb_data.get("id")
                    
                    sheets = wb_data.get("sheets") or []
                    for sheet in sheets:
                        if not sheet: continue
                        view_id = sheet.get("id")
                        view_name = sheet.get("name")
                        fields = sheet.get("sheetFieldInstances") or []
                        
                        for field in fields:
                            if field and field.get("id"):
                                all_view_fields.append({
                                    "view_id": view_id,
                                    "view_name": view_name,
                                    "workbook_id": wb_id,
                                    "field_id": field.get("id"),
                                    "field_name": field.get("name"),
                                    "datasource_id": (field.get("datasource") or {}).get("id")
                                })
                                
                print(f"    - 已处理 {min(i+chunk_size, total)}/{total} 个工作簿, 累计关联 {len(all_view_fields)}")
                
            except Exception as e:
                print(f"  ❌ 批次查询异常: {e}")
        
        print(f"  ✅ 抓取到 {len(all_view_fields)} 个字段关联关系")
        return all_view_fields
    
    def _fetch_views_with_fields_fallback(self) -> List[Dict]:
        """备用方法：通过工作簿的数据源关系间接获取"""
        # 由于 Tableau API 限制，我们采用简化策略：
        # 通过 calculatedFields 的 datasource 关系来建立字段→视图的间接关联
        query = """
        {
            workbooks {
                id
                name
                sheets {
                    id
                    name
                }
                upstreamDatasources {
                    id
                    name
                }
            }
        }
        """
        result = self.execute_query(query)
        
        if "errors" in result:
            print(f"  ⚠️ 备用查询也失败: {result['errors']}")
            return []
        
        data = result.get("data")
        if data is None:
            return []
        
        workbooks = data.get("workbooks") or []
        
        # 获取数据源到字段的映射
        ds_to_fields = {}
        fields_result = self.execute_query("""
        {
            publishedDatasources {
                id
                fields {
                    id
                    name
                }
            }
        }
        """)
        if "data" in fields_result and fields_result["data"]:
            for ds in (fields_result["data"].get("publishedDatasources") or []):
                if ds:
                    ds_to_fields[ds["id"]] = ds.get("fields") or []
        
        # 构建视图→字段关联
        view_fields = []
        for wb in workbooks:
            if not wb:
                continue
            sheets = wb.get("sheets") or []
            datasources = wb.get("upstreamDatasources") or []
            
            for sheet in sheets:
                if not sheet:
                    continue
                # 将数据源的字段关联到视图
                for ds in datasources:
                    if not ds:
                        continue
                    for field in ds_to_fields.get(ds.get("id"), []):
                        if field and field.get("id"):
                            view_fields.append({
                                "view_id": sheet.get("id"),
                                "view_name": sheet.get("name"),
                                "workbook_id": wb.get("id"),
                                "field_id": field.get("id"),
                                "field_name": field.get("name")
                            })
        
        return view_fields


    def fetch_users(self) -> List[Dict]:
        """获取所有 Tableau 用户"""
        query = """
        {
            tableauUsers {
                id
                luid
                name
                username
                email
                domain
                siteRole
            }
        }
        """
        result = self.execute_query(query)
        
        # 检查错误
        if "errors" in result:
            print(f"  ⚠️ GraphQL 警告 (users): {result['errors']}")
            # 尝试简化查询
            return self._fetch_users_fallback()
        
        return result.get("data", {}).get("tableauUsers", [])
    
    def _fetch_users_fallback(self) -> List[Dict]:
        """回退：通过 owner 关系收集用户"""
        users_dict = {}
        
        # 从数据源收集用户
        ds_query = """
        {
            publishedDatasources {
                owner {
                    id
                    username
                    name
                }
            }
        }
        """
        ds_result = self.execute_query(ds_query)
        if "data" in ds_result and ds_result["data"]:
            for ds in (ds_result["data"].get("publishedDatasources") or []):
                if ds and ds.get("owner"):
                    owner = ds["owner"]
                    if owner.get("id"):
                        users_dict[owner["id"]] = {
                            "id": owner.get("id"),
                            "name": owner.get("name"),
                            "username": owner.get("username")
                        }
        
        # 从工作簿收集用户
        wb_query = """
        {
            workbooks {
                owner {
                    id
                    username
                    name
                }
            }
        }
        """
        wb_result = self.execute_query(wb_query)
        if "data" in wb_result and wb_result["data"]:
            for wb in (wb_result["data"].get("workbooks") or []):
                if wb and wb.get("owner"):
                    owner = wb["owner"]
                    if owner.get("id"):
                        users_dict[owner["id"]] = {
                            "id": owner.get("id"),
                            "name": owner.get("name"),
                            "username": owner.get("username")
                        }
        
        return list(users_dict.values())
    
    def fetch_projects(self) -> List[Dict]:
        """获取所有 Tableau 项目"""
        # 通过数据源和工作簿的 projectName 收集项目信息
        # 注意：Tableau Metadata API 没有直接的 projects 查询，需要间接收集
        projects_dict = {}
        
        # 从数据源收集项目
        ds_query = """
        {
            publishedDatasources {
                projectName
                projectVizportalUrlId
            }
        }
        """
        ds_result = self.execute_query(ds_query)
        if "data" in ds_result and ds_result["data"]:
            for ds in (ds_result["data"].get("publishedDatasources") or []):
                if ds and ds.get("projectName"):
                    project_name = ds["projectName"]
                    if project_name and project_name not in projects_dict:
                        projects_dict[project_name] = {
                            "name": project_name,
                            "vizportalUrlId": ds.get("projectVizportalUrlId")
                        }
        
        # 从工作簿收集项目
        wb_query = """
        {
            workbooks {
                projectName
                projectVizportalUrlId
            }
        }
        """
        wb_result = self.execute_query(wb_query)
        if "data" in wb_result and wb_result["data"]:
            for wb in (wb_result["data"].get("workbooks") or []):
                if wb and wb.get("projectName"):
                    project_name = wb["projectName"]
                    if project_name and project_name not in projects_dict:
                        projects_dict[project_name] = {
                            "name": project_name,
                            "vizportalUrlId": wb.get("projectVizportalUrlId")
                        }
        
        # 生成唯一 ID (使用 MD5 保证稳定性)
        result = []
        for name, proj in projects_dict.items():
            # 使用 MD5 生成稳定的 ID (前8位作为 ID)
            import hashlib
            name_hash = hashlib.md5(name.encode('utf-8')).hexdigest()
            proj["id"] = f"project_{name_hash[:8]}"
            result.append(proj)
        
        return result


class MetadataSync:
    """元数据同步管理器"""
    
    def __init__(self, client: TableauMetadataClient, db_path: str = None):
        self.client = client
        self.db_path = db_path or Config.DATABASE_PATH
        self.engine = get_engine(self.db_path)
        self.session = get_session(self.engine)
        self.sync_log: Optional[SyncLog] = None
    
    def _start_sync_log(self, sync_type: str):
        """开始同步日志"""
        self.sync_log = SyncLog(
            sync_type=sync_type,
            status="running",
            started_at=datetime.now(),
            records_synced=0
        )
        self.session.add(self.sync_log)
        self.session.commit()
    
    def _complete_sync_log(self, records: int, error: str = None):
        """完成同步日志"""
        if self.sync_log:
            self.sync_log.status = "failed" if error else "completed"
            self.sync_log.completed_at = datetime.utcnow()
            self.sync_log.records_synced = records
            self.sync_log.error_message = error
            self.session.commit()

    def _cleanup_orphaned_records(self, model_class, current_ids: List[str], filter_condition=None):
        """清理数据库中存在但本次同步未发现的记录（物理删除）"""
        if not current_ids and filter_condition is None:
            return 0
        
        query = self.session.query(model_class)
        if filter_condition is not None:
            query = query.filter(filter_condition)
        
        # 过滤掉本次同步发现的 IDs
        orphaned = query.filter(~model_class.id.in_(current_ids)).all()
        
        count = 0
        for record in orphaned:
            # 对于 Field，还需要清理相关的 CalculatedField 和依赖
            if model_class == Field:
                self.session.query(CalculatedField).filter_by(field_id=record.id).delete()
                self.session.query(FieldDependency).filter(
                    (FieldDependency.source_field_id == record.id) | 
                    (FieldDependency.dependency_field_id == record.id)
                ).delete()
            
            self.session.delete(record)
            count += 1
            
        if count > 0:
            print(f"  🧹 清理了 {count} 个已不存在的 {model_class.__name__} 记录")
        return count
    
    def sync_databases(self) -> int:
        """同步数据库（增强版）"""
        print("\n📦 同步数据库...")
        self._start_sync_log("databases")
        
        try:
            databases = self.client.fetch_databases()
            count = 0
            current_ids = []
            
            for db_data in databases:
                if not db_data or not db_data.get("id"):
                    continue
                
                current_ids.append(db_data["id"])
                db = self.session.query(Database).filter_by(id=db_data["id"]).first()
                if not db:
                    db = Database(id=db_data["id"])
                    self.session.add(db)
                
                db.name = db_data.get("name", "")
                db.luid = db_data.get("luid")
                db.connection_type = db_data.get("connectionType")
                db.host_name = db_data.get("hostName")
                db.port = db_data.get("port")
                db.service = db_data.get("service")
                db.description = db_data.get("description")
                db.is_certified = db_data.get("isCertified", False)
                db.certification_note = db_data.get("certificationNote")
                db.platform = db_data.get("platform")
                db.updated_at = datetime.now()
                
                count += 1
            
            self.session.commit()
            
            # 清理数据库中已不存在的数据库记录
            self._cleanup_orphaned_records(Database, current_ids)
            
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个数据库")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_tables(self) -> int:
        """同步数据表（增强版）"""
        print("\n📋 同步数据表...")
        self._start_sync_log("tables")
        
        try:
            tables = self.client.fetch_tables()
            table_count = 0
            column_count = 0
            current_ids = []
            
            for table_data in tables:
                if not table_data or not table_data.get("id"):
                    continue
                
                # 过滤掉嵌入式表 (已经在存量清理中处理过，这里确保同步也不拉取/更新它们)
                if table_data.get("isEmbedded"):
                    continue
                
                current_ids.append(table_data["id"])
                table = self.session.query(DBTable).filter_by(id=table_data["id"]).first()
                if not table:
                    table = DBTable(id=table_data["id"])
                    self.session.add(table)
                
                table.name = table_data.get("name", "")
                table.luid = table_data.get("luid")
                table.full_name = table_data.get("fullName")
                table.schema = table_data.get("schema")
                
                # 关联数据库
                db_info = table_data.get("database", {})
                if db_info:
                    table.database_id = db_info.get("id")
                    table.connection_type = db_info.get("connectionType", "")
                
                table.table_type = table_data.get("tableType")
                table.description = table_data.get("description")
                table.is_embedded = False # 明确设置为False，因为我们过滤掉了嵌入式表
                table.is_certified = table_data.get("isCertified", False)
                table.certification_note = table_data.get("certificationNote")
                table.project_name = table_data.get("projectName")
                
                # 解析时间
                for time_field, attr_name in [("createdAt", "created_at"), ("updatedAt", "updated_at")]:
                    time_val = table_data.get(time_field)
                    if time_val:
                        try:
                            # 兼容不同格式
                            dt = datetime.fromisoformat(time_val.replace("Z", "+00:00"))
                            setattr(table, attr_name, dt)
                        except:
                            pass
                
                # 同步列 (Columns)
                columns = table_data.get("columns", [])
                for col_data in columns:
                    if not col_data or not col_data.get("id"):
                        continue
                    
                    col = self.session.query(DBColumn).filter_by(id=col_data["id"]).first()
                    if not col:
                        col = DBColumn(id=col_data["id"])
                        self.session.add(col)
                    
                    col.name = col_data.get("name", "")
                    col.remote_type = col_data.get("remoteType")
                    col.description = col_data.get("description")
                    col.is_nullable = col_data.get("isNullable")
                    col.table_id = table.id
                    column_count += 1
                
                table_count += 1
                if table_count % 100 == 0:
                    self.session.commit()
                    print(f"  - 数据表: 已处理 {table_count}/{len(tables)}")
            
            self.session.commit()
            
            # 清理数据库中已不存在的正式表记录（排除嵌入式，因为我们不再同步它们）
            self._cleanup_orphaned_records(DBTable, current_ids, filter_condition=(DBTable.is_embedded == False))
            
            self._complete_sync_log(table_count)
            print(f"  ✅ 同步 {table_count} 个数据表, {column_count} 个列")
            return table_count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_datasources(self) -> int:
        """同步数据源（增强版）"""
        print("\n🔗 同步数据源...")
        self._start_sync_log("datasources")
        
        try:
            datasources = self.client.fetch_datasources()
            count = 0
            current_ids = []
            
            for ds_data in datasources:
                if not ds_data or not ds_data.get("id"):
                    continue
                
                # 仅同步发布式数据源
                if ds_data.get("isEmbedded"):
                    continue
                
                current_ids.append(ds_data["id"])
                ds = self.session.query(Datasource).filter_by(id=ds_data["id"]).first()
                if not ds:
                    ds = Datasource(id=ds_data["id"])
                    self.session.add(ds)
                
                ds.name = ds_data.get("name", "")
                ds.luid = ds_data.get("luid")
                ds.description = ds_data.get("description")
                ds.uri = ds_data.get("uri")
                ds.project_name = ds_data.get("projectName", "")
                ds.has_extract = ds_data.get("hasExtracts", False)
                ds.is_certified = ds_data.get("isCertified", False)
                ds.certification_note = ds_data.get("certificationNote")
                ds.certifier_display_name = ds_data.get("certifierDisplayName")
                ds.contains_unsupported_custom_sql = ds_data.get("containsUnsupportedCustomSql", False)
                ds.has_active_warning = ds_data.get("hasActiveWarning", False)
                ds.vizportal_url_id = ds_data.get("vizportalUrlId")
                ds.is_embedded = False # 明确设置为False，因为我们过滤掉了嵌入式数据源
                
                owner = ds_data.get("owner", {})
                if owner:
                    ds.owner = owner.get("username", "")
                    ds.owner_id = owner.get("id")
                
                # 解析时间字段
                for time_field, attr_name in [
                    ("extractLastRefreshTime", "extract_last_refresh_time"),
                    ("extractLastIncrementalUpdateTime", "extract_last_incremental_update_time"),
                    ("extractLastUpdateTime", "extract_last_update_time"),
                    ("createdAt", "created_at"),
                    ("updatedAt", "updated_at")
                ]:
                    time_val = ds_data.get(time_field)
                    if time_val:
                        try:
                            setattr(ds, attr_name, datetime.fromisoformat(
                                time_val.replace("Z", "+00:00")
                            ))
                        except:
                            pass
                
                count += 1
                
                # 同步表到数据源的关系
                upstream_tables = ds_data.get("upstreamTables", [])
                if upstream_tables:
                    print(f"  📊 数据源 {ds_data.get('name')} 的上游表: {len(upstream_tables)} 个")
                    # 抽样打印 ID 格式
                    if len(upstream_tables) > 0:
                        print(f"     示例表 ID: {upstream_tables[0].get('id')}")

                for tbl in upstream_tables:
                    if not tbl or not tbl.get("id"):
                        continue
                    rel = self.session.execute(
                        select(table_to_datasource).where(
                            table_to_datasource.c.table_id == tbl["id"],
                            table_to_datasource.c.datasource_id == ds_data["id"]
                        )
                    ).first()
                    
                    if not rel:
                        try:
                            self.session.execute(
                                table_to_datasource.insert().values(
                                    table_id=tbl["id"],
                                    datasource_id=ds_data["id"],
                                    relationship_type="upstream"
                                )
                            )
                        except:
                            pass
                
            self.session.commit()
            
            # 清理数据库中已不存在的数据源（排除嵌入式）
            self._cleanup_orphaned_records(Datasource, current_ids, filter_condition=(Datasource.is_embedded == False))
            
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个数据源")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_workbooks(self) -> int:
        """同步工作簿和视图（增强版）"""
        print("\n📊 同步工作簿...")
        self._start_sync_log("workbooks")
        
        try:
            workbooks = self.client.fetch_workbooks()
            wb_count = 0
            view_count = 0
            current_wb_ids = []
            current_view_ids = []
            
            for wb_data in workbooks:
                current_wb_ids.append(wb_data["id"])
                wb = self.session.query(Workbook).filter_by(id=wb_data["id"]).first()
                if not wb:
                    wb = Workbook(id=wb_data["id"])
                    self.session.add(wb)
                
                wb.name = wb_data.get("name", "")
                wb.luid = wb_data.get("luid")
                wb.description = wb_data.get("description")
                wb.uri = wb_data.get("uri")
                wb.project_name = wb_data.get("projectName", "")
                wb.contains_unsupported_custom_sql = wb_data.get("containsUnsupportedCustomSql", False)
                wb.has_active_warning = wb_data.get("hasActiveWarning", False)
                wb.vizportal_url_id = wb_data.get("vizportalUrlId")
                
                owner = wb_data.get("owner", {})
                if owner:
                    wb.owner = owner.get("username", "")
                    wb.owner_id = owner.get("id")
                
                # 解析时间字段
                for time_field, attr_name in [("createdAt", "created_at"), ("updatedAt", "updated_at")]:
                    time_val = wb_data.get(time_field)
                    if time_val:
                        try:
                            setattr(wb, attr_name, datetime.fromisoformat(
                                time_val.replace("Z", "+00:00")
                            ))
                        except:
                            pass
                
                wb_count += 1
                
                # 同步数据源到工作簿的关系 (Published)
                upstream_ds = wb_data.get("upstreamDatasources", [])
                for ds in upstream_ds:
                    if not ds or not ds.get("id"):
                        continue
                    self._link_datasource_to_workbook(ds["id"], wb_data["id"])

                # 同步嵌入式数据源 (Embedded) - 注意：不再为嵌入式数据源创建 Datasource 记录，只同步其字段
                embedded_ds = wb_data.get("embeddedDatasources", [])
                for eds in embedded_ds:
                    if not eds or not eds.get("id"):
                        continue
                    
                    # 仅同步字段，datasource_id 设为 None，workbook_id 设为当前工作簿
                    # 这符合用户“嵌入式数据源及其字段作为内部属性”的要求
                    eds_fields = eds.get("fields", [])
                    for f_data in eds_fields:
                       self._sync_field(f_data, datasource_id=None, workbook_id=wb_data["id"])
                
                # 同步视图 (sheets + dashboards)
                for idx, sheet in enumerate(wb_data.get("sheets", [])):
                    if not sheet or not sheet.get("id"):
                        continue
                    current_view_ids.append(sheet["id"])
                    view = self.session.query(View).filter_by(id=sheet["id"]).first()
                    if not view:
                        view = View(id=sheet["id"])
                        self.session.add(view)
                    
                    view.name = sheet.get("name", "")
                    view.luid = sheet.get("luid")
                    view.path = sheet.get("path")
                    view.index = sheet.get("index", idx)
                    view.view_type = "sheet"
                    view.workbook_id = wb_data["id"]
                    
                    # 解析时间
                    for time_field, attr_name in [("createdAt", "created_at"), ("updatedAt", "updated_at")]:
                        time_val = sheet.get(time_field)
                        if time_val:
                            try:
                                setattr(view, attr_name, datetime.fromisoformat(
                                    time_val.replace("Z", "+00:00")
                                ))
                            except:
                                pass
                    
                    view_count += 1
                
                # 同步仪表板 (dashboards)
                for idx, dashboard in enumerate(wb_data.get("dashboards", [])):
                    if not dashboard or not dashboard.get("id"):
                        continue
                    current_view_ids.append(dashboard["id"])
                    view = self.session.query(View).filter_by(id=dashboard["id"]).first()
                    if not view:
                        view = View(id=dashboard["id"])
                        self.session.add(view)
                    
                    view.name = dashboard.get("name", "")
                    view.luid = dashboard.get("luid")
                    view.path = dashboard.get("path")
                    view.index = dashboard.get("index", idx)
                    view.view_type = "dashboard"
                    view.workbook_id = wb_data["id"]
                    

                    # 解析时间
                    for time_field, attr_name in [("createdAt", "created_at"), ("updatedAt", "updated_at")]:
                        time_val = dashboard.get(time_field)
                        if time_val:
                            try:
                                setattr(view, attr_name, datetime.fromisoformat(
                                    time_val.replace("Z", "+00:00")
                                ))
                            except:
                                pass
                    
                    # 同步仪表板与 sheet 的关联
                    contained_sheets = dashboard.get("sheets", [])
                    for contained_sheet in contained_sheets:
                         if contained_sheet and contained_sheet.get("id"):
                             sheet_id = contained_sheet.get("id")
                             # 检查是否存在
                             rel = self.session.execute(
                                 select(dashboard_to_sheet).where(
                                     dashboard_to_sheet.c.dashboard_id == dashboard["id"],
                                     dashboard_to_sheet.c.sheet_id == sheet_id
                                 )
                             ).first()
                             if not rel:
                                 try:
                                     self.session.execute(
                                         dashboard_to_sheet.insert().values(
                                             dashboard_id=dashboard["id"],
                                             sheet_id=sheet_id
                                         )
                                     )
                                 except Exception as e:
                                     print(f"  ⚠️ 关联 sheet 失败: {e}")
                                     pass
                    
                    view_count += 1
            
            self.session.commit()
            
            # 清理数据库中已不存在的工作簿
            self._cleanup_orphaned_records(Workbook, current_wb_ids)
            # 清理已不存在的视图
            self._cleanup_orphaned_records(View, current_view_ids)
            
            self._complete_sync_log(wb_count)
            print(f"  ✅ 同步 {wb_count} 个工作簿, {view_count} 个视图")
            return wb_count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
            return 0
    
    def sync_fields(self) -> int:
        """同步字段"""
        print("\n🔤 同步字段...")
        self._start_sync_log("fields")
        
        try:
            from backend.models import table_to_datasource, Datasource
            # 建立物理表到发布式数据源的映射，用于穿透补齐
            # 仅包含非嵌入式数据源
            table_real_ds_map = {}
            ds_to_table_rels = self.session.execute(
                select(table_to_datasource.c.table_id, table_to_datasource.c.datasource_id)
                .join(Datasource, Datasource.id == table_to_datasource.c.datasource_id)
                .where(Datasource.is_embedded == 0)
            ).fetchall()
            for tid, dsid in ds_to_table_rels:
                if tid not in table_real_ds_map:
                    table_real_ds_map[tid] = dsid

            fields = self.client.fetch_fields()
            count = 0
            calc_count = 0
            current_ids = []
            
            for f_data in fields:
                if not f_data or not f_data.get("id"):
                    continue
                    
                current_ids.append(f_data["id"])
                
                # 获取/创建 Field 记录
                field = self.session.query(Field).filter_by(id=f_data["id"]).first()
                if not field:
                    field = Field(id=f_data["id"])
                    self.session.add(field)
                
                field.name = f_data.get("name") or ""
                field.description = f_data.get("description") or ""
                
                # 获取初始 datasource_id
                ds_id = f_data.get("datasource_id")
                
                # 根据类型解析字段详情 (提前解析以便获取 table_id 和 schema 穿透)
                typename = f_data.get("__typename")
                target_table_id = None
                
                if typename == "ColumnField":
                    # 关联上游表和列
                    upstream_cols = f_data.get("upstreamColumns") or []
                    if upstream_cols and len(upstream_cols) > 0:
                        first_col = upstream_cols[0]
                        if first_col:
                            field.upstream_column_id = first_col.get("id")
                            field.upstream_column_name = first_col.get("name")
                            table_info = first_col.get("table")
                            if table_info:
                                target_table_id = table_info.get("id")
                                field.table_id = target_table_id

                # 血缘补齐：如果当前 datasource_id 指向的不是发布式（或不存在），尝试通过 table_id 找发布式
                if ds_id:
                    exists = self.session.query(Datasource).filter_by(id=ds_id, is_embedded=0).first()
                    if not exists and target_table_id in table_real_ds_map:
                        ds_id = table_real_ds_map[target_table_id]
                
                field.datasource_id = ds_id
                
                # 默认值
                field.data_type = ""
                field.role = ""
                field.is_calculated = False
                field.formula = ""
                field.is_hidden = False
                field.folder_name = f_data.get("folderName")
                field.fully_qualified_name = ""
                
                # 根据类型解析字段
                typename = f_data.get("__typename")
                if typename == "CalculatedField":
                    field.is_calculated = True
                    field.formula = f_data.get("formula") or ""
                    field.data_type = f_data.get("dataType") or ""
                    field.role = f_data.get("role") or ""
                    field.is_hidden = f_data.get("isHidden") or False
                    field.folder_name = f_data.get("folderName")
                    
                    # 指标血缘穿透：通过 upstreamFields 找物理数据源
                    upstream_fields = f_data.get("upstreamFields") or []
                    for uf in upstream_fields:
                        if uf and uf.get("datasource"):
                            ref_ds_id = uf["datasource"].get("id")
                            # 如果引用的是发布式数据源，则以此为准
                            if ref_ds_id:
                                exists = self.session.query(Datasource).filter_by(id=ref_ds_id, is_embedded=0).first()
                                if exists:
                                    ds_id = ref_ds_id
                                    break
                elif typename == "ColumnField":
                    field.data_type = f_data.get("dataType") or ""
                    field.role = f_data.get("role") or ""
                    field.is_hidden = f_data.get("isHidden") or False
                    field.folder_name = f_data.get("folderName")
                    
                    # 关联上游表和列
                    upstream_cols = f_data.get("upstreamColumns") or []
                    if upstream_cols and len(upstream_cols) > 0:
                        first_col = upstream_cols[0]
                        if first_col:
                            field.upstream_column_id = first_col.get("id")
                            field.upstream_column_name = first_col.get("name")
                            
                            # 从本地 DBColumn 获取 Remote Type (避免 API schema 错误)
                            if field.upstream_column_id:
                                from backend.models import DBColumn
                                db_col = self.session.query(DBColumn).filter_by(id=field.upstream_column_id).first()
                                if db_col and db_col.remote_type:
                                    field.remote_type = db_col.remote_type
                            
                            table_info = first_col.get("table")
                            if table_info:
                                field.table_id = table_info.get("id")
                
                count += 1
                if count % 1000 == 0:
                    self.session.commit()
                    print(f"  - 字段: 已处理 {count}/{len(fields)}")
                
                # 处理计算字段
                if f_data.get("isCalculated"):
                    calc_field = self.session.query(CalculatedField).filter_by(
                        field_id=f_data["id"]
                    ).first()
                    if not calc_field:
                        calc_field = CalculatedField(field_id=f_data["id"])
                        self.session.add(calc_field)
                    
                    calc_field.name = f_data.get("name") or ""
                    calc_field.formula = f_data.get("formula") or ""
                    calc_count += 1
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个字段 (其中 {calc_count} 个计算字段)")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def sync_calculated_fields(self) -> int:
        """同步计算字段"""
        print("\n📐 同步计算字段...")
        self._start_sync_log("calculated_fields")
        
        try:
            calc_fields = self.client.fetch_calculated_fields()
            count = 0
            
            for cf_data in calc_fields:
                if not cf_data or not cf_data.get("id"):
                    continue
                
                # 先确保 Field 记录存在
                field = self.session.query(Field).filter_by(id=cf_data["id"]).first()
                if not field:
                    field = Field(id=cf_data["id"])
                    self.session.add(field)
                
                field.name = cf_data.get("name") or ""
                field.description = cf_data.get("description") or ""
                field.data_type = cf_data.get("dataType") or ""
                field.is_calculated = True
                field.formula = cf_data.get("formula") or ""
                field.role = cf_data.get("role") or ""
                field.datasource_id = cf_data.get("datasource_id")
                
                # 更新/创建 CalculatedField 记录
                calc_field = self.session.query(CalculatedField).filter_by(
                    field_id=cf_data["id"]
                ).first()
                if not calc_field:
                    calc_field = CalculatedField(field_id=cf_data["id"])
                    self.session.add(calc_field)
                
                calc_field.name = cf_data.get("name") or ""
                calc_field.formula = cf_data.get("formula") or ""
                count += 1
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个计算字段")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def sync_field_to_view(self) -> int:
        """同步字段到视图的关联关系"""
        print("\n🔗 同步字段→视图关联...")
        self._start_sync_log("field_to_view")
        
        try:
            view_fields = self.client.fetch_views_with_fields()
            count = 0
            skipped = 0
            
            for vf in view_fields:
                field_id = vf.get("field_id")
                view_id = vf.get("view_id")
                
                if not field_id or not view_id:
                    skipped += 1
                    continue
                
                # 检查是否已存在
                existing = self.session.execute(
                    select(field_to_view).where(
                        field_to_view.c.field_id == field_id,
                        field_to_view.c.view_id == view_id
                    )
                ).first()
                
                if not existing:
                    try:
                        self.session.execute(
                            field_to_view.insert().values(
                                field_id=field_id,
                                view_id=view_id,
                                used_in_formula=False
                            )
                        )
                        count += 1
                    except Exception as e:
                        # 忽略外键约束错误（字段或视图不存在）
                        skipped += 1
                        continue
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个字段→视图关联 (跳过 {skipped} 个)")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def sync_users(self) -> int:
        """同步 Tableau 用户"""
        print("\n👥 同步用户...")
        self._start_sync_log("users")
        
        try:
            users = self.client.fetch_users()
            count = 0
            
            for u_data in users:
                if not u_data or not u_data.get("id"):
                    continue
                    
                user = self.session.query(TableauUser).filter_by(id=u_data["id"]).first()
                if not user:
                    user = TableauUser(id=u_data["id"])
                    self.session.add(user)
                
                user.luid = u_data.get("luid")
                user.name = u_data.get("username") or u_data.get("name") or ""
                user.display_name = u_data.get("name")
                user.email = u_data.get("email")
                user.domain = u_data.get("domain")
                user.site_role = u_data.get("siteRole")
                count += 1
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个用户")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def sync_projects(self) -> int:
        """同步 Tableau 项目"""
        print("\n📁 同步项目...")
        self._start_sync_log("projects")
        
        try:
            projects = self.client.fetch_projects()
            count = 0
            
            for p_data in projects:
                if not p_data or not p_data.get("name"):
                    continue
                
                project_id = p_data.get("id")
                
                project = self.session.query(Project).filter_by(id=project_id).first()
                if not project:
                    project = Project(id=project_id)
                    self.session.add(project)
                
                project.name = p_data.get("name") or ""
                project.vizportal_url_id = p_data.get("vizportalUrlId")
                count += 1
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个项目")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0

    def sync_lineage(self) -> int:
        """同步指标与血缘关系 (DB持久化)"""
        print("\n🕸️ 同步血缘与指标关系...")
        count = 0
        
        try:
            # 1. 清理现有依赖关系 (全量同步策略)
            self.session.query(FieldDependency).delete()
            self.session.query(Metric).delete() # 重新构建指标表
            self.session.commit()
            
            # 2. 获取所有计算字段
            calc_fields = self.session.query(CalculatedField, Field).join(
                Field, CalculatedField.field_id == Field.id
            ).all()
            
            # 构建字段索引 (Name -> ID lookup cache)
            all_fields = self.session.query(Field).all()
            field_map = {} # (datasource_id, name) -> field_id
            global_field_map = {} # name -> field_id (fallback)
            
            for f in all_fields:
                key = (f.datasource_id, f.name)
                field_map[key] = f.id
                global_field_map[f.name] = f.id
            
            for calc, field in calc_fields:
                formula = calc.formula
                if not formula:
                    continue
                    
                # A. 识别 Metric
                # 规则: 计算字段 且 Role=Measure
                if field.role == 'measure':
                    metric = Metric(
                        id=field.id, # 复用 Field ID
                        name=field.name,
                        description=field.description,
                        formula=formula,
                        metric_type='Calculated',
                        owner=field.datasource.owner if field.datasource else None
                    )
                    self.session.merge(metric)
                
                # B. 解析依赖 (后端持久化)
                refs = re.findall(r'\[(.*?)\]', formula)
                unique_refs = set(refs)
                
                for ref_name in unique_refs:
                    dep_id = None
                    
                    # 1. 尝试同数据源匹配
                    if field.datasource_id:
                        dep_id = field_map.get((field.datasource_id, ref_name))
                    
                    # 2. 尝试全局匹配
                    if not dep_id:
                        dep_id = global_field_map.get(ref_name)
                    
                    # 3. 创建依赖记录
                    dependency = FieldDependency(
                        source_field_id=field.id,
                        dependency_field_id=dep_id, 
                        dependency_name=ref_name,
                        dependency_type='formula'
                    )
                    self.session.add(dependency)
                    count += 1
            
            self.session.commit()
            print(f"  ✅ 同步 {count} 条依赖关系")
            return count
            
        except Exception as e:
            self.session.rollback()
            print(f"  ❌ 血缘同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def _link_datasource_to_workbook(self, datasource_id: str, workbook_id: str):
        """建立数据源与工作簿的关联"""
        rel = self.session.execute(
            select(datasource_to_workbook).where(
                datasource_to_workbook.c.datasource_id == datasource_id,
                datasource_to_workbook.c.workbook_id == workbook_id
            )
        ).first()
        if not rel:
            try:
                self.session.execute(
                    datasource_to_workbook.insert().values(
                        datasource_id=datasource_id,
                        workbook_id=workbook_id
                    )
                )
            except:
                pass

    def _sync_field(self, f_data: Dict, datasource_id: str = None, workbook_id: str = None):
        """同步单个字段（嵌入式或发布）"""
        if not f_data or not f_data.get("id"):
            return

        field = self.session.query(Field).filter_by(id=f_data["id"]).first()
        if not field:
            field = Field(id=f_data["id"])
            self.session.add(field)
        
        field.name = f_data.get("name") or ""
        field.description = f_data.get("description") or ""
        field.datasource_id = datasource_id
        field.workbook_id = workbook_id
        
        # 默认值
        if not field.data_type: field.data_type = ""
        if not field.role: field.role = ""
        field.is_calculated = False
        if not field.formula: field.formula = ""
        field.is_hidden = False
        field.folder_name = f_data.get("folderName")
        
        # 根据类型解析字段
        typename = f_data.get("__typename")
        # 某些 embedded field 可能没有 __typename，尝试推断或读取直接属性
        if typename == "CalculatedField" or f_data.get("formula"):
            field.is_calculated = True
            field.formula = f_data.get("formula") or ""
            field.data_type = f_data.get("dataType") or field.data_type
            field.role = f_data.get("role") or field.role
            field.is_hidden = f_data.get("isHidden") or False
            
            # 确保 CalculatedField 记录
            calc_sub = self.session.query(CalculatedField).filter_by(field_id=field.id).first()
            if not calc_sub:
                calc_sub = CalculatedField(field_id=field.id)
                self.session.add(calc_sub)
            calc_sub.name = field.name
            calc_sub.formula = field.formula

        elif typename == "ColumnField" or f_data.get("remoteType"):
            field.data_type = f_data.get("dataType") or field.data_type
            field.role = f_data.get("role") or field.role
            field.is_hidden = f_data.get("isHidden") or False
            # 嵌入式列通常没有 upstreamColumns 因为它是直接连接

    
    def sync_all(self):
        """全量同步所有实体"""
        print("=" * 60)
        print("🚀 开始全量同步 Tableau Metadata")
        print("=" * 60)
        
        start_time = datetime.now()
        
        # 按依赖顺序同步
        user_count = self.sync_users()  # 先同步用户
        project_count = self.sync_projects()  # 同步项目
        db_count = self.sync_databases()
        table_count = self.sync_tables()
        ds_count = self.sync_datasources()
        wb_count = self.sync_workbooks()
        field_count = self.sync_fields()
        calc_count = self.sync_calculated_fields()
        calc_count = self.sync_calculated_fields()
        ftv_count = self.sync_field_to_view()
        lineage_count = self.sync_lineage()
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print("\n" + "=" * 60)
        print("📈 同步完成统计")
        print("=" * 60)
        print(f"  用户:   {user_count}")
        print(f"  项目:   {project_count}")
        print(f"  数据库: {db_count}")
        print(f"  数据表: {table_count}")
        print(f"  数据源: {ds_count}")
        print(f"  工作簿: {wb_count}")
        print(f"  血缘:   {lineage_count}")
        print(f"  字段:   {field_count}")
        print(f"  计算字段: {calc_count}")
        print(f"  字段→视图: {ftv_count}")
        print(f"  耗时: {duration:.2f} 秒")
        print("=" * 60)
        
        # 同步视图使用统计（通过 REST API）
        self.sync_views_usage()
        
        # 最后：计算预存统计字段
        self.calculate_stats()
    
    def sync_views_usage(self) -> int:
        """同步视图使用统计（通过 REST API）并记录历史快照"""
        print("\n📊 同步视图使用统计 (REST API)...")
        
        try:
            usage_map = self.client.fetch_views_usage()
            
            if not usage_map:
                print("  ⚠️ 未获取到视图使用统计")
                return 0
            
            updated = 0
            history_count = 0
            views = self.session.query(View).all()
            
            for view in views:
                # REST API 返回的是 luid，需要匹配
                if view.luid and view.luid in usage_map:
                    new_count = usage_map[view.luid]
                    
                    # 只有当访问次数发生变化时才记录历史
                    if view.total_view_count != new_count:
                        # 记录历史快照
                        from backend.models import ViewUsageHistory
                        history = ViewUsageHistory(
                            view_id=view.id,
                            view_luid=view.luid,
                            total_view_count=new_count
                        )
                        self.session.add(history)
                        history_count += 1
                    
                    view.total_view_count = new_count
                    updated += 1
            
            self.session.commit()
            print(f"  ✅ 更新 {updated} 个视图的使用统计, 记录 {history_count} 条历史")
            
            # 将仪表盘访问量累加到其包含的sheet上
            self._propagate_dashboard_views()
            
            return updated
            
        except Exception as e:
            print(f"  ❌ 同步视图使用统计失败: {e}")
            import traceback
            traceback.print_exc()
            return 0
    
    def _propagate_dashboard_views(self):
        """将仪表盘的访问量累加到其包含的sheet上
        
        逻辑：如果一个sheet被包含在仪表盘中，用户访问仪表盘时也相当于访问了这些sheet。
        因此，将仪表盘的访问量完整累加到每个包含的sheet上。
        """
        print("  📈 将仪表盘访问量累加到包含的sheet...")
        
        try:
            from sqlalchemy import text
            
            # 使用 SQL 直接更新，更高效
            # 对于每个被仪表盘包含的sheet，累加所有包含它的仪表盘的访问量
            update_sql = text("""
                UPDATE views
                SET total_view_count = COALESCE(total_view_count, 0) + COALESCE((
                    SELECT SUM(COALESCE(d.total_view_count, 0))
                    FROM dashboard_to_sheet ds
                    JOIN views d ON ds.dashboard_id = d.id
                    WHERE ds.sheet_id = views.id
                ), 0)
                WHERE id IN (SELECT DISTINCT sheet_id FROM dashboard_to_sheet)
            """)
            
            result = self.session.execute(update_sql)
            self.session.commit()
            
            # 统计受影响的sheet数量
            affected = self.session.execute(text(
                "SELECT COUNT(DISTINCT sheet_id) FROM dashboard_to_sheet"
            )).scalar()
            
            print(f"  ✅ 已将仪表盘访问量累加到 {affected} 个sheet")
            
        except Exception as e:
            print(f"  ⚠️ 分摊仪表盘访问量失败: {e}")
            import traceback
            traceback.print_exc()
    
    def calculate_stats(self):
        """计算并更新预存统计字段（同步结束后调用）"""
        print("\n📊 计算预存统计字段...")
        
        try:
            # ========== Workbook 统计 ==========
            workbooks = self.session.query(Workbook).all()
            for wb in workbooks:
                wb.view_count = len(wb.views) if wb.views else 0
                wb.datasource_count = len(wb.datasources) if wb.datasources else 0
                
                # 统计字段和指标（排除嵌入式数据源中的重复）
                field_ids = set()
                metric_ids = set()
                
                # 方案1：通过关联的数据源统计（更准确且包含未引用的资产）
                for ds in (wb.datasources or []):
                    # 仅统计非嵌入式数据源，除非工作簿本身没有发布式数据源
                    if ds.is_embedded and len([d for d in wb.datasources if not d.is_embedded]) > 0:
                        continue
                        
                    for f in (ds.fields or []):
                        if f.is_calculated:
                            if f.role == 'measure' or f.role is None:
                                metric_ids.add(f.id)
                        else:
                            field_ids.add(f.id)
                
                # 方案2：回退到视图引用（如果上述为空）
                if len(field_ids) == 0 and len(metric_ids) == 0:
                    for v in (wb.views or []):
                        for f in (v.fields or []):
                            if f.is_calculated:
                                if f.role == 'measure' or f.role is None:
                                    metric_ids.add(f.id)
                            else:
                                field_ids.add(f.id)
                
                wb.field_count = len(field_ids)
                wb.metric_count = len(metric_ids)

            
            # ========== Datasource 统计 ==========
            datasources = self.session.query(Datasource).all()
            for ds in datasources:
                ds.table_count = len(ds.tables) if ds.tables else 0
                ds.workbook_count = len(ds.workbooks) if ds.workbooks else 0
                
                field_count = 0
                metric_count = 0
                for f in (ds.fields or []):
                    if f.is_calculated:
                        if f.role == 'measure' or f.role is None:
                            metric_count += 1
                    else:
                        field_count += 1
                ds.field_count = field_count
                ds.metric_count = metric_count
            
            # ========== Field & CalculatedField 深度统计 (指标预计算优化) ==========
            print("  - 计算字段和指标深度统计...")
            
            # 1. 计算字段公式哈希及查重
            calc_fields = self.session.query(CalculatedField).all()
            formula_map = defaultdict(list)
            for cf in calc_fields:
                if cf.formula:
                    # 标准化公式并计算哈希
                    formula_clean = cf.formula.strip()
                    h = hashlib.md5(formula_clean.encode('utf-8')).hexdigest()
                    cf.formula_hash = h
                    formula_map[h].append(cf)
            
            # 更新查重信息
            for h, cfs in formula_map.items():
                is_duplicate = len(cfs) > 1
                for cf in cfs:
                    cf.has_duplicates = is_duplicate
                    cf.duplicate_count = len(cfs) - 1
            
            # 2. 统计字段被视图引用的次数 (usage_count)
            print("  - 使用 SQL 批量更新视图引用次数...")
            self.session.execute(text("""
                UPDATE fields SET usage_count = (
                    SELECT COUNT(*) FROM field_to_view 
                    WHERE field_to_view.field_id = fields.id
                )
            """))
            
            # 3. 统计字段被指标引用的次数 (metric_usage_count)
            print("  - 使用 SQL 批量更新指标引用次数...")
            self.session.execute(text("""
                UPDATE fields SET metric_usage_count = (
                    SELECT COUNT(*) FROM field_dependencies 
                    WHERE field_dependencies.dependency_name = fields.name
                )
            """))
            
            # 4. 统计指标依赖数 (dependency_count)
            print("  - 使用 SQL 批量更新指标依赖数...")
            self.session.execute(text("""
                UPDATE calculated_fields SET dependency_count = (
                    SELECT COUNT(*) FROM field_dependencies 
                    WHERE field_dependencies.source_field_id = calculated_fields.field_id
                )
            """))

            # 5. 统计指标引用数 (reference_count)
            print("  - 使用 SQL 批量更新指标引用数...")
            self.session.execute(text("""
                UPDATE calculated_fields SET reference_count = (
                    SELECT COUNT(*) FROM field_dependencies 
                    WHERE field_dependencies.dependency_field_id = calculated_fields.field_id
                )
            """))

            self.session.commit()
            print(f"  ✅ 已更新 {len(workbooks)} 个工作簿, {len(datasources)} 个数据源, {len(calc_fields)} 个计算字段的统计字段")
            
        except Exception as e:
            self.session.rollback()
            print(f"  ❌ 统计计算失败: {e}")
            import traceback
            traceback.print_exc()
    
    def close(self):
        """关闭会话"""
        self.session.close()


def main():
    """主函数 - 执行同步"""
    print("\n" + "=" * 60)
    print("Tableau Metadata 同步工具")
    print("=" * 60)
    
    # 配置
    BASE_URL = "http://tbi.juneyaoair.com"
    USERNAME = "huangguanru"
    PASSWORD = "Admin123"
    
    # 创建客户端
    client = TableauMetadataClient(BASE_URL, USERNAME, PASSWORD)
    
    # 登录
    if not client.sign_in():
        print("无法登录，退出")
        return
    
    try:
        # 创建同步管理器
        sync = MetadataSync(client)
        
        # 执行全量同步
        sync.sync_all()
        
        sync.close()
        
    finally:
        # 登出
        client.sign_out()


if __name__ == "__main__":
    main()
