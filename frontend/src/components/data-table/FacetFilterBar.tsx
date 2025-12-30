'use client';

import React from 'react';
import { X, Filter } from 'lucide-react';
import DropdownFilter, { FilterOption } from './DropdownFilter';

export interface FacetConfig {
    [key: string]: {
        [value: string]: number;
    };
}

export interface ActiveFilters {
    [key: string]: string[];
}

interface FacetFilterBarProps {
    /** facets 数据 */
    facets: FacetConfig;
    /** 当前激活的筛选 */
    activeFilters: ActiveFilters;
    /** 筛选变化回调（批量更新） */
    onFilterChange: (facetKey: string, values: string[]) => void;
    /** 清空所有筛选 */
    onClearAll?: () => void;
}

// 标签映射
const FILTER_LABELS: Record<string, string> = {
    // 维度 key 翻译
    connection_type: '连接类型',
    role: '角色',
    is_certified: '认证状态',
    data_type: '数据类型',
    schema: 'Schema',
    hasDescription: '有描述',
    hasDuplicate: '有重复',
    metricType: '指标类型',
    hasExtract: '抽取类型',
    project_name: '项目',
    database_name: '数据库',
    view_type: '视图类型',
    owner: '负责人',
    isCalculated: '计算字段',
    dedup_method: '去重方式',  // 新增

    // 值翻译
    measure: '度量',
    dimension: '维度',
    'true': '是',
    'false': '否',
    business: '业务指标',
    technical: '技术计算',
    dashboard: '仪表盘',
    sheet: '工作表',
    all: '全部',
    physical_table: '按物理表+列',
    embedded_table: '按嵌入式表',
    datasource: '按数据源+名称',
    is_aggregated: '是否聚合',
    // 计算字段去重方式
    hash_embedded: '公式哈希+嵌入式',
    hash_published: '公式哈希+数据源',
    hash_mixed: '公式哈希+混合',
};

// 值到中文标签的翻译函数
function translateValue(value: string): string {
    return FILTER_LABELS[value] || value;
}

// 维度 key 到中文标签的翻译函数
function translateLabel(key: string): string {
    return FILTER_LABELS[key] || key;
}

export default function FacetFilterBar({
    facets,
    activeFilters,
    onFilterChange,
    onClearAll,
}: FacetFilterBarProps) {
    // 将 facets 转换为 DropdownFilter 需要的格式
    const facetEntries = Object.entries(facets).filter(
        ([, values]) => Object.keys(values).length > 0
    );

    // 计算是否有任何激活的筛选
    const hasActiveFilters = Object.values(activeFilters).some(values => values.length > 0);

    // 获取所有已选条件（用于展示已选汇总）
    const selectedChips: { facetKey: string; value: string; label: string }[] = [];
    Object.entries(activeFilters).forEach(([facetKey, values]) => {
        values.forEach(value => {
            selectedChips.push({
                facetKey,
                value,
                label: `${translateLabel(facetKey)}: ${translateValue(value)}`,
            });
        });
    });

    // 移除单个筛选项
    const handleRemoveChip = (facetKey: string, value: string) => {
        const currentValues = activeFilters[facetKey] || [];
        onFilterChange(facetKey, currentValues.filter(v => v !== value));
    };

    if (facetEntries.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            {/* 筛选器按钮行 */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 text-gray-400 mr-1">
                    <Filter className="w-4 h-4" />
                    <span className="text-xs font-medium">筛选</span>
                </div>

                {facetEntries.map(([facetKey, counts]) => {
                    const options: FilterOption[] = Object.entries(counts).map(([value, count]) => ({
                        value,
                        label: translateValue(value),
                        count,
                    }));

                    return (
                        <DropdownFilter
                            key={facetKey}
                            facetKey={facetKey}
                            label={translateLabel(facetKey)}
                            options={options}
                            selectedValues={activeFilters[facetKey] || []}
                            onSelectionChange={onFilterChange}
                        />
                    );
                })}

                {/* 清空全部按钮 */}
                {hasActiveFilters && onClearAll && (
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                        清空全部
                    </button>
                )}
            </div>

            {/* 已选筛选项汇总行 */}
            {selectedChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-400">已选:</span>
                    {selectedChips.map(chip => (
                        <span
                            key={`${chip.facetKey}-${chip.value}`}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-200"
                        >
                            {chip.label}
                            <button
                                type="button"
                                onClick={() => handleRemoveChip(chip.facetKey, chip.value)}
                                className="hover:text-indigo-900 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
