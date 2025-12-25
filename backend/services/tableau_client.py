"""
Tableau Metadata API 客户端
从 Tableau Server 抓取元数据
"""
import os
import sys
import json
import requests
from collections import defaultdict
from typing import Optional, List, Dict, Any

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config

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
    
    def fetch_datasource_by_id(self, ds_id: str) -> Optional[Dict]:
        """获取单个数据源详情"""
        query = """
        {
            publishedDatasources(filter: {id: "%s"}) {
                id
                name
                description
                projectName
                projectVizportalUrlId
                uri
                hasExtracts
                isCertified
                certificationNote
                certifierDisplayName
                owner {
                    id
                    username
                }
            }
        }
        """ % ds_id
        
        result = self.execute_query(query)
        if "errors" in result:
             print(f"  ⚠️ 获取单数据源失败: {result['errors']}")
             return None
             
        data = result.get("data", {})
        ds_list = data.get("publishedDatasources") or []
        if ds_list:
            return ds_list[0]
        return None

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
                workbook {
                    id
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
            
            # 建立嵌入式数据源到工作簿的映射
            if ds.get("workbook"):
                f_wb_id = ds["workbook"]["id"]
                # 我们将在 _batch_fetch_fields 中用到这个信息，但那里是重新查的
                # 实际上 _batch_fetch_fields 也需要更新查询来获取 workbook


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
        
        # 修正：仅由于嵌入式数据源本身有 workbook 字段，发布式数据源没有
        # 我们需要在查询中动态决定是否包含 workbook
        nested_workbook_query = ""
        if type_name == "embeddedDatasources":
            nested_workbook_query = """
                workbook {
                    id
                }"""

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
                    {nested_workbook_query}
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
                            field["is_from_embedded_ds"] = (type_name == "embeddedDatasources")  # 标记来源
                            
                            # 提取 workbook 信息 (仅针对 embeddedDatasources)
                            if ds_data.get("workbook"):
                                field["workbook"] = ds_data["workbook"]
                                
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
            
            # 动态构建 Alias Filter 查询（增加仪表板字段查询）
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
                    dashboards {{
                        id
                        name
                        upstreamSheetFieldInstances {{
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

                    # 处理 sheets 的字段
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
                                    "view_type": "sheet",
                                    "workbook_id": wb_id,
                                    "field_id": field.get("id"),
                                    "field_name": field.get("name"),
                                    "datasource_id": (field.get("datasource") or {}).get("id")
                                })

                    # 处理 dashboards 的字段
                    dashboards = wb_data.get("dashboards") or []
                    for dashboard in dashboards:
                        if not dashboard: continue
                        view_id = dashboard.get("id")
                        view_name = dashboard.get("name")
                        fields = dashboard.get("upstreamSheetFieldInstances") or []

                        for field in fields:
                            if field and field.get("id"):
                                all_view_fields.append({
                                    "view_id": view_id,
                                    "view_name": view_name,
                                    "view_type": "dashboard",
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
