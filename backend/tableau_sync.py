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
                    upstreamTables {{
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
                            role
                            isHidden
                            upstreamColumns {{
                                id
                                name
                                remoteType
                                table {{
                                    id
                                    name
                                    __typename

                                    ... on CustomSQLTable {{
                                        upstreamTables {{
                                            id
                                            name
                                        }}
                                    }}
                                }}
                            }}
                        }}
                        ... on CalculatedField {{
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
                                ... on ColumnField {{
                                    upstreamColumns {{
                                        id
                                        name
                                        table {{
                                            id
                                            name
                                            __typename

                                            ... on CustomSQLTable {{
                                                upstreamTables {{
                                                    id
                                                    name
                                                }}
                                            }}
                                        }}
                                    }}
                                }}
                            }}
                        }}
                        ... on GroupField {{
                            role
                            isHidden
                        }}
                        ... on DatasourceField {{
                            remoteField {{
                                id
                                name
                                description
                                datasource {{
                                    id
                                    name
                                    __typename
                                }}
                            }}
                            upstreamColumns {{
                                id
                                name
                                table {{
                                    id
                                    name
                                    __typename

                                    ... on CustomSQLTable {{
                                        upstreamTables {{
                                            id
                                            name
                                        }}
                                    }}
                                }}
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
                
                # 不再跳过嵌入式表，因为字段的 upstream_column_id 可能引用嵌入式表的列
                # 标记 is_embedded 以便在 UI 中区分
                is_embedded = table_data.get("isEmbedded", False)
                
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
                table.is_embedded = is_embedded  # 正确标记嵌入式表
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
            
    def _save_embedded_datasource(self, ds_data: Dict, workbook_id: str, source_published_ds_id: str = None):
        """保存嵌入式数据源 (包括直连场景和引用已发布数据源场景)"""
        try:
            ds_id = ds_data["id"]
            ds = self.session.query(Datasource).filter_by(id=ds_id).first()
            if not ds:
                ds = Datasource(id=ds_id)
                self.session.add(ds)
            
            ds.name = ds_data.get("name") or "Embedded Datasource"
            ds.is_embedded = True
            ds.project_name = "(Embedded)" # 嵌入式源通常没有独立的项目归属，因为它属于工作簿
            
            # 🆕 设置源已发布数据源ID（血缘关系）
            if source_published_ds_id:
                ds.source_published_datasource_id = source_published_ds_id
            
            # 建立上游表关联 (直连源的关键血缘)
            upstream_tables = ds_data.get("upstreamTables", [])
            for tbl in upstream_tables:
                if not tbl or not tbl.get("id"):
                     continue
                
                # 使用 select 查询避免重复插入错误
                rel = self.session.execute(
                    select(table_to_datasource).where(
                        table_to_datasource.c.table_id == tbl["id"],
                        table_to_datasource.c.datasource_id == ds_id
                    )
                ).first()
                
                if not rel:
                    try:
                        self.session.execute(
                            table_to_datasource.insert().values(
                                table_id=tbl["id"],
                                datasource_id=ds_id,
                                relationship_type="upstream"
                            )
                        )
                    except:
                        pass # 忽略主键冲突

        except Exception as e:
            print(f"  ⚠️ 保存嵌入式数据源失败: {e}")
    
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

                # 同步嵌入式数据源 (Embedded)
                embedded_ds = wb_data.get("embeddedDatasources", [])
                for eds in embedded_ds:
                    if not eds or not eds.get("id"):
                        continue
                    
                    upstream_published = eds.get("upstreamDatasources", [])
                    upstream_ds_id = None
                    
                    if upstream_published:
                        # 场景1：嵌入式源引用了已发布数据源 (穿透模式)
                        # 将上游发布式数据源关联到工作簿
                        for up_ds in upstream_published:
                            if up_ds and up_ds.get("id"):
                                self._link_datasource_to_workbook(up_ds["id"], wb_data["id"])
                        upstream_ds_id = upstream_published[0]["id"]
                        
                        # 🆕 场景1也保存嵌入式数据源记录，并设置 source_published_datasource_id
                        self._save_embedded_datasource(eds, wb_data["id"], source_published_ds_id=upstream_ds_id)
                        # 🔧 修复：场景1也需要建立嵌入式数据源到工作簿的关联
                        self._link_datasource_to_workbook(eds["id"], wb_data["id"])
                    else:
                        # 场景2：完全独立的嵌入式直连源 (保留模式)
                        # 保存该嵌入式数据源，标记 is_embedded=True
                        # 这样工作簿就有了一个关联的 Datasource，字段也有了归属
                        self._save_embedded_datasource(eds, wb_data["id"])
                        # 同时也建立 Datasource -> Workbook 关联 (虽然上面已经在 DB 层面建立了，但这里显式链接)
                        self._link_datasource_to_workbook(eds["id"], wb_data["id"])
                        upstream_ds_id = eds["id"]
                    
                    # 同步嵌入式字段
                    eds_fields = eds.get("fields", [])
                    for f_data in eds_fields:
                        self._sync_field(f_data, datasource_id=upstream_ds_id, workbook_id=wb_data["id"])



                
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
        """同步字段（含去重逻辑）"""
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
            
            # --- 去重准备开始 ---
            # 1. 分离已发布字段和嵌入式字段
            published_fields = []
            embedded_fields = []
            
            # 缓存已发布的字段：(datasource_id, name) -> field_id
            published_field_cache = {}
            
            # 预处理：分类
            for f in fields:
                if not f or not f.get("id"): continue
                
                # 判断是否为嵌入式 (通过原始 datasource_id 和 parent_datasource_id 对比)
                # fetch_fields 中有一步: field["parent_datasource_id"] = ds_id (原始ID)
                # field["datasource_id"] = final_ds_id (穿透后的ID)
                
                orig_ds_id = f.get("parent_datasource_id")
                final_ds_id = f.get("datasource_id")
                
                # 如果 orig_ds_id != final_ds_id，说明发生了穿透，它是嵌入式字段
                if orig_ds_id and final_ds_id and orig_ds_id != final_ds_id:
                    embedded_fields.append(f)
                else:
                    published_fields.append(f)
            
            print(f"  - 字段预处理: 已发布 {len(published_fields)} 个, 嵌入式 {len(embedded_fields)} 个")
            
            count = 0
            calc_count = 0
            skipped_count = 0
            current_ids = []
            
            # --- 第一阶段：处理已发布字段 (构建基准) ---
            for f_data in published_fields:
                self._process_single_field(f_data, table_real_ds_map)
                current_ids.append(f_data["id"])
                
                # 加入缓存
                ds_id = f_data.get("datasource_id")
                name = f_data.get("name")
                if ds_id and name:
                     published_field_cache[(ds_id, name)] = f_data["id"]

                count += 1
                if count % 1000 == 0:
                    self.session.commit()
            
            # --- 第二阶段：处理嵌入式字段 (查重) ---
            for f_data in embedded_fields:
                ds_id = f_data.get("datasource_id") # 这是穿透后的 ID (即已发布源ID)
                name = f_data.get("name")
                
                # 检查是否重复
                if ds_id and name and (ds_id, name) in published_field_cache:
                    # 发现重复！跳过保存，但可能需要记录（为了后续 view 关联）
                    # 下一步 fetch_views_with_fields 会处理重连
                    skipped_count += 1
                    continue
                
                # 如果不重复（例如工作簿特有的计算字段），则保存
                self._process_single_field(f_data, table_real_ds_map)
                current_ids.append(f_data["id"])
                count += 1
                
            self.session.commit()
            
            # 清理数据库中已不存在的记录
            self._cleanup_orphaned_records(Field, current_ids)
            
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个字段 (其中 {calc_count} 个计算字段, 去重跳过 {skipped_count} 个)")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            import traceback
            traceback.print_exc()
            return 0

    def _process_single_field(self, f_data, table_real_ds_map):
        """辅助：处理单个字段的保存逻辑"""
        from backend.models import DBTable, DBColumn

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
                        target_table_id = self._get_physical_table_id(table_info)
                        field.table_id = target_table_id

        # 血缘补齐：如果当前 datasource_id 指向的不是发布式（或不存在），尝试通过 table_id 找发布式
        if ds_id:
            # 🔧 关键修改：允许引用嵌入式数据源 (is_embedded=1)，只要它存在于数据库中
            exists = self.session.query(Datasource).filter_by(id=ds_id).first()
            if not exists:
                # 尝试通过 table_id 找发布式数据源
                if target_table_id in table_real_ds_map:
                    ds_id = table_real_ds_map[target_table_id]
                else:
                    # 无法穿透到有效数据源，则设为 NULL
                    ds_id = None
        
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
            field.role = (f_data.get("role") or "").lower()
            field.is_hidden = f_data.get("isHidden") or False
            field.folder_name = f_data.get("folderName")
            
            # 指标血缘穿透：通过 upstreamFields 找物理数据源和物理表
            upstream_fields = f_data.get("upstreamFields") or []
            for uf in upstream_fields:
                if uf:
                    # 1. 尝试获取物理表 (从上游字段的 upstreamColumns)
                    upstream_cols = uf.get("upstreamColumns") or []
                    if upstream_cols and not field.table_id:
                        for col in upstream_cols:
                            if col and col.get("table"):
                                field.table_id = self._get_physical_table_id(col["table"])
                                break
                    
                    # 2. 尝试获取发布式数据源
                    if uf.get("datasource"):
                        ref_ds_id = uf["datasource"].get("id")
                        if ref_ds_id:
                            exists = self.session.query(Datasource).filter_by(id=ref_ds_id, is_embedded=0).first()
                            if exists:
                                ds_id = ref_ds_id
                                # 继续遍历以找更多的table_id，但数据源已确定
        elif typename == "ColumnField":
            field.data_type = f_data.get("dataType") or ""
            field.role = (f_data.get("role") or "").lower()
            field.is_hidden = f_data.get("isHidden") or False
            field.folder_name = f_data.get("folderName")
            
            # 关联上游表和列
            upstream_cols = f_data.get("upstreamColumns") or []
            if upstream_cols and len(upstream_cols) > 0:
                first_col = upstream_cols[0]
                if first_col:
                    field.upstream_column_id = first_col.get("id")
                    field.upstream_column_name = first_col.get("name")
                    
                    # B1 Fix: 尝试补全缺失的物理列
                    if field.upstream_column_id:
                        db_col = self.session.query(DBColumn).filter_by(id=field.upstream_column_id).first()
                        
                        # 如果本地没有该列，但我们知道它属于某张表，则创建该表和列
                        if not db_col and first_col.get("table") and first_col["table"].get("id"):
                            try:
                                real_table_id = first_col["table"]["id"]
                                # 确保表存在
                                real_table_id = first_col["table"]["id"]
                                table_typename = first_col["table"].get("__typename")
                                
                                # 确保表存在，如果不存在则创建
                                real_table = self.session.query(DBTable).filter_by(id=real_table_id).first()
                                new_name = first_col["table"].get("name")
                                
                                if not real_table:
                                    real_table = DBTable(id=real_table_id)
                                    real_table.name = new_name or "Unknown Table"
                                    # 如果是 DatabaseTable，则认为是物理表；否则 (EmbeddedTable等) 为嵌入表
                                    real_table.is_embedded = (table_typename != "DatabaseTable")
                                    self.session.add(real_table)
                                    print(f"    🔨 补全缺失表: {real_table.name} (Type: {table_typename})")
                                elif real_table.name == "Unknown Table" and new_name:
                                    real_table.name = new_name
                                    print(f"    🔨 更新缺失表名: {real_table.name}")

                                # 创建补全列
                                new_col = DBColumn(id=field.upstream_column_id)
                                new_col.name = field.upstream_column_name
                                new_col.remote_type = first_col.get("remoteType")
                                new_col.table_id = real_table_id
                                self.session.add(new_col)
                                self.session.flush() # 立即提交
                                print(f"    🔨 修复缺失物理列: {new_col.name} -> {real_table.name}")
                                db_col = new_col
                            except Exception as e:
                                print(f"    ⚠️ 修复物理列/表失败: {e}")

                        if db_col and db_col.remote_type:
                            field.remote_type = db_col.remote_type
                    
                    table_info = first_col.get("table")
                    if table_info:
                        field.table_id = self._get_physical_table_id(table_info)
        elif typename == "DatasourceField":
            # 处理 DatasourceField（通常是嵌入式数据源中引用已发布数据源的字段）
            field.data_type = f_data.get("dataType") or ""
            field.role = (f_data.get("role") or "").lower()
            field.is_hidden = f_data.get("isHidden") or False
            
            # 解析 remoteField（指向已发布数据源中的原始字段）
            remote_field = f_data.get("remoteField")
            if remote_field:
                field.remote_field_id = remote_field.get("id")
                field.remote_field_name = remote_field.get("name")
                
                # 如果有 remoteField，尝试获取其数据源信息用于追溯
                remote_ds = remote_field.get("datasource")
                if remote_ds:
                    remote_ds_id = remote_ds.get("id")
                    # 检查 remoteField 的数据源是否为已发布数据源
                    remote_ds_type = remote_ds.get("__typename")
                    if remote_ds_type == "PublishedDatasource":
                        # 更新当前字段所属的嵌入式数据源的 source_published_datasource_id
                        # 使用 parent_datasource_id 而不是 ds_id，因为 ds_id 可能已被血缘穿透
                        parent_ds_id = f_data.get("parent_datasource_id")
                        if parent_ds_id:
                            current_ds = self.session.query(Datasource).filter_by(id=parent_ds_id).first()
                            if current_ds and current_ds.is_embedded and not current_ds.source_published_datasource_id:
                                current_ds.source_published_datasource_id = remote_ds_id
            
            # 关联上游表和列
            upstream_cols = f_data.get("upstreamColumns") or []
            if upstream_cols and len(upstream_cols) > 0:
                first_col = upstream_cols[0]
                if first_col:
                    field.upstream_column_id = first_col.get("id")
                    field.upstream_column_name = first_col.get("name")
                    table_info = first_col.get("table")
                    if table_info:
                        field.table_id = self._get_physical_table_id(table_info)
        
        # 处理计算字段详情
        if f_data.get("isCalculated"):
            calc_field = self.session.query(CalculatedField).filter_by(
                field_id=f_data["id"]
            ).first()
            if not calc_field:
                calc_field = CalculatedField(field_id=f_data["id"])
                self.session.add(calc_field)
            
            calc_field.name = f_data.get("name") or ""
            calc_field.formula = f_data.get("formula") or ""

        # D Fix: 如果此时还没有 table_id，尝试通过名称匹配物理表
        if not field.table_id and field.name:
            # 仅当字段名与现有物理表名完全一致时关联
            # 排除常见的通用名称
            ignored_names = [":Measure Names", "Measure Values", "Number of Records", "记录数"]
            if field.name not in ignored_names:
                matched_table = self.session.query(DBTable).filter_by(name=field.name).first()
                if matched_table:
                    field.table_id = matched_table.id
                    print(f"    🔨 修复无关联表字段: {field.name} -> 关联到表 {matched_table.name}")

    def _get_physical_table_id(self, table_info):
        """尝试从 Table 对象（可能是 EmbeddedTable 或 CustomSQLTable）中提取物理 Table ID"""
        if not table_info:
            return None
            
        typename = table_info.get("__typename")
        table_id = table_info.get("id")
        
        # 如果是 DatabaseTable，直接返回其 ID
        if typename == "DatabaseTable":
            return table_id
            
        # 如果是 EmbeddedTable 或 CustomSQLTable，尝试穿透到 upstreamTables
        upstream_tables = table_info.get("upstreamTables") or []
        if upstream_tables and len(upstream_tables) > 0:
            # 返回第一个上游物理表的 ID (通常是 DatabaseTable)
            # 注意：upstreamTables 可能返回多个，通常取第一个
            return upstream_tables[0].get("id")
            
        return table_id

    
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
                field.role = (cf_data.get("role") or "").lower()
                if not field.datasource_id:
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
        """同步字段到视图的关联关系（含智能重连）"""
        print("\n🔗 同步字段→视图关联...")
        self._start_sync_log("field_to_view")
        
        try:
            # 1. 清理旧数据 (全量同步策略)
            # 由于我们做了去重，必须清除旧的可能指向无效ID的链接
            self.session.execute(text("DELETE FROM field_to_view"))
            self.session.commit()
            print("  🧹 已清空旧的字段关联关系")

            view_fields = self.client.fetch_views_with_fields()
            
            # 2. 准备查找缓存 (Name + Datasource -> FieldID)
            # 用于当原始 field_id 是嵌入式副本（已被去重）时，找回已发布的真身
            from backend.models import Datasource
            print("  - 构建字段查找缓存...")
            
            # 获取所有已发布的字段信息: (datasource_id, name) -> field_id
            # 仅加载已发布数据源的字段
            published_fields_map = {} 
            result = self.session.execute(
                select(Field.id, Field.name, Field.datasource_id)
                .join(Datasource, Datasource.id == Field.datasource_id)
                .where(Datasource.is_embedded == 0)
            ).fetchall()
            
            for fid, fname, fdsid in result:
                if fdsid and fname:
                    published_fields_map[(fdsid, fname)] = fid
            
            # 还需要嵌入式数据源ID -> 发布式数据源ID 的映射
            # 这在 fetch_fields 期间用到了，这里重新构建或通过 table_to_datasource 推断
            # 简单起见，我们假设 embedded_ds_id 在 backend/models.py 里没有直接存储映射，
            # 但我们可以通过 "Tableau Metadata API" 的特性：embedded field 的 datasource_id 往往是临时的。
            # 我们在 sync_fields 既然已经统一了 datasource_id，那数据库里的 Field.datasource_id 都是发布式的。
            
            count = 0
            relinked_count = 0
            skipped = 0
            
            # 缓存有效字段ID集合，减少查询
            valid_field_ids = set([r[0] for r in result])
            
            # 为了处理嵌入式数据源ID -> 发布式ID，我们需要一个辅助映射
            # 因为 view_fields 返回的数据中，field 往往带着嵌入式 DS ID
            # 我们需要构建: embedded_ds_id -> published_ds_id
            # 这可以通过 "fetch_fields" 的逻辑复现，或者更简单地：
            # 在 sync_fields 阶段没有持久化这个映射有点可惜。
            # 补救策略：
            # 如果直接找不到 ID，尝试用 (任何发布式DS, name) 匹配？不，太宽泛。
            # 我们可以尝试匹配 (view.workbook -> upstreamDatasource, name)
            
            # 构建 Workbook -> Published Datasources 映射
            wb_ds_map = {}
            wb_ds_rels = self.session.execute(
                select(datasource_to_workbook.c.workbook_id, datasource_to_workbook.c.datasource_id)
            ).fetchall()
            for wbid, dsid in wb_ds_rels:
                if wbid not in wb_ds_map:
                    wb_ds_map[wbid] = []
                wb_ds_map[wbid].append(dsid)

            for vf in view_fields:
                field_id = vf.get("field_id")
                field_name = vf.get("field_name")
                view_id = vf.get("view_id")
                workbook_id = vf.get("workbook_id") # 需要 fetch_views_with_fields 返回 workbook_id
                
                if not field_id or not view_id:
                    skipped += 1
                    continue
                
                final_field_id = field_id
                
                # 检查ID是否有效
                if field_id not in valid_field_ids:
                    # ID 无效（可能是被去重的嵌入式字段）
                    # 尝试重连：在工作簿关联的发布式数据源中查找同名字段
                    found_new_id = None
                    
                    if workbook_id and field_name and workbook_id in wb_ds_map:
                        potential_ds_ids = wb_ds_map[workbook_id]
                        for p_ds_id in potential_ds_ids:
                            key = (p_ds_id, field_name)
                            if key in published_fields_map:
                                found_new_id = published_fields_map[key]
                                break
                    
                    if found_new_id:
                        final_field_id = found_new_id
                        relinked_count += 1
                    else:
                        # 确实找不到，放弃
                        skipped += 1
                        continue
                
                # 插入关联 (批量插入优化可留待后续，目前单条插入并忽略错误)
                try:
                    self.session.execute(
                        field_to_view.insert().values(
                            field_id=final_field_id,
                            view_id=view_id,
                            used_in_formula=False
                        )
                    )
                    count += 1
                except Exception as e:
                    # 可能是主键冲突（如果逻辑有误导致重复插入）
                    skipped += 1
                    continue
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个字段→视图关联 (重连 {relinked_count} 个, 跳过 {skipped} 个)")
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
            field.role = (f_data.get("role") or field.role or "").lower()
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
            field.role = (f_data.get("role") or field.role or "").lower()
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
            
            # ========== 预计算完整血缘链 (field_full_lineage) ==========
            print("  - 预计算完整血缘链...")
            self._compute_full_lineage()
            
        except Exception as e:
            self.session.rollback()
            print(f"  ❌ 统计计算失败: {e}")
            import traceback
            traceback.print_exc()
    
    def _compute_full_lineage(self):
        """预计算所有字段的完整血缘链并存入 field_full_lineage 表"""
        from backend.models import FieldFullLineage, Field, Datasource
        
        try:
            # 清空旧数据
            self.session.execute(text("DELETE FROM field_full_lineage"))
            
            # 构建数据源 -> 物理表的映射
            ds_table_map = {}  # datasource_id -> [table_ids]
            result = self.session.execute(text(
                "SELECT datasource_id, table_id FROM table_to_datasource"
            )).fetchall()
            for ds_id, tbl_id in result:
                if ds_id not in ds_table_map:
                    ds_table_map[ds_id] = []
                ds_table_map[ds_id].append(tbl_id)
            
            # 遍历所有字段
            fields = self.session.query(Field).all()
            lineage_records = []
            
            for f in fields:
                if not f.is_calculated:
                    # 原始字段: 直接血缘
                    # 物理表来源: 优先用 field.table_id，否则用 datasource 反查
                    table_ids = []
                    if f.table_id and self.session.query(DBTable).filter_by(id=f.table_id).first():
                        table_ids = [f.table_id]
                    elif f.datasource_id and f.datasource_id in ds_table_map:
                        table_ids = ds_table_map[f.datasource_id]
                    
                    if table_ids:
                        for tbl_id in table_ids:
                            lineage_records.append({
                                'field_id': f.id,
                                'table_id': tbl_id,
                                'datasource_id': f.datasource_id,
                                'workbook_id': f.workbook_id,
                                'lineage_type': 'direct',
                                'lineage_path': f'Field -> DS -> Table'
                            })
                    else:
                        # 无物理表关联，但仍需记录字段存在
                        lineage_records.append({
                            'field_id': f.id,
                            'table_id': None,
                            'datasource_id': f.datasource_id,
                            'workbook_id': f.workbook_id,
                            'lineage_type': 'direct',
                            'lineage_path': f'Field -> DS (no table)'
                        })
                else:
                    # 计算字段: 间接血缘 (通过数据源反查物理表)
                    table_ids = []
                    if f.datasource_id and f.datasource_id in ds_table_map:
                        table_ids = ds_table_map[f.datasource_id]
                    
                    if table_ids:
                        for tbl_id in table_ids:
                            lineage_records.append({
                                'field_id': f.id,
                                'table_id': tbl_id,
                                'datasource_id': f.datasource_id,
                                'workbook_id': f.workbook_id,
                                'lineage_type': 'indirect',
                                'lineage_path': f'CalcField -> DS -> Table'
                            })
                    else:
                        # 无物理表关联
                        lineage_records.append({
                            'field_id': f.id,
                            'table_id': None,
                            'datasource_id': f.datasource_id,
                            'workbook_id': f.workbook_id,
                            'lineage_type': 'indirect',
                            'lineage_path': f'CalcField -> DS (no table)'
                        })
            
            # 批量插入
            if lineage_records:
                self.session.execute(
                    text("""
                        INSERT INTO field_full_lineage 
                        (field_id, table_id, datasource_id, workbook_id, lineage_type, lineage_path)
                        VALUES (:field_id, :table_id, :datasource_id, :workbook_id, :lineage_type, :lineage_path)
                    """),
                    lineage_records
                )
                self.session.commit()
            
            print(f"  ✅ 预计算 {len(lineage_records)} 条完整血缘记录")
            
        except Exception as e:
            self.session.rollback()
            print(f"  ❌ 预计算血缘失败: {e}")
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
    
    # 从 Config 读取配置
    BASE_URL = Config.TABLEAU_BASE_URL.replace('http://', 'https://')  # 强制使用 HTTPS
    PAT_NAME = Config.TABLEAU_PAT_NAME
    PAT_SECRET = Config.TABLEAU_PAT_SECRET
    USERNAME = Config.TABLEAU_USERNAME
    PASSWORD = Config.TABLEAU_PASSWORD
    
    # 创建客户端 (优先使用 PAT)
    if PAT_NAME and PAT_SECRET:
        client = TableauMetadataClient(BASE_URL, pat_name=PAT_NAME, pat_secret=PAT_SECRET)
    else:
        client = TableauMetadataClient(BASE_URL, username=USERNAME, password=PASSWORD)
    
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
