'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, BookOpen, Search } from 'lucide-react';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import WorkbookCard from '@/components/cards/WorkbookCard';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import EmptyWorkbooksAnalysis from '@/components/workbooks/EmptyWorkbooksAnalysis';
import { useCallback } from 'react';

interface WorkbookItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    viewCount?: number;
    view_count?: number;
    upstream_datasources?: string[];
    [key: string]: string | number | string[] | undefined;
}

function WorkbooksContent() {
    const { openDrawer } = useDrawer();
    const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');

    // 数据状态
    const [data, setData] = useState<WorkbookItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // 预取函数 (暂时为空)
    const prefetch = useCallback((id: string, type: string) => {
        // TODO: 实现预取逻辑
    }, []);

    // 各 Tab 统计数量
    const [tabCounts, setTabCounts] = useState<{ [key: string]: number }>({
        list: 0,
        analysis: 0
    });

    // 处理子组件回传的统计数量
    const handleTabCountUpdate = useCallback((tab: string, count: number) => {
        setTabCounts(prev => ({ ...prev, [tab]: count }));
    }, []);

    const fetchWorkbooks = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/workbooks?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
            // 同步列表页数量
            setTabCounts(prev => ({ ...prev, list: result.total || 0 }));
        } catch (error) {
            console.error('Failed to fetch workbooks:', error);
        } finally {
            setLoading(false);
        }
    };

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
        setSearchTerm
    } = useDataTable({
        moduleName: 'workbooks',
        data: data,
        facetFields: ['project_name'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'list') {
                fetchWorkbooks(params);
            }
        },
    });

    // 同步列表页数量 (如果有筛选)
    useEffect(() => {
        if (activeTab === 'list') {
            handleTabCountUpdate('list', paginationState.total);
        }
    }, [paginationState.total, activeTab, handleTabCountUpdate]);

    // 排序选项
    const sortOptions = [
        { key: 'viewCount', label: '视图数' },
        { key: 'name', label: '名称' },
    ];

    // 获取当前 Tab 的统计信息
    const stats = {
        label: activeTab === 'list' ? '工作簿' : '治理分析',
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
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    工作簿
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
                        工作簿列表
                    </button>
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'analysis'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        治理分析
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

                {activeTab === 'list' ? (
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
            {activeTab === 'list' && (
                <div className="flex items-center justify-between gap-4">
                    <FacetFilterBar
                        facets={facets}
                        activeFilters={activeFilters}
                        onFilterChange={handleBatchFilterChange}
                        onClearAll={handleClearAllFilters}
                    />

                    {/* 搜索框 */}
                    <div className="relative w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索工作簿名称..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>
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
                                {total === 0 ? '暂无数据' : '未找到匹配的工作簿'}
                            </div>
                        ) : (
                            displayData.map((item) => (
                                <WorkbookCard
                                    key={item.id}
                                    workbook={item}
                                    onClick={() => openDrawer(item.id, 'workbooks', item.name)}
                                    onMouseEnter={() => prefetch(item.id, 'workbooks')}
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
            ) : (
                <EmptyWorkbooksAnalysis
                    onSortUpdate={handleGovSortUpdate}
                    onCountUpdate={(count) => handleTabCountUpdate('analysis', count)}
                />
            )}
        </div>
    );
}

export default function WorkbooksPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <WorkbooksContent />
        </Suspense>
    );
}
