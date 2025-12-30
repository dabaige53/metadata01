'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Zap,
    AlertTriangle,
    FunctionSquare,
    GitBranch,
    Search
} from 'lucide-react';
import { MetricCatalogItem } from '../cards/MetricCatalogCard';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';

// 排序选项定义在组件外部，保证引用稳定
const SORT_OPTIONS: SortConfig[] = [
    { key: 'complexity', label: '复杂度' },
    { key: 'total_references', label: '引用数' },
    { key: 'name', label: '名称' }
];

interface ComplexMetricsAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function ComplexMetricsAnalysis({ onCountUpdate, onSortUpdate }: ComplexMetricsAnalysisProps) {
    const [allData, setAllData] = useState<MetricCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics/catalog/complex')
            .then(res => res.json())
            .then(result => {
                const items = result.items || [];
                setAllData(items);
                onCountUpdate?.(items.length);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 只在挂载时获取数据

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
        setSearchTerm,
        handleSearch,
        clearSearch
    } = useDataTable({
        moduleName: 'metrics-complex',
        data: allData,
        facetFields: ['role'],
        searchFields: ['name', 'formula'],
        defaultPageSize: 20
    });

    // 同步排序状态给父组件 - 使用稳定的 SORT_OPTIONS 常量
    useEffect(() => {
        onSortUpdate?.({
            options: SORT_OPTIONS,
            state: sortState,
            onChange: handleSortChange
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortState]);

    // 统计
    const multiDatasourceCount = allData.filter(m => m.datasource_count > 1).length;

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
                    <Zap className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有高复杂度指标</h3>
                <p className="text-green-600 text-sm">所有指标公式都比较简洁，维护性良好！</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">高复杂度指标</div>
                    <div className="text-2xl font-bold text-orange-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">评分 &gt; 10 或 长度 &gt; 300</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">超高复杂度</div>
                    <div className="text-2xl font-bold text-red-600">{allData.filter(m => m.complexity > 20).length}</div>
                    <div className="text-xs text-gray-400 mt-1">评分 &gt; 20</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源</div>
                    <div className="text-2xl font-bold text-purple-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">复杂度可能传播</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        考虑拆分或简化
                    </div>
                </div>
            </div>

            {/* 统一工具栏: 筛选 (左) + 排序 & 搜索 (右) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />

                {/* 搜索框组件 */}
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索参数名称或公式..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="block w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={clearSearch}
                                className="absolute inset-y-0 right-0 pr-2 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                                title="清空搜索"
                            >
                                <span className="text-xs">✕</span>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => handleSearch()}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        搜索
                    </button>
                </div>
            </div>

            {/* 复杂指标卡片列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        高难度规范指标列表
                        <span className="text-xs text-gray-500 font-normal">按规范指标复杂度排序</span>
                    </h3>
                </div>
                <div className="space-y-0 divide-y divide-gray-100">
                    {displayData.length === 0 ? (
                        <div className="p-12 text-center text-gray-400">
                            未找到匹配的高复杂度指标
                        </div>
                    ) : (
                        displayData.map((item, idx) => {
                            return (
                                <div
                                    key={`${item.name}-${item.formula_hash || idx}`}
                                    className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => openDrawer(item.representative_id || '', 'metrics')}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* 图标 */}
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-50 text-orange-600">
                                            <FunctionSquare className="w-5 h-5" />
                                        </div>

                                        {/* 指标信息 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-gray-800">{item.name}</span>
                                                {/* 复杂度标签 */}
                                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${item.complexity_level === '超高' ? 'text-red-600 bg-red-50' :
                                                    item.complexity_level === '高' ? 'text-orange-600 bg-orange-50' :
                                                        item.complexity_level === '中' ? 'text-purple-600 bg-purple-50' : 'text-blue-600 bg-blue-50'
                                                    }`}>
                                                    {item.complexity_level === '超高' ? '🔴' : '🟠'} {item.complexity_level} (评分:{item.complexity})
                                                </span>
                                                {/* 实例数标签 */}
                                                {item.instance_count > 1 && (
                                                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-600">
                                                        {item.instance_count} 实例
                                                    </span>
                                                )}
                                                {/* 多数据源血缘标记 */}
                                                {item.datasource_count > 1 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-600">
                                                        <GitBranch className="w-3 h-3" />
                                                        跨 {item.datasource_count} 数据源
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

                                        {/* 引用数 */}
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-lg font-bold text-gray-700">{item.total_references || 0}</div>
                                            <div className="text-xs text-gray-400">引用</div>
                                        </div>

                                        <div className="text-gray-300">→</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {allData.length > paginationState.pageSize && (
                    <div className="p-4 border-t border-gray-100">
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
