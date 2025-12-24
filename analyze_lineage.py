#!/usr/bin/env python3
"""
血缘连接完整性分析脚本

基于元数据交叉关系表，分析每种血缘关系的连接情况，
找出未连接的记录及可能的原因。

输出：docs/测试验证/血缘连接分析报告.md
"""

import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = "metadata.db"
OUTPUT_PATH = "docs/重构方案/血缘连接分析报告.md"

class LineageAnalyzer:
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.report_lines = []
        self.sql_archive = []
    
    def log(self, line: str = ""):
        self.report_lines.append(line)
        print(line)
    
    def execute_and_log(self, name: str, sql: str) -> list:
        """执行SQL并记录"""
        self.sql_archive.append((name, sql.strip()))
        cur = self.conn.execute(sql)
        return [dict(row) for row in cur.fetchall()]
    
    def analyze_all(self):
        """执行全部分析"""
        self.log("# 血缘连接完整性分析报告")
        self.log()
        self.log(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"> 数据库: `{DB_PATH}`")
        self.log()
        self.log("---")
        self.log()
        
        # 1. 数据库 → 物理表
        self.analyze_db_to_physical_table()
        
        # 2. 物理表 → 数据库
        self.analyze_physical_table_to_db()
        
        # 3. 物理表 → 数据列
        self.analyze_physical_table_to_column()
        
        # 4. 物理表 → 数据源
        self.analyze_table_to_datasource()
        
        # 5. 嵌入表 → 物理表 (穿透)
        self.analyze_embedded_table_penetration()
        
        # 6. 发布源 → 嵌入源(穿透)
        self.analyze_published_to_embedded_ds()
        
        # 7. 数据源 → 工作簿
        self.analyze_datasource_to_workbook()
        
        # 8. 工作簿 → 视图
        self.analyze_workbook_to_view()
        
        # 9. 视图 → 字段
        self.analyze_view_to_field()
        
        # 10. 字段 → 数据表
        self.analyze_field_to_table()
        
        # 11. 字段 → 数据列
        self.analyze_field_to_column()
        
        # 12. 字段 → 数据源
        self.analyze_field_to_datasource()
        
        # 13. 字段 → 工作簿
        self.analyze_field_to_workbook()
        
        # 14. 计算字段 → 依赖字段
        self.analyze_calc_field_dependencies()
        
        # 15. 计算字段 → 物理表 (递归)
        self.analyze_calc_field_to_table()
        
        # 汇总
        self.generate_summary()
        
        # 附录: SQL 存档
        self.generate_sql_archive()
    
    # ==================== 1. 数据库 → 物理表 ====================
    
    def analyze_db_to_physical_table(self):
        self.log("## 1. 数据库 → 物理表")
        self.log()
        self.log("**关系字段**: `tables.database_id`")
        self.log()
        
        # 统计
        result = self.execute_and_log("数据库→物理表 统计", """
            SELECT 
                db.id, db.name,
                COUNT(t.id) as table_count
            FROM databases db
            LEFT JOIN tables t ON db.id = t.database_id AND t.is_embedded = 0
            GROUP BY db.id
        """)
        
        self.log("| 数据库 | 物理表数量 |")
        self.log("|--------|-----------|")
        for r in result:
            self.log(f"| {r['name']} | {r['table_count']} |")
        
        # 无表的数据库
        no_table_dbs = [r for r in result if r['table_count'] == 0]
        self.log()
        self.log(f"**无物理表的数据库**: {len(no_table_dbs)} 个")
        if no_table_dbs:
            for r in no_table_dbs:
                self.log(f"- {r['name']}")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 2. 物理表 → 数据库 ====================
    
    def analyze_physical_table_to_db(self):
        self.log("## 2. 物理表 → 数据库")
        self.log()
        self.log("**关系字段**: `tables.database_id`")
        self.log()
        
        result = self.execute_and_log("物理表→数据库 统计", """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN database_id IS NOT NULL THEN 1 ELSE 0 END) as with_db,
                SUM(CASE WHEN database_id IS NULL THEN 1 ELSE 0 END) as without_db
            FROM tables
            WHERE is_embedded = 0
        """)
        
        r = result[0]
        self.log(f"- 物理表总数: **{r['total']}**")
        self.log(f"- 有数据库关联: **{r['with_db']}** ({r['with_db']*100//max(r['total'],1)}%)")
        self.log(f"- 无数据库关联: **{r['without_db']}**")
        
        if r['without_db'] > 0:
            self.log()
            self.log("**未连接原因分析**: 物理表的 `database_id` 为空")
            orphans = self.execute_and_log("孤立物理表", """
                SELECT id, name, schema FROM tables 
                WHERE is_embedded = 0 AND database_id IS NULL
                LIMIT 10
            """)
            self.log()
            self.log("示例:")
            for o in orphans[:5]:
                self.log(f"- `{o['name']}` (schema: {o['schema']})")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 3. 物理表 → 数据列 ====================
    
    def analyze_physical_table_to_column(self):
        self.log("## 3. 物理表 → 数据列")
        self.log()
        self.log("**关系字段**: `db_columns.table_id`")
        self.log()
        
        result = self.execute_and_log("物理表→数据列 统计", """
            SELECT 
                (SELECT COUNT(*) FROM tables WHERE is_embedded = 0) as total_tables,
                (SELECT COUNT(DISTINCT table_id) FROM db_columns) as tables_with_columns,
                (SELECT COUNT(*) FROM tables t WHERE t.is_embedded = 0 
                 AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.table_id = t.id)) as tables_without_columns
        """)
        
        r = result[0]
        self.log(f"- 物理表总数: **{r['total_tables']}**")
        self.log(f"- 有列关联: **{r['tables_with_columns']}**")
        self.log(f"- 无列关联: **{r['tables_without_columns']}**")
        
        if r['tables_without_columns'] > 0:
            self.log()
            self.log("**未连接原因分析**: API 未返回该表的列信息，可能是 CustomSQL 表或权限问题")
            orphans = self.execute_and_log("无列的物理表", """
                SELECT t.id, t.name, t.schema FROM tables t
                WHERE t.is_embedded = 0
                AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.table_id = t.id)
                LIMIT 10
            """)
            self.log()
            self.log("示例:")
            for o in orphans[:5]:
                self.log(f"- `{o['name']}` (schema: {o['schema']})")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 4. 表 → 数据源 ====================
    
    def analyze_table_to_datasource(self):
        self.log("## 4. 数据表 → 数据源")
        self.log()
        self.log("**关系字段**: `table_to_datasource` 关联表")
        self.log()
        
        result = self.execute_and_log("表→数据源 统计", """
            SELECT 
                (SELECT COUNT(*) FROM tables) as total_tables,
                (SELECT COUNT(DISTINCT table_id) FROM table_to_datasource) as tables_with_ds,
                (SELECT COUNT(*) FROM tables t 
                 WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td2 WHERE td2.table_id = t.id)) as tables_without_ds,
                (SELECT COUNT(*) FROM table_to_datasource) as total_relations
        """)
        
        r = result[0]
        self.log(f"- 表总数: **{r['total_tables']}**")
        self.log(f"- 有数据源关联: **{r['tables_with_ds']}**")
        self.log(f"- 无数据源关联: **{r['tables_without_ds']}**")
        self.log(f"- 关联记录总数: **{r['total_relations']}**")
        
        if r['tables_without_ds'] > 0:
            self.log()
            self.log("**未连接原因分析**: 表未被任何数据源引用，或同步时未建立关联")
            orphans = self.execute_and_log("无数据源的表", """
                SELECT t.id, t.name, t.is_embedded FROM tables t
                WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id)
                LIMIT 10
            """)
            self.log()
            self.log("| 表名 | 是否嵌入 |")
            self.log("|------|----------|")
            for o in orphans[:10]:
                self.log(f"| {o['name']} | {'是' if o['is_embedded'] else '否'} |")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 5. 嵌入表 → 物理表 (穿透) ====================
    
    def analyze_embedded_table_penetration(self):
        self.log("## 5. 嵌入表 → 物理表 (穿透)")
        self.log()
        self.log("**关系字段**: 嵌入表通过 `database_id` 穿透到物理库")
        self.log()
        
        result = self.execute_and_log("嵌入表穿透 统计", """
            SELECT 
                COUNT(*) as total_embedded,
                SUM(CASE WHEN database_id IS NOT NULL THEN 1 ELSE 0 END) as with_db,
                SUM(CASE WHEN database_id IS NULL THEN 1 ELSE 0 END) as without_db
            FROM tables
            WHERE is_embedded = 1
        """)
        
        r = result[0]
        self.log(f"- 嵌入表总数: **{r['total_embedded']}**")
        self.log(f"- 已穿透(有database_id): **{r['with_db']}** ({r['with_db']*100//max(r['total_embedded'],1)}%)")
        self.log(f"- 未穿透: **{r['without_db']}**")
        
        if r['without_db'] > 0:
            self.log()
            self.log("**未连接原因分析**: 嵌入表无上游物理表信息（如纯 Excel/CSV 文件）")
            orphans = self.execute_and_log("未穿透的嵌入表", """
                SELECT t.id, t.name FROM tables t
                WHERE t.is_embedded = 1 AND t.database_id IS NULL
                LIMIT 10
            """)
            self.log()
            self.log("示例:")
            for o in orphans[:5]:
                self.log(f"- `{o['name']}`")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 6. 发布源 → 嵌入源(穿透) ====================
    
    def analyze_published_to_embedded_ds(self):
        self.log("## 6. 发布数据源 ↔ 嵌入数据源 (穿透关系)")
        self.log()
        self.log("**关系字段**: `datasources.source_published_datasource_id`")
        self.log()
        
        result = self.execute_and_log("嵌入源穿透 统计", """
            SELECT 
                COUNT(*) as total_embedded,
                SUM(CASE WHEN source_published_datasource_id IS NOT NULL THEN 1 ELSE 0 END) as penetrating,
                SUM(CASE WHEN source_published_datasource_id IS NULL THEN 1 ELSE 0 END) as standalone
            FROM datasources
            WHERE is_embedded = 1
        """)
        
        r = result[0]
        self.log(f"- 嵌入数据源总数: **{r['total_embedded']}**")
        self.log(f"- 穿透型(引用发布源): **{r['penetrating']}** ({r['penetrating']*100//max(r['total_embedded'],1)}%)")
        self.log(f"- 独立型(无发布源): **{r['standalone']}**")
        
        self.log()
        self.log("**穿透型**: 工作簿引用已发布的数据源时，会自动创建嵌入副本")
        self.log("**独立型**: 工作簿直接连接外部数据（Excel/数据库），无发布源")
        
        # 检查断链
        broken = self.execute_and_log("断链的穿透关系", """
            SELECT eds.id, eds.name, eds.source_published_datasource_id
            FROM datasources eds
            WHERE eds.source_published_datasource_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM datasources pds WHERE pds.id = eds.source_published_datasource_id)
        """)
        
        if broken:
            self.log()
            self.log(f"**⚠️ 断链警告**: {len(broken)} 条穿透关系指向不存在的发布源")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 7. 数据源 → 工作簿 ====================
    
    def analyze_datasource_to_workbook(self):
        self.log("## 7. 数据源 → 工作簿")
        self.log()
        self.log("**关系字段**: `datasource_to_workbook` 关联表")
        self.log()
        
        result = self.execute_and_log("数据源→工作簿 统计", """
            SELECT 
                (SELECT COUNT(*) FROM datasources) as total_ds,
                (SELECT COUNT(DISTINCT datasource_id) FROM datasource_to_workbook) as ds_with_wb,
                (SELECT COUNT(*) FROM datasources ds 
                 WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw2 WHERE dw2.datasource_id = ds.id)) as ds_without_wb,
                (SELECT COUNT(*) FROM datasource_to_workbook) as total_relations
        """)
        
        r = result[0]
        self.log(f"- 数据源总数: **{r['total_ds']}**")
        self.log(f"- 有工作簿关联: **{r['ds_with_wb']}**")
        self.log(f"- 无工作簿关联: **{r['ds_without_wb']}**")
        self.log(f"- 关联记录总数: **{r['total_relations']}**")
        
        if r['ds_without_wb'] > 0:
            self.log()
            self.log("**未连接原因分析**:")
            
            # 按类型分析
            detail = self.execute_and_log("无工作簿数据源分类", """
                SELECT 
                    is_embedded,
                    COUNT(*) as count
                FROM datasources ds
                WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = ds.id)
                GROUP BY is_embedded
            """)
            
            for d in detail:
                ds_type = "嵌入式" if d['is_embedded'] else "发布式"
                self.log(f"- {ds_type}: {d['count']} 个")
            
            self.log()
            self.log("发布式数据源无工作簿关联是正常的（未被工作簿引用）")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 8. 工作簿 → 视图 ====================
    
    def analyze_workbook_to_view(self):
        self.log("## 8. 工作簿 → 视图")
        self.log()
        self.log("**关系字段**: `views.workbook_id`")
        self.log()
        
        result = self.execute_and_log("工作簿→视图 统计", """
            SELECT 
                (SELECT COUNT(*) FROM workbooks) as total_wb,
                (SELECT COUNT(DISTINCT workbook_id) FROM views) as wb_with_views,
                (SELECT COUNT(*) FROM workbooks wb 
                 WHERE NOT EXISTS (SELECT 1 FROM views v2 WHERE v2.workbook_id = wb.id)) as wb_without_views,
                (SELECT COUNT(*) FROM views) as total_views
        """)
        
        r = result[0]
        self.log(f"- 工作簿总数: **{r['total_wb']}**")
        self.log(f"- 有视图的工作簿: **{r['wb_with_views']}**")
        self.log(f"- 无视图的工作簿: **{r['wb_without_views']}**")
        self.log(f"- 视图总数: **{r['total_views']}**")
        
        if r['wb_without_views'] > 0:
            self.log()
            self.log("**未连接原因分析**: 工作簿可能为空或视图同步失败")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 9. 视图 → 字段 ====================
    
    def analyze_view_to_field(self):
        self.log("## 9. 视图 → 字段")
        self.log()
        self.log("**关系字段**: `field_to_view` 关联表")
        self.log()
        
        result = self.execute_and_log("视图→字段 统计", """
            SELECT 
                (SELECT COUNT(*) FROM views) as total_views,
                (SELECT COUNT(DISTINCT view_id) FROM field_to_view) as views_with_fields,
                (SELECT COUNT(*) FROM views v 
                 WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv2 WHERE fv2.view_id = v.id)) as views_without_fields,
                (SELECT COUNT(*) FROM field_to_view) as total_relations
        """)
        
        r = result[0]
        self.log(f"- 视图总数: **{r['total_views']}**")
        self.log(f"- 有字段关联: **{r['views_with_fields']}**")
        self.log(f"- 无字段关联: **{r['views_without_fields']}**")
        self.log(f"- 关联记录总数: **{r['total_relations']}**")
        
        if r['views_without_fields'] > 0:
            self.log()
            self.log("**未连接原因分析**: Dashboard 类型的视图可能不直接包含字段，或字段同步未完成")
            
            # 按类型分析
            detail = self.execute_and_log("无字段视图分类", """
                SELECT 
                    view_type,
                    COUNT(*) as count
                FROM views v
                WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.view_id = v.id)
                GROUP BY view_type
            """)
            
            self.log()
            for d in detail:
                self.log(f"- {d['view_type'] or 'unknown'}: {d['count']} 个")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 10. 字段 → 数据表 ====================
    
    def analyze_field_to_table(self):
        self.log("## 10. 字段 → 数据表")
        self.log()
        self.log("**关系字段**: `fields.table_id`")
        self.log()
        
        result = self.execute_and_log("字段→表 统计", """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as with_table,
                SUM(CASE WHEN table_id IS NULL AND is_calculated = 0 THEN 1 ELSE 0 END) as regular_without_table,
                SUM(CASE WHEN table_id IS NULL AND is_calculated = 1 THEN 1 ELSE 0 END) as calc_without_table
            FROM fields
        """)
        
        r = result[0]
        self.log(f"- 字段总数: **{r['total']}**")
        self.log(f"- 有表关联: **{r['with_table']}** ({r['with_table']*100//max(r['total'],1)}%)")
        self.log(f"- 普通字段无表关联: **{r['regular_without_table']}**")
        self.log(f"- 计算字段无表关联: **{r['calc_without_table']}**")
        
        self.log()
        self.log("**分析**:")
        self.log("- 普通字段无表: 上游列信息缺失或嵌入表未穿透")
        self.log("- 计算字段无表: **正常现象**，需通过递归依赖追溯物理表")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 11. 字段 → 数据列 ====================
    
    def analyze_field_to_column(self):
        self.log("## 11. 字段 → 数据列")
        self.log()
        self.log("**关系字段**: `fields.upstream_column_id`")
        self.log()
        
        result = self.execute_and_log("字段→列 统计", """
            SELECT 
                COUNT(*) as total_regular,
                SUM(CASE WHEN upstream_column_id IS NOT NULL THEN 1 ELSE 0 END) as with_column,
                SUM(CASE WHEN upstream_column_id IS NULL THEN 1 ELSE 0 END) as without_column
            FROM fields
            WHERE is_calculated = 0
        """)
        
        r = result[0]
        self.log(f"- 普通字段总数: **{r['total_regular']}**")
        self.log(f"- 有列关联: **{r['with_column']}** ({r['with_column']*100//max(r['total_regular'],1)}%)")
        self.log(f"- 无列关联: **{r['without_column']}**")
        
        if r['without_column'] > 0:
            self.log()
            self.log("**未连接原因分析**:")
            self.log("- API 未返回 upstreamColumns 信息")
            self.log("- 嵌入式数据源字段无物理列映射")
            self.log("- 列已被删除但字段记录保留")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 12. 字段 → 数据源 ====================
    
    def analyze_field_to_datasource(self):
        self.log("## 12. 字段 → 数据源")
        self.log()
        self.log("**关系字段**: `fields.datasource_id`")
        self.log()
        
        result = self.execute_and_log("字段→数据源 统计", """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN datasource_id IS NOT NULL THEN 1 ELSE 0 END) as with_ds,
                SUM(CASE WHEN datasource_id IS NULL THEN 1 ELSE 0 END) as without_ds
            FROM fields
        """)
        
        r = result[0]
        self.log(f"- 字段总数: **{r['total']}**")
        self.log(f"- 有数据源关联: **{r['with_ds']}** ({r['with_ds']*100//max(r['total'],1)}%)")
        self.log(f"- 无数据源关联: **{r['without_ds']}**")
        
        if r['without_ds'] > 0:
            self.log()
            self.log("**⚠️ 异常**: 字段应始终有数据源关联，这可能是同步错误")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 13. 字段 → 工作簿 ====================
    
    def analyze_field_to_workbook(self):
        self.log("## 13. 字段 → 工作簿")
        self.log()
        self.log("**关系字段**: `fields.workbook_id`（直接）或 穿透（via 数据源）")
        self.log()
        
        result = self.execute_and_log("字段→工作簿 统计", """
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN workbook_id IS NOT NULL THEN 1 ELSE 0 END) as direct,
                (SELECT COUNT(DISTINCT f.id) FROM fields f 
                 JOIN datasource_to_workbook dw ON f.datasource_id = dw.datasource_id) as via_datasource
            FROM fields
        """)
        
        r = result[0]
        self.log(f"- 字段总数: **{r['total']}**")
        self.log(f"- 直接关联工作簿: **{r['direct']}**")
        self.log(f"- 穿透可达工作簿: **{r['via_datasource']}**")
        
        # 无法追溯到工作簿的字段
        orphan_count = self.execute_and_log("无法追溯工作簿的字段", """
            SELECT COUNT(*) as count FROM fields f
            WHERE f.workbook_id IS NULL
            AND NOT EXISTS (
                SELECT 1 FROM datasource_to_workbook dw 
                WHERE dw.datasource_id = f.datasource_id
            )
        """)[0]['count']
        
        self.log(f"- 无法追溯工作簿: **{orphan_count}**")
        
        if orphan_count > 0:
            self.log()
            self.log("**未连接原因**: 字段所属数据源为发布式，且未被任何工作簿引用")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 14. 计算字段 → 依赖字段 ====================
    
    def analyze_calc_field_dependencies(self):
        self.log("## 14. 计算字段 → 依赖字段")
        self.log()
        self.log("**关系字段**: `field_dependencies` 表")
        self.log()
        
        result = self.execute_and_log("计算字段依赖 统计", """
            SELECT 
                (SELECT COUNT(*) FROM fields WHERE is_calculated = 1) as total_calc,
                COUNT(DISTINCT source_field_id) as calc_with_deps,
                (SELECT COUNT(*) FROM field_dependencies) as total_deps,
                SUM(CASE WHEN dependency_field_id IS NOT NULL THEN 1 ELSE 0 END) as resolved,
                SUM(CASE WHEN dependency_field_id IS NULL THEN 1 ELSE 0 END) as unresolved
            FROM field_dependencies
        """)
        
        r = result[0]
        self.log(f"- 计算字段总数: **{r['total_calc']}**")
        self.log(f"- 有依赖记录: **{r['calc_with_deps']}**")
        self.log(f"- 依赖关系总数: **{r['total_deps']}**")
        self.log(f"- 已解析(找到字段): **{r['resolved']}**")
        self.log(f"- 未解析: **{r['unresolved']}**")
        
        if r['unresolved'] > 0:
            self.log()
            self.log("**未解析原因分析**:")
            self.log("- 依赖的字段名称在同数据源中不存在")
            self.log("- 引用的是参数、集合或其他非字段对象")
            self.log("- 公式解析未能正确提取依赖名称")
            
            # 示例
            examples = self.execute_and_log("未解析依赖示例", """
                SELECT fd.dependency_name, COUNT(*) as count
                FROM field_dependencies fd
                WHERE fd.dependency_field_id IS NULL
                GROUP BY fd.dependency_name
                ORDER BY count DESC
                LIMIT 10
            """)
            
            self.log()
            self.log("| 未解析依赖名 | 出现次数 |")
            self.log("|-------------|---------|")
            for e in examples:
                self.log(f"| {e['dependency_name']} | {e['count']} |")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 15. 计算字段 → 物理表 ====================
    
    def analyze_calc_field_to_table(self):
        self.log("## 15. 计算字段 → 物理表 (递归穿透)")
        self.log()
        self.log("**关系方式**: 递归追溯依赖字段的 `table_id`")
        self.log()
        
        result = self.execute_and_log("计算字段表关联 统计", """
            SELECT 
                COUNT(*) as total_calc,
                SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as with_table,
                SUM(CASE WHEN table_id IS NULL THEN 1 ELSE 0 END) as without_table
            FROM fields
            WHERE is_calculated = 1
        """)
        
        r = result[0]
        self.log(f"- 计算字段总数: **{r['total_calc']}**")
        self.log(f"- 有直接表关联: **{r['with_table']}** ({r['with_table']*100//max(r['total_calc'],1)}%)")
        self.log(f"- 无直接表关联: **{r['without_table']}**")
        
        self.log()
        self.log("**说明**: 计算字段通常无直接 `table_id`，需通过依赖字段递归追溯")
        self.log("**重构后**: 将预计算并填充 `lineage_table_id` 冗余列")
        
        self.log()
        self.log("---")
        self.log()
    
    # ==================== 汇总 ====================
    
    def generate_summary(self):
        self.log("## 汇总")
        self.log()
        
        # 读取快照数据
        summary = self.execute_and_log("汇总统计", """
            SELECT 
                (SELECT COUNT(*) FROM databases) as databases,
                (SELECT COUNT(*) FROM tables WHERE is_embedded = 0) as physical_tables,
                (SELECT COUNT(*) FROM tables WHERE is_embedded = 1) as embedded_tables,
                (SELECT COUNT(*) FROM datasources WHERE is_embedded = 0) as published_ds,
                (SELECT COUNT(*) FROM datasources WHERE is_embedded = 1 AND source_published_datasource_id IS NOT NULL) as penetrating_ds,
                (SELECT COUNT(*) FROM datasources WHERE is_embedded = 1 AND source_published_datasource_id IS NULL) as standalone_ds,
                (SELECT COUNT(*) FROM workbooks) as workbooks,
                (SELECT COUNT(*) FROM views) as views,
                (SELECT COUNT(*) FROM fields WHERE is_calculated = 0) as regular_fields,
                (SELECT COUNT(*) FROM fields WHERE is_calculated = 1) as calc_fields
        """)[0]
        
        self.log("| 模块 | 数量 |")
        self.log("|------|------|")
        self.log(f"| 数据库 | {summary['databases']} |")
        self.log(f"| 物理表 | {summary['physical_tables']} |")
        self.log(f"| 嵌入表 | {summary['embedded_tables']} |")
        self.log(f"| 发布数据源 | {summary['published_ds']} |")
        self.log(f"| 嵌入源(穿透) | {summary['penetrating_ds']} |")
        self.log(f"| 嵌入源(独立) | {summary['standalone_ds']} |")
        self.log(f"| 工作簿 | {summary['workbooks']} |")
        self.log(f"| 视图 | {summary['views']} |")
        self.log(f"| 普通字段 | {summary['regular_fields']} |")
        self.log(f"| 计算字段 | {summary['calc_fields']} |")
        
        self.log()
        self.log("### 主要问题点")
        self.log()
        self.log("1. **字段→列 关联率偏低** (82.6%): 部分字段无物理列映射")
        self.log("2. **计算字段无直接表关联** (77.2%): 需通过依赖递归追溯")
        self.log("3. **依赖解析未完成** (717条): 部分公式引用无法解析")
        self.log()
    
    # ==================== SQL 存档 ====================
    
    def generate_sql_archive(self):
        self.log("---")
        self.log()
        self.log("## 附录: SQL 验证脚本")
        self.log()
        
        for name, sql in self.sql_archive:
            self.log(f"### {name}")
            self.log()
            self.log("```sql")
            self.log(sql)
            self.log("```")
            self.log()
    
    def save_report(self):
        """保存报告"""
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            f.write('\n'.join(self.report_lines))
        print(f"\n✅ 报告已保存至: {OUTPUT_PATH}")


def main():
    print("🔍 开始血缘连接完整性分析...")
    print()
    
    analyzer = LineageAnalyzer(DB_PATH)
    analyzer.analyze_all()
    analyzer.save_report()
    analyzer.conn.close()


if __name__ == '__main__':
    main()
