'use client';

import { Loader2, FunctionSquare, Search, HelpCircle } from 'lucide-react';
import DuplicateMetricsAnalysis from '@/components/metrics/DuplicateMetricsAnalysis';
import ComplexMetricsAnalysis from '@/components/metrics/ComplexMetricsAnalysis';
import UnusedMetricsAnalysis from '@/components/metrics/UnusedMetricsAnalysis';
import MetricCatalog from '@/components/metrics/MetricCatalog';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
import SortButtons from '@/components/data-table/SortButtons';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useDrawer } from '@/lib/drawer-context';

function MetricsContent() {
    const [activeTab, setActiveTab] = useState<'catalog' | 'duplicate' | 'complex' | 'unused'>('catalog');
    const { openDrawer } = useDrawer();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 各 Tab 统计数量
    const [tabCounts, setTabCounts] = useState({
        catalog: 0,
        duplicate: 0,
        complex: 0,
        unused: 0
    });

    // 治理 Tab 的排序配置与状态
    const [govSortConfig, setGovSortConfig] = useState<{
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    } | null>(null);

    const handleGovSortUpdate = useCallback((config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => {
        setGovSortConfig(config);
    }, []);

    const fetchData = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/metrics/catalog?${queryParams.toString()}`);
            const result = await res.json();

            // 处理数据，增加 complexity_level
            const items = (result.items || []).map((item: any) => {
                const score = item.complexity || 0;
                let level = '低';
                if (score > 10) level = '超高';
                else if (score > 6) level = '高';
                else if (score > 3) level = '中';

                return {
                    ...item,
                    complexity_level: level
                };
            });

            setData(items);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
            setTabCounts(prev => ({ ...prev, catalog: result.total || 0 }));
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
        setSearchTerm,
        handleSearch,
        clearSearch
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

    // 处理子组件回传的统计数量
    const handleTabCountUpdate = useCallback((tab: 'duplicate' | 'complex' | 'unused', count: number) => {
        setTabCounts(prev => ({ ...prev, [tab]: count }));
    }, []);

    // 获取当前 Tab 的统计信息
    const getCurrentTabStats = () => {
        const tabLabels = {
            catalog: '计算字段目录',
            duplicate: '重复指标',
            complex: '高复杂度',
            unused: '未使用指标'
        };
        return {
            label: tabLabels[activeTab],
            count: tabCounts[activeTab],
            total: tabCounts.catalog
        };
    };

    const stats = getCurrentTabStats();

    return (
        <div className="space-y-4">
            {/* 第一行：页面标题与标签页切换 */}
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FunctionSquare className="w-5 h-5 text-indigo-600" />
                    计算字段
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

            {/* 第二行：统计信息 + 排序按钮 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                            <span>{stats.label}</span>
                            <span className="font-semibold text-gray-800">{stats.total.toLocaleString()}</span>
                            <span>项 中的</span>
                            <span className="font-bold text-indigo-600">{stats.count.toLocaleString()}</span>
                        </span>
                    </div>
                    {/* 去重说明 */}
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50/50 px-2 py-1 rounded-md border border-gray-100">
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400" />
                        <span>⑦ 去重说明：计算字段按『名称＋公式哈希』聚合，不同工作簿中逻辑相同的公式仅计为1项</span>
                    </div>
                </div>

                {activeTab === 'catalog' ? (
                    <SortButtons
                        sortOptions={sortOptions}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                ) : govSortConfig && (
                    <SortButtons
                        sortOptions={govSortConfig.options}
                        currentSort={govSortConfig.state}
                        onSortChange={govSortConfig.onChange}
                    />
                )}
            </div>

            {/* 第三行：筛选 + 搜索（仅 catalog Tab） */}
            {activeTab === 'catalog' && (
                <div className="flex items-center justify-between gap-4">
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
                                placeholder="搜索指标名称/公式..."
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
                <DuplicateMetricsAnalysis
                    onCountUpdate={(count: number) => handleTabCountUpdate('duplicate', count)}
                    onSortUpdate={handleGovSortUpdate}
                />
            ) : activeTab === 'complex' ? (
                <ComplexMetricsAnalysis
                    onCountUpdate={(count: number) => handleTabCountUpdate('complex', count)}
                    onSortUpdate={handleGovSortUpdate}
                />
            ) : (
                <UnusedMetricsAnalysis
                    onCountUpdate={(count: number) => handleTabCountUpdate('unused', count)}
                    onSortUpdate={handleGovSortUpdate}
                />
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
