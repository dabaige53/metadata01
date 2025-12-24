#!/usr/bin/env python3
"""
血缘连接全量清单分析脚本
包含 Source -> Target 的覆盖率分析，并列出每个关联的血缘链路。
"""

import sqlite3
from datetime import datetime

DB_PATH = "metadata.db"
OUTPUT_PATH = "docs/重构方案/血缘连接分析报告.md"

# 定义所有检查项及其血缘链路
# 格式: (source, target, sql, [链路列表])
CHECKLIST = [
    # ==================== 1. 数据库 (1) ====================
    ("一、数据库", "数据库", "物理表", 
     "SELECT (SELECT COUNT(*) FROM databases) as total, COUNT(DISTINCT database_id) as linked FROM tables WHERE is_embedded=0",
     ["数据库 → 物理表 (tables.database_id)"]),

    # ==================== 2. 物理表 (5) ====================
    ("二、物理表", "物理表", "数据库", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=0) as total, SUM(CASE WHEN database_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM tables WHERE is_embedded=0",
     ["物理表 → 数据库 (tables.database_id)"]),
    (None, "物理表", "数据列", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=0) as total, COUNT(DISTINCT table_id) as linked FROM db_columns WHERE table_id IN (SELECT id FROM tables WHERE is_embedded=0)",
     ["物理表 → 数据列 (db_columns.table_id)"]),
    (None, "物理表", "发布源", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=0) as total, COUNT(DISTINCT td.table_id) as linked FROM table_to_datasource td JOIN datasources ds ON td.datasource_id=ds.id WHERE ds.is_embedded=0",
     ["物理表 → 发布源 (table_to_datasource)"]),
    (None, "物理表", "嵌入源(独立)", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=0) as total, COUNT(DISTINCT td.table_id) as linked FROM table_to_datasource td JOIN datasources ds ON td.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL",
     ["物理表 → 嵌入源(独立) (table_to_datasource)"]),
    (None, "物理表", "字段", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=0) as total, COUNT(DISTINCT f.table_id) as linked FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=0",
     ["物理表 → 字段 (fields.table_id)"]),

    # ==================== 3. 嵌入表 (4) ====================
    ("三、嵌入表", "嵌入表", "物理表", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=1) as total, SUM(CASE WHEN database_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM tables WHERE is_embedded=1",
     ["嵌入表 → 物理表 (tables.database_id 穿透)"]),
    (None, "嵌入表", "数据列", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=1) as total, COUNT(DISTINCT table_id) as linked FROM db_columns WHERE table_id IN (SELECT id FROM tables WHERE is_embedded=1)",
     ["嵌入表 → 数据列 (db_columns.table_id)"]),
    (None, "嵌入表", "嵌入源(独立)", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=1) as total, COUNT(DISTINCT td.table_id) as linked FROM table_to_datasource td JOIN datasources ds ON td.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL",
     ["嵌入表 → 嵌入源(独立) (table_to_datasource)"]),
    (None, "嵌入表", "字段", 
     "SELECT (SELECT COUNT(*) FROM tables WHERE is_embedded=1) as total, COUNT(DISTINCT f.table_id) as linked FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=1",
     ["嵌入表 → 字段 (fields.table_id)"]),

    # ==================== 4. 数据列 (3) ====================
    ("四、数据列", "数据列", "物理表", 
     "SELECT (SELECT COUNT(*) FROM db_columns) as total, SUM(CASE WHEN table_id IN (SELECT id FROM tables WHERE is_embedded=0) THEN 1 ELSE 0 END) as linked FROM db_columns",
     ["数据列 → 物理表 (db_columns.table_id)"]),
    (None, "数据列", "嵌入表", 
     "SELECT (SELECT COUNT(*) FROM db_columns) as total, SUM(CASE WHEN table_id IN (SELECT id FROM tables WHERE is_embedded=1) THEN 1 ELSE 0 END) as linked FROM db_columns",
     ["数据列 → 嵌入表 (db_columns.table_id)"]),
    (None, "数据列", "字段", 
     "SELECT (SELECT COUNT(*) FROM db_columns) as total, COUNT(DISTINCT upstream_column_id) as linked FROM fields WHERE upstream_column_id IS NOT NULL",
     ["数据列 → 字段 (fields.upstream_column_id)"]),

    # ==================== 5. 发布源 (4) ====================
    ("五、发布源", "发布源", "物理表", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=0) as total, COUNT(DISTINCT td.datasource_id) as linked FROM table_to_datasource td JOIN tables t ON td.table_id=t.id WHERE t.is_embedded=0 AND td.datasource_id IN (SELECT id FROM datasources WHERE is_embedded=0)",
     ["发布源 → 物理表 (table_to_datasource)"]),
    (None, "发布源", "嵌入源(穿透)", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=0) as total, COUNT(DISTINCT source_published_datasource_id) as linked FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL",
     ["发布源 → 嵌入源(穿透) (datasources.source_published_datasource_id)"]),
    (None, "发布源", "工作簿", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=0) as total, COUNT(DISTINCT datasource_id) as linked FROM datasource_to_workbook WHERE datasource_id IN (SELECT id FROM datasources WHERE is_embedded=0)",
     ["发布源 → 工作簿 (datasource_to_workbook)"]),
    (None, "发布源", "字段", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=0) as total, COUNT(DISTINCT datasource_id) as linked FROM fields WHERE datasource_id IN (SELECT id FROM datasources WHERE is_embedded=0)",
     ["发布源 → 字段 (fields.datasource_id)"]),

    # ==================== 6. 嵌入源(穿透) (2) ====================
    ("六、嵌入源(穿透)", "嵌入源(穿透)", "发布源", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL) as total, SUM(CASE WHEN EXISTS (SELECT 1 FROM datasources p WHERE p.id=ds.source_published_datasource_id) THEN 1 ELSE 0 END) as linked FROM datasources ds WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NOT NULL",
     ["嵌入源(穿透) → 发布源 (datasources.source_published_datasource_id)"]),
    (None, "嵌入源(穿透)", "工作簿", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL) as total, COUNT(DISTINCT datasource_id) as linked FROM datasource_to_workbook WHERE datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL)",
     ["嵌入源(穿透) → 工作簿 (datasource_to_workbook)"]),

    # ==================== 7. 嵌入源(独立) (4) ====================
    ("七、嵌入源(独立)", "嵌入源(独立)", "物理表", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL) as total, COUNT(DISTINCT td.datasource_id) as linked FROM table_to_datasource td JOIN tables t ON td.table_id=t.id WHERE t.is_embedded=0 AND td.datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL)",
     ["嵌入源(独立) → 物理表 (table_to_datasource)"]),
    (None, "嵌入源(独立)", "嵌入表", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL) as total, COUNT(DISTINCT td.datasource_id) as linked FROM table_to_datasource td JOIN tables t ON td.table_id=t.id WHERE t.is_embedded=1 AND td.datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL)",
     ["嵌入源(独立) → 嵌入表 (table_to_datasource)"]),
    (None, "嵌入源(独立)", "工作簿", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL) as total, COUNT(DISTINCT datasource_id) as linked FROM datasource_to_workbook WHERE datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL)",
     ["嵌入源(独立) → 工作簿 (datasource_to_workbook)"]),
    (None, "嵌入源(独立)", "字段", 
     "SELECT (SELECT COUNT(*) FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL) as total, COUNT(DISTINCT datasource_id) as linked FROM fields WHERE datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL)",
     ["嵌入源(独立) → 字段 (fields.datasource_id)"]),

    # ==================== 8. 工作簿 (8) ====================
    ("八、工作簿", "工作簿", "数据库", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT dw.workbook_id) as linked FROM datasource_to_workbook dw JOIN table_to_datasource td ON dw.datasource_id=td.datasource_id JOIN tables t ON td.table_id=t.id WHERE t.database_id IS NOT NULL",
     ["工作簿 → 数据源 → 表 → 数据库 (穿透链路)"]),
    (None, "工作簿", "物理表", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT dw.workbook_id) as linked FROM datasource_to_workbook dw JOIN table_to_datasource td ON dw.datasource_id=td.datasource_id JOIN tables t ON td.table_id=t.id WHERE t.is_embedded=0",
     ["工作簿 → 数据源 → 物理表 (穿透链路)"]),
    (None, "工作簿", "嵌入表", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT dw.workbook_id) as linked FROM datasource_to_workbook dw JOIN table_to_datasource td ON dw.datasource_id=td.datasource_id JOIN tables t ON td.table_id=t.id WHERE t.is_embedded=1",
     ["工作簿 → 数据源 → 嵌入表 (穿透链路)"]),
    (None, "工作簿", "发布源", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT dw.workbook_id) as linked FROM datasource_to_workbook dw JOIN datasources ds ON dw.datasource_id=ds.id WHERE ds.is_embedded=0",
     ["工作簿 → 发布源 (datasource_to_workbook)"]),
    (None, "工作簿", "嵌入源(穿透)", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT dw.workbook_id) as linked FROM datasource_to_workbook dw JOIN datasources ds ON dw.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NOT NULL",
     ["工作簿 → 嵌入源(穿透) (datasource_to_workbook)"]),
    (None, "工作簿", "嵌入源(独立)", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT dw.workbook_id) as linked FROM datasource_to_workbook dw JOIN datasources ds ON dw.datasource_id=ds.id WHERE ds.is_embedded=1 AND ds.source_published_datasource_id IS NULL",
     ["工作簿 → 嵌入源(独立) (datasource_to_workbook)"]),
    (None, "工作簿", "视图", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT workbook_id) as linked FROM views",
     ["工作簿 → 视图 (views.workbook_id)"]),
    (None, "工作簿", "字段", 
     "SELECT (SELECT COUNT(*) FROM workbooks) as total, COUNT(DISTINCT workbook_id) as linked FROM fields WHERE workbook_id IS NOT NULL",
     ["工作簿 → 字段 (fields.workbook_id)"]),

    # ==================== 9. 视图 (4) ====================
    ("九、视图", "视图", "数据库", 
     "SELECT (SELECT COUNT(*) FROM views) as total, COUNT(DISTINCT fv.view_id) as linked FROM field_to_view fv JOIN fields f ON fv.field_id=f.id JOIN tables t ON f.table_id=t.id WHERE t.database_id IS NOT NULL",
     ["视图 → 字段 → 表 → 数据库 (穿透链路)"]),
    (None, "视图", "物理表", 
     "SELECT (SELECT COUNT(*) FROM views) as total, COUNT(DISTINCT fv.view_id) as linked FROM field_to_view fv JOIN fields f ON fv.field_id=f.id JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=0",
     ["视图 → 字段 → 物理表 (穿透链路)"]),
    (None, "视图", "工作簿", 
     "SELECT (SELECT COUNT(*) FROM views) as total, SUM(CASE WHEN workbook_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM views",
     ["视图 → 工作簿 (views.workbook_id)"]),
    (None, "视图", "字段", 
     "SELECT (SELECT COUNT(*) FROM views) as total, COUNT(DISTINCT view_id) as linked FROM field_to_view",
     ["视图 → 字段 (field_to_view)"]),

    # ==================== 10. 字段 (10) ====================
    ("十、字段", "字段", "数据库", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, COUNT(DISTINCT f.id) as linked FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.database_id IS NOT NULL",
     ["字段 → 表 → 数据库 (穿透链路)"]),
    (None, "字段", "物理表", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, SUM(CASE WHEN table_id IN (SELECT id FROM tables WHERE is_embedded=0) THEN 1 ELSE 0 END) as linked FROM fields",
     ["字段 → 物理表 (fields.table_id)"]),
    (None, "字段", "嵌入表", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, SUM(CASE WHEN table_id IN (SELECT id FROM tables WHERE is_embedded=1) THEN 1 ELSE 0 END) as linked FROM fields",
     ["字段 → 嵌入表 (fields.table_id)"]),
    (None, "字段", "数据列", 
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=0) as total, SUM(CASE WHEN upstream_column_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM fields WHERE is_calculated=0",
     ["字段 → 数据列 (fields.upstream_column_id)"]),
    (None, "字段", "发布源", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, SUM(CASE WHEN datasource_id IN (SELECT id FROM datasources WHERE is_embedded=0) THEN 1 ELSE 0 END) as linked FROM fields",
     ["字段 → 发布源 (fields.datasource_id)"]),
    (None, "字段", "嵌入源(穿透)", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, SUM(CASE WHEN datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NOT NULL) THEN 1 ELSE 0 END) as linked FROM fields",
     ["字段 → 嵌入源(穿透) (fields.datasource_id)"]),
    (None, "字段", "嵌入源(独立)", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, SUM(CASE WHEN datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL) THEN 1 ELSE 0 END) as linked FROM fields",
     ["字段 → 嵌入源(独立) (fields.datasource_id)"]),
    (None, "字段", "工作簿", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, SUM(CASE WHEN workbook_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM fields",
     ["字段 → 工作簿 (fields.workbook_id)",
      "字段 → 数据源 → 工作簿 (穿透链路, 通过 datasource_to_workbook)"]),
    (None, "字段", "视图", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, COUNT(DISTINCT field_id) as linked FROM field_to_view",
     ["字段 → 视图 (field_to_view)"]),
    (None, "字段", "计算字段", 
     "SELECT (SELECT COUNT(*) FROM fields) as total, COUNT(DISTINCT dependency_field_id) as linked FROM field_dependencies",
     ["字段 → 计算字段 (field_dependencies, 被计算字段依赖)"]),

    # ==================== 11. 计算字段 (6) ====================
    ("十一、计算字段", "计算字段", "物理表", 
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=1) as total, SUM(CASE WHEN table_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM fields WHERE is_calculated=1",
     ["计算字段 → 物理表 (fields.table_id, 直接关联)",
      "计算字段 → 依赖字段 → 物理表 (递归穿透)"]),
    (None, "计算字段", "字段(依赖)", 
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=1) as total, COUNT(DISTINCT source_field_id) as linked FROM field_dependencies",
     ["计算字段 → 依赖字段 (field_dependencies.dependency_field_id)"]),
    (None, "计算字段", "发布源",
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=1) as total, SUM(CASE WHEN datasource_id IN (SELECT id FROM datasources WHERE is_embedded=0) THEN 1 ELSE 0 END) as linked FROM fields WHERE is_calculated=1",
     ["计算字段 → 发布源 (fields.datasource_id)"]),
    (None, "计算字段", "嵌入源(独立)", 
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=1) as total, SUM(CASE WHEN datasource_id IN (SELECT id FROM datasources WHERE is_embedded=1 AND source_published_datasource_id IS NULL) THEN 1 ELSE 0 END) as linked FROM fields WHERE is_calculated=1",
     ["计算字段 → 嵌入源(独立) (fields.datasource_id)"]),
    (None, "计算字段", "工作簿",
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=1) as total, SUM(CASE WHEN workbook_id IS NOT NULL THEN 1 ELSE 0 END) as linked FROM fields WHERE is_calculated=1",
     ["计算字段 → 工作簿 (fields.workbook_id)",
      "计算字段 → 数据源 → 工作簿 (穿透链路, 通过 datasource_to_workbook)"]),
    (None, "计算字段", "视图",
     "SELECT (SELECT COUNT(*) FROM fields WHERE is_calculated=1) as total, COUNT(DISTINCT field_id) as linked FROM field_to_view WHERE field_id IN (SELECT id FROM fields WHERE is_calculated=1)",
     ["计算字段 → 视图 (field_to_view)"]),
]


class LineageChecklist:
    def __init__(self, db_path: str):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.lines = []
        self.count = 1

    def log(self, text):
        self.lines.append(text)
        print(text)

    def run(self):
        self.log(f"# 元数据血缘连接全量清单")
        self.log(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.log(f"> 统计口径: 源端资产覆盖率 (有多少 Source 关联到了 Target)")
        self.log("\n---\n")

        current_section = None
        for item in CHECKLIST:
            section, source, target, sql, paths = item
            
            # 新章节标题
            if section and section != current_section:
                current_section = section
                self.log(f"## {section}")
            
            # 执行检查
            title = f"{self.count}. {source} → {target}"
            self.count += 1
            
            try:
                cur = self.conn.execute(sql)
                row = cur.fetchone()
                total = row['total'] if row else 0
                linked = row['linked'] if row else 0
                rate = round(linked * 100 / total, 1) if total > 0 else 0.0
                
                self.log(f"### {title}")
                self.log(f"- **覆盖率**: {linked}/{total} (**{rate}%**)")
                self.log(f"- **血缘链路**:")
                for p in paths:
                    self.log(f"  - `{p}`")
                self.log("")
            except Exception as e:
                self.log(f"### {title}")
                self.log(f"- **Error**: {e}")
                self.log("")

        self.save()

    def save(self):
        with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
            f.write('\n'.join(self.lines))
        print(f"✅ 报告已生成: {OUTPUT_PATH}")


if __name__ == "__main__":
    checker = LineageChecklist(DB_PATH)
    checker.run()
