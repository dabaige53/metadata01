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
import ComplexMetricsAnalysis from '@/components/metrics/ComplexMetricsAnalysis';
import UnusedMetricsAnalysis from '@/components/metrics/UnusedMetricsAnalysis';

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
    const [data, setData] = useState<MetricItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'duplicate' | 'complex' | 'unused'>('list');
    const { openDrawer } = useDrawer();

    const fetchMetrics = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/metrics?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    // 使用自定义 Hook 管理表格状态 (服务器端模式)
    const {
        displayData,
        facets,
        activeFilters,
        handleFilterChange,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
        handlePageSizeChange,
    } = useDataTable({
        moduleName: 'metrics',
        data: data,
        facetFields: ['metricType', 'role', 'hasDuplicate'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'list') {
                fetchMetrics(params);
            }
        },
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
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {total.toLocaleString()} 项
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
                    <div className="space-y-3 min-h-[400px] relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center items-start pt-20 z-10 transition-all">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                        )}

                        {displayData.length === 0 && !loading ? (
                            <div className="py-20 text-center text-gray-400">
                                {total === 0 ? '暂无数据' : '未找到匹配的指标'}
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
                    {total > 0 && (
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    )}
                </>
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
