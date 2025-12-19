-- ==================== 002: 添加预计算统计字段 ====================

-- fields表添加统计字段
ALTER TABLE fields ADD COLUMN usage_count INTEGER DEFAULT 0;
ALTER TABLE fields ADD COLUMN metric_usage_count INTEGER DEFAULT 0;
ALTER TABLE fields ADD COLUMN last_used_at DATETIME;

-- calculated_fields表添加统计字段
ALTER TABLE calculated_fields ADD COLUMN has_duplicates BOOLEAN DEFAULT 0;
ALTER TABLE calculated_fields ADD COLUMN duplicate_count INTEGER DEFAULT 0;
ALTER TABLE calculated_fields ADD COLUMN dependency_count INTEGER DEFAULT 0;
ALTER TABLE calculated_fields ADD COLUMN formula_hash VARCHAR(64);

-- 创建索引以支持快速排序
CREATE INDEX IF NOT EXISTS idx_fields_usage_count ON fields(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_fields_metric_usage_count ON fields(metric_usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_calc_fields_formula_hash ON calculated_fields(formula_hash);
CREATE INDEX IF NOT EXISTS idx_calc_fields_dep_count ON calculated_fields(dependency_count DESC);
