'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, LayoutGrid, Search } from 'lucide-react';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import ViewCard from '@/components/cards/ViewCard';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import ZeroAccessViewsAnalysis from '@/components/views/ZeroAccessViewsAnalysis';
import HotViewsAnalysis from '@/components/views/HotViewsAnalysis';
import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

interface ViewItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    workbook?: string;
    workbook_name?: string;
    workbookName?: string;
    owner?: string;
    hits_total?: number;
    usage?: number;
    hitsTotal?: number;
    field_count?: number;
    fieldCount?: number;
    [key: string]: string | number | undefined;
}

function ViewsContent() {
    const { openDrawer } = useDrawer();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'zeroAccess' | 'hot'>('dashboard');

    // 数据状态
    const [data, setData] = useState<ViewItem[]>([]);
    const [total, setTotal] = useState(0);
    const [baseTotal, setBaseTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const requestIdRef = useRef(0);

    // 各 Tab 统计数量
    const [tabCounts, setTabCounts] = useState<{ [key: string]: number }>({
        dashboard: 0,
        list: 0,
        zeroAccess: 0,
        hot: 0
    });

    // 处理子组件回传的统计数量
    const handleTabCountUpdate = useCallback((tab: string, count: number) => {
        setTabCounts(prev => ({ ...prev, [tab]: count }));
    }, []);

    const fetchViews = useCallback(async (params: Record<string, any>) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/views?${queryParams.toString()}`);
            const result = await res.json();
            if (requestId !== requestIdRef.current) return;

            setData(result.items || []);
            setTotal(result.total || 0);
            setBaseTotal(result.base_total ?? result.total ?? 0);
            setFacetsData(result.facets || null);
            // 同步当前列表数量
            if (activeTab === 'dashboard' || activeTab === 'list') {
                setTabCounts(prev => ({ ...prev, [activeTab]: result.total || 0 }));
            }
        } catch (error) {
            if (requestId !== requestIdRef.current) return;
            console.error('Failed to fetch views:', error);
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }, [activeTab]);

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
        clearSearch
    } = useDataTable({
        moduleName: 'views',
        data: data,
        facetFields: ['view_type', 'workbook_name'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            // Dashboard tab 这里的 params 会包含 include_standalone=true
            if (activeTab === 'list' || activeTab === 'dashboard') {
                const finalParams = { ...params };
                if (activeTab === 'dashboard') {
                    finalParams.include_standalone = 'true';
                }
                fetchViews(finalParams);
            }
        },
    });

    useEffect(() => {
        if (activeTab !== 'list' && activeTab !== 'dashboard') return;

        const params: Record<string, any> = {};
        searchParams.forEach((value, key) => {
            params[key] = value;
        });
        if (activeTab === 'dashboard') {
            params.include_standalone = 'true';
        }

        fetchViews(params);
    }, [activeTab, fetchViews, searchParams]);

    

    // 同步列表页数量 (如果有筛选)
    useEffect(() => {
        if (activeTab === 'dashboard' || activeTab === 'list') {
            handleTabCountUpdate(activeTab, paginationState.total);
        }
    }, [paginationState.total, activeTab, handleTabCountUpdate]);

    // 排序选项
    const sortOptions = [
        { key: 'hits_total', label: '访问量' },
        { key: 'field_count', label: '字段数' },
        { key: 'name', label: '名称' },
    ];

    // 获取当前 Tab 的统计信息
    const stats = {
        label: activeTab === 'dashboard' ? '仪表盘' :
            activeTab === 'list' ? '全部视图' :
                activeTab === 'zeroAccess' ? '零访问视图' : '热门视图',
        total: baseTotal,
        count: tabCounts[activeTab] || 0
    };

    if (loading && data.length === 0) {
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
                    <LayoutGrid className="w-5 h-5 text-indigo-600" />
                    仪表盘/视图
                </h1>

                {/* 标签页切换 */}
                <div className="flex p-1 bg-gray-100/80 rounded-lg">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'dashboard'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        仪表盘列表
                    </button>
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'list'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        全部视图
                    </button>
                    <button
                        onClick={() => setActiveTab('zeroAccess')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'zeroAccess'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        零访问视图
                    </button>
                    <button
                        onClick={() => setActiveTab('hot')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'hot'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        热门视图
                    </button>
                </div>
            </div>

            {/* 第二行：统计信息 + 排序按钮 */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                        <span>{stats.label}</span>
                        <span className="font-semibold text-gray-800">{stats.total.toLocaleString()}</span>
                        <span>项 中的</span>
                        <span className="font-bold text-indigo-600">{stats.count.toLocaleString()}</span>
                    </span>
                </div>

                {(activeTab === 'list' || activeTab === 'dashboard') ? (
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
            {
                (activeTab === 'list' || activeTab === 'dashboard') && (
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
                                    placeholder="搜索视图或仪表盘..."
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
                )
            }

            {
                (activeTab === 'list' || activeTab === 'dashboard') ? (
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
                                    {total === 0 ? '暂无数据' : '未找到匹配的视图'}
                                </div>
                            ) : (
                                displayData.map((item) => (
                                    <ViewCard
                                        key={item.id}
                                        view={item}
                                        onClick={() => openDrawer(item.id, 'views', item.name)}
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
                ) : activeTab === 'zeroAccess' ? (
                    <ZeroAccessViewsAnalysis
                        onCountUpdate={(count) => handleTabCountUpdate('zeroAccess', count)}
                    />
                ) : (
                    <HotViewsAnalysis
                        onSortUpdate={handleGovSortUpdate}
                        onCountUpdate={(count) => handleTabCountUpdate('hot', count)}
                    />
                )
            }
        </div >
    );
}

export default function ViewsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <ViewsContent />
        </Suspense>
    );
}
