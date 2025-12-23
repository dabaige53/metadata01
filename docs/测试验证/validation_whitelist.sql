-- ================================================================
-- 验证白名单配置 (Validation Whitelist)
-- 作用: 存储已确认的误报 (False Positives) 和例外情况
-- 调用方式: 在主验证脚本中通过 .read 读取
-- ================================================================

CREATE TEMP TABLE IF NOT EXISTS temp_whitelist (
    rule_id TEXT,      -- 规则ID (如 '2.3', '4.2')
    value TEXT,        -- 匹配值
    match_type TEXT,   -- 匹配类型: 'EXACT' (精确), 'LIKE' (模糊)
    reason TEXT        -- 白名单原因
);

DELETE FROM temp_whitelist;

-- 2.3 空壳数据源 (排除 Custom SQL 和 Extract)
INSERT INTO temp_whitelist VALUES 
('2.3', '%SQL%', 'LIKE', 'Custom SQL 无法解析物理表'),
('2.3', '%Extract%', 'LIKE', '中间过程 Extract 文件');

-- 4.2 计算公式丢失 (排除 Ad-hoc 别名字段)
INSERT INTO temp_whitelist VALUES 
('4.2', 'HO座公里投入', 'EXACT', '业务别名/简单聚合'),
('4.2', '中转次数', 'EXACT', '业务别名/简单聚合');
