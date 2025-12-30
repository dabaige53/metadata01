'use client';

import { Loader2, Columns, Search, HelpCircle } from 'lucide-react';
import NoDescriptionFieldsAnalysis from '@/components/fields/NoDescriptionFieldsAnalysis';
import OrphanFieldsAnalysis from '@/components/fields/OrphanFieldsAnalysis';
import HotFieldsAnalysis from '@/components/fields/HotFieldsAnalysis';
import FieldCatalog from '@/components/fields/FieldCatalog';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
import SortButtons from '@/components/data-table/SortButtons';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useDrawer } from '@/lib/drawer-context';

function FieldsContent() {
    // 各 Tab 统计数量
    const [tabCounts, setTabCounts] = useState<{ [key: string]: number }>({
        catalog: 0,
        noDescription: 0,
        orphan: 0,
        hot: 0
    });

    const [activeTab, setActiveTab] = useState<'catalog' | 'noDescription' | 'orphan' | 'hot'>('catalog');
    const { openDrawer } = useDrawer();
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 处理子组件回传的统计数量
    const handleTabCountUpdate = useCallback((tab: string, count: number) => {
        setTabCounts(prev => ({ ...prev, [tab]: count }));
    }, []);

    const fetchData = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/fields/catalog?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
            // 同步主目录数量
            setTabCounts(prev => ({ ...prev, catalog: result.total || 0 }));
        } catch (error) {
            console.error('Failed to fetch field catalog:', error);
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
        moduleName: 'fields',
        data: data,
        facetFields: ['role', 'dedup_method'],  // 新增 dedup_method 筛选
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'catalog') {
                fetchData(params);
            }
        },
    });

    // 同步列表页数量 (如果有筛选)
    useEffect(() => {
        if (activeTab === 'catalog') {
            handleTabCountUpdate('catalog', paginationState.total);
        }
    }, [paginationState.total, activeTab, handleTabCountUpdate]);

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

    const sortOptions = [
        { key: 'total_usage', label: '热度' },
        { key: 'instance_count', label: '实例数' },
        { key: 'name', label: '名称' },
    ];

    // 获取当前 Tab 的统计信息
    const stats = {
        label: activeTab === 'catalog' ? '原始字段' :
            activeTab === 'noDescription' ? '无描述字段' :
                activeTab === 'orphan' ? '孤立字段' : '热门字段',
        total: total,
        count: tabCounts[activeTab] || 0
    };

    return (
        <div className="space-y-4">
            {/* 第一行：页面标题与标签页切换 */}
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Columns className="w-5 h-5 text-indigo-600" />
                    原始字段
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
                        原始字段目录
                    </button>
                    <button
                        onClick={() => setActiveTab('noDescription')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'noDescription'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        无描述字段
                    </button>
                    <button
                        onClick={() => setActiveTab('orphan')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'orphan'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        孤立字段
                    </button>
                    <button
                        onClick={() => setActiveTab('hot')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'hot'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        热门字段
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
                        <span>去重规则：同一物理表的同一列 → 聚合为 1 个标准字段 | 数据来源：unique_regular_fields 表</span>
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

            {/* 工具栏: 左下筛选 + 右下搜索 */}
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
                                placeholder="输入名称/表名搜索..."
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
                <FieldCatalog
                    data={data}
                    loading={loading}
                    total={total}
                    paginationState={paginationState}
                    handlePageChange={handlePageChange}
                    handlePageSizeChange={handlePageSizeChange}
                    onFieldClick={(field) => openDrawer(field.representative_id || '', 'fields')}
                />
            ) : activeTab === 'noDescription' ? (
                <NoDescriptionFieldsAnalysis
                    onSortUpdate={handleGovSortUpdate}
                    onCountUpdate={(count) => handleTabCountUpdate('noDescription', count)}
                />
            ) : activeTab === 'orphan' ? (
                <OrphanFieldsAnalysis
                    onSortUpdate={handleGovSortUpdate}
                    onCountUpdate={(count) => handleTabCountUpdate('orphan', count)}
                />
            ) : (
                <HotFieldsAnalysis
                    onSortUpdate={handleGovSortUpdate}
                    onCountUpdate={(count) => handleTabCountUpdate('hot', count)}
                />
            )}
        </div>
    );
}

export default function FieldsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <FieldsContent />
        </Suspense>
    );
}
