-- ==================== 001: 索引优化 ====================

-- fields表索引
CREATE INDEX IF NOT EXISTS idx_fields_role ON fields(role);
CREATE INDEX IF NOT EXISTS idx_fields_data_type ON fields(data_type);
CREATE INDEX IF NOT EXISTS idx_fields_name ON fields(name);
CREATE INDEX IF NOT EXISTS idx_fields_datasource_id ON fields(datasource_id);
CREATE INDEX IF NOT EXISTS idx_fields_table_id ON fields(table_id);

-- calculated_fields表索引
CREATE INDEX IF NOT EXISTS idx_calc_fields_complexity ON calculated_fields(complexity_score DESC);
CREATE INDEX IF NOT EXISTS idx_calc_fields_reference_count ON calculated_fields(reference_count DESC);

-- field_dependencies表索引
CREATE INDEX IF NOT EXISTS idx_field_deps_source ON field_dependencies(source_field_id);
CREATE INDEX IF NOT EXISTS idx_field_deps_dependency ON field_dependencies(dependency_field_id);
CREATE INDEX IF NOT EXISTS idx_field_deps_name ON field_dependencies(dependency_name);

-- field_to_view关联表索引
CREATE INDEX IF NOT EXISTS idx_field_to_view_field ON field_to_view(field_id);
CREATE INDEX IF NOT EXISTS idx_field_to_view_view ON field_to_view(view_id);

-- views表索引
CREATE INDEX IF NOT EXISTS idx_views_workbook ON views(workbook_id);
