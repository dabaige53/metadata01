"""
Tableau Metadata API 数据同步模块
从 Tableau Server 抓取元数据并存入本地数据库
"""
import os
import sys
import json
import requests
from datetime import datetime
from typing import Optional, List, Dict, Any

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import Config
from app.models import (
    get_engine, get_session,
    Database, Table, Field, Datasource, Workbook, View,
    TableToDatasource, DatasourceToWorkbook, CalculatedField, SyncLog
)


class TableauMetadataClient:
    """Tableau Metadata API 客户端"""
    
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip('/')
        self.username = username
        self.password = password
        self.auth_token: Optional[str] = None
        self.site_id: Optional[str] = None
        self.api_version = "3.10"
    
    def sign_in(self) -> bool:
        """登录获取认证 token"""
        signin_url = f"{self.base_url}/api/{self.api_version}/auth/signin"
        
        payload = {
            "credentials": {
                "name": self.username,
                "password": self.password,
                "site": {"contentUrl": ""}
            }
        }
        
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
    
    def fetch_databases(self) -> List[Dict]:
        """获取所有数据库"""
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
        """获取所有数据表"""
        query = """
        {
            databaseTables {
                id
                name
                schema
                fullName
                database {
                    id
                    name
                    connectionType
                }
            }
        }
        """
        result = self.execute_query(query)
        return result.get("data", {}).get("databaseTables", [])
    
    def fetch_datasources(self) -> List[Dict]:
        """获取所有已发布数据源"""
        query = """
        {
            publishedDatasources {
                id
                name
                projectName
                hasExtracts
                extractLastRefreshTime
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
        """获取所有工作簿"""
        query = """
        {
            workbooks {
                id
                name
                projectName
                createdAt
                updatedAt
                owner {
                    username
                }
                upstreamDatasources {
                    id
                    name
                }
                sheets {
                    id
                    name
                }
            }
        }
        """
        result = self.execute_query(query)
        return result.get("data", {}).get("workbooks", [])
    
    def fetch_fields(self) -> List[Dict]:
        """获取所有字段（通过数据源）"""
        query = """
        {
            publishedDatasources {
                id
                name
                fields {
                    id
                    name
                    description
                }
            }
        }
        """
        result = self.execute_query(query)
        
        # 检查是否有错误
        if "errors" in result:
            print(f"  ⚠️ GraphQL 错误: {result['errors']}")
            return []
        
        data = result.get("data")
        if data is None:
            print(f"  ⚠️ 未获取到数据: {result}")
            return []
            
        datasources = data.get("publishedDatasources") or []
        
        # 展平字段列表
        all_fields = []
        for ds in datasources:
            if not ds:
                continue
            ds_id = ds.get("id")
            ds_name = ds.get("name")
            fields = ds.get("fields") or []
            for field in fields:
                if field and field.get("id"):
                    field["datasource_id"] = ds_id
                    field["datasource_name"] = ds_name
                    all_fields.append(field)
        
        return all_fields
    
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
        
        # 处理数据，添加 datasource_id
        for cf in calc_fields:
            if cf and cf.get("datasource"):
                cf["datasource_id"] = cf["datasource"].get("id")
        
        return calc_fields


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
            self.sync_log.status = "error" if error else "completed"
            self.sync_log.completed_at = datetime.now()
            self.sync_log.records_synced = records
            self.sync_log.error_message = error
            self.session.commit()
    
    def sync_databases(self) -> int:
        """同步数据库"""
        print("\n📦 同步数据库...")
        self._start_sync_log("databases")
        
        try:
            databases = self.client.fetch_databases()
            count = 0
            
            for db_data in databases:
                db = self.session.query(Database).filter_by(id=db_data["id"]).first()
                if not db:
                    db = Database(id=db_data["id"])
                    self.session.add(db)
                
                db.name = db_data.get("name", "")
                db.connection_type = db_data.get("connectionType", "")
                db.updated_at = datetime.now()
                count += 1
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个数据库")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_tables(self) -> int:
        """同步数据表"""
        print("\n📋 同步数据表...")
        self._start_sync_log("tables")
        
        try:
            tables = self.client.fetch_tables()
            count = 0
            
            for t_data in tables:
                table = self.session.query(Table).filter_by(id=t_data["id"]).first()
                if not table:
                    table = Table(id=t_data["id"])
                    self.session.add(table)
                
                table.name = t_data.get("name", "")
                table.schema = t_data.get("schema", "")
                table.full_name = t_data.get("fullName", "")
                
                # 关联数据库
                db_info = t_data.get("database", {})
                if db_info:
                    table.database_id = db_info.get("id")
                    table.connection_type = db_info.get("connectionType", "")
                
                table.updated_at = datetime.now()
                count += 1
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个数据表")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_datasources(self) -> int:
        """同步数据源"""
        print("\n🔗 同步数据源...")
        self._start_sync_log("datasources")
        
        try:
            datasources = self.client.fetch_datasources()
            count = 0
            
            for ds_data in datasources:
                ds = self.session.query(Datasource).filter_by(id=ds_data["id"]).first()
                if not ds:
                    ds = Datasource(id=ds_data["id"])
                    self.session.add(ds)
                
                ds.name = ds_data.get("name", "")
                ds.project_name = ds_data.get("projectName", "")
                ds.has_extract = ds_data.get("hasExtracts", False)
                
                owner = ds_data.get("owner", {})
                if owner:
                    ds.owner = owner.get("username", "")
                
                # 解析刷新时间
                refresh_time = ds_data.get("extractLastRefreshTime")
                if refresh_time:
                    try:
                        ds.extract_last_refresh_time = datetime.fromisoformat(
                            refresh_time.replace("Z", "+00:00")
                        )
                    except:
                        pass
                
                ds.updated_at = datetime.now()
                count += 1
                
                # 同步表到数据源的关系
                upstream_tables = ds_data.get("upstreamTables", [])
                for tbl in upstream_tables:
                    rel = self.session.query(TableToDatasource).filter_by(
                        table_id=tbl["id"],
                        datasource_id=ds_data["id"]
                    ).first()
                    if not rel:
                        rel = TableToDatasource(
                            table_id=tbl["id"],
                            datasource_id=ds_data["id"],
                            relationship_type="upstream"
                        )
                        self.session.add(rel)
            
            self.session.commit()
            self._complete_sync_log(count)
            print(f"  ✅ 同步 {count} 个数据源")
            return count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_workbooks(self) -> int:
        """同步工作簿和视图"""
        print("\n📊 同步工作簿...")
        self._start_sync_log("workbooks")
        
        try:
            workbooks = self.client.fetch_workbooks()
            wb_count = 0
            view_count = 0
            
            for wb_data in workbooks:
                wb = self.session.query(Workbook).filter_by(id=wb_data["id"]).first()
                if not wb:
                    wb = Workbook(id=wb_data["id"])
                    self.session.add(wb)
                
                wb.name = wb_data.get("name", "")
                wb.project_name = wb_data.get("projectName", "")
                
                owner = wb_data.get("owner", {})
                if owner:
                    wb.owner = owner.get("username", "")
                
                # 解析时间
                created_at = wb_data.get("createdAt")
                if created_at:
                    try:
                        wb.created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                    except:
                        pass
                
                updated_at = wb_data.get("updatedAt")
                if updated_at:
                    try:
                        wb.updated_at = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                    except:
                        wb.updated_at = datetime.now()
                
                wb_count += 1
                
                # 同步数据源到工作簿的关系
                upstream_ds = wb_data.get("upstreamDatasources", [])
                for ds in upstream_ds:
                    rel = self.session.query(DatasourceToWorkbook).filter_by(
                        datasource_id=ds["id"],
                        workbook_id=wb_data["id"]
                    ).first()
                    if not rel:
                        rel = DatasourceToWorkbook(
                            datasource_id=ds["id"],
                            workbook_id=wb_data["id"]
                        )
                        self.session.add(rel)
                
                # 同步视图 (sheets)
                sheets = wb_data.get("sheets", [])
                for sheet in sheets:
                    view = self.session.query(View).filter_by(id=sheet["id"]).first()
                    if not view:
                        view = View(id=sheet["id"])
                        self.session.add(view)
                    
                    view.name = sheet.get("name", "")
                    view.workbook_id = wb_data["id"]
                    view.updated_at = datetime.now()
                    view_count += 1
            
            self.session.commit()
            self._complete_sync_log(wb_count)
            print(f"  ✅ 同步 {wb_count} 个工作簿, {view_count} 个视图")
            return wb_count
            
        except Exception as e:
            self.session.rollback()
            self._complete_sync_log(0, str(e))
            print(f"  ❌ 同步失败: {e}")
            return 0
    
    def sync_fields(self) -> int:
        """同步字段"""
        print("\n🔤 同步字段...")
        self._start_sync_log("fields")
        
        try:
            fields = self.client.fetch_fields()
            count = 0
            calc_count = 0
            
            for f_data in fields:
                if not f_data or not f_data.get("id"):
                    continue
                    
                field = self.session.query(Field).filter_by(id=f_data["id"]).first()
                if not field:
                    field = Field(id=f_data["id"])
                    self.session.add(field)
                
                field.name = f_data.get("name") or ""
                field.description = f_data.get("description") or ""
                field.data_type = f_data.get("dataType") or ""
                field.is_calculated = f_data.get("isCalculated") or False
                field.formula = f_data.get("formula") or ""
                field.role = f_data.get("role") or ""
                field.datasource_id = f_data.get("datasource_id")
                
                # 关联上游表
                upstream_cols = f_data.get("upstreamColumns") or []
                if upstream_cols and len(upstream_cols) > 0:
                    first_col = upstream_cols[0]
                    if first_col:
                        table_info = first_col.get("table")
                        if table_info:
                            field.table_id = table_info.get("id")
                
                field.updated_at = datetime.now()
                count += 1
                
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
                field.updated_at = datetime.now()
                
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
    
    def sync_all(self):
        """全量同步所有实体"""
        print("=" * 60)
        print("🚀 开始全量同步 Tableau Metadata")
        print("=" * 60)
        
        start_time = datetime.now()
        
        # 按依赖顺序同步
        db_count = self.sync_databases()
        table_count = self.sync_tables()
        ds_count = self.sync_datasources()
        wb_count = self.sync_workbooks()
        field_count = self.sync_fields()
        calc_count = self.sync_calculated_fields()
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print("\n" + "=" * 60)
        print("📈 同步完成统计")
        print("=" * 60)
        print(f"  数据库: {db_count}")
        print(f"  数据表: {table_count}")
        print(f"  数据源: {ds_count}")
        print(f"  工作簿: {wb_count}")
        print(f"  字段:   {field_count}")
        print(f"  计算字段: {calc_count}")
        print(f"  耗时: {duration:.2f} 秒")
        print("=" * 60)
    
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
