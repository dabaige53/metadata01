-- ================================================================
-- Tableau 元数据治理平台 - 系统设计验证脚本 (System Design Validator)
-- 目的: 验证元数据模型在物理、逻辑、消费、字段、血缘 5 大维度的设计完整性
-- 模式: 系统问题导向 (System Issue-Oriented) - 仅验证系统设计缺陷
-- 范围: 不包含数据治理层面的验证(如利用率、冗余度、规范性等)
-- ================================================================

.mode column
.headers on
.width 45 40 40

-- ================================================================
-- 加载验证白名单
-- ================================================================
.read docs/测试验证/validation_whitelist.sql

-- ================================================================
-- 1. 物理基础设施验证 (Physical Infrastructure)
-- Object: Database, Table, DBColumn
-- ================================================================
SELECT '★★★ 1. 物理基础设施验证 ★★★' as 验证类别;

-- ... (skip to 2.3)

-- 2.3 DS 物理关联 (排除白名单: Custom SQL 和 Extract)
SELECT '空壳数据源(无表)' as 验证内容, COUNT(*) as 异常数, '已发布 DS 应关联物理表 (排除白名单)' as 规则 
FROM datasources ds 
WHERE is_embedded = 0 
  AND NOT EXISTS (
      SELECT 1 FROM temp_whitelist w 
      WHERE w.rule_id = '2.3' AND (
          (w.match_type = 'EXACT' AND ds.name = w.value) OR
          (w.match_type = 'LIKE' AND ds.name LIKE w.value)
      )
  )
  AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.datasource_id = ds.id);

-- ... (skip to 4.2)

-- 4.2 计算公式缺失 (排除白名单: Ad-hoc)
SELECT '计算公式丢失' as 验证内容, COUNT(*) as 异常数, 'is_calculated=1 必须有 formula (排除白名单)' as 规则 
FROM fields f
WHERE is_calculated = 1 
  AND (formula IS NULL OR formula = '')
  AND NOT EXISTS (
      SELECT 1 FROM temp_whitelist w 
      WHERE w.rule_id = '4.2' AND (
          (w.match_type = 'EXACT' AND f.name = w.value) OR
          (w.match_type = 'LIKE' AND f.name LIKE w.value)
      )
  );

-- 1.1 Database 主键唯一性
SELECT '数据库主键ID冲突' as 验证内容, COUNT(id) - COUNT(DISTINCT id) as 异常数, 'Database.id 必须唯一' as 规则 FROM databases;

-- 1.2 Table 归属缺失
SELECT '孤立数据表记录' as 验证内容, COUNT(*) as 异常数, 'Table.database_id 不能为空' as 规则 
FROM tables WHERE database_id IS NULL;

-- 1.3 Table 外键有效性
SELECT '无效的数据库引用' as 验证内容, COUNT(*) as 异常数, 'Table.database_id 必须存在于 databases 表' as 规则 
FROM tables WHERE database_id IS NOT NULL AND database_id NOT IN (SELECT id FROM databases);

-- 1.4 Column 归属完整性
SELECT '孤立物理列记录' as 验证内容, COUNT(*) as 异常数, 'DBColumn.table_id 不能为空' as 规则 
FROM db_columns WHERE table_id IS NULL;

-- 1.5 Column 外键有效性
SELECT '无效的数据表引用' as 验证内容, COUNT(*) as 异常数, 'DBColumn.table_id 必须存在于 tables 表' as 规则 
FROM db_columns WHERE table_id IS NOT NULL AND table_id NOT IN (SELECT id FROM tables);

-- ================================================================
-- 2. 数据源语义层验证 (Logical Semantic Layer)
-- Object: Datasource, Project
-- ================================================================
SELECT '★★★ 2. 数据源语义层验证 ★★★' as 验证类别;

-- 2.1 DS 名称完整性
SELECT '数据源名称为空' as 验证内容, COUNT(*) as 异常数, 'Datasource.name 不能为空' as 规则 
FROM datasources WHERE name IS NULL OR name = '';

-- 2.2 DS 项目归属 (仅针对非内嵌)
SELECT '数据源未归属项目' as 验证内容, COUNT(*) as 异常数, '非内嵌 DS 必须有 project_name' as 规则 
FROM datasources WHERE is_embedded = 0 AND (project_name IS NULL OR project_name = '');

-- 2.3 DS 物理关联 (是否有下层表)
SELECT '空壳数据源(无表)' as 验证内容, COUNT(*) as 异常数, '已发布 DS 应关联物理表 (Custom SQL 除外)' as 规则 
FROM datasources ds 
WHERE is_embedded = 0 
  AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.datasource_id = ds.id);

-- 2.4 DS 字段内容 (是否为空壳)
SELECT '空壳数据源(无字段)' as 验证内容, COUNT(*) as 异常数, 'DS 必须包含至少一个 Field' as 规则 
FROM datasources ds WHERE NOT EXISTS (SELECT 1 FROM fields f WHERE f.datasource_id = ds.id);

-- 2.5 嵌入式数据源关联完整性 (v2.1)
SELECT '嵌入式源关联丢失' as 验证内容, COUNT(*) as 异常数, '嵌入式 DS 应关联已发布 DS (排除白名单)' as 规则
FROM datasources
WHERE is_embedded = 1
  AND (source_published_datasource_id IS NULL OR source_published_datasource_id = '')
  AND NOT EXISTS (
      SELECT 1 FROM temp_whitelist w
      WHERE w.rule_id = '2.5' AND (
          (w.match_type = 'EXACT' AND datasources.name = w.value) OR
          (w.match_type = 'LIKE' AND datasources.name LIKE w.value)
      )
  );

-- 2.6 嵌入式字段关联完整性 (v2.1)
SELECT '嵌入式字段关联丢失' as 验证内容, COUNT(*) as 异常数, '嵌入式 Field 应关联已发布 Field (排除白名单)' as 规则
FROM fields f
JOIN datasources ds ON f.datasource_id = ds.id
WHERE ds.is_embedded = 1
  -- 只检查引用了远程字段的字段（部分字段可能是工作簿新建的计算字段，没有 remote_field）
  AND f.is_calculated = 0 
  AND (f.remote_field_id IS NULL OR f.remote_field_id = '')
  AND NOT EXISTS (
      SELECT 1 FROM temp_whitelist w
      WHERE w.rule_id = '2.6' AND (
          (w.match_type = 'EXACT' AND f.name = w.value) OR
          (w.match_type = 'LIKE' AND f.name LIKE w.value)
      )
  );

-- ================================================================
-- 3. 消费层验证 (Consumption Layer)
-- Object: Workbook, View, Project
-- ================================================================
SELECT '★★★ 3. 消费层验证 ★★★' as 验证类别;

-- 3.1 WB 项目归属
SELECT '工作簿未归属项目' as 验证内容, COUNT(*) as 异常数, 'Workbook.project_name 不能为空' as 规则 
FROM workbooks WHERE project_name IS NULL OR project_name = '';

-- 3.2 WB 负责人归属
SELECT '工作簿缺少负责人' as 验证内容, COUNT(*) as 异常数, 'Workbook.owner 不能为空' as 规则 
FROM workbooks WHERE owner IS NULL OR owner = '';

-- 3.3 WB 名称完整性
SELECT '工作簿名称为空' as 验证内容, COUNT(*) as 异常数, 'Workbook.name 不能为空' as 规则 
FROM workbooks WHERE name IS NULL OR name = '';

-- 3.4 View 父级归属
SELECT '孤立视图记录' as 验证内容, COUNT(*) as 异常数, 'View.workbook_id 不能为空' as 规则 
FROM views WHERE workbook_id IS NULL;

-- 3.5 View 外键有效性
SELECT '无效的工作簿引用' as 验证内容, COUNT(*) as 异常数, 'View.workbook_id 必须存在于 workbooks 表' as 规则 
FROM views WHERE workbook_id IS NOT NULL AND workbook_id NOT IN (SELECT id FROM workbooks);

-- 3.6 Dashboard 结构完整性
SELECT '仪表板内容缺失' as 验证内容, COUNT(*) as 异常数, 'Dashboard 类型视图应包含 Sheet' as 规则 
FROM views d 
WHERE d.view_type = 'dashboard' 
  AND NOT EXISTS (SELECT 1 FROM dashboard_to_sheet ds WHERE ds.dashboard_id = d.id);

-- ================================================================
-- 4. 字段与指标逻辑验证 (Field & Metric Logic)
-- Object: Field, CalculatedField
-- ================================================================
SELECT '★★★ 4. 字段与指标逻辑验证 ★★★' as 验证类别;

-- 4.1 未使用字段 (Unused Fields) - 与 API /api/stats.orphanedFields 口径一致
SELECT '未使用字段(无视图引用)' as 验证内容, COUNT(*) as 异常数, '字段未被任何视图引用' as 规则 
FROM fields f WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id);

-- 4.2 计算公式缺失 (排除简单聚合/重命名)
SELECT '计算公式丢失' as 验证内容, COUNT(*) as 异常数, 'is_calculated=1 必须有 formula (排除简单聚合)' as 规则 
FROM fields 
WHERE is_calculated = 1 
  AND (formula IS NULL OR formula = '')
  AND name NOT IN ('HO座公里投入', '中转次数');  -- 临时白名单，确认为业务别名

-- 4.3 度量类型缺失
SELECT '度量数据类型缺失' as 验证内容, COUNT(*) as 异常数, 'Role=measure 必须有 data_type' as 规则 
FROM fields WHERE role = 'measure' AND (data_type IS NULL OR data_type = '');

-- 4.4 度量角色缺失 (如果定义为 Metric 但没 Role)
SELECT '计算字段角色未定义' as 验证内容, COUNT(*) as 异常数, 'is_calculated=1 且名为 Metric 的字段应有 Role' as 规则 
FROM fields WHERE is_calculated = 1 AND role IS NULL;

-- 4.5 字段采集空值检测 (新增)
SELECT '字段名称为空' as 验证内容, COUNT(*) as 异常数, 'Field.name 不能为空' as 规则 
FROM fields WHERE name IS NULL OR name = '';

SELECT '字段ID为空' as 验证内容, COUNT(*) as 异常数, 'Field.id 不能为空' as 规则 
FROM fields WHERE id IS NULL OR id = '';

SELECT '字段数据源ID为空' as 验证内容, COUNT(*) as 异常数, 'Field.datasource_id 不能为空' as 规则 
FROM fields WHERE datasource_id IS NULL;

-- 4.6 三层命名结构验证 (新增)
SELECT '字段无上游列关联' as 验证内容, COUNT(*) as 异常数, '非计算字段应有 upstream_column_id (理想状态)' as 规则 
FROM fields WHERE is_calculated = 0 AND upstream_column_id IS NULL;

SELECT '上游列ID无效' as 验证内容, COUNT(*) as 异常数, 'upstream_column_id 必须存在于 db_columns 表' as 规则 
FROM fields f 
WHERE f.upstream_column_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.id = f.upstream_column_id);

-- 4.7 嵌入式字段关联验证 (新增)
SELECT '嵌入式字段无源字段关联' as 验证内容, COUNT(*) as 异常数, '嵌入式数据源字段应有 remote_field_id' as 规则 
FROM fields f 
JOIN datasources ds ON f.datasource_id = ds.id
WHERE ds.is_embedded = 1 AND f.remote_field_id IS NULL;

-- ================================================================
-- 5. 血缘全链路中断验证 (Broken Lineage)
-- 问题模式：计算中断数量，而不是覆盖率
-- ================================================================
SELECT '★★★ 5. 血缘全链路验证 ★★★' as 验证类别;

-- 5.1 Table -> DS
SELECT '物理-语义血缘中断' as 验证内容, 
    COUNT(*) as 异常数, 
    '物理表未被任何数据源引用' as 规则 
FROM tables t 
WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id);

-- 5.2 DS -> WB
SELECT '语义-消费血缘中断' as 验证内容, 
    COUNT(*) as 异常数, 
    '数据源未被任何工作簿引用' as 规则 
FROM datasources ds 
WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = ds.id);

-- 5.3 Field -> View
SELECT '字段-视图血缘中断' as 验证内容, 
    COUNT(*) as 异常数, 
    '字段未被任何视图引用' as 规则 
FROM fields f 
WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id);

-- ================================================================
-- 6. 统计准确性验证 (Statistics Accuracy)
-- 目的: 验证前后端统计数据一致性
-- ================================================================
SELECT '★★★ 6. 统计准确性验证 ★★★' as 验证类别;

-- 6.1 数据库计数
SELECT '数据库总数' as 验证内容, COUNT(*) as 数据库计数, '与 API /api/stats 比对' as 规则 
FROM databases;

-- 6.2 数据表计数
SELECT '数据表总数' as 验证内容, COUNT(*) as 数据表计数, '与 API /api/stats 比对' as 规则 
FROM tables;

-- 6.3 数据源计数
SELECT '数据源总数' as 验证内容, COUNT(*) as 数据源计数, '与 API /api/stats 比对' as 规则 
FROM datasources;

-- 6.4 字段计数
SELECT '字段总数' as 验证内容, COUNT(*) as 字段计数, '与 API /api/stats 比对' as 规则 
FROM fields;

-- 6.5 工作簿计数
SELECT '工作簿总数' as 验证内容, COUNT(*) as 工作簿计数, '与 API /api/stats 比对' as 规则 
FROM workbooks;

-- 6.6 视图计数
SELECT '视图总数' as 验证内容, COUNT(*) as 视图计数, '与 API /api/stats 比对' as 规则 
FROM views;

-- ================================================================
-- 7. 血缘完整性验证 (Lineage Integrity)
-- 目的: 验证字段到数据源/物理表的血缘关联完整性
-- ================================================================
SELECT '★★★ 7. 血缘完整性验证 ★★★' as 验证类别;

-- 7.1 计算字段孤儿数据源引用
-- 问题: 字段的 datasource_id 指向不存在的数据源（通常是嵌入式数据源未被同步）
SELECT 
    '计算字段孤儿数据源引用' as 验证内容,
    COUNT(*) as 异常数,
    '引用了不存在数据源的计算字段' as 规则
FROM fields f
LEFT JOIN datasources d ON f.datasource_id = d.id
WHERE f.is_calculated = 1 
  AND f.datasource_id IS NOT NULL 
  AND d.id IS NULL;

-- 7.2 孤儿数据源ID统计
SELECT 
    '孤儿数据源ID数量' as 验证内容,
    COUNT(DISTINCT f.datasource_id) as 异常数,
    '被引用但不存在的数据源ID数量' as 规则
FROM fields f
LEFT JOIN datasources d ON f.datasource_id = d.id
WHERE f.is_calculated = 1 
  AND f.datasource_id IS NOT NULL 
  AND d.id IS NULL;

-- 7.3 计算字段物理表血缘缺失
-- 问题: 计算字段没有关联物理表，导致无法追溯数据来源
SELECT 
    '计算字段物理表血缘缺失' as 验证内容,
    COUNT(*) as 异常数,
    '缺少 table_id 的计算字段' as 规则
FROM fields f
WHERE f.is_calculated = 1 
  AND (f.table_id IS NULL OR f.table_id = '');

-- 7.4 计算字段物理表关联率
SELECT 
    '计算字段物理表关联率' as 验证内容,
    ROUND(100.0 * SUM(CASE WHEN table_id IS NOT NULL AND table_id != '' THEN 1 ELSE 0 END) / COUNT(*), 2) || '%' as 关联率,
    '有 table_id 的计算字段占比' as 规则
FROM fields WHERE is_calculated = 1;

-- 7.5 孤儿数据源样本 (Top 5)
SELECT 
    '孤儿数据源引用样本' as 验证内容,
    f.datasource_id as 孤儿数据源ID,
    COUNT(*) as 引用字段数
FROM fields f
LEFT JOIN datasources d ON f.datasource_id = d.id
WHERE f.is_calculated = 1 
  AND f.datasource_id IS NOT NULL 
  AND d.id IS NULL
GROUP BY f.datasource_id
ORDER BY COUNT(*) DESC
LIMIT 5;


-- 7.6 物理表列信息缺失(B1)
-- 问题: 物理表 (is_embedded=0) 必须包含至少一个列信息，否则字段无法追溯到列级。
SELECT 
    '物理表列信息缺失(B1)' as 验证内容,
    COUNT(*) as 异常数,
    '物理表必须包含列信息' as 规则
FROM tables t
WHERE t.is_embedded = 0
  AND NOT EXISTS (SELECT 1 FROM db_columns c WHERE c.table_id = t.id);

-- 7.7 表引用字段无关联(D)
-- 问题: 表引用类型字段 (如"日期表") 必须关联到对应的数据表。
SELECT 
    '表引用字段无关联(D)' as 验证内容,
    COUNT(*) as 异常数,
    '表引用字段必须关联表' as 规则
FROM fields f
WHERE f.name IN ('日期表', '航司表', 'DIM-进港', '春运日期表')
  AND table_id IS NULL;

-- ================================================================
-- 8. 字段归属完整性验证 (Field Container Integrity)
-- 目的: 验证字段是否正确归属于数据源或工作簿
-- ================================================================
SELECT '★★★ 8. 字段归属完整性验证 ★★★' as 验证类别;

-- 8.1 原始字段归属缺失
SELECT 
    '原始字段归属缺失' as 验证内容,
    COUNT(*) as 异常数,
    '原始字段必须归属数据源' as 规则
FROM fields 
WHERE is_calculated = 0 AND datasource_id IS NULL;

-- 2.3 DS 物理关联 (排除 Custom SQL 和 Extract)
SELECT '空壳数据源(无表)' as 验证内容, COUNT(*) as 异常数, '已发布 DS 应关联物理表 (排除 Custom SQL)' as 规则 
FROM datasources ds 
WHERE is_embedded = 0 
  AND name NOT LIKE '%SQL%' 
  AND name NOT LIKE '%Extract%'
  AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.datasource_id = ds.id);

-- 8.2 计算字段归属缺失
SELECT 
    '计算字段归属缺失' as 验证内容,
    COUNT(*) as 异常数,
    '计算字段必须归属工作簿 (除非归属已发布DS)' as 规则
FROM fields 
WHERE is_calculated = 1 
  AND workbook_id IS NULL
  AND datasource_id IS NULL;  -- 只有当既无WB又无DS时才是问题

-- ================================================================
-- 9. 预计算血缘表验证 (Field Full Lineage)
-- 目的: 验证 field_full_lineage 表完整性和覆盖率
-- ================================================================
SELECT '★★★ 9. 预计算血缘表验证 ★★★' as 验证类别;

-- 9.1 血缘表覆盖率
SELECT '预计算血缘覆盖率' as 验证内容,
    (SELECT COUNT(DISTINCT field_id) FROM field_full_lineage) || '/' || (SELECT COUNT(*) FROM fields) as 覆盖情况,
    '所有字段应有血缘记录' as 规则;

-- 9.2 计算字段间接血缘 (应有 indirect 类型记录)
SELECT '计算字段间接血缘' as 验证内容,
    COUNT(*) as 有间接血缘数,
    '计算字段应有 lineage_type=indirect 记录' as 规则
FROM fields f
WHERE f.is_calculated = 1
  AND EXISTS (SELECT 1 FROM field_full_lineage fl WHERE fl.field_id = f.id AND fl.lineage_type = 'indirect');

-- 9.3 计算字段无血缘记录
SELECT '计算字段血缘缺失' as 验证内容,
    COUNT(*) as 异常数,
    '计算字段应能穿透到物理表' as 规则
FROM fields f
WHERE f.is_calculated = 1
  AND NOT EXISTS (SELECT 1 FROM field_full_lineage fl WHERE fl.field_id = f.id);


SELECT '========== 系统问题扫描完成 ==========' as 状态;

-- ================================================================
-- 10. 有数据但无血缘验证 (Orphan Asset Detection)
-- 目的: 检测同步进来但缺少关联的资产，用于排查同步逻辑遗漏
-- ================================================================
SELECT '★★★ 10. 有数据但无血缘验证 ★★★' as 验证类别;

-- 10.1 嵌入式表无数据源关联
SELECT '嵌入式表无数据源关联' as 验证内容,
    COUNT(*) as 异常数,
    '嵌入式表应通过 table_to_datasource 关联到嵌入式数据源' as 规则
FROM tables t
WHERE t.is_embedded = 1
  AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id);

-- 10.2 嵌入式数据源无工作簿关联
SELECT '嵌入式数据源无工作簿关联' as 验证内容,
    COUNT(*) as 异常数,
    '嵌入式数据源应通过 datasource_to_workbook 关联到工作簿' as 规则
FROM datasources d
WHERE d.is_embedded = 1
  AND NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = d.id);

-- 10.3 嵌入式表工作簿可追溯率
SELECT '嵌入式表工作簿可追溯率' as 验证内容,
    ROUND(100.0 * (
        SELECT COUNT(DISTINCT t.id)
        FROM tables t
        JOIN table_to_datasource td ON t.id = td.table_id
        JOIN datasource_to_workbook dw ON td.datasource_id = dw.datasource_id
        WHERE t.is_embedded = 1
    ) / NULLIF((SELECT COUNT(*) FROM tables WHERE is_embedded = 1), 0), 2) || '%' as 可追溯率,
    '嵌入式表能追溯到工作簿的比例' as 规则;

-- 10.4 有数据无血缘的嵌入式表样本
SELECT '无血缘嵌入式表样本' as 验证内容,
    t.name as 表名,
    t.database_id as 数据库ID
FROM tables t
WHERE t.is_embedded = 1
  AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id)
LIMIT 5;

-- 10.5 已发布数据源无工作簿关联
SELECT '已发布数据源无工作簿关联' as 验证内容,
    COUNT(*) as 异常数,
    '已发布数据源应被工作簿引用 (排除新发布未使用)' as 规则
FROM datasources d
WHERE d.is_embedded = 0
  AND NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = d.id);

-- 10.6 已发布数据表无数据源关联
SELECT '已发布数据表无数据源关联' as 验证内容,
    COUNT(*) as 异常数,
    '已发布数据表应被数据源引用 (排除新建未使用)' as 规则
FROM tables t
WHERE t.is_embedded = 0
  AND NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id);

SELECT '========== 完整验证扫描完成 ==========' as 状态;


