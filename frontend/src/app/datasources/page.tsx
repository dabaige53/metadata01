'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Layers, Search } from 'lucide-react';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import DatasourceCard from '@/components/cards/DatasourceCard';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import UncertifiedDatasourcesAnalysis from '@/components/datasources/UncertifiedDatasourcesAnalysis';
import OrphanDatasourcesAnalysis from '@/components/datasources/OrphanDatasourcesAnalysis';
import { useCallback } from 'react';

interface DatasourceItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    isCertified?: boolean;
    is_certified?: boolean;
    hasExtract?: boolean;
    has_extract?: boolean;
    lastRefresh?: string;
    last_refresh?: string;
    table_count?: number;
    tableCount?: number;
    field_count?: number;
    metric_count?: number;
    workbook_count?: number;
    view_count?: number;
    [key: string]: string | number | boolean | undefined;
}

function DatasourcesContent() {
    const { openDrawer } = useDrawer();
    const [activeTab, setActiveTab] = useState<'published' | 'embedded' | 'uncertified' | 'orphan'>('published');

    // 数据状态
    const [data, setData] = useState<DatasourceItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 各 Tab 统计数量
    const [tabCounts, setTabCounts] = useState<{ [key: string]: number }>({
        published: 0,
        embedded: 0,
        uncertified: 0,
        orphan: 0
    });

    // 处理子组件回传的统计数量
    const handleTabCountUpdate = useCallback((tab: string, count: number) => {
        setTabCounts(prev => ({ ...prev, [tab]: count }));
    }, []);

    const fetchDatasources = useCallback(async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/datasources?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
            // 同步列表页数量
            // 同步列表页数量
            if (params.is_embedded === '1') {
                setTabCounts(prev => ({ ...prev, embedded: result.total || 0 }));
            } else if (params.is_embedded === '0') {
                setTabCounts(prev => ({ ...prev, published: result.total || 0 }));
            }
        } catch (error) {
            console.error('Failed to fetch datasources:', error);
        } finally {
            setLoading(false);
        }
    }, []);

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

    // 使用自定义 Hook 管理表格状态 (服务器端模式)
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
        clearSearch,
    } = useDataTable({
        moduleName: 'datasources',
        data: data,
        facetFields: ['is_certified', 'project_name'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'published' || activeTab === 'embedded') {
                fetchDatasources({ ...params, is_embedded: activeTab === 'embedded' ? '1' : '0' });
            }
        },
    });

    // 同步列表页数量 (如果有筛选)
    // 监听 Tab 切换，重新获取数据
    useEffect(() => {
        if (activeTab === 'published' || activeTab === 'embedded') {
            // 切换 Tab 时，重置为第一页，并获取对应的数据
            fetchDatasources({
                page: 1,
                page_size: paginationState.pageSize,
                is_embedded: activeTab === 'embedded' ? '1' : '0'
            });
            // 如果不在第一页，更新页码状态
            if (paginationState.page !== 1) {
                handlePageChange(1);
            }
        }
    }, [activeTab, fetchDatasources, handlePageChange, paginationState.page, paginationState.pageSize]);

    // 同步列表页数量 (如果有筛选) - 仅在总数变化时更新
    useEffect(() => {
        if (activeTab === 'published' || activeTab === 'embedded') {
            handleTabCountUpdate(activeTab, paginationState.total);
        }
    }, [activeTab, paginationState.total, handleTabCountUpdate]);

    // 排序选项
    const sortOptions = [
        { key: 'table_count', label: '表数量' },
        { key: 'workbook_count', label: '引用数' },
        { key: 'last_refresh', label: '更新时间' },
        { key: 'name', label: '名称' },
    ];

    // 获取当前 Tab 的统计信息
    const stats = {
        label: activeTab === 'published' ? '已发布数据源' :
            activeTab === 'embedded' ? '嵌入式数据源' :
                activeTab === 'uncertified' ? '未认证数据源' : '孤立数据源',
        total: total,
        count: tabCounts[activeTab] || 0
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 第一行：页面标题与标签页切换 */}
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    数据源
                </h1>

                {/* 标签页切换 */}
                <div className="flex p-1 bg-gray-100/80 rounded-lg">
                    <button
                        onClick={() => setActiveTab('published')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'published'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        已发布
                    </button>
                    <button
                        onClick={() => setActiveTab('embedded')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'embedded'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        嵌入式
                    </button>
                    <button
                        onClick={() => setActiveTab('uncertified')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'uncertified'
                            ? 'bg-white text-amber-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        未认证分析
                    </button>
                    <button
                        onClick={() => setActiveTab('orphan')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'orphan'
                            ? 'bg-white text-red-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        孤立数据源
                    </button>
                </div>
            </div>

            {/* 第二行：统计信息 + 排序按钮 */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                        <span>{stats.label}</span>
                        <span className="font-bold text-indigo-600">{stats.count.toLocaleString()}</span>
                        <span>项</span>
                    </span>
                </div>

                {(activeTab === 'published' || activeTab === 'embedded') ? (
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
            {(activeTab === 'published' || activeTab === 'embedded') && (
                <div className="flex items-center justify-between gap-4">
                    <FacetFilterBar
                        facets={facets}
                        activeFilters={activeFilters}
                        onFilterChange={handleBatchFilterChange}
                        onClearAll={handleClearAllFilters}
                    />

                    {/* 搜索框 */}
                    <div className="flex items-center gap-2">
                        <div className="relative w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="搜索数据源名称..."
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

            {(activeTab === 'published' || activeTab === 'embedded') ? (
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
                                {total === 0 ? '暂无数据' : '未找到匹配的数据源'}
                            </div>
                        ) : (
                            displayData.map((item) => (
                                <DatasourceCard
                                    key={item.id}
                                    datasource={item}
                                    onClick={() => openDrawer(item.id, 'datasources', item.name)}
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
            ) : activeTab === 'uncertified' ? (
                <UncertifiedDatasourcesAnalysis
                    onSortUpdate={handleGovSortUpdate}
                    onCountUpdate={(count) => handleTabCountUpdate('uncertified', count)}
                />
            ) : (
                <OrphanDatasourcesAnalysis
                    onSortUpdate={handleGovSortUpdate}
                    onCountUpdate={(count) => handleTabCountUpdate('orphan', count)}
                />
            )}
        </div>
    );
}

export default function DatasourcesPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <DatasourcesContent />
        </Suspense>
    );
}

