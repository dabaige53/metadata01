'use client';

import { Loader2, FunctionSquare, Search } from 'lucide-react';
import DuplicateMetricsAnalysis from '@/components/metrics/DuplicateMetricsAnalysis';
import ComplexMetricsAnalysis from '@/components/metrics/ComplexMetricsAnalysis';
import UnusedMetricsAnalysis from '@/components/metrics/UnusedMetricsAnalysis';
import MetricCatalog from '@/components/metrics/MetricCatalog';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
import SortButtons from '@/components/data-table/SortButtons';
import { useDataTable } from '@/hooks/useDataTable';
import { Suspense, useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';

function MetricsContent() {
    const [activeTab, setActiveTab] = useState<'catalog' | 'duplicate' | 'complex' | 'unused'>('catalog');
    const { openDrawer } = useDrawer();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/metrics/catalog?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
        } catch (error) {
            console.error('Failed to fetch metric catalog:', error);
        } finally {
            setLoading(false);
        }
    };

    const {
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
        moduleName: 'metrics',
        data: data,
        facetFields: ['metric_type'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'catalog') {
                fetchData(params);
            }
        },
    });

    const sortOptions = [
        { key: 'total_usage', label: '热度' },
        { key: 'complexity', label: '复杂度' },
        { key: 'name', label: '名称' },
    ];

    return (
        <div className="space-y-4">
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FunctionSquare className="w-5 h-5 text-indigo-600" />
                        计算字段
                        {activeTab === 'catalog' && (
                            <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {total.toLocaleString()} 项
                            </span>
                        )}
                    </h1>

                    {/* 标签页切换 */}
                    <div className="flex p-1 bg-gray-100/80 rounded-lg">
                        <button
                            onClick={() => setActiveTab('catalog')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'catalog'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            计算字段目录
                        </button>
                        <button
                            onClick={() => setActiveTab('duplicate')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'duplicate'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            重复指标
                        </button>
                        <button
                            onClick={() => setActiveTab('complex')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'complex'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            高复杂度
                        </button>
                        <button
                            onClick={() => setActiveTab('unused')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'unused'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            未使用指标
                        </button>
                    </div>
                </div>

                {activeTab === 'catalog' && (
                    <SortButtons
                        sortOptions={sortOptions}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                )}
            </div>

            {/* 工具栏: 左下筛选 + 右下搜索 */}
            {activeTab === 'catalog' && (
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
                            placeholder="搜索指标名称..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>
            )}

            {/* 内容区域 */}
            {activeTab === 'catalog' ? (
                <MetricCatalog
                    data={data}
                    loading={loading}
                    total={total}
                    paginationState={paginationState}
                    handlePageChange={handlePageChange}
                    handlePageSizeChange={handlePageSizeChange}
                    onMetricClick={(metric) => openDrawer(metric.representative_id || '', 'metrics')}
                />
            ) : activeTab === 'duplicate' ? (
                <DuplicateMetricsAnalysis />
            ) : activeTab === 'complex' ? (
                <ComplexMetricsAnalysis />
            ) : (
                <UnusedMetricsAnalysis />
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
