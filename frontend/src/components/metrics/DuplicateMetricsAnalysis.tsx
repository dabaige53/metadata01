'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    AlertTriangle,
    FunctionSquare,
    GitBranch,
    Search
} from 'lucide-react';
import { MetricCatalogItem } from '../cards/MetricCatalogCard';
import FacetFilterBar from '../data-table/FacetFilterBar';
import SortButtons from '../data-table/SortButtons';
import Pagination from '../data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';

interface DuplicateMetricsAnalysisProps {
    onCountUpdate?: (count: number) => void;
}

export default function DuplicateMetricsAnalysis({ onCountUpdate }: DuplicateMetricsAnalysisProps) {
    const [allData, setAllData] = useState<MetricCatalogItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics/catalog/duplicate')
            .then(res => res.json())
            .then(result => {
                const items = result.items || [];
                setAllData(items);
                onCountUpdate?.(items.length);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [onCountUpdate]);

    const {
        displayData,
        facets,
        activeFilters,
        handleBatchFilterChange,
        handleClearAllFilters,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
        handlePageSizeChange,
        searchTerm,
        setSearchTerm
    } = useDataTable({
        moduleName: 'metrics-duplicate',
        data: allData,
        facetFields: ['role'],
        searchFields: ['name', 'formula'],
        defaultPageSize: 20
    });

    // 统计多数据源/多工作簿数量
    const multiDatasourceCount = allData.filter(m => m.datasource_count > 1).length;
    const multiWorkbookCount = allData.filter(m => m.workbook_count > 1).length;

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (allData.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">未发现重复指标</h3>
                <p className="text-green-600 text-sm">您的指标管理非常规范，没有发现同一指标在多处重复定义的情况。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">重复规范指标数</div>
                    <div className="text-2xl font-bold text-red-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">基于公式哈希聚合的冗余资产</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源</div>
                    <div className="text-2xl font-bold text-purple-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同一指标跨多个数据源</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨工作簿</div>
                    <div className="text-2xl font-bold text-blue-600">{multiWorkbookCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同一指标跨多个工作簿</div>
                </div>
            </div>

            {/* 工具栏: 右上排序 */}
            <div className="flex justify-end">
                <SortButtons
                    sortOptions={[
                        { key: 'total_references', label: '引用数' },
                        { key: 'instance_count', label: '实例数' },
                        { key: 'name', label: '名称' }
                    ]}
                    currentSort={sortState}
                    onSortChange={handleSortChange}
                />
            </div>

            {/* 工具栏: 左下筛选 + 右下搜索 */}
            <div className="flex items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />

                <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="搜索指标名称或公式..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* 指标卡片列表 */}
            <div className="space-y-3">
                {displayData.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        未找到匹配的指标
                    </div>
                ) : (
                    displayData.map((item, idx) => (
                        <div
                            key={`${item.name}-${item.formula_hash || idx}`}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => openDrawer(item.representative_id || '', 'metrics')}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-50 text-red-600">
                                        <FunctionSquare className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-gray-800 text-[15px]">
                                                {item.name}
                                            </h4>
                                            {/* 实例数标签 */}
                                            <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-red-50 text-red-700 border border-red-100">
                                                {item.instance_count} 个实例
                                            </span>
                                            {/* 多数据源血缘标记 */}
                                            {item.datasource_count > 1 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-600">
                                                    <GitBranch className="w-3 h-3" />
                                                    跨 {item.datasource_count} 数据源
                                                </span>
                                            )}
                                            {/* 多工作簿标记 */}
                                            {item.workbook_count > 1 && (
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">
                                                    {item.workbook_count} 个工作簿
                                                </span>
                                            )}
                                        </div>
                                        {/* 公式预览 */}
                                        <div className="mt-2">
                                            <code className="bg-gray-100/50 px-2 py-1 rounded text-[11px] text-gray-600 font-mono line-clamp-2">
                                                {item.formula}
                                            </code>
                                        </div>
                                    </div>
                                </div>

                                {/* 右侧引用数 */}
                                <div className="flex items-center gap-4 text-right">
                                    <div>
                                        <div className="text-lg font-bold text-gray-700">{item.total_references || 0}</div>
                                        <div className="text-xs text-gray-400">总引用</div>
                                    </div>
                                    <div className="text-gray-300">→</div>
                                </div>
                            </div>

                            {/* 数据源/工作簿列表 */}
                            {(item.datasource_count > 1 || item.workbook_count > 1) && (
                                <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-4">
                                    {item.datasources && item.datasource_count > 1 && (
                                        <div>
                                            <div className="text-xs text-gray-400 mb-1">涉及数据源：</div>
                                            <div className="flex flex-wrap gap-1">
                                                {item.datasources.map((ds, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                                                        {ds.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {item.workbooks && item.workbook_count > 1 && (
                                        <div>
                                            <div className="text-xs text-gray-400 mb-1">涉及工作簿：</div>
                                            <div className="flex flex-wrap gap-1">
                                                {item.workbooks.map((wb, i) => (
                                                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-md">
                                                        {wb.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )))}
            </div>

            {/* 分页控制 */}
            {allData.length > paginationState.pageSize && (
                <div className="mt-6">
                    <Pagination
                        pagination={paginationState}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                </div>
            )}

            {/* 治理建议 */}
            <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-lg flex items-start gap-3">
                <div className="p-1 bg-yellow-100 rounded text-yellow-700 flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-[13px] text-yellow-800 leading-relaxed">
                    <strong>治理建议：</strong> 重复指标可能导致维护成本增加和口径不一致风险。建议将重复的指标统一为一个标准定义，并在需要的地方引用同一数据源。
                </div>
            </div>
        </div>
    );
}
