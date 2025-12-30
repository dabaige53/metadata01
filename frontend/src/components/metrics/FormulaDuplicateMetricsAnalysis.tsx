'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    AlertTriangle,
    Search
} from 'lucide-react';
import MetricCatalogCard, { MetricCatalogItem } from '../cards/MetricCatalogCard';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';

interface FormulaDuplicateMetricsAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

const SORT_OPTIONS: SortConfig[] = [
    { key: 'name_count', label: '名称数' },
    { key: 'instance_count', label: '实例数' },
    { key: 'total_references', label: '引用数' },
    { key: 'name', label: '名称' }
];

export default function FormulaDuplicateMetricsAnalysis({ onCountUpdate, onSortUpdate }: FormulaDuplicateMetricsAnalysisProps) {
    const [allData, setAllData] = useState<MetricCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics/catalog/duplicate-formula')
            .then(res => res.json())
            .then(result => {
                const items = (result.items || []).map((item: MetricCatalogItem) => {
                    const score = item.complexity || 0;
                    let level = '低';
                    if (score > 10) level = '超高';
                    else if (score > 6) level = '高';
                    else if (score > 3) level = '中';
                    return { ...item, complexity_level: level };
                });
                setAllData(items);
                onCountUpdate?.(items.length);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        moduleName: 'metrics-duplicate-formula',
        data: allData,
        facetFields: ['role'],
        searchFields: ['name', 'formula'],
        defaultPageSize: 20,
        defaultSelected: true
    });

    useEffect(() => {
        onSortUpdate?.({
            options: SORT_OPTIONS,
            state: sortState,
            onChange: handleSortChange
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortState]);

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
                <h3 className="text-green-800 font-bold mb-1">未发现同公式多名称</h3>
                <p className="text-green-600 text-sm">当前没有出现相同公式对应多个指标名称的情况。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">同公式多名称</div>
                    <div className="text-2xl font-bold text-red-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">按公式哈希聚合的命名差异</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源</div>
                    <div className="text-2xl font-bold text-purple-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同公式跨多个数据源</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨工作簿</div>
                    <div className="text-2xl font-bold text-blue-600">{multiWorkbookCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同公式跨多个工作簿</div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />

                <div className="flex items-center gap-2">
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
            </div>

            <div className="space-y-3">
                {displayData.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        未找到匹配的指标
                    </div>
                ) : (
                    displayData.map((item, idx) => (
                        <div key={`${item.name}-${item.formula_hash || idx}`}>
                            <MetricCatalogCard
                                metric={item}
                                onClick={() => openDrawer(item.representative_id || '', 'metrics')}
                            />
                            {item.name_variants && item.name_variants.length > 0 && (
                                <div className="mt-2 bg-gray-50/60 border border-gray-100 rounded-lg p-3">
                                    <div className="text-[11px] text-gray-500 mb-2">不同名称：</div>
                                    <div className="space-y-2">
                                        {item.name_variants.map((variant, vi) => (
                                            <button
                                                key={`${variant.name}-${vi}`}
                                                onClick={() => openDrawer(variant.representative_id, 'metrics', variant.name, 'instance')}
                                                className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-[12px] text-gray-800 font-medium">
                                                        {variant.name}
                                                    </div>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                                                    {variant.datasources && variant.datasources.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {variant.datasources.slice(0, 3).map((ds, di) => (
                                                                <span key={`${ds.id}-${di}`} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                                                    {ds.name}
                                                                </span>
                                                            ))}
                                                            {variant.datasource_count && variant.datasource_count > 3 && (
                                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                                                    +{variant.datasource_count - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {variant.workbooks && variant.workbooks.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {variant.workbooks.slice(0, 3).map((wb, wi) => (
                                                                <span key={`${wb.id}-${wi}`} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                                                    {wb.name}
                                                                </span>
                                                            ))}
                                                            {variant.workbook_count && variant.workbook_count > 3 && (
                                                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                                                    +{variant.workbook_count - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {variant.tables && variant.tables.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {variant.tables.slice(0, 3).map((tb, ti) => (
                                                                <span key={`${tb.id}-${ti}`} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                                                                    {tb.name}
                                                                </span>
                                                            ))}
                                                            {variant.table_count && variant.table_count > 3 && (
                                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                                                                    +{variant.table_count - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {allData.length > paginationState.pageSize && (
                <div className="mt-6">
                    <Pagination
                        pagination={paginationState}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                </div>
            )}

            <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-lg flex items-start gap-3">
                <div className="p-1 bg-yellow-100 rounded text-yellow-700 flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-[13px] text-yellow-800 leading-relaxed">
                    <strong>治理建议：</strong> 同一公式出现多个名称会造成口径混乱，建议统一名称并沉淀为标准指标。
                </div>
            </div>
        </div>
    );
}
