-- ================================================================
-- Tableau 元数据治理平台 - 全量系统设计验证脚本 (Ultimate Design Validator)
-- 目的: 验证元数据模型在物理、逻辑、消费、字段、血缘 5 大维度的设计完整性
-- 特性: 全量原子化拆解，每个 check 只验证一个具体规则
-- 模式: 问题导向 (Issue-Oriented) - 只列出问题，不列出覆盖率
-- ================================================================

.mode column
.headers on
.width 45 40 40

-- ================================================================
-- 1. 物理基础设施验证 (Physical Infrastructure)
-- Object: Database, Table, DBColumn
-- ================================================================
SELECT '★★★ 1. 物理基础设施验证 (Atomic) ★★★' as 验证类别;

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
SELECT '★★★ 2. 数据源语义层验证 (Atomic) ★★★' as 验证类别;

-- 2.1 DS 名称完整性
SELECT '数据源名称为空' as 验证内容, COUNT(*) as 异常数, 'Datasource.name 不能为空' as 规则 
FROM datasources WHERE name IS NULL OR name = '';

-- 2.2 DS 项目归属 (仅针对非内嵌)
SELECT '数据源未归属项目' as 验证内容, COUNT(*) as 异常数, '非内嵌 DS 必须有 project_name' as 规则 
FROM datasources WHERE is_embedded = 0 AND (project_name IS NULL OR project_name = '');

-- 2.3 DS 物理关联 (是否有下层表)
SELECT '空壳数据源(无表)' as 验证内容, COUNT(*) as 异常数, 'DS 应通过 table_to_datasource 关联物理表' as 规则 
FROM datasources ds WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.datasource_id = ds.id);

-- 2.4 DS 字段内容 (是否为空壳)
SELECT '空壳数据源(无字段)' as 验证内容, COUNT(*) as 异常数, 'DS 必须包含至少一个 Field' as 规则 
FROM datasources ds WHERE NOT EXISTS (SELECT 1 FROM fields f WHERE f.datasource_id = ds.id);

-- ================================================================
-- 3. 消费层验证 (Consumption Layer)
-- Object: Workbook, View, Project
-- ================================================================
SELECT '★★★ 3. 消费层验证 (Atomic) ★★★' as 验证类别;

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
SELECT '★★★ 4. 字段与指标逻辑验证 (Atomic) ★★★' as 验证类别;

-- 4.1 幽灵字段 (Ghost Fields)
SELECT '幽灵字段(悬空)' as 验证内容, COUNT(*) as 异常数, '字段必须属于 DS 或 WB' as 规则 
FROM fields WHERE datasource_id IS NULL AND workbook_id IS NULL;

-- 4.2 计算公式缺失
SELECT '计算公式丢失' as 验证内容, COUNT(*) as 异常数, 'is_calculated=1 必须有 formula' as 规则 
FROM fields WHERE is_calculated = 1 AND (formula IS NULL OR formula = '');

-- 4.3 度量类型缺失
SELECT '度量数据类型缺失' as 验证内容, COUNT(*) as 异常数, 'Role=measure 必须有 data_type' as 规则 
FROM fields WHERE role = 'measure' AND (data_type IS NULL OR data_type = '');

-- 4.4 度量角色缺失 (如果定义为 Metric 但没 Role)
SELECT '计算字段角色未定义' as 验证内容, COUNT(*) as 异常数, 'is_calculated=1 且名为 Metric 的字段应有 Role' as 规则 
FROM fields WHERE is_calculated = 1 AND role IS NULL;

-- ================================================================
-- 5. [已移除] 实体关系基数统计 (Cardinality Stats)
-- 根据用户要求“只写问题，不写指标”，移除单纯的分布统计
-- ================================================================

-- ================================================================
-- 6. 血缘全链路中断验证 (Broken Lineage)
-- 问题模式：计算中断数量，而不是覆盖率
-- ================================================================
SELECT '★★★ 6. 血缘全链路中断验证 ★★★' as 验证类别;

-- 6.1 Table -> DS
SELECT '物理-语义血缘中断' as 验证内容, 
    COUNT(*) as 异常数, 
    '物理表未被任何数据源引用' as 规则 
FROM tables t 
WHERE NOT EXISTS (SELECT 1 FROM table_to_datasource td WHERE td.table_id = t.id);

-- 6.2 DS -> WB (同 7.1.4 未引用数据源，此处为血缘视角)
SELECT '语义-消费血缘中断' as 验证内容, 
    COUNT(*) as 异常数, 
    '数据源未被任何工作簿引用' as 规则 
FROM datasources ds 
WHERE NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = ds.id);

-- 6.3 Field -> View
SELECT '字段-视图血缘中断' as 验证内容, 
    COUNT(*) as 异常数, 
    '字段未被任何视图引用' as 规则 
FROM fields f 
WHERE NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id);

-- ================================================================
-- 7. 数据治理合理性验证 (Governance Rationality - Deep Dive)
-- 目的: 从利用率、冗余度、有效性、规范性 4 个维度进行深层治理扫描
-- ================================================================
SELECT '★★★ 7. 数据治理合理性验证 (Deep Dive) ★★★' as 验证类别;

-- ==================== 7.1 资产利用率 (Utilization) ====================

-- 7.1.1 未使用计算指标 (需要满足: 所有实例均无任何引用)
SELECT 
    '僵尸计算指标' as 验证内容,
    COUNT(*) as 异常数,
    '聚合后全局引用次数为 0 的指标' as 规则
FROM (
    SELECT f.name, cf.formula_hash
    FROM fields f
    JOIN calculated_fields cf ON f.id = cf.field_id
    WHERE f.is_calculated = 1 AND f.role = 'measure'
    GROUP BY f.name, cf.formula_hash
    HAVING SUM(COALESCE(cf.reference_count, 0)) = 0 
       AND SUM(COALESCE(f.usage_count, 0)) = 0
);

-- 7.1.2 未使用计算维度 (需要满足: 所有实例均无任何引用)
SELECT 
    '僵尸计算维度' as 验证内容,
    COUNT(*) as 异常数,
    '聚合后全局引用次数为 0 的维度' as 规则
FROM (
    SELECT f.name, cf.formula_hash
    FROM fields f
    JOIN calculated_fields cf ON f.id = cf.field_id
    WHERE f.is_calculated = 1 AND f.role = 'dimension'
    GROUP BY f.name, cf.formula_hash
    HAVING SUM(COALESCE(cf.reference_count, 0)) = 0 
       AND SUM(COALESCE(f.usage_count, 0)) = 0
);

-- 7.1.3 零引用物理字段 (去重: name，物理字段无 formula_hash)
SELECT 
    '冗余物理列' as 验证内容,
    COUNT(DISTINCT f.name) as 异常数,
    '去重后未被使用的物理字段逻辑实体' as 规则
FROM fields f
WHERE (f.is_calculated = 0 OR f.is_calculated IS NULL)
  AND NOT EXISTS (SELECT 1 FROM field_to_view fv WHERE fv.field_id = f.id);

-- 7.1.4 未引用数据源 (Zombie Datasources)
-- (已在 6.2 覆盖，但作为治理项保留，或者合并)
SELECT 
    '僵尸数据源' as 验证内容,
    COUNT(*) as 异常数,
    '已发布但未被连接的数据源' as 规则
FROM datasources ds
WHERE is_embedded = 0
  AND NOT EXISTS (SELECT 1 FROM datasource_to_workbook dw WHERE dw.datasource_id = ds.id);


-- ==================== 7.2 逻辑冗余度 (Redundancy) ====================

-- 7.2.1 完全重复公式
SELECT 
    '逻辑重复定义' as 验证内容,
    SUM(cnt - 1) as 异常数,
    '不同字段使用了完全相同的计算公式' as 规则
FROM (
    SELECT formula, COUNT(*) as cnt
    FROM fields
    WHERE is_calculated = 1 AND formula IS NOT NULL AND formula != ''
    GROUP BY formula
    HAVING cnt > 1
);

-- 7.2.2 命名冲突逻辑
SELECT 
    '字段名歧义冲突' as 验证内容,
    COUNT(*) as 异常数,
    '同名但公式不同' as 规则
FROM (
    SELECT name, COUNT(DISTINCT formula) as distinct_formulas
    FROM fields
    WHERE is_calculated = 1 AND formula IS NOT NULL
    GROUP BY name
    HAVING distinct_formulas > 1
);


-- ==================== 7.3 容器有效性 (Container Validity) ====================

-- 7.3.1 空壳工作簿
SELECT 
    '空容器工作簿' as 验证内容,
    COUNT(*) as 异常数,
    '不包含任何视图的工作簿' as 规则
FROM workbooks w
WHERE NOT EXISTS (SELECT 1 FROM views v WHERE v.workbook_id = w.id);

-- 7.3.2 空壳 Dashboard
SELECT 
    '空容器仪表板' as 验证内容,
    COUNT(*) as 异常数,
    '未包含任何 Sheet 的仪表板' as 规则
FROM views v
WHERE v.view_type = 'dashboard'
  AND NOT EXISTS (SELECT 1 FROM dashboard_to_sheet ds WHERE ds.dashboard_id = v.id);


-- ==================== 7.4 规范性与完整性 (Standardization) ====================

-- 7.4.1 无认证数据源
SELECT 
    '非认证数据源' as 验证内容,
    COUNT(*) as 异常数,
    '未经过官方认证流程的数据源' as 规则
FROM datasources
WHERE is_embedded = 0 
  AND (is_certified = 0 OR is_certified IS NULL);

-- 7.4.2 无描述核心资产
SELECT 
    '资产描述缺失' as 验证内容,
    COUNT(*) as 异常数,
    '缺失描述的表和字段' as 规则
FROM (
    SELECT id FROM tables WHERE description IS NULL OR description = ''
    UNION ALL
    SELECT id FROM fields WHERE description IS NULL OR description = ''
);

-- 7.4.3 简单计算字段
SELECT 
    '低价值重命名' as 验证内容,
    COUNT(*) as 异常数,
    '复杂度极低 (Score<=1) 的计算字段' as 规则
FROM calculated_fields
WHERE complexity_score <= 1;

-- 7.4.4 无负责人工作簿
SELECT 
    '无主资产' as 验证内容,
    COUNT(*) as 异常数,
    'Owner 字段为空的工作簿' as 规则
FROM workbooks
WHERE owner IS NULL OR owner = '';

-- ==================== 7.5 实例统计验证 (Instance Count Verification) ====================
-- 目的: 验证实例数统计的准确性和一致性

-- 7.5.1 原始字段实例数验证
-- 定义: instance_count = 按 (规范名称 + table_id) 分组后的记录数
-- 验证: 实例数 vs 实际关联数据源数 的差异
SELECT 
    '原始字段实例-数据源差异' as 验证内容,
    COUNT(*) as 异常数,
    '实例数与数据源数不一致的字段组' as 规则
FROM (
    SELECT 
        COALESCE(upstream_column_name, name) as canonical_name,
        table_id,
        COUNT(*) as instance_count,
        COUNT(DISTINCT datasource_id) as datasource_count
    FROM fields
    WHERE is_calculated = 0 OR is_calculated IS NULL
    GROUP BY COALESCE(upstream_column_name, name), table_id
    HAVING instance_count != datasource_count
);

-- 7.5.2 计算字段实例数验证
-- 定义: instance_count = 按 (name + formula_hash) 分组后的记录数
-- 验证: 实例数 vs 工作簿数 的关系
SELECT 
    '计算字段工作簿分布' as 验证内容,
    COUNT(*) as 异常数,
    '实例来自相同工作簿(可能是内嵌重复)' as 规则
FROM (
    SELECT 
        f.name,
        cf.formula_hash,
        COUNT(*) as instance_count,
        COUNT(DISTINCT f.datasource_id) as datasource_count,
        COUNT(DISTINCT f.workbook_id) as workbook_count
    FROM fields f
    JOIN calculated_fields cf ON f.id = cf.field_id
    GROUP BY f.name, cf.formula_hash
    HAVING instance_count > 1 AND datasource_count = 1
);

-- 7.5.3 实例统计口径说明 (信息输出)
SELECT 
    '实例统计口径' as 验证内容,
    '原始字段: 按(名称+表)分组的记录数 | 计算字段: 按(名称+公式哈希)分组的记录数' as 说明,
    '实例可能来自同一数据源的多个工作簿' as 注意事项;

-- 7.5.4 高实例数字段 (Top 10)
SELECT 
    '高实例数原始字段 Top 5' as 验证内容,
    canonical_name as 字段名,
    instance_count as 实例数,
    datasource_count as 数据源数
FROM (
    SELECT 
        COALESCE(upstream_column_name, name) as canonical_name,
        COUNT(*) as instance_count,
        COUNT(DISTINCT datasource_id) as datasource_count
    FROM fields
    WHERE is_calculated = 0 OR is_calculated IS NULL
    GROUP BY COALESCE(upstream_column_name, name), table_id
    ORDER BY instance_count DESC
    LIMIT 5
);

-- 7.5.5 高实例数计算字段 (Top 5)
SELECT 
    '高实例数计算字段 Top 5' as 验证内容,
    f.name as 字段名,
    COUNT(*) as 实例数,
    COUNT(DISTINCT f.datasource_id) as 数据源数,
    COUNT(DISTINCT f.workbook_id) as 工作簿数
FROM fields f
JOIN calculated_fields cf ON f.id = cf.field_id
GROUP BY f.name, cf.formula_hash
ORDER BY COUNT(*) DESC
LIMIT 5;

SELECT '========== 问题扫描完成 ==========' as 状态;
