"""
元数据同步管理器
将 Tableau 元数据存入本地数据库
"""
import os
import sys
import hashlib
from collections import defaultdict
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, text
import re

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config
from backend.migrations import split_fields_table_v5
from backend.models import (
    Base, get_engine, init_db, get_session,
    Database, DBTable, DBColumn, Field, Datasource, Workbook, View,
    TableauUser, Project,
    table_to_datasource, datasource_to_workbook, field_to_view, CalculatedField, SyncLog,
    FieldDependency, Metric, dashboard_to_sheet
)
from .tableau_client import TableauMetadataClient

class MetadataSync:
    """元数据同步管理器"""
    
    def __init__(self, client: TableauMetadataClient, db_path: str = None):
        self.client = client
        self.db_path = db_path or Config.DATABASE_PATH
        self.engine = get_engine(self.db_path)
        self.session = get_session(self.engine)
        self.sync_log: Optional[SyncLog] = None
        self.deduplication_map = {} # skipped_id -> survivor_id (跨阶段去重映射)
    
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
            # 对于 Field，还需要清理相关的依赖和关联
            if model_class == Field:
                # 新模型: CalculatedField 使用 id 作为主键，与 Field.id 相同
                self.session.query(CalculatedField).filter_by(id=record.id).delete()
                self.session.query(FieldDependency).filter(
                    (FieldDependency.source_field_id == record.id) | 
                    (FieldDependency.dependency_field_id == record.id)
                ).delete()
                from backend.models import Metric, field_to_view
                self.session.query(Metric).filter_by(id=record.id).delete()
                self.session.execute(field_to_view.delete().where(field_to_view.c.field_id == record.id))
                self.session.execute(text("DELETE FROM field_full_lineage WHERE field_id = :fid"), {"fid": record.id})
            
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

            # --- 去重准备开始 ---
            # 缓存已发布的字段：(datasource_id, name) -> field_id
            published_field_cache = {}
            physical_column_cache = {} # (table_name, column_name) -> field_id
            calc_field_cache = {}      # (field_name, formula_hash) -> field_id
            self.deduplication_map = {} # skipped_id -> survivor_id

            all_fields = self.client.fetch_fields()
            ds_fields_map = {} # {datasource_id: [field_data, ...]}
            published_datasources = [] # 存储已发布的datasource对象
            embedded_fields = [] # 存储嵌入式字段

            print(f"  - 拉取到 {len(all_fields)} 个字段，开始分类...")

            for f in all_fields:
                if not f or not f.get("id"): continue
                
                # 判断是否为嵌入式：使用 is_from_embedded_ds 标记（在 fetch_fields 中设置）
                is_from_embedded = f.get("is_from_embedded_ds", False)
                
                is_from_embedded = f.get("is_from_embedded_ds", False)
                
                if is_from_embedded:
                    # 对于嵌入式字段，尝试从数据源反向查找 workbook_id
                    # 注意：fetch_fields 返回的数据中可能没有 workbook 信息，
                    # 这里的 f 是从 self.client.fetch_fields() 获取的。
                    # 如果 fetch_fields 没有返回 workbook，我们需要在这里补全。
                    # 但 fetch_fields 实际上是全量拉取，对于 embedded datasource，通常能关联到 parent workbook。
                    # 我们检查一下 f 里面是否有 workbook 对象。
                    if "workbook" in f and f["workbook"]:
                         f["workbook_id"] = f["workbook"]["id"]
                    
                    embedded_fields.append(f)
                else:
                    # 这是一个已发布字段，将其归类到其数据源下
                    ds_id = f.get("datasource_id")
                    if ds_id:
                        if ds_id not in ds_fields_map:
                            ds_fields_map[ds_id] = []
                            # 首次遇到这个数据源，尝试获取其信息
                            ds_info = self.client.fetch_datasource_by_id(ds_id)
                            if ds_info:
                                published_datasources.append(ds_info)
                        ds_fields_map[ds_id].append(f)
            
            # --- 去重准备开始 ---
            # 缓存已发布的字段：(datasource_id, name) -> field_id
            published_field_cache = {}
            physical_column_cache = {} # (table_name, column_name) -> field_id
            calc_field_cache = {}      # (field_name, formula_hash) -> field_id
            self.deduplication_map = {} # skipped_id -> survivor_id (记录被去重的字段映射关系)

            print(f"  - 字段预处理: 已发布数据源 {len(published_datasources)} 个, 嵌入式字段 {len(embedded_fields)} 个")
            
            count = 0
            calc_count = 0
            skipped_count = 0
            current_ids = []
            
            # 1. 第一阶段：处理发布式数据源 (PublishedDatasource)
            # 这些是"真身"，优先保存并建立缓存
            # ----------------------------------------------------
            for ds in published_datasources:
                ds_id = ds["id"]
                # 重新构建 table_real_ds_map，确保包含所有发布式数据源的映射
                # 这一步可能需要更精细的逻辑，这里简化为直接更新
                # 实际上，table_real_ds_map 应该在所有发布式数据源处理前构建完成
                # 但为了与用户提供的diff保持一致，这里暂时保留
                # self._get_table_to_datasource_map(ds) 应该返回一个字典，然后用 update
                # 考虑到原始代码中 table_real_ds_map 已经通过 DB 查询构建，这里可能不需要再次更新
                # 暂时注释掉，如果需要，再根据实际情况调整
                # table_real_ds_map.update(self._get_table_to_datasource_map(ds))
                
                fields = ds_fields_map.get(ds_id, [])
                for f_data in fields:
                    if not f_data: continue
                    
                    # 为发布式字段设置正确的 datasource_id
                    f_data["datasource_id"] = ds_id
                    
                    self._process_single_field(f_data, table_real_ds_map)
                    current_ids.append(f_data["id"])
                    
                    # 填充一级缓存 (发布式字段缓存)
                    name = f_data.get("name")
                    if name:
                        published_field_cache[(ds_id, name)] = f_data["id"]

                    # 填充二级缓存 (物理列缓存)
                    upstream_cols = f_data.get("upstreamColumns") or []
                    if upstream_cols:
                        first_col = upstream_cols[0]
                        col_name = first_col.get("name")
                        table_info = first_col.get("table")
                        if table_info:
                            table_name = table_info.get("name")
                            if table_name and col_name:
                                physical_column_cache[(table_name, col_name)] = f_data["id"]
                                
                    # 填充三级缓存 (计算字段缓存) - 发布式也可能被后续嵌入式引用
                    if f_data.get("isCalculated") or f_data.get("__typename") == "CalculatedField":
                        formula = f_data.get("formula") or ""
                        norm_formula = "".join(formula.split()).lower()
                        if norm_formula and name:
                            import hashlib
                            f_hash = hashlib.md5(norm_formula.encode('utf-8')).hexdigest()
                            
                            # 发布数据源的字段，root_entity_id 就是 ds_id
                            calc_field_cache[(ds_id, name, f_hash)] = f_data["id"]
                            
                            if f_data.get("__typename") == "CalculatedField":
                                 calc_count += 1
                    
                    count += 1
                    if count % 1000 == 0:
                        self.session.commit()
            
            # --- 第二阶段：处理嵌入式字段 (不去重，全部保存) ---
            # 去重逻辑移至四表迁移阶段 (split_fields_table_v5.py)
            for f_data in embedded_fields:
                # 直接保存嵌入式字段，不做任何去重跳过
                wb_id = f_data.get("workbook_id")  # 嵌入式字段数据中应携带 workbook_id
                self._process_single_field(f_data, table_real_ds_map, workbook_id=wb_id)
                current_ids.append(f_data["id"])
                
                # 统计计算字段
                if f_data.get("isCalculated") or f_data.get("__typename") == "CalculatedField":
                    name = f_data.get("name")
                    if name:
                        calc_count += 1
                
                count += 1
                if count % 1000 == 0:
                    self.session.commit()
                
            self.session.commit()
            
            # 清理数据库中已不存在的记录
            self._cleanup_orphaned_records(Field, current_ids)
            
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

    def _process_single_field(self, f_data, table_real_ds_map, workbook_id=None):
        """辅助：处理单个字段的保存逻辑"""
        from backend.models import DBTable, DBColumn

        # 获取/创建 Field 记录
        field = self.session.query(Field).filter_by(id=f_data["id"]).first()
        if not field:
            field = Field(id=f_data["id"])
            self.session.add(field)
        
        field.name = f_data.get("name") or ""
        field.description = f_data.get("description") or ""
        field.workbook_id = workbook_id  # 保存 Workbook ID
        
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
                    # 除非这里是嵌入式字段，且 ds_id 就指向那个嵌入式数据源 (虽然可能在 DB 中找不到 published record)
                    # 此时保留原始 ds_id 可能更好，以便至少知道它属于哪个 "Logical Datasource"
                    # 但为了保持一致性（指向发布的），如果这真的是一个 embedded datasource id 且没有 map 到 published, 
                    # 我们可能应该让它保持为 None 或者指向嵌入式数据源记录(如果我们存了的话)
                    # 目前系统里似乎存了嵌入式数据源，所以我们应该让它指向那里
                    pass
        else:
             # 如果 ds_id 为空，尝试通过 workbook + table 推导 (针对嵌入式且没关联好 DS 的情况)
             # 但这比较复杂，暂且依靠 table_real_ds_map
             if target_table_id in table_real_ds_map:
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

                # 💡 去重检查：如果该字段已在 fields 同步阶段被判定为重复并跳过，则在此不再处理
                if hasattr(self, 'deduplication_map') and cf_data["id"] in self.deduplication_map:
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
                    id=cf_data["id"]
                ).first()
                if not calc_field:
                    calc_field = CalculatedField(id=cf_data["id"])
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
            
            # 获取所有字段信息: (datasource_id, name) -> field_id
            # 修正：加载所有字段（包括嵌入式），避免因过滤导致有效关联被丢弃
            published_fields_map = {} 
            result = self.session.execute(
                select(Field.id, Field.name, Field.datasource_id)
            ).fetchall()
            
            for fid, fname, fdsid in result:
                if fdsid and fname:
                    published_fields_map[(fdsid, fname)] = fid
            
            # ... (中间注释省略)
            
            count = 0
            relinked_count = 0
            skipped = 0
            
            # 缓存有效字段ID集合
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
                    found_new_id = None  # 初始化变量
                    
                    # 策略1: 检查去重映射表 (Deduplication Map) - 最准确
                    # 这是我们在 sync_fields 阶段记录的 "Skipped ID -> Survivor ID"
                    if field_id in self.deduplication_map:
                        final_field_id = self.deduplication_map[field_id]
                        
                        # 再次检查 map 出来的 id 是否有效 (防止链式去重或 survivor 也被删除)
                        if final_field_id in valid_field_ids:
                             relinked_count += 1
                             # 继续执行插入，跳过后续匹配逻辑
                        else:
                             # 映射的目标也无效？尝试策略2
                             pass
                    
                    # 策略2: 尝试智能重连 (Name 匹配) - 仅当策略1未成功时
                    if final_field_id not in valid_field_ids:
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
            # 注意：CalculatedField 是独立表，不再需要 join Field
            calc_fields = self.session.query(CalculatedField).all()
            
            # 构建字段索引 (Name -> ID lookup cache)
            all_fields = self.session.query(Field).all()
            field_map = {} # (datasource_id, name) -> field_id
            global_field_map = {} # name -> field_id (fallback)
            
            for f in all_fields:
                key = (f.datasource_id, f.name)
                field_map[key] = f.id
                global_field_map[f.name] = f.id
            
            for calc in calc_fields:
                formula = calc.formula
                if not formula:
                    continue
                    
                # A. 识别 Metric
                # 规则: 计算字段 且 Role=Measure
                if calc.role == 'measure':
                    metric = Metric(
                        id=calc.id,
                        name=calc.name,
                        description=calc.description,
                        formula=formula,
                        metric_type='Calculated',
                        owner=None # 暂不获取 Owner
                    )
                    self.session.merge(metric)
                
                # B. 解析依赖 (后端持久化)
                refs = re.findall(r'\[(.*?)\]', formula)
                unique_refs = set(refs)
                
                for ref_name in unique_refs:
                    dep_id = None
                    
                    # 1. 尝试同数据源匹配
                    if calc.datasource_id:
                        dep_id = field_map.get((calc.datasource_id, ref_name))
                    
                    # 2. 尝试全局匹配
                    if not dep_id:
                        dep_id = global_field_map.get(ref_name)
                    
                    # 3. 创建依赖记录
                    dependency = FieldDependency(
                        source_field_id=calc.id,
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
            calc_sub = self.session.query(CalculatedField).filter_by(id=field.id).first()
            if not calc_sub:
                calc_sub = CalculatedField(id=field.id)
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

        # 自动执行四表架构迁移与统计更新
        print("-" * 30)
        print("🛠 自动触发 V5 数据迁移与统计...")
        try:
            # 确保当前会话已提交，避免锁竞争
            self.session.commit()
            split_fields_table_v5.main()
        except Exception as e:
            print(f"❌ V5 迁移失败: {e}")
        
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
                    WHERE field_dependencies.source_field_id = calculated_fields.id
                )
            """))

            # 5. 统计指标引用数 (reference_count)
            print("  - 使用 SQL 批量更新指标引用数...")
            self.session.execute(text("""
                UPDATE calculated_fields SET reference_count = (
                    SELECT COUNT(*) FROM field_dependencies 
                    WHERE field_dependencies.dependency_field_id = calculated_fields.id
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
        """预计算所有字段的完整血缘链并存入 field_full_lineage 表
        
        修复版：通过 datasource_to_workbook 推导字段的工作簿关联，
        解决发布数据源字段 workbook_id 为 NULL 导致血缘丢失的问题。
        """
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
            
            # 构建数据源 -> 工作簿的映射 (核心修复)
            ds_workbook_map = {}  # datasource_id -> [workbook_ids]
            result = self.session.execute(text(
                "SELECT datasource_id, workbook_id FROM datasource_to_workbook"
            )).fetchall()
            for ds_id, wb_id in result:
                if ds_id not in ds_workbook_map:
                    ds_workbook_map[ds_id] = []
                ds_workbook_map[ds_id].append(wb_id)
            
            # 遍历所有字段
            fields = self.session.query(Field).all()
            lineage_records = []
            
            for f in fields:
                # 确定所有关联的工作簿 (核心修复逻辑)
                workbook_ids = set()
                if f.workbook_id:
                    workbook_ids.add(f.workbook_id)
                # 通过数据源推导工作簿
                if f.datasource_id and f.datasource_id in ds_workbook_map:
                    for wb_id in ds_workbook_map[f.datasource_id]:
                        workbook_ids.add(wb_id)
                # 如果没有任何工作簿，仍记录一条 (workbook_id=None)
                if not workbook_ids:
                    workbook_ids.add(None)
                
                if not f.is_calculated:
                    # 原始字段: 直接血缘
                    table_ids = []
                    if f.table_id:
                         # 修正：即使是原始字段，也要验证 table_id 是否有效（存在于 DBTable）
                         # 避免野指针
                         # 但考虑到性能，这里假设 DB 约束或 sync 逻辑保证了 table_id 有效，或者左连接查询时自然过滤
                         table_ids = [f.table_id]
                    elif f.datasource_id and f.datasource_id in ds_table_map:
                        table_ids = ds_table_map[f.datasource_id]
                    
                    if table_ids:
                        for tbl_id in table_ids:
                            for wb_id in workbook_ids:
                                lineage_records.append({
                                    'field_id': f.id,
                                    'table_id': tbl_id,
                                    'datasource_id': f.datasource_id,
                                    'workbook_id': wb_id,
                                    'lineage_type': 'direct',
                                    'lineage_path': 'Field -> DS -> Table'
                                })
                    else:
                        # 无物理表关联
                        for wb_id in workbook_ids:
                            lineage_records.append({
                                'field_id': f.id,
                                'table_id': None,
                                'datasource_id': f.datasource_id,
                                'workbook_id': wb_id,
                                'lineage_type': 'direct',
                                'lineage_path': 'Field -> DS (no table)'
                            })
                else:
                    # 计算字段: 间接血缘
                    table_ids = []
                    # 1. 优先使用字段自身的 table_id (如果在 sync_fields 中已修复)
                    if f.table_id:
                        table_ids = [f.table_id]
                    # 2. 其次使用数据源关联的表
                    elif f.datasource_id and f.datasource_id in ds_table_map:
                        table_ids = ds_table_map[f.datasource_id]
                    
                    if table_ids:
                        for tbl_id in table_ids:
                            for wb_id in workbook_ids:
                                lineage_records.append({
                                    'field_id': f.id,
                                    'table_id': tbl_id,
                                    'datasource_id': f.datasource_id,
                                    'workbook_id': wb_id,
                                    'lineage_type': 'indirect',
                                    'lineage_path': 'CalcField -> DS -> Table'
                                })
                    else:
                        for wb_id in workbook_ids:
                            lineage_records.append({
                                'field_id': f.id,
                                'table_id': None,
                                'datasource_id': f.datasource_id,
                                'workbook_id': wb_id,
                                'lineage_type': 'indirect',
                                'lineage_path': 'CalcField -> DS (no table)'
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
