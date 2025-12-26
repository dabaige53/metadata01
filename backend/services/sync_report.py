"""
同步报告生成模块
在每次 Tableau 元数据同步完成后生成详细的统计报告
"""
import os
import json
from datetime import datetime
from sqlalchemy import text


class SyncReportGenerator:
    """同步报告生成器"""
    
    def __init__(self, session, sync_stats: dict = None):
        """
        Args:
            session: 数据库会话
            sync_stats: 同步过程中收集的统计信息
        """
        self.session = session
        self.sync_stats = sync_stats or {}
        self.report_data = {}
        
    def generate_report(self, output_dir: str = None) -> dict:
        """生成完整的同步报告"""
        self.report_data = {
            "report_time": datetime.now().isoformat(),
            "sync_summary": self._get_sync_summary(),
            "module_stats": self._get_module_stats(),
            "module_lineage_details": self._get_module_lineage_details(),  # 新增：各模块血缘详情
            "lineage_stats": self._get_lineage_stats(),
            "label_distribution": self._get_label_distribution(),
            "type_distribution": self._get_type_distribution(),  # 新增：类型分布
            "coverage_stats": self._get_coverage_stats(),  # 新增：覆盖率统计
            "hot_assets": self._get_hot_assets(),  # 新增：热门资产
            "project_distribution": self._get_project_distribution(),  # 新增：项目分布
            "deduplication_stats": self._get_deduplication_stats(),
            "dedup_top_duplicates": self._get_top_duplicates(),  # 新增：重复最多的字段
            "unestablished_lineage": self._get_unestablished_lineage(),
        }
        
        # 输出报告
        if output_dir:
            self._save_report(output_dir)
            self._print_report()
            
        return self.report_data
    
    def _get_sync_summary(self) -> dict:
        """获取同步概要"""
        return {
            "start_time": self.sync_stats.get("start_time"),
            "end_time": self.sync_stats.get("end_time"),
            "duration_seconds": self.sync_stats.get("duration"),
            "status": self.sync_stats.get("status", "completed")
        }
    
    def _get_module_stats(self) -> dict:
        """获取各模块同步统计"""
        result = {}
        
        # 从数据库直接统计
        queries = {
            "users": "SELECT COUNT(*) FROM tableau_users",
            "projects": "SELECT COUNT(*) FROM projects",
            "databases": "SELECT COUNT(*) FROM databases",
            "tables": "SELECT COUNT(*) FROM tables",
            "datasources": "SELECT COUNT(*) FROM datasources",
            "workbooks": "SELECT COUNT(*) FROM workbooks",
            "views": "SELECT COUNT(*) FROM views",
            "fields": "SELECT COUNT(*) FROM fields",
            "calculated_fields": "SELECT COUNT(*) FROM calculated_fields",
            "regular_fields": "SELECT COUNT(*) FROM regular_fields",
            "unique_regular_fields": "SELECT COUNT(*) FROM unique_regular_fields",
            "unique_calculated_fields": "SELECT COUNT(*) FROM unique_calculated_fields",
        }
        
        for module_name, sql in queries.items():
            try:
                count = self.session.execute(text(sql)).scalar() or 0
                result[module_name] = {"count": count}
            except Exception as e:
                result[module_name] = {"count": 0, "error": str(e)}
        
        # 从 sync_stats 补充同步增量信息
        for key in ["user_count", "project_count", "db_count", "table_count", 
                    "ds_count", "wb_count", "field_count", "calc_count", "ftv_count"]:
            if key in self.sync_stats:
                module_name = key.replace("_count", "")
                if module_name in result:
                    result[module_name]["synced"] = self.sync_stats[key]
                    
        return result
    
    def _get_lineage_stats(self) -> dict:
        """获取血缘建立统计"""
        result = {}
        
        # 关联表统计
        association_queries = {
            "table_to_datasource": {
                "count": "SELECT COUNT(*) FROM table_to_datasource",
                "by_source": "SELECT lineage_source, COUNT(*) as cnt FROM table_to_datasource GROUP BY lineage_source"
            },
            "datasource_to_workbook": {
                "count": "SELECT COUNT(*) FROM datasource_to_workbook",
                "by_source": "SELECT lineage_source, COUNT(*) as cnt FROM datasource_to_workbook GROUP BY lineage_source"
            },
            "field_to_view": {
                "count": "SELECT COUNT(*) FROM field_to_view",
                "by_source": "SELECT lineage_source, COUNT(*) as cnt FROM field_to_view GROUP BY lineage_source"
            },
            "dashboard_to_sheet": {
                "count": "SELECT COUNT(*) FROM dashboard_to_sheet",
                "by_source": "SELECT lineage_source, COUNT(*) as cnt FROM dashboard_to_sheet GROUP BY lineage_source"
            },
            "field_dependencies": {
                "count": "SELECT COUNT(*) FROM field_dependencies",
            },
            "calc_field_dependencies": {
                "count": "SELECT COUNT(*) FROM calc_field_dependencies",
            },
            "field_full_lineage": {
                "count": "SELECT COUNT(*) FROM field_full_lineage",
            },
            "regular_field_full_lineage": {
                "count": "SELECT COUNT(*) FROM regular_field_full_lineage",
            },
            "calc_field_full_lineage": {
                "count": "SELECT COUNT(*) FROM calc_field_full_lineage",
            },
        }
        
        for table_name, queries in association_queries.items():
            try:
                count = self.session.execute(text(queries["count"])).scalar() or 0
                item = {"total": count}
                
                if "by_source" in queries:
                    rows = self.session.execute(text(queries["by_source"])).fetchall()
                    item["by_lineage_source"] = {str(r[0] or "null"): r[1] for r in rows}
                    
                result[table_name] = item
            except Exception as e:
                result[table_name] = {"total": 0, "error": str(e)}
                
        return result
    
    def _get_label_distribution(self) -> dict:
        """获取血缘标签分布"""
        result = {}
        
        # fields 表的标签分布
        try:
            fields_source = self.session.execute(text(
                "SELECT lineage_source, COUNT(*) FROM fields GROUP BY lineage_source"
            )).fetchall()
            result["fields_by_source"] = {str(r[0] or "null"): r[1] for r in fields_source}
            
            fields_penetration = self.session.execute(text(
                "SELECT penetration_status, COUNT(*) FROM fields GROUP BY penetration_status"
            )).fetchall()
            result["fields_by_penetration"] = {str(r[0] or "null"): r[1] for r in fields_penetration}
        except Exception as e:
            result["fields_error"] = str(e)
            
        # regular_fields 表的标签分布
        try:
            rf_source = self.session.execute(text(
                "SELECT lineage_source, COUNT(*) FROM regular_fields GROUP BY lineage_source"
            )).fetchall()
            result["regular_fields_by_source"] = {str(r[0] or "null"): r[1] for r in rf_source}
            
            rf_penetration = self.session.execute(text(
                "SELECT penetration_status, COUNT(*) FROM regular_fields GROUP BY penetration_status"
            )).fetchall()
            result["regular_fields_by_penetration"] = {str(r[0] or "null"): r[1] for r in rf_penetration}
        except Exception as e:
            result["regular_fields_error"] = str(e)
            
        return result
    
    def _get_deduplication_stats(self) -> dict:
        """获取去重统计"""
        result = {}
        
        try:
            # 原始字段去重统计
            rf_instances = self.session.execute(text(
                "SELECT COUNT(*) FROM regular_fields"
            )).scalar() or 0
            rf_unique = self.session.execute(text(
                "SELECT COUNT(*) FROM unique_regular_fields"
            )).scalar() or 0
            
            result["regular_fields"] = {
                "total_instances": rf_instances,
                "unique_fields": rf_unique,
                "dedup_ratio": round(1 - rf_unique / rf_instances, 4) if rf_instances > 0 else 0,
                "avg_instances_per_field": round(rf_instances / rf_unique, 2) if rf_unique > 0 else 0
            }
            
            # 去重策略分布 (如果有记录的话)
            # 这需要在迁移时记录策略，目前先统计表关联情况
            rf_by_table = self.session.execute(text("""
                SELECT 
                    CASE WHEN urf.table_id IS NOT NULL THEN 'has_table' ELSE 'no_table' END as has_tbl,
                    COUNT(*)
                FROM unique_regular_fields urf
                GROUP BY has_tbl
            """)).fetchall()
            result["regular_fields"]["by_table_association"] = {r[0]: r[1] for r in rf_by_table}
            
        except Exception as e:
            result["regular_fields_error"] = str(e)
            
        try:
            # 计算字段去重统计
            cf_instances = self.session.execute(text(
                "SELECT COUNT(*) FROM calculated_fields"
            )).scalar() or 0
            cf_unique = self.session.execute(text(
                "SELECT COUNT(*) FROM unique_calculated_fields"
            )).scalar() or 0
            
            result["calculated_fields"] = {
                "total_instances": cf_instances,
                "unique_fields": cf_unique,
                "dedup_ratio": round(1 - cf_unique / cf_instances, 4) if cf_instances > 0 else 0,
                "avg_instances_per_field": round(cf_instances / cf_unique, 2) if cf_unique > 0 else 0
            }
            
            # 复杂度分布
            cf_complexity = self.session.execute(text("""
                SELECT 
                    CASE 
                        WHEN complexity_score < 5 THEN 'simple'
                        WHEN complexity_score < 20 THEN 'medium'
                        ELSE 'complex'
                    END as complexity_level,
                    COUNT(*)
                FROM unique_calculated_fields
                GROUP BY complexity_level
            """)).fetchall()
            result["calculated_fields"]["by_complexity"] = {r[0]: r[1] for r in cf_complexity}
            
        except Exception as e:
            result["calculated_fields_error"] = str(e)
            
        return result
    
    def _get_unestablished_lineage(self) -> dict:
        """获取未建立血缘的情况"""
        result = {}
        
        try:
            # 没有关联数据源的字段
            no_ds = self.session.execute(text("""
                SELECT COUNT(*) FROM fields WHERE datasource_id IS NULL
            """)).scalar() or 0
            result["fields_without_datasource"] = no_ds
            
            # 没有关联表的字段
            no_table = self.session.execute(text("""
                SELECT COUNT(*) FROM fields WHERE table_id IS NULL
            """)).scalar() or 0
            result["fields_without_table"] = no_table
            
            # 没有关联工作簿的字段
            no_wb = self.session.execute(text("""
                SELECT COUNT(*) FROM fields WHERE workbook_id IS NULL
            """)).scalar() or 0
            result["fields_without_workbook"] = no_wb
            
            # 没有视图引用的字段
            no_views = self.session.execute(text("""
                SELECT COUNT(*) FROM fields f 
                WHERE NOT EXISTS (SELECT 1 FROM field_to_view ftv WHERE ftv.field_id = f.id)
            """)).scalar() or 0
            result["fields_without_views"] = no_views
            
            # 穿透失败的字段
            penetration_failed = self.session.execute(text("""
                SELECT COUNT(*) FROM fields WHERE penetration_status = 'failed'
            """)).scalar() or 0
            result["penetration_failed"] = penetration_failed
            
            # 没有上游列的字段（ColumnField 应该有）
            no_upstream_col = self.session.execute(text("""
                SELECT COUNT(*) FROM fields 
                WHERE is_calculated = 0 AND upstream_column_id IS NULL
            """)).scalar() or 0
            result["column_fields_without_upstream"] = no_upstream_col
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _get_module_lineage_details(self) -> dict:
        """获取各模块的血缘建立详情"""
        result = {}
        
        try:
            # 数据库血缘统计
            db_stats = self.session.execute(text("""
                SELECT 
                    COUNT(DISTINCT db.id) as db_count,
                    COUNT(DISTINCT t.id) as tables_with_db,
                    (SELECT COUNT(*) FROM tables WHERE database_id IS NULL) as orphan_tables
                FROM databases db
                LEFT JOIN tables t ON t.database_id = db.id
            """)).first()
            result["databases"] = {
                "total": db_stats[0] if db_stats else 0,
                "linked_tables": db_stats[1] if db_stats else 0,
                "orphan_tables": db_stats[2] if db_stats else 0
            }
            
            # 数据表血缘统计
            table_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_embedded = 1 THEN 1 ELSE 0 END) as embedded,
                    SUM(CASE WHEN is_embedded = 0 OR is_embedded IS NULL THEN 1 ELSE 0 END) as physical,
                    (SELECT COUNT(DISTINCT table_id) FROM table_to_datasource) as linked_to_ds
                FROM tables
            """)).first()
            result["tables"] = {
                "total": table_stats[0] if table_stats else 0,
                "embedded": table_stats[1] if table_stats else 0,
                "physical": table_stats[2] if table_stats else 0,
                "linked_to_datasource": table_stats[3] if table_stats else 0
            }
            
            # 数据源血缘统计
            ds_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_embedded = 1 THEN 1 ELSE 0 END) as embedded,
                    SUM(CASE WHEN is_certified = 1 THEN 1 ELSE 0 END) as certified,
                    (SELECT COUNT(DISTINCT datasource_id) FROM table_to_datasource) as with_tables,
                    (SELECT COUNT(DISTINCT datasource_id) FROM datasource_to_workbook) as with_workbooks,
                    (SELECT COUNT(DISTINCT datasource_id) FROM fields WHERE datasource_id IS NOT NULL) as with_fields
                FROM datasources
            """)).first()
            result["datasources"] = {
                "total": ds_stats[0] if ds_stats else 0,
                "embedded": ds_stats[1] if ds_stats else 0,
                "certified": ds_stats[2] if ds_stats else 0,
                "with_upstream_tables": ds_stats[3] if ds_stats else 0,
                "with_downstream_workbooks": ds_stats[4] if ds_stats else 0,
                "with_fields": ds_stats[5] if ds_stats else 0
            }
            
            # 工作簿血缘统计
            wb_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    (SELECT COUNT(DISTINCT workbook_id) FROM views) as with_views,
                    (SELECT COUNT(DISTINCT workbook_id) FROM datasource_to_workbook) as with_datasources,
                    (SELECT COUNT(DISTINCT workbook_id) FROM fields WHERE workbook_id IS NOT NULL) as with_fields
                FROM workbooks
            """)).first()
            result["workbooks"] = {
                "total": wb_stats[0] if wb_stats else 0,
                "with_views": wb_stats[1] if wb_stats else 0,
                "with_datasources": wb_stats[2] if wb_stats else 0,
                "with_fields": wb_stats[3] if wb_stats else 0
            }
            
            # 视图血缘统计
            view_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN view_type = 'dashboard' THEN 1 ELSE 0 END) as dashboards,
                    SUM(CASE WHEN view_type != 'dashboard' OR view_type IS NULL THEN 1 ELSE 0 END) as sheets,
                    (SELECT COUNT(DISTINCT view_id) FROM field_to_view) as with_fields,
                    (SELECT COUNT(DISTINCT sheet_id) FROM dashboard_to_sheet) as sheets_in_dashboards
                FROM views
            """)).first()
            result["views"] = {
                "total": view_stats[0] if view_stats else 0,
                "dashboards": view_stats[1] if view_stats else 0,
                "sheets": view_stats[2] if view_stats else 0,
                "with_field_references": view_stats[3] if view_stats else 0,
                "sheets_included_in_dashboards": view_stats[4] if view_stats else 0
            }
            
            # 字段血缘统计
            field_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_calculated = 1 THEN 1 ELSE 0 END) as calculated,
                    SUM(CASE WHEN is_calculated = 0 OR is_calculated IS NULL THEN 1 ELSE 0 END) as regular,
                    SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as with_table,
                    SUM(CASE WHEN datasource_id IS NOT NULL THEN 1 ELSE 0 END) as with_datasource,
                    SUM(CASE WHEN workbook_id IS NOT NULL THEN 1 ELSE 0 END) as with_workbook,
                    (SELECT COUNT(DISTINCT field_id) FROM field_to_view) as used_in_views
                FROM fields
            """)).first()
            result["fields"] = {
                "total": field_stats[0] if field_stats else 0,
                "calculated": field_stats[1] if field_stats else 0,
                "regular": field_stats[2] if field_stats else 0,
                "with_table": field_stats[3] if field_stats else 0,
                "with_datasource": field_stats[4] if field_stats else 0,
                "with_workbook": field_stats[5] if field_stats else 0,
                "used_in_views": field_stats[6] if field_stats else 0
            }
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _get_type_distribution(self) -> dict:
        """获取各类型分布"""
        result = {}
        
        try:
            # 字段角色分布 (Dimension vs Measure)
            role_dist = self.session.execute(text("""
                SELECT role, COUNT(*) FROM fields GROUP BY role
            """)).fetchall()
            result["field_roles"] = {str(r[0] or "unknown"): r[1] for r in role_dist}
            
            # 字段数据类型分布
            dtype_dist = self.session.execute(text("""
                SELECT data_type, COUNT(*) FROM fields WHERE data_type IS NOT NULL AND data_type != '' GROUP BY data_type ORDER BY COUNT(*) DESC LIMIT 15
            """)).fetchall()
            result["field_data_types"] = {str(r[0]): r[1] for r in dtype_dist}
            
            # 表类型分布
            table_type_dist = self.session.execute(text("""
                SELECT 
                    CASE WHEN is_embedded = 1 THEN 'embedded' ELSE 'physical' END,
                    COUNT(*)
                FROM tables 
                GROUP BY CASE WHEN is_embedded = 1 THEN 'embedded' ELSE 'physical' END
            """)).fetchall()
            result["table_types"] = {r[0]: r[1] for r in table_type_dist}
            
            # 视图类型分布
            view_type_dist = self.session.execute(text("""
                SELECT view_type, COUNT(*) FROM views GROUP BY view_type
            """)).fetchall()
            result["view_types"] = {str(r[0] or "sheet"): r[1] for r in view_type_dist}
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _get_coverage_stats(self) -> dict:
        """获取覆盖率统计"""
        result = {}
        
        try:
            # 字段描述覆盖率
            desc_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as has_desc
                FROM fields
            """)).first()
            total = desc_stats[0] if desc_stats else 0
            has_desc = desc_stats[1] if desc_stats else 0
            result["field_description"] = {
                "total": total,
                "with_description": has_desc,
                "without_description": total - has_desc,
                "coverage_rate": round(has_desc / total, 4) if total > 0 else 0
            }
            
            # 数据源描述覆盖率
            ds_desc = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END) as has_desc
                FROM datasources
            """)).first()
            ds_total = ds_desc[0] if ds_desc else 0
            ds_has = ds_desc[1] if ds_desc else 0
            result["datasource_description"] = {
                "total": ds_total,
                "with_description": ds_has,
                "coverage_rate": round(ds_has / ds_total, 4) if ds_total > 0 else 0
            }
            
            # 数据源认证覆盖率
            cert_stats = self.session.execute(text("""
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN is_certified = 1 THEN 1 ELSE 0 END) as certified
                FROM datasources WHERE is_embedded = 0 OR is_embedded IS NULL
            """)).first()
            cert_total = cert_stats[0] if cert_stats else 0
            certified = cert_stats[1] if cert_stats else 0
            result["datasource_certification"] = {
                "published_total": cert_total,
                "certified": certified,
                "certification_rate": round(certified / cert_total, 4) if cert_total > 0 else 0
            }
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _get_hot_assets(self) -> dict:
        """获取热门资产"""
        result = {}
        
        try:
            # 热门视图 Top 10
            hot_views = self.session.execute(text("""
                SELECT name, total_view_count, workbook_id
                FROM views
                WHERE total_view_count > 0
                ORDER BY total_view_count DESC
                LIMIT 10
            """)).fetchall()
            result["hot_views"] = [{"name": r[0], "views": r[1], "workbook_id": r[2]} for r in hot_views]
            
            # 高频使用字段 Top 10
            hot_fields = self.session.execute(text("""
                SELECT name, (usage_count + COALESCE(metric_usage_count, 0)) as total_usage, datasource_id
                FROM fields
                WHERE usage_count > 0
                ORDER BY total_usage DESC
                LIMIT 10
            """)).fetchall()
            result["hot_fields"] = [{"name": r[0], "usage": r[1], "datasource_id": r[2]} for r in hot_fields]
            
            # 被引用最多的数据源 Top 10
            hot_ds = self.session.execute(text("""
                SELECT d.name, COUNT(DISTINCT dw.workbook_id) as wb_count, d.id
                FROM datasources d
                LEFT JOIN datasource_to_workbook dw ON d.id = dw.datasource_id
                GROUP BY d.id
                ORDER BY wb_count DESC
                LIMIT 10
            """)).fetchall()
            result["hot_datasources"] = [{"name": r[0], "workbook_count": r[1], "id": r[2]} for r in hot_ds]
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _get_project_distribution(self) -> dict:
        """获取项目分布"""
        result = {}
        
        try:
            # 各项目的资产数量
            project_stats = self.session.execute(text("""
                SELECT 
                    p.name,
                    p.id,
                    (SELECT COUNT(*) FROM datasources WHERE project_name = p.name) as ds_count,
                    (SELECT COUNT(*) FROM workbooks WHERE project_name = p.name) as wb_count
                FROM projects p
                ORDER BY ds_count + wb_count DESC
            """)).fetchall()
            result["by_project"] = [{
                "name": r[0],
                "id": r[1],
                "datasource_count": r[2],
                "workbook_count": r[3],
                "total_assets": r[2] + r[3]
            } for r in project_stats]
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _get_top_duplicates(self) -> dict:
        """获取重复最多的字段"""
        result = {}
        
        try:
            # 实例数最多的标准字段 Top 10
            top_rf = self.session.execute(text("""
                SELECT urf.name, COUNT(rf.id) as instance_count, urf.id
                FROM unique_regular_fields urf
                JOIN regular_fields rf ON rf.unique_id = urf.id
                GROUP BY urf.id
                ORDER BY instance_count DESC
                LIMIT 10
            """)).fetchall()
            result["top_regular_fields"] = [{"name": r[0], "instances": r[1], "id": r[2]} for r in top_rf]
            
            # 实例数最多的标准指标 Top 10
            top_cf = self.session.execute(text("""
                SELECT ucf.name, COUNT(cf.id) as instance_count, ucf.id
                FROM unique_calculated_fields ucf
                JOIN calculated_fields cf ON cf.unique_id = ucf.id
                GROUP BY ucf.id
                ORDER BY instance_count DESC
                LIMIT 10
            """)).fetchall()
            result["top_calculated_fields"] = [{"name": r[0], "instances": r[1], "id": r[2]} for r in top_cf]
            
        except Exception as e:
            result["error"] = str(e)
            
        return result
    
    def _save_report(self, output_dir: str):
        """保存报告到文件"""
        os.makedirs(output_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 保存 JSON 报告
        json_filename = f"sync_report_{timestamp}.json"
        json_filepath = os.path.join(output_dir, json_filename)
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(self.report_data, f, ensure_ascii=False, indent=2)
        
        # 保存最新 JSON 报告副本
        latest_json_path = os.path.join(output_dir, "sync_report_latest.json")
        with open(latest_json_path, 'w', encoding='utf-8') as f:
            json.dump(self.report_data, f, ensure_ascii=False, indent=2)
        
        # 生成并保存 Markdown 文字报告
        md_content = self._generate_markdown_report()
        md_filename = f"sync_report_{timestamp}.md"
        md_filepath = os.path.join(output_dir, md_filename)
        with open(md_filepath, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        # 保存最新 Markdown 报告副本
        latest_md_path = os.path.join(output_dir, "sync_report_latest.md")
        with open(latest_md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
            
        print(f"\n📄 报告已保存:")
        print(f"   JSON: {json_filepath}")
        print(f"   文字: {md_filepath}")
    
    def _generate_markdown_report(self) -> str:
        """生成 Markdown 格式的文字报告"""
        lines = []
        
        # 标题
        summary = self.report_data.get("sync_summary", {})
        lines.append("# Tableau 元数据同步报告")
        lines.append("")
        lines.append(f"**报告生成时间**: {self.report_data.get('report_time', '-')}")
        lines.append(f"**同步状态**: {summary.get('status', 'unknown')}")
        duration = summary.get('duration_seconds')
        lines.append(f"**同步耗时**: {duration:.2f} 秒" if duration else "**同步耗时**: -")
        lines.append("")
        
        # 模块同步统计
        lines.append("---")
        lines.append("## 📦 模块同步统计")
        lines.append("")
        lines.append("| 模块 | 数量 | 说明 |")
        lines.append("|------|------|------|")
        
        ms = self.report_data.get("module_stats", {})
        module_names = {
            "users": "用户",
            "projects": "项目",
            "databases": "数据库",
            "tables": "数据表",
            "datasources": "数据源",
            "workbooks": "工作簿",
            "views": "视图",
            "fields": "字段 (原始)",
            "calculated_fields": "计算字段",
            "regular_fields": "普通字段实例",
            "unique_regular_fields": "标准字段 (去重后)",
            "unique_calculated_fields": "标准指标 (去重后)",
        }
        for module, stats in ms.items():
            name = module_names.get(module, module)
            count = stats.get("count", 0)
            synced = stats.get("synced", "")
            note = f"本次同步: {synced}" if synced else ""
            if stats.get("error"):
                note = f"⚠️ 错误"
            lines.append(f"| {name} | {count:,} | {note} |")
        lines.append("")
        
        # 血缘关联统计
        lines.append("---")
        lines.append("## 🔗 血缘关联统计")
        lines.append("")
        lines.append("### 关联表记录数")
        lines.append("")
        lines.append("| 关联表 | 总记录数 | 标签分布 |")
        lines.append("|--------|----------|----------|")
        
        ls = self.report_data.get("lineage_stats", {})
        table_names = {
            "table_to_datasource": "表→数据源",
            "datasource_to_workbook": "数据源→工作簿",
            "field_to_view": "字段→视图",
            "dashboard_to_sheet": "仪表盘→Sheet",
            "field_dependencies": "字段依赖",
            "calc_field_dependencies": "计算字段依赖",
            "field_full_lineage": "完整血缘链",
            "regular_field_full_lineage": "普通字段血缘",
            "calc_field_full_lineage": "计算字段血缘",
        }
        for table, stats in ls.items():
            name = table_names.get(table, table)
            total = stats.get("total", 0)
            by_source = stats.get("by_lineage_source", {})
            source_str = ", ".join([f"{k}: {v}" for k, v in by_source.items()]) if by_source else "-"
            lines.append(f"| {name} | {total:,} | {source_str} |")
        lines.append("")
        
        # 血缘标签分布
        lines.append("### 血缘标签分布")
        lines.append("")
        ld = self.report_data.get("label_distribution", {})
        
        if "fields_by_source" in ld:
            lines.append("**字段血缘来源 (lineage_source)**:")
            lines.append("")
            for source, count in ld["fields_by_source"].items():
                label = {"api": "🔗 API 直接返回", "derived": "🔄 智能重连推导", "computed": "📊 预计算", "null": "❓ 未标记"}.get(source, source)
                lines.append(f"- {label}: {count:,} 个")
            lines.append("")
            
        if "fields_by_penetration" in ld:
            lines.append("**字段穿透状态 (penetration_status)**:")
            lines.append("")
            for status, count in ld["fields_by_penetration"].items():
                label = {"success": "✅ 穿透成功", "failed": "❌ 穿透失败", "not_applicable": "➖ 无需穿透", "null": "❓ 未标记"}.get(status, status)
                lines.append(f"- {label}: {count:,} 个")
            lines.append("")
        
        # 去重统计
        lines.append("---")
        lines.append("## 📊 字段去重统计")
        lines.append("")
        
        ds = self.report_data.get("deduplication_stats", {})
        
        if "regular_fields" in ds:
            rf = ds["regular_fields"]
            lines.append("### 原始字段去重")
            lines.append("")
            lines.append(f"| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 原始实例数 | {rf.get('total_instances', 0):,} |")
            lines.append(f"| 去重后标准字段数 | {rf.get('unique_fields', 0):,} |")
            lines.append(f"| 去重率 | {rf.get('dedup_ratio', 0):.2%} |")
            lines.append(f"| 平均每个标准字段的实例数 | {rf.get('avg_instances_per_field', 0):.1f} |")
            lines.append("")
            
            if "by_table_association" in rf:
                lines.append("**表关联情况**:")
                for k, v in rf["by_table_association"].items():
                    label = {"has_table": "✅ 有关联表", "no_table": "❌ 无关联表"}.get(k, k)
                    lines.append(f"- {label}: {v:,} 个")
                lines.append("")
        
        if "calculated_fields" in ds:
            cf = ds["calculated_fields"]
            lines.append("### 计算字段去重")
            lines.append("")
            lines.append(f"| 指标 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 原始实例数 | {cf.get('total_instances', 0):,} |")
            lines.append(f"| 去重后标准指标数 | {cf.get('unique_fields', 0):,} |")
            lines.append(f"| 去重率 | {cf.get('dedup_ratio', 0):.2%} |")
            lines.append(f"| 平均每个标准指标的实例数 | {cf.get('avg_instances_per_field', 0):.1f} |")
            lines.append("")
            
            if "by_complexity" in cf:
                lines.append("**复杂度分布**:")
                for k, v in cf["by_complexity"].items():
                    label = {"simple": "🟢 简单 (<5分)", "medium": "🟡 中等 (5-20分)", "complex": "🔴 复杂 (>20分)"}.get(k, k)
                    lines.append(f"- {label}: {v:,} 个")
                lines.append("")
        
        # ========== 新增：各模块血缘详情 ==========
        mld = self.report_data.get("module_lineage_details", {})
        if mld:
            lines.append("---")
            lines.append("## 🔍 各模块血缘建立详情")
            lines.append("")
            
            # 数据库
            if "databases" in mld:
                db = mld["databases"]
                lines.append("### 数据库")
                lines.append(f"- 总数: {db.get('total', 0)}")
                lines.append(f"- 已关联表数: {db.get('linked_tables', 0)}")
                lines.append(f"- 孤立表数: {db.get('orphan_tables', 0)}")
                lines.append("")
            
            # 数据表
            if "tables" in mld:
                tb = mld["tables"]
                lines.append("### 数据表")
                lines.append(f"- 总数: {tb.get('total', 0)}")
                lines.append(f"- 物理表: {tb.get('physical', 0)}")
                lines.append(f"- 嵌入式表: {tb.get('embedded', 0)}")
                lines.append(f"- 已关联数据源: {tb.get('linked_to_datasource', 0)}")
                lines.append("")
            
            # 数据源
            if "datasources" in mld:
                ds = mld["datasources"]
                lines.append("### 数据源")
                lines.append(f"- 总数: {ds.get('total', 0)}")
                lines.append(f"- 嵌入式: {ds.get('embedded', 0)}")
                lines.append(f"- 已认证: {ds.get('certified', 0)}")
                lines.append(f"- 有上游表: {ds.get('with_upstream_tables', 0)}")
                lines.append(f"- 被工作簿引用: {ds.get('with_downstream_workbooks', 0)}")
                lines.append(f"- 包含字段: {ds.get('with_fields', 0)}")
                lines.append("")
            
            # 工作簿
            if "workbooks" in mld:
                wb = mld["workbooks"]
                lines.append("### 工作簿")
                lines.append(f"- 总数: {wb.get('total', 0)}")
                lines.append(f"- 有视图: {wb.get('with_views', 0)}")
                lines.append(f"- 有数据源: {wb.get('with_datasources', 0)}")
                lines.append(f"- 有字段: {wb.get('with_fields', 0)}")
                lines.append("")
            
            # 视图
            if "views" in mld:
                vw = mld["views"]
                lines.append("### 视图")
                lines.append(f"- 总数: {vw.get('total', 0)}")
                lines.append(f"- 仪表盘: {vw.get('dashboards', 0)}")
                lines.append(f"- Sheet: {vw.get('sheets', 0)}")
                lines.append(f"- 有字段引用: {vw.get('with_field_references', 0)}")
                lines.append(f"- Sheet被仪表盘包含: {vw.get('sheets_included_in_dashboards', 0)}")
                lines.append("")
            
            # 字段
            if "fields" in mld:
                fd = mld["fields"]
                lines.append("### 字段")
                lines.append(f"- 总数: {fd.get('total', 0)}")
                lines.append(f"- 计算字段: {fd.get('calculated', 0)}")
                lines.append(f"- 普通字段: {fd.get('regular', 0)}")
                lines.append(f"- 有表关联: {fd.get('with_table', 0)}")
                lines.append(f"- 有数据源关联: {fd.get('with_datasource', 0)}")
                lines.append(f"- 有工作簿关联: {fd.get('with_workbook', 0)}")
                lines.append(f"- 被视图使用: {fd.get('used_in_views', 0)}")
                lines.append("")
        
        # ========== 新增：类型分布 ==========
        td = self.report_data.get("type_distribution", {})
        if td:
            lines.append("---")
            lines.append("## 📈 类型分布")
            lines.append("")
            
            if "field_roles" in td:
                lines.append("### 字段角色分布")
                for role, count in td["field_roles"].items():
                    lines.append(f"- {role}: {count:,}")
                lines.append("")
            
            if "field_data_types" in td:
                lines.append("### 字段数据类型 Top 15")
                for dtype, count in list(td["field_data_types"].items())[:15]:
                    lines.append(f"- {dtype}: {count:,}")
                lines.append("")
            
            if "table_types" in td:
                lines.append("### 数据表类型")
                for ttype, count in td["table_types"].items():
                    label = {"physical": "📋 物理表", "embedded": "📦 嵌入式表"}.get(ttype, ttype)
                    lines.append(f"- {label}: {count:,}")
                lines.append("")
            
            if "view_types" in td:
                lines.append("### 视图类型")
                for vtype, count in td["view_types"].items():
                    label = {"dashboard": "📊 仪表盘", "sheet": "📄 Sheet"}.get(vtype, vtype)
                    lines.append(f"- {label}: {count:,}")
                lines.append("")
        
        # ========== 新增：覆盖率统计 ==========
        cs = self.report_data.get("coverage_stats", {})
        if cs:
            lines.append("---")
            lines.append("## 📝 覆盖率统计")
            lines.append("")
            
            if "field_description" in cs:
                fd = cs["field_description"]
                lines.append("### 字段描述覆盖率")
                lines.append(f"- 总字段数: {fd.get('total', 0):,}")
                lines.append(f"- 有描述: {fd.get('with_description', 0):,}")
                lines.append(f"- 无描述: {fd.get('without_description', 0):,}")
                lines.append(f"- **覆盖率: {fd.get('coverage_rate', 0):.2%}**")
                lines.append("")
            
            if "datasource_description" in cs:
                dd = cs["datasource_description"]
                lines.append("### 数据源描述覆盖率")
                lines.append(f"- 总数据源: {dd.get('total', 0):,}")
                lines.append(f"- 有描述: {dd.get('with_description', 0):,}")
                lines.append(f"- **覆盖率: {dd.get('coverage_rate', 0):.2%}**")
                lines.append("")
            
            if "datasource_certification" in cs:
                dc = cs["datasource_certification"]
                lines.append("### 数据源认证率")
                lines.append(f"- 已发布数据源: {dc.get('published_total', 0):,}")
                lines.append(f"- 已认证: {dc.get('certified', 0):,}")
                lines.append(f"- **认证率: {dc.get('certification_rate', 0):.2%}**")
                lines.append("")
        
        # ========== 新增：热门资产 ==========
        ha = self.report_data.get("hot_assets", {})
        if ha:
            lines.append("---")
            lines.append("## 🔥 热门资产 Top 10")
            lines.append("")
            
            if ha.get("hot_views"):
                lines.append("### 热门视图")
                lines.append("| 排名 | 视图名称 | 访问量 |")
                lines.append("|------|----------|--------|")
                for i, v in enumerate(ha["hot_views"][:10], 1):
                    lines.append(f"| {i} | {v['name']} | {v['views']:,} |")
                lines.append("")
            
            if ha.get("hot_fields"):
                lines.append("### 高频使用字段")
                lines.append("| 排名 | 字段名称 | 使用次数 |")
                lines.append("|------|----------|----------|")
                for i, f in enumerate(ha["hot_fields"][:10], 1):
                    lines.append(f"| {i} | {f['name']} | {f['usage']:,} |")
                lines.append("")
            
            if ha.get("hot_datasources"):
                lines.append("### 被引用最多的数据源")
                lines.append("| 排名 | 数据源名称 | 工作簿引用数 |")
                lines.append("|------|------------|--------------|")
                for i, d in enumerate(ha["hot_datasources"][:10], 1):
                    lines.append(f"| {i} | {d['name']} | {d['workbook_count']:,} |")
                lines.append("")
        
        # ========== 新增：项目分布 ==========
        pd = self.report_data.get("project_distribution", {})
        if pd and pd.get("by_project"):
            lines.append("---")
            lines.append("## 📁 项目资产分布")
            lines.append("")
            lines.append("| 项目 | 数据源 | 工作簿 | 总资产 |")
            lines.append("|------|--------|--------|--------|")
            for p in pd["by_project"]:
                lines.append(f"| {p['name']} | {p['datasource_count']} | {p['workbook_count']} | {p['total_assets']} |")
            lines.append("")
        
        # ========== 新增：重复最多的字段 ==========
        td = self.report_data.get("dedup_top_duplicates", {})
        if td:
            lines.append("---")
            lines.append("## 🔄 重复最多的字段 Top 10")
            lines.append("")
            
            if td.get("top_regular_fields"):
                lines.append("### 原始字段（实例数最多）")
                lines.append("| 排名 | 字段名称 | 实例数 |")
                lines.append("|------|----------|--------|")
                for i, f in enumerate(td["top_regular_fields"][:10], 1):
                    lines.append(f"| {i} | {f['name']} | {f['instances']} |")
                lines.append("")
            
            if td.get("top_calculated_fields"):
                lines.append("### 计算字段（实例数最多）")
                lines.append("| 排名 | 指标名称 | 实例数 |")
                lines.append("|------|----------|--------|")
                for i, f in enumerate(td["top_calculated_fields"][:10], 1):
                    lines.append(f"| {i} | {f['name']} | {f['instances']} |")
                lines.append("")
        
        # 未建立血缘
        lines.append("---")
        lines.append("## ⚠️ 未建立血缘/异常情况")
        lines.append("")
        
        ul = self.report_data.get("unestablished_lineage", {})
        lines.append("| 异常类型 | 数量 | 说明 |")
        lines.append("|----------|------|------|")
        
        issues = [
            ("fields_without_datasource", "无数据源关联", "字段未关联到任何数据源"),
            ("fields_without_table", "无数据表关联", "字段未关联到物理表"),
            ("fields_without_workbook", "无工作簿关联", "字段未关联到工作簿"),
            ("fields_without_views", "无视图引用", "字段未被任何视图使用"),
            ("penetration_failed", "穿透失败", "嵌入式表穿透到物理表失败"),
            ("column_fields_without_upstream", "列字段无上游列", "ColumnField 缺少 upstream_column"),
        ]
        
        for key, name, desc in issues:
            count = ul.get(key, 0)
            if count > 0:
                lines.append(f"| ❌ {name} | {count:,} | {desc} |")
            else:
                lines.append(f"| ✅ {name} | {count} | {desc} |")
        lines.append("")
        
        # 结尾
        lines.append("---")
        lines.append("")
        lines.append("*本报告由 Tableau 元数据同步系统自动生成*")
        
        return "\n".join(lines)
            
    def _print_report(self):
        """打印报告摘要到控制台"""
        print("\n" + "=" * 70)
        print("📊 同步报告摘要")
        print("=" * 70)
        
        # 模块统计
        print("\n【模块同步统计】")
        ms = self.report_data.get("module_stats", {})
        for module, stats in ms.items():
            count = stats.get("count", 0)
            synced = stats.get("synced", "")
            synced_str = f" (本次同步: {synced})" if synced else ""
            print(f"  · {module}: {count}{synced_str}")
            
        # 血缘统计
        print("\n【血缘关联统计】")
        ls = self.report_data.get("lineage_stats", {})
        for table, stats in ls.items():
            total = stats.get("total", 0)
            by_source = stats.get("by_lineage_source", {})
            source_str = ", ".join([f"{k}={v}" for k, v in by_source.items()]) if by_source else ""
            print(f"  · {table}: {total}" + (f" ({source_str})" if source_str else ""))
        
        # 标签分布
        print("\n【血缘标签分布】")
        ld = self.report_data.get("label_distribution", {})
        if "fields_by_source" in ld:
            print(f"  · fields.lineage_source: {ld['fields_by_source']}")
        if "fields_by_penetration" in ld:
            print(f"  · fields.penetration_status: {ld['fields_by_penetration']}")
            
        # 去重统计
        print("\n【去重统计】")
        ds = self.report_data.get("deduplication_stats", {})
        if "regular_fields" in ds:
            rf = ds["regular_fields"]
            print(f"  · 原始字段: {rf.get('total_instances', 0)} 实例 → {rf.get('unique_fields', 0)} 标准字段")
            print(f"    去重率: {rf.get('dedup_ratio', 0):.2%}, 平均实例数: {rf.get('avg_instances_per_field', 0):.1f}")
        if "calculated_fields" in ds:
            cf = ds["calculated_fields"]
            print(f"  · 计算字段: {cf.get('total_instances', 0)} 实例 → {cf.get('unique_fields', 0)} 标准指标")
            print(f"    去重率: {cf.get('dedup_ratio', 0):.2%}, 平均实例数: {cf.get('avg_instances_per_field', 0):.1f}")
            if "by_complexity" in cf:
                print(f"    复杂度分布: {cf['by_complexity']}")
                
        # 未建立血缘
        print("\n【未建立血缘/异常情况】")
        ul = self.report_data.get("unestablished_lineage", {})
        print(f"  · 无数据源关联: {ul.get('fields_without_datasource', 0)}")
        print(f"  · 无数据表关联: {ul.get('fields_without_table', 0)}")
        print(f"  · 无工作簿关联: {ul.get('fields_without_workbook', 0)}")
        print(f"  · 无视图引用: {ul.get('fields_without_views', 0)}")
        print(f"  · 穿透失败: {ul.get('penetration_failed', 0)}")
        print(f"  · 列字段无上游列: {ul.get('column_fields_without_upstream', 0)}")
        
        print("\n" + "=" * 70)

