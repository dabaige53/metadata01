'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, FunctionSquare } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import MetricCard from '@/components/cards/MetricCard';
import { useDataTable } from '@/hooks/useDataTable';
import DuplicateMetricsAnalysis from '@/components/metrics/DuplicateMetricsAnalysis';

interface MetricItem {
    id: string;
    name: string;
    role?: string;
    formula?: string;
    complexity?: number;
    referenceCount?: number;
    reference_count?: number;
    hasDuplicate?: boolean;
    has_duplicate?: boolean;
    similarMetrics?: Array<{ id: string; name: string }>;
    dependencyFields?: Array<{ id: string; name: string; role?: string }>;
    datasourceName?: string;
    datasource_name?: string;
    [key: string]: string | number | boolean | undefined | Array<{ id: string; name: string; role?: string }>;
}

function MetricsContent() {
    const [allData, setAllData] = useState<MetricItem[]>([]);
    const [apiTotal, setApiTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        fetch('/api/metrics?page=1&page_size=5000')
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                setAllData(items);
                setApiTotal(result.total || items.length);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // 使用自定义 Hook 管理表格状态
    const {
        displayData,
        totalCount,
        facets,
        activeFilters,
        handleFilterChange,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
    } = useDataTable({
        moduleName: 'metrics',
        data: allData,
        facetFields: ['metricType', 'role', 'hasDuplicate'],
        defaultPageSize: 50,
        searchFields: ['name', 'formula', 'datasourceName', 'datasource_name'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'complexity', label: '复杂度' },
        { key: 'referenceCount', label: '引用数' },
        { key: 'name', label: '名称' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FunctionSquare className="w-5 h-5 text-indigo-600" />
                        指标库
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {apiTotal.toLocaleString()} 项
                        </span>
                    </h1>

                    {/* 标签页切换 */}
                    <div className="flex p-1 bg-gray-100/80 rounded-lg">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            指标列表
                        </button>
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'analysis'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            重复指标分析
                        </button>
                    </div>
                </div>

                {activeTab === 'list' && (
                    <SortButtons
                        sortOptions={sortOptions}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                )}
            </div>

            {/* 标签页内容切换 */}
            {activeTab === 'list' && (
                <InlineFilter
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleFilterChange}
                />
            )}

            {activeTab === 'list' ? (
                <>
                    {/* 横向卡片列表 */}
                    <div className="space-y-3">
                        {displayData.length === 0 ? (
                            <div className="py-20 text-center text-gray-400">
                                {totalCount === 0 ? '暂无数据' : '未找到匹配的指标'}
                            </div>
                        ) : (
                            displayData.map((item) => (
                                <MetricCard
                                    key={item.id}
                                    metric={item}
                                    onClick={() => openDrawer(item.id, 'metrics', item.name)}
                                />
                            ))
                        )}
                    </div>

                    {/* 分页控件 */}
                    {displayData.length > 0 && (
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                        />
                    )}
                </>
            ) : (
                <DuplicateMetricsAnalysis />
            )}
        </div>
    );
}

export default function MetricsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <MetricsContent />
        </Suspense>
    );
}
