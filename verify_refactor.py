#!/usr/bin/env python3
"""
重构验证脚本 - 用于对比重构前后数据一致性

使用方法：
    # 重构前：生成基准快照
    python3 verify_refactor.py --snapshot before
    
    # 重构后：对比验证
    python3 verify_refactor.py --compare

输出文件：
    - docs/测试验证/refactor_snapshot_before.json  # 重构前快照
    - docs/测试验证/refactor_snapshot_after.json   # 重构后快照
    - docs/测试验证/refactor_comparison_report.md  # 对比报告
"""

import sqlite3
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# 数据库路径
DB_PATH = "metadata.db"
BACKUP_DB_PATH = "metadata_backup_20241224_before_refactor.db"
OUTPUT_DIR = "docs/测试验证"

# 确保输出目录存在
Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


class RefactorVerifier:
    """重构验证器"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
    
    def close(self):
        self.conn.close()
    
    # ==================== 基础统计 ====================
    
    def get_table_counts(self) -> dict:
        """获取各表记录数"""
        tables = [
            'databases', 'tables', 'db_columns', 'datasources', 
            'workbooks', 'views', 'fields', 'calculated_fields',
            'metrics', 'field_dependencies', 'field_full_lineage'
        ]
        counts = {}
        for table in tables:
            try:
                cur = self.conn.execute(f"SELECT COUNT(*) FROM {table}")
                counts[table] = cur.fetchone()[0]
            except:
                counts[table] = -1  # 表不存在
        return counts
    
    # ==================== 模块一：数据库 ====================
    
    def verify_databases(self) -> dict:
        """验证数据库模块"""
        result = {}
        
        # 1. 数据库总数
        cur = self.conn.execute("SELECT COUNT(*) FROM databases")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 数据库 → 表 关联
        cur = self.conn.execute("""
            SELECT d.id, d.name, COUNT(t.id) as table_count
            FROM databases d
            LEFT JOIN tables t ON d.id = t.database_id
            GROUP BY d.id
            ORDER BY table_count DESC
            LIMIT 10
        """)
        result['top_databases_by_tables'] = [dict(row) for row in cur.fetchall()]
        
        # 3. 无表的数据库数量
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM databases d
            WHERE NOT EXISTS (SELECT 1 FROM tables t WHERE t.database_id = d.id)
        """)
        result['databases_without_tables'] = cur.fetchone()[0]
        
        return result
    
    # ==================== 模块二：数据表 ====================
    
    def verify_tables(self) -> dict:
        """验证数据表模块"""
        result = {}
        
        # 1. 表总数
        cur = self.conn.execute("SELECT COUNT(*) FROM tables")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 按类型分布
        cur = self.conn.execute("""
            SELECT 
                SUM(CASE WHEN is_embedded = 1 THEN 1 ELSE 0 END) as embedded_count,
                SUM(CASE WHEN is_embedded = 0 THEN 1 ELSE 0 END) as physical_count
            FROM tables
        """)
        row = cur.fetchone()
        result['embedded_count'] = row[0] or 0
        result['physical_count'] = row[1] or 0
        
        # 3. 表 → 数据源 关联
        cur = self.conn.execute("""
            SELECT t.id, t.name, COUNT(td.datasource_id) as ds_count
            FROM tables t
            LEFT JOIN table_to_datasource td ON t.id = td.table_id
            GROUP BY t.id
            ORDER BY ds_count DESC
            LIMIT 10
        """)
        result['top_tables_by_datasources'] = [dict(row) for row in cur.fetchall()]
        
        # 4. 表 → 字段 关联
        cur = self.conn.execute("""
            SELECT t.id, t.name, COUNT(f.id) as field_count
            FROM tables t
            LEFT JOIN fields f ON t.id = f.table_id
            GROUP BY t.id
            ORDER BY field_count DESC
            LIMIT 10
        """)
        result['top_tables_by_fields'] = [dict(row) for row in cur.fetchall()]
        
        # 5. 无数据源关联的表
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM tables t
            WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id)
        """)
        result['tables_without_datasources'] = cur.fetchone()[0]
        
        return result
    
    # ==================== 模块三：数据源 ====================
    
    def verify_datasources(self) -> dict:
        """验证数据源模块"""
        result = {}
        
        # 1. 数据源总数
        cur = self.conn.execute("SELECT COUNT(*) FROM datasources")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 按类型分布
        cur = self.conn.execute("""
            SELECT 
                SUM(CASE WHEN is_embedded = 1 THEN 1 ELSE 0 END) as embedded_count,
                SUM(CASE WHEN is_embedded = 0 THEN 1 ELSE 0 END) as published_count
            FROM datasources
        """)
        row = cur.fetchone()
        result['embedded_count'] = row[0] or 0
        result['published_count'] = row[1] or 0
        
        # 3. 穿透型嵌入源数量
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM datasources 
            WHERE is_embedded = 1 AND source_published_datasource_id IS NOT NULL
        """)
        result['penetrating_embedded_count'] = cur.fetchone()[0]
        
        # 4. 数据源 → 表 关联
        cur = self.conn.execute("""
            SELECT ds.id, ds.name, COUNT(td.table_id) as table_count
            FROM datasources ds
            LEFT JOIN table_to_datasource td ON ds.id = td.datasource_id
            GROUP BY ds.id
            ORDER BY table_count DESC
            LIMIT 10
        """)
        result['top_datasources_by_tables'] = [dict(row) for row in cur.fetchall()]
        
        # 5. 数据源 → 工作簿 关联
        cur = self.conn.execute("""
            SELECT ds.id, ds.name, COUNT(dw.workbook_id) as wb_count
            FROM datasources ds
            LEFT JOIN datasource_to_workbook dw ON ds.id = dw.datasource_id
            GROUP BY ds.id
            ORDER BY wb_count DESC
            LIMIT 10
        """)
        result['top_datasources_by_workbooks'] = [dict(row) for row in cur.fetchall()]
        
        # 6. 数据源 → 字段 关联
        cur = self.conn.execute("""
            SELECT ds.id, ds.name, COUNT(f.id) as field_count
            FROM datasources ds
            LEFT JOIN fields f ON ds.id = f.datasource_id
            GROUP BY ds.id
            ORDER BY field_count DESC
            LIMIT 10
        """)
        result['top_datasources_by_fields'] = [dict(row) for row in cur.fetchall()]
        
        return result
    
    # ==================== 模块四：工作簿 ====================
    
    def verify_workbooks(self) -> dict:
        """验证工作簿模块"""
        result = {}
        
        # 1. 工作簿总数
        cur = self.conn.execute("SELECT COUNT(*) FROM workbooks")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 工作簿 → 数据源 关联
        cur = self.conn.execute("""
            SELECT wb.id, wb.name, COUNT(dw.datasource_id) as ds_count
            FROM workbooks wb
            LEFT JOIN datasource_to_workbook dw ON wb.id = dw.workbook_id
            GROUP BY wb.id
            ORDER BY ds_count DESC
            LIMIT 10
        """)
        result['top_workbooks_by_datasources'] = [dict(row) for row in cur.fetchall()]
        
        # 3. 工作簿 → 视图 关联
        cur = self.conn.execute("""
            SELECT wb.id, wb.name, COUNT(v.id) as view_count
            FROM workbooks wb
            LEFT JOIN views v ON wb.id = v.workbook_id
            GROUP BY wb.id
            ORDER BY view_count DESC
            LIMIT 10
        """)
        result['top_workbooks_by_views'] = [dict(row) for row in cur.fetchall()]
        
        # 4. 无数据源关联的工作簿
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM workbooks wb
            WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.workbook_id = wb.id)
        """)
        result['workbooks_without_datasources'] = cur.fetchone()[0]
        
        return result
    
    # ==================== 模块五：视图 ====================
    
    def verify_views(self) -> dict:
        """验证视图模块"""
        result = {}
        
        # 1. 视图总数
        cur = self.conn.execute("SELECT COUNT(*) FROM views")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 按类型分布
        cur = self.conn.execute("""
            SELECT view_type, COUNT(*) as count
            FROM views
            GROUP BY view_type
        """)
        result['by_type'] = {row[0]: row[1] for row in cur.fetchall()}
        
        # 3. 视图 → 字段 关联
        cur = self.conn.execute("""
            SELECT v.id, v.name, COUNT(fv.field_id) as field_count
            FROM views v
            LEFT JOIN field_to_view fv ON v.id = fv.view_id
            GROUP BY v.id
            ORDER BY field_count DESC
            LIMIT 10
        """)
        result['top_views_by_fields'] = [dict(row) for row in cur.fetchall()]
        
        # 4. 无字段关联的视图
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM views v
            WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.view_id = v.id)
        """)
        result['views_without_fields'] = cur.fetchone()[0]
        
        return result
    
    # ==================== 模块六：字段 ====================
    
    def verify_fields(self) -> dict:
        """验证字段模块"""
        result = {}
        
        # 1. 字段总数
        cur = self.conn.execute("SELECT COUNT(*) FROM fields")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 按类型分布
        cur = self.conn.execute("""
            SELECT 
                SUM(CASE WHEN is_calculated = 1 THEN 1 ELSE 0 END) as calculated_count,
                SUM(CASE WHEN is_calculated = 0 THEN 1 ELSE 0 END) as regular_count
            FROM fields
        """)
        row = cur.fetchone()
        result['calculated_count'] = row[0] or 0
        result['regular_count'] = row[1] or 0
        
        # 3. 字段 → 表 关联
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields WHERE table_id IS NOT NULL
        """)
        result['fields_with_table'] = cur.fetchone()[0]
        
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields WHERE table_id IS NULL
        """)
        result['fields_without_table'] = cur.fetchone()[0]
        
        # 4. 字段 → 数据源 关联
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields WHERE datasource_id IS NOT NULL
        """)
        result['fields_with_datasource'] = cur.fetchone()[0]
        
        # 5. 字段 → 工作簿 关联
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields WHERE workbook_id IS NOT NULL
        """)
        result['fields_with_workbook'] = cur.fetchone()[0]
        
        # 6. 字段 → 上游列 关联
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields WHERE upstream_column_id IS NOT NULL
        """)
        result['fields_with_upstream_column'] = cur.fetchone()[0]
        
        # 7. 字段 → 视图 关联统计
        cur = self.conn.execute("""
            SELECT f.id, f.name, COUNT(fv.view_id) as view_count
            FROM fields f
            LEFT JOIN field_to_view fv ON f.id = fv.field_id
            GROUP BY f.id
            ORDER BY view_count DESC
            LIMIT 10
        """)
        result['top_fields_by_views'] = [dict(row) for row in cur.fetchall()]
        
        # 8. 字段重复检测（按名称+公式）
        cur = self.conn.execute("""
            SELECT name, COUNT(*) as count
            FROM fields
            WHERE is_calculated = 1
            GROUP BY name
            HAVING COUNT(*) > 1
            ORDER BY count DESC
            LIMIT 10
        """)
        result['duplicate_calculated_fields'] = [dict(row) for row in cur.fetchall()]
        
        return result
    
    # ==================== 模块七：计算字段 ====================
    
    def verify_calculated_fields(self) -> dict:
        """验证计算字段模块"""
        result = {}
        
        # 1. 计算字段总数
        cur = self.conn.execute("SELECT COUNT(*) FROM calculated_fields")
        result['total_count'] = cur.fetchone()[0]
        
        # 2. 有重复的计算字段
        try:
            cur = self.conn.execute("""
                SELECT COUNT(*) FROM calculated_fields WHERE has_duplicates = 1
            """)
            result['with_duplicates'] = cur.fetchone()[0]
        except:
            result['with_duplicates'] = -1
        
        # 3. 依赖字段统计
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM field_dependencies
        """)
        result['total_dependencies'] = cur.fetchone()[0]
        
        return result
    
    # ==================== 模块八：血缘完整性 ====================
    
    def verify_lineage_integrity(self) -> dict:
        """验证血缘完整性"""
        result = {}
        
        # 1. field_full_lineage 记录数
        try:
            cur = self.conn.execute("SELECT COUNT(*) FROM field_full_lineage")
            result['full_lineage_count'] = cur.fetchone()[0]
        except:
            result['full_lineage_count'] = -1
        
        # 2. 字段 → 表 → 数据库 完整链路
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields f
            JOIN tables t ON f.table_id = t.id
            JOIN databases db ON t.database_id = db.id
        """)
        result['complete_field_to_db_chain'] = cur.fetchone()[0]
        
        # 3. 字段 → 数据源 → 工作簿 完整链路
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT f.id) FROM fields f
            JOIN datasources ds ON f.datasource_id = ds.id
            JOIN datasource_to_workbook dw ON ds.id = dw.datasource_id
            JOIN workbooks wb ON dw.workbook_id = wb.id
        """)
        result['complete_field_to_wb_chain'] = cur.fetchone()[0]
        
        # 4. 断链字段数（无表关联）
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields 
            WHERE table_id IS NULL AND is_calculated = 0
        """)
        result['broken_lineage_regular_fields'] = cur.fetchone()[0]
        
        return result
    
    # ==================== 关联表统计 ====================
    
    def verify_relation_tables(self) -> dict:
        """验证关联表"""
        result = {}
        
        # 1. table_to_datasource
        cur = self.conn.execute("SELECT COUNT(*) FROM table_to_datasource")
        result['table_to_datasource_count'] = cur.fetchone()[0]
        
        # 2. datasource_to_workbook
        cur = self.conn.execute("SELECT COUNT(*) FROM datasource_to_workbook")
        result['datasource_to_workbook_count'] = cur.fetchone()[0]
        
        # 3. field_to_view
        cur = self.conn.execute("SELECT COUNT(*) FROM field_to_view")
        result['field_to_view_count'] = cur.fetchone()[0]
        
        # 4. dashboard_to_sheet
        try:
            cur = self.conn.execute("SELECT COUNT(*) FROM dashboard_to_sheet")
            result['dashboard_to_sheet_count'] = cur.fetchone()[0]
        except:
            result['dashboard_to_sheet_count'] = -1
        
        return result
    
    # ==================== 血缘正确性验证（完整矩阵） ====================
    
    # ---------- 1. 数据库相关 ----------
    
    def verify_database_to_table(self) -> dict:
        """数据库 → 表 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT db.id, db.name, db.connection_type, 
                   COUNT(t.id) as table_count,
                   GROUP_CONCAT(t.name, ', ') as table_names
            FROM databases db
            LEFT JOIN tables t ON db.id = t.database_id
            GROUP BY db.id
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        result['stats']['total_databases'] = len(result['samples'])
        result['stats']['databases_with_tables'] = sum(1 for r in result['samples'] if r['table_count'] > 0)
        return result
    
    # ---------- 2. 表相关 ----------
    
    def verify_table_to_column(self) -> dict:
        """表 → 列 血缘"""
        result = {'samples': [], 'issues': []}
        cur = self.conn.execute("""
            SELECT t.id, t.name, t.is_embedded, COUNT(c.id) as column_count
            FROM tables t
            LEFT JOIN db_columns c ON t.id = c.table_id
            GROUP BY t.id
            ORDER BY column_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        # 无列的非嵌入表
        cur = self.conn.execute("""
            SELECT t.id, t.name FROM tables t
            WHERE t.is_embedded = 0
            AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.table_id = t.id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_table_to_datasource(self) -> dict:
        """表 → 数据源 血缘（table_to_datasource）"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT t.id, t.name, t.is_embedded,
                   COUNT(td.datasource_id) as ds_count,
                   GROUP_CONCAT(ds.name, ', ') as ds_names
            FROM tables t
            LEFT JOIN table_to_datasource td ON t.id = td.table_id
            LEFT JOIN datasources ds ON td.datasource_id = ds.id
            GROUP BY t.id
            ORDER BY ds_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(*) FROM table_to_datasource")
        result['stats']['total_relations'] = cur.fetchone()[0]
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT table_id) FROM table_to_datasource
        """)
        result['stats']['tables_with_datasource'] = cur.fetchone()[0]
        return result
    
    def verify_table_to_field(self) -> dict:
        """表 → 字段 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT t.id, t.name, t.is_embedded,
                   COUNT(f.id) as field_count
            FROM tables t
            LEFT JOIN fields f ON t.id = f.table_id
            GROUP BY t.id
            ORDER BY field_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(DISTINCT table_id) FROM fields WHERE table_id IS NOT NULL")
        result['stats']['tables_with_fields'] = cur.fetchone()[0]
        return result
    
    def verify_embedded_table_penetration(self) -> dict:
        """嵌入式表 → 物理表 穿透"""
        result = {'samples': [], 'stats': {}}
        # 嵌入式表统计
        cur = self.conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN database_id IS NOT NULL THEN 1 ELSE 0 END) as with_db
            FROM tables WHERE is_embedded = 1
        """)
        row = cur.fetchone()
        result['stats']['embedded_tables'] = row[0]
        result['stats']['embedded_with_database'] = row[1]
        # 抽样
        cur = self.conn.execute("""
            SELECT t.id, t.name, t.database_id, db.name as database_name
            FROM tables t
            LEFT JOIN databases db ON t.database_id = db.id
            WHERE t.is_embedded = 1
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        return result
    
    # ---------- 3. 数据源相关 ----------
    
    def verify_datasource_to_table(self) -> dict:
        """数据源 → 表 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT ds.id, ds.name, ds.is_embedded,
                   COUNT(td.table_id) as table_count,
                   GROUP_CONCAT(t.name, ', ') as table_names
            FROM datasources ds
            LEFT JOIN table_to_datasource td ON ds.id = td.datasource_id
            LEFT JOIN tables t ON td.table_id = t.id
            GROUP BY ds.id
            ORDER BY table_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM datasources ds
            WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.datasource_id = ds.id)
        """)
        result['stats']['datasources_without_tables'] = cur.fetchone()[0]
        return result
    
    def verify_datasource_to_workbook(self) -> dict:
        """数据源 → 工作簿 血缘（datasource_to_workbook）"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT ds.id, ds.name, ds.is_embedded,
                   COUNT(dw.workbook_id) as wb_count,
                   GROUP_CONCAT(wb.name, ', ') as wb_names
            FROM datasources ds
            LEFT JOIN datasource_to_workbook dw ON ds.id = dw.datasource_id
            LEFT JOIN workbooks wb ON dw.workbook_id = wb.id
            GROUP BY ds.id
            ORDER BY wb_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(*) FROM datasource_to_workbook")
        result['stats']['total_relations'] = cur.fetchone()[0]
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM datasources ds
            WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = ds.id)
        """)
        result['stats']['datasources_without_workbook'] = cur.fetchone()[0]
        return result
    
    def verify_datasource_to_field(self) -> dict:
        """数据源 → 字段 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT ds.id, ds.name, ds.is_embedded,
                   COUNT(f.id) as field_count,
                   SUM(CASE WHEN f.is_calculated = 1 THEN 1 ELSE 0 END) as calc_count
            FROM datasources ds
            LEFT JOIN fields f ON ds.id = f.datasource_id
            GROUP BY ds.id
            ORDER BY field_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(DISTINCT datasource_id) FROM fields WHERE datasource_id IS NOT NULL")
        result['stats']['datasources_with_fields'] = cur.fetchone()[0]
        return result
    
    def verify_embedded_datasource_penetration(self) -> dict:
        """嵌入式数据源 → 发布数据源 穿透"""
        result = {'samples': [], 'stats': {}}
        # 穿透型统计
        cur = self.conn.execute("""
            SELECT 
                COUNT(*) as total_embedded,
                SUM(CASE WHEN source_published_datasource_id IS NOT NULL THEN 1 ELSE 0 END) as penetrating,
                SUM(CASE WHEN source_published_datasource_id IS NULL THEN 1 ELSE 0 END) as standalone
            FROM datasources WHERE is_embedded = 1
        """)
        row = cur.fetchone()
        result['stats']['total_embedded'] = row[0]
        result['stats']['penetrating_count'] = row[1]
        result['stats']['standalone_count'] = row[2]
        # 穿透样本
        cur = self.conn.execute("""
            SELECT eds.id, eds.name as embedded_name,
                   pds.id as published_id, pds.name as published_name
            FROM datasources eds
            JOIN datasources pds ON eds.source_published_datasource_id = pds.id
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        # 断链检查
        cur = self.conn.execute("""
            SELECT eds.id, eds.name, eds.source_published_datasource_id
            FROM datasources eds
            WHERE eds.source_published_datasource_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM datasources pds WHERE pds.id = eds.source_published_datasource_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    # ---------- 4. 工作簿相关 ----------
    
    def verify_workbook_to_datasource(self) -> dict:
        """工作簿 → 数据源 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT wb.id, wb.name,
                   COUNT(dw.datasource_id) as ds_count,
                   SUM(CASE WHEN ds.is_embedded = 1 THEN 1 ELSE 0 END) as embedded_ds_count,
                   SUM(CASE WHEN ds.is_embedded = 0 THEN 1 ELSE 0 END) as published_ds_count
            FROM workbooks wb
            LEFT JOIN datasource_to_workbook dw ON wb.id = dw.workbook_id
            LEFT JOIN datasources ds ON dw.datasource_id = ds.id
            GROUP BY wb.id
            ORDER BY ds_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM workbooks wb
            WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.workbook_id = wb.id)
        """)
        result['stats']['orphan_workbooks'] = cur.fetchone()[0]
        return result
    
    def verify_workbook_to_view(self) -> dict:
        """工作簿 → 视图 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT wb.id, wb.name,
                   COUNT(v.id) as view_count,
                   SUM(CASE WHEN v.view_type = 'sheet' THEN 1 ELSE 0 END) as sheet_count,
                   SUM(CASE WHEN v.view_type = 'dashboard' THEN 1 ELSE 0 END) as dashboard_count
            FROM workbooks wb
            LEFT JOIN views v ON wb.id = v.workbook_id
            GROUP BY wb.id
            ORDER BY view_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM workbooks wb
            WHERE NOT EXISTS (SELECT 1 FROM views v WHERE v.workbook_id = wb.id)
        """)
        result['stats']['workbooks_without_views'] = cur.fetchone()[0]
        return result
    
    def verify_workbook_to_table(self) -> dict:
        """工作簿 → 表 血缘（穿透：工作簿→数据源→表）"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT wb.id, wb.name,
                   COUNT(DISTINCT t.id) as table_count,
                   GROUP_CONCAT(t.name, ', ') as table_names
            FROM workbooks wb
            JOIN datasource_to_workbook dw ON wb.id = dw.workbook_id
            JOIN table_to_datasource td ON dw.datasource_id = td.datasource_id
            JOIN tables t ON td.table_id = t.id
            GROUP BY wb.id
            ORDER BY table_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT wb.id) FROM workbooks wb
            JOIN datasource_to_workbook dw ON wb.id = dw.workbook_id
            JOIN table_to_datasource td ON dw.datasource_id = td.datasource_id
        """)
        result['stats']['workbooks_with_tables'] = cur.fetchone()[0]
        return result
    
    def verify_workbook_to_database(self) -> dict:
        """工作簿 → 数据库 血缘（穿透：工作簿→数据源→表→库）"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT wb.id, wb.name,
                   COUNT(DISTINCT db.id) as db_count,
                   GROUP_CONCAT(db.name, ', ') as db_names
            FROM workbooks wb
            JOIN datasource_to_workbook dw ON wb.id = dw.workbook_id
            JOIN table_to_datasource td ON dw.datasource_id = td.datasource_id
            JOIN tables t ON td.table_id = t.id
            JOIN databases db ON t.database_id = db.id
            GROUP BY wb.id
            ORDER BY db_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        return result
    
    # ---------- 5. 视图相关 ----------
    
    def verify_view_to_workbook(self) -> dict:
        """视图 → 工作簿 血缘"""
        result = {'samples': [], 'issues': []}
        cur = self.conn.execute("""
            SELECT v.id, v.name, v.view_type, v.workbook_id, wb.name as workbook_name
            FROM views v
            LEFT JOIN workbooks wb ON v.workbook_id = wb.id
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        # 无工作簿的视图
        cur = self.conn.execute("""
            SELECT v.id, v.name FROM views v
            WHERE v.workbook_id IS NULL
            OR NOT EXISTS (SELECT 1 FROM workbooks wb WHERE wb.id = v.workbook_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_view_to_field(self) -> dict:
        """视图 → 字段 血缘（field_to_view）"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT v.id, v.name, v.view_type,
                   COUNT(fv.field_id) as field_count
            FROM views v
            LEFT JOIN field_to_view fv ON v.id = fv.view_id
            GROUP BY v.id
            ORDER BY field_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(*) FROM field_to_view")
        result['stats']['total_relations'] = cur.fetchone()[0]
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM views v
            WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.view_id = v.id)
        """)
        result['stats']['views_without_fields'] = cur.fetchone()[0]
        # 断链检查
        cur = self.conn.execute("""
            SELECT fv.view_id, fv.field_id FROM field_to_view fv
            WHERE NOT EXISTS (SELECT 1 FROM fields f WHERE f.id = fv.field_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_dashboard_to_sheet(self) -> dict:
        """仪表板 → 图表 血缘（dashboard_to_sheet）"""
        result = {'samples': [], 'stats': {}}
        try:
            cur = self.conn.execute("""
                SELECT d.id as dashboard_id, d.name as dashboard_name,
                       COUNT(ds.sheet_id) as sheet_count
                FROM views d
                LEFT JOIN dashboard_to_sheet ds ON d.id = ds.dashboard_id
                WHERE d.view_type = 'dashboard'
                GROUP BY d.id
                ORDER BY sheet_count DESC
                LIMIT 20
            """)
            result['samples'] = [dict(row) for row in cur.fetchall()]
            cur = self.conn.execute("SELECT COUNT(*) FROM dashboard_to_sheet")
            result['stats']['total_relations'] = cur.fetchone()[0]
        except:
            result['stats']['total_relations'] = -1
        return result
    
    # ---------- 6. 字段相关 ----------
    
    def verify_field_to_table(self) -> dict:
        """字段 → 表 血缘"""
        result = {'samples': [], 'stats': {}, 'issues': []}
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.is_calculated, f.table_id,
                   t.name as table_name, t.is_embedded as table_is_embedded
            FROM fields f
            LEFT JOIN tables t ON f.table_id = t.id
            WHERE f.table_id IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        # 统计
        cur = self.conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as with_table,
                SUM(CASE WHEN table_id IS NULL AND is_calculated = 0 THEN 1 ELSE 0 END) as regular_without_table,
                SUM(CASE WHEN table_id IS NULL AND is_calculated = 1 THEN 1 ELSE 0 END) as calc_without_table
            FROM fields
        """)
        row = cur.fetchone()
        result['stats'] = {
            'total': row[0], 'with_table': row[1],
            'regular_without_table': row[2], 'calc_without_table': row[3]
        }
        # 断链
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.table_id FROM fields f
            WHERE f.table_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM tables t WHERE t.id = f.table_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_field_to_column(self) -> dict:
        """字段 → 列 血缘（upstream_column_id）"""
        result = {'samples': [], 'stats': {}, 'issues': []}
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.upstream_column_id, f.upstream_column_name,
                   c.name as column_name, t.name as table_name
            FROM fields f
            LEFT JOIN db_columns c ON f.upstream_column_id = c.id
            LEFT JOIN tables t ON c.table_id = t.id
            WHERE f.upstream_column_id IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN upstream_column_id IS NOT NULL THEN 1 ELSE 0 END) as with_column
            FROM fields WHERE is_calculated = 0
        """)
        row = cur.fetchone()
        result['stats'] = {'total_regular': row[0], 'with_column': row[1]}
        # 断链
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.upstream_column_id FROM fields f
            WHERE f.upstream_column_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.id = f.upstream_column_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_field_to_datasource(self) -> dict:
        """字段 → 数据源 血缘"""
        result = {'samples': [], 'stats': {}, 'issues': []}
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.datasource_id,
                   ds.name as datasource_name, ds.is_embedded
            FROM fields f
            LEFT JOIN datasources ds ON f.datasource_id = ds.id
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN datasource_id IS NOT NULL THEN 1 ELSE 0 END) as with_ds
            FROM fields
        """)
        row = cur.fetchone()
        result['stats'] = {'total': row[0], 'with_datasource': row[1]}
        # 断链
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.datasource_id FROM fields f
            WHERE f.datasource_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM datasources ds WHERE ds.id = f.datasource_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_field_to_workbook(self) -> dict:
        """字段 → 工作簿 血缘（直接 + 穿透）"""
        result = {'samples': [], 'stats': {}}
        # 直接关联
        cur = self.conn.execute("""
            SELECT COUNT(*) as with_direct_wb FROM fields WHERE workbook_id IS NOT NULL
        """)
        result['stats']['direct_workbook'] = cur.fetchone()[0]
        # 穿透关联（字段→数据源→工作簿）
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT f.id) FROM fields f
            JOIN datasource_to_workbook dw ON f.datasource_id = dw.datasource_id
        """)
        result['stats']['via_datasource'] = cur.fetchone()[0]
        # 抽样
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.workbook_id, wb.name as direct_wb,
                   ds.name as datasource_name
            FROM fields f
            LEFT JOIN workbooks wb ON f.workbook_id = wb.id
            LEFT JOIN datasources ds ON f.datasource_id = ds.id
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        return result
    
    def verify_field_to_view(self) -> dict:
        """字段 → 视图 血缘"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT f.id, f.name, COUNT(fv.view_id) as view_count
            FROM fields f
            LEFT JOIN field_to_view fv ON f.id = fv.field_id
            GROUP BY f.id
            ORDER BY view_count DESC
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(DISTINCT field_id) FROM field_to_view")
        result['stats']['fields_with_views'] = cur.fetchone()[0]
        return result
    
    def verify_field_to_database(self) -> dict:
        """字段 → 数据库 血缘（穿透：字段→表→库）"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT f.id, f.name, t.name as table_name, db.name as database_name
            FROM fields f
            JOIN tables t ON f.table_id = t.id
            JOIN databases db ON t.database_id = db.id
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT f.id) FROM fields f
            JOIN tables t ON f.table_id = t.id
            JOIN databases db ON t.database_id = db.id
        """)
        result['stats']['fields_with_database'] = cur.fetchone()[0]
        return result
    
    # ---------- 7. 计算字段相关 ----------
    
    def verify_calc_field_to_dependency(self) -> dict:
        """计算字段 → 依赖字段 血缘"""
        result = {'samples': [], 'stats': {}, 'issues': []}
        cur = self.conn.execute("""
            SELECT fd.source_field_id, sf.name as source_name,
                   fd.dependency_field_id, fd.dependency_name,
                   df.name as resolved_name, df.table_id
            FROM field_dependencies fd
            JOIN fields sf ON fd.source_field_id = sf.id
            LEFT JOIN fields df ON fd.dependency_field_id = df.id
            ORDER BY RANDOM()
            LIMIT 30
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("SELECT COUNT(*) FROM field_dependencies")
        result['stats']['total_dependencies'] = cur.fetchone()[0]
        cur = self.conn.execute("SELECT COUNT(DISTINCT source_field_id) FROM field_dependencies")
        result['stats']['calc_fields_with_deps'] = cur.fetchone()[0]
        # 未解析的依赖
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM field_dependencies WHERE dependency_field_id IS NULL
        """)
        result['stats']['unresolved_dependencies'] = cur.fetchone()[0]
        # 断链
        cur = self.conn.execute("""
            SELECT fd.source_field_id, fd.dependency_field_id FROM field_dependencies fd
            WHERE fd.dependency_field_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM fields f WHERE f.id = fd.dependency_field_id)
        """)
        result['issues'] = [dict(row) for row in cur.fetchall()]
        result['broken_count'] = len(result['issues'])
        return result
    
    def verify_calc_field_to_table(self) -> dict:
        """计算字段 → 物理表 血缘（递归追溯）"""
        result = {'samples': [], 'stats': {}}
        # 有直接表关联的计算字段
        cur = self.conn.execute("""
            SELECT f.id, f.name, f.formula, f.table_id, t.name as table_name
            FROM fields f
            LEFT JOIN tables t ON f.table_id = t.id
            WHERE f.is_calculated = 1
            ORDER BY RANDOM()
            LIMIT 20
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT 
                COUNT(*) as total_calc,
                SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as with_table
            FROM fields WHERE is_calculated = 1
        """)
        row = cur.fetchone()
        result['stats'] = {'total_calc': row[0], 'with_table': row[1]}
        return result
    
    # ---------- 8. 完整链路验证 ----------
    
    def verify_full_chain_field_to_db(self) -> dict:
        """完整链路：字段 → 列 → 表 → 库"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT 
                f.id as field_id, f.name as field_name,
                c.id as column_id, c.name as column_name,
                t.id as table_id, t.name as table_name, t.schema,
                db.id as database_id, db.name as database_name
            FROM fields f
            JOIN db_columns c ON f.upstream_column_id = c.id
            JOIN tables t ON c.table_id = t.id
            JOIN databases db ON t.database_id = db.id
            ORDER BY RANDOM()
            LIMIT 30
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(*) FROM fields f
            JOIN db_columns c ON f.upstream_column_id = c.id
            JOIN tables t ON c.table_id = t.id
            JOIN databases db ON t.database_id = db.id
        """)
        result['stats']['complete_chain_count'] = cur.fetchone()[0]
        return result
    
    def verify_full_chain_field_to_wb(self) -> dict:
        """完整链路：字段 → 数据源 → 工作簿"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT 
                f.id as field_id, f.name as field_name,
                ds.id as datasource_id, ds.name as datasource_name,
                wb.id as workbook_id, wb.name as workbook_name
            FROM fields f
            JOIN datasources ds ON f.datasource_id = ds.id
            JOIN datasource_to_workbook dw ON ds.id = dw.datasource_id
            JOIN workbooks wb ON dw.workbook_id = wb.id
            ORDER BY RANDOM()
            LIMIT 30
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT f.id) FROM fields f
            JOIN datasource_to_workbook dw ON f.datasource_id = dw.datasource_id
        """)
        result['stats']['via_datasource_count'] = cur.fetchone()[0]
        return result
    
    def verify_full_chain_view_to_db(self) -> dict:
        """完整链路：视图 → 字段 → 表 → 库"""
        result = {'samples': [], 'stats': {}}
        cur = self.conn.execute("""
            SELECT 
                v.id as view_id, v.name as view_name,
                f.id as field_id, f.name as field_name,
                t.id as table_id, t.name as table_name,
                db.name as database_name
            FROM views v
            JOIN field_to_view fv ON v.id = fv.view_id
            JOIN fields f ON fv.field_id = f.id
            JOIN tables t ON f.table_id = t.id
            JOIN databases db ON t.database_id = db.id
            ORDER BY RANDOM()
            LIMIT 30
        """)
        result['samples'] = [dict(row) for row in cur.fetchall()]
        cur = self.conn.execute("""
            SELECT COUNT(DISTINCT v.id) FROM views v
            JOIN field_to_view fv ON v.id = fv.view_id
            JOIN fields f ON fv.field_id = f.id
            JOIN tables t ON f.table_id = t.id
        """)
        result['stats']['views_with_table_lineage'] = cur.fetchone()[0]
        return result
    
    # ==================== 生成完整快照 ====================
    
    def generate_snapshot(self) -> dict:
        """生成完整验证快照"""
        return {
            'generated_at': datetime.now().isoformat(),
            'db_path': self.db_path,
            
            # 基础统计
            'table_counts': self.get_table_counts(),
            'databases': self.verify_databases(),
            'tables': self.verify_tables(),
            'datasources': self.verify_datasources(),
            'workbooks': self.verify_workbooks(),
            'views': self.verify_views(),
            'fields': self.verify_fields(),
            'calculated_fields': self.verify_calculated_fields(),
            'lineage_integrity': self.verify_lineage_integrity(),
            'relation_tables': self.verify_relation_tables(),
            
            # ========== 完整血缘验证矩阵 ==========
            
            # 1. 数据库相关
            'db_to_table': self.verify_database_to_table(),
            
            # 2. 表相关
            'table_to_column': self.verify_table_to_column(),
            'table_to_datasource': self.verify_table_to_datasource(),
            'table_to_field': self.verify_table_to_field(),
            'embedded_table_penetration': self.verify_embedded_table_penetration(),
            
            # 3. 数据源相关
            'datasource_to_table': self.verify_datasource_to_table(),
            'datasource_to_workbook': self.verify_datasource_to_workbook(),
            'datasource_to_field': self.verify_datasource_to_field(),
            'embedded_datasource_penetration': self.verify_embedded_datasource_penetration(),
            
            # 4. 工作簿相关
            'workbook_to_datasource': self.verify_workbook_to_datasource(),
            'workbook_to_view': self.verify_workbook_to_view(),
            'workbook_to_table': self.verify_workbook_to_table(),
            'workbook_to_database': self.verify_workbook_to_database(),
            
            # 5. 视图相关
            'view_to_workbook': self.verify_view_to_workbook(),
            'view_to_field': self.verify_view_to_field(),
            'dashboard_to_sheet': self.verify_dashboard_to_sheet(),
            
            # 6. 字段相关
            'field_to_table': self.verify_field_to_table(),
            'field_to_column': self.verify_field_to_column(),
            'field_to_datasource': self.verify_field_to_datasource(),
            'field_to_workbook': self.verify_field_to_workbook(),
            'field_to_view': self.verify_field_to_view(),
            'field_to_database': self.verify_field_to_database(),
            
            # 7. 计算字段相关
            'calc_field_to_dependency': self.verify_calc_field_to_dependency(),
            'calc_field_to_table': self.verify_calc_field_to_table(),
            
            # 8. 完整链路验证
            'full_chain_field_to_db': self.verify_full_chain_field_to_db(),
            'full_chain_field_to_wb': self.verify_full_chain_field_to_wb(),
            'full_chain_view_to_db': self.verify_full_chain_view_to_db()
        }


def compare_snapshots(before: dict, after: dict) -> dict:
    """对比两个快照"""
    comparison = {
        'before_time': before.get('generated_at'),
        'after_time': after.get('generated_at'),
        'differences': []
    }
    
    def compare_values(path: str, val1, val2):
        if isinstance(val1, dict) and isinstance(val2, dict):
            for key in set(val1.keys()) | set(val2.keys()):
                compare_values(f"{path}.{key}", val1.get(key), val2.get(key))
        elif isinstance(val1, list) and isinstance(val2, list):
            # 只比较长度
            if len(val1) != len(val2):
                comparison['differences'].append({
                    'path': path,
                    'before': f"list[{len(val1)}]",
                    'after': f"list[{len(val2)}]",
                    'change': len(val2) - len(val1)
                })
        elif val1 != val2:
            change = None
            if isinstance(val1, (int, float)) and isinstance(val2, (int, float)):
                change = val2 - val1
            comparison['differences'].append({
                'path': path,
                'before': val1,
                'after': val2,
                'change': change
            })
    
    for key in set(before.keys()) | set(after.keys()):
        if key in ('generated_at', 'db_path'):
            continue
        compare_values(key, before.get(key), after.get(key))
    
    return comparison


def generate_markdown_report(comparison: dict) -> str:
    """生成 Markdown 格式的对比报告"""
    lines = [
        "# 重构验证对比报告",
        "",
        f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"> 重构前快照: {comparison['before_time']}",
        f"> 重构后快照: {comparison['after_time']}",
        "",
        "---",
        "",
        "## 差异汇总",
        "",
        f"共发现 **{len(comparison['differences'])}** 处差异。",
        "",
    ]
    
    if comparison['differences']:
        lines.extend([
            "| 指标路径 | 重构前 | 重构后 | 变化 |",
            "|----------|--------|--------|------|"
        ])
        
        for diff in comparison['differences']:
            change_str = ""
            if diff['change'] is not None:
                if diff['change'] > 0:
                    change_str = f"+{diff['change']}"
                else:
                    change_str = str(diff['change'])
            
            lines.append(
                f"| `{diff['path']}` | {diff['before']} | {diff['after']} | {change_str} |"
            )
    else:
        lines.append("> ✅ 无差异，数据完全一致。")
    
    return "\n".join(lines)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='重构验证工具')
    parser.add_argument('--snapshot', choices=['before', 'after'], 
                        help='生成快照 (before=重构前, after=重构后)')
    parser.add_argument('--compare', action='store_true',
                        help='对比重构前后快照')
    parser.add_argument('--db', default=DB_PATH,
                        help=f'数据库路径 (默认: {DB_PATH})')
    
    args = parser.parse_args()
    
    if args.snapshot:
        print(f"📸 生成 {args.snapshot} 快照...")
        verifier = RefactorVerifier(args.db)
        snapshot = verifier.generate_snapshot()
        verifier.close()
        
        output_path = f"{OUTPUT_DIR}/refactor_snapshot_{args.snapshot}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 快照已保存至: {output_path}")
        
        # 打印摘要
        print("\n📊 快照摘要:")
        for table, count in snapshot['table_counts'].items():
            print(f"   {table}: {count}")
    
    elif args.compare:
        before_path = f"{OUTPUT_DIR}/refactor_snapshot_before.json"
        after_path = f"{OUTPUT_DIR}/refactor_snapshot_after.json"
        
        if not os.path.exists(before_path):
            print(f"❌ 未找到重构前快照: {before_path}")
            print("   请先运行: python3 verify_refactor.py --snapshot before")
            sys.exit(1)
        
        if not os.path.exists(after_path):
            print(f"❌ 未找到重构后快照: {after_path}")
            print("   请先运行: python3 verify_refactor.py --snapshot after")
            sys.exit(1)
        
        with open(before_path, 'r', encoding='utf-8') as f:
            before = json.load(f)
        
        with open(after_path, 'r', encoding='utf-8') as f:
            after = json.load(f)
        
        print("🔍 对比快照...")
        comparison = compare_snapshots(before, after)
        
        # 生成报告
        report = generate_markdown_report(comparison)
        report_path = f"{OUTPUT_DIR}/refactor_comparison_report.md"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"✅ 对比报告已保存至: {report_path}")
        print(f"\n📊 差异数量: {len(comparison['differences'])}")
        
        if comparison['differences']:
            print("\n主要差异:")
            for diff in comparison['differences'][:10]:
                print(f"   {diff['path']}: {diff['before']} → {diff['after']}")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
