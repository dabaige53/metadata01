'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, LayoutGrid } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import ViewCard from '@/components/cards/ViewCard';
import { useDataTable } from '@/hooks/useDataTable';
import ZeroAccessViewsAnalysis from '@/components/views/ZeroAccessViewsAnalysis';
import HotViewsAnalysis from '@/components/views/HotViewsAnalysis';

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
    const [data, setData] = useState<ViewItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'zeroAccess' | 'hot'>('dashboard');
    const { openDrawer } = useDrawer();

    const fetchViews = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/views?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
        } catch (error) {
            console.error('Failed to fetch views:', error);
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
        moduleName: 'views',
        data: data,
        facetFields: ['workbook'],
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

    // 排序选项
    const sortOptions = [
        { key: 'hits_total', label: '访问量' },
        { key: 'field_count', label: '字段数' },
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
                        <LayoutGrid className="w-5 h-5 text-indigo-600" />
                        仪表盘/视图
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {total.toLocaleString()} 项
                        </span>
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



                {(activeTab === 'list' || activeTab === 'dashboard') && (
                    <SortButtons
                        sortOptions={sortOptions}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                )}
            </div>

            {/* 标签页内容切换 */}
            {
                (activeTab === 'list' || activeTab === 'dashboard') && (
                    <div className="flex gap-4 mb-4">
                        <InlineFilter
                            facets={facets}
                            activeFilters={activeFilters}
                            onFilterChange={handleFilterChange}
                        />
                        {activeTab === 'list' && (
                            <div className="flex items-center gap-2 bg-gray-50/50 px-3 py-1 rounded-lg border border-gray-200">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">类型:</span>
                                {[
                                    { label: '全部', value: 'all' },
                                    { label: '仪表盘', value: 'dashboard' },
                                    { label: '工作表', value: 'sheet' }
                                ].map(opt => {
                                    const isActive = (activeFilters.view_type?.[0] || 'all') === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => {
                                                const current = activeFilters.view_type?.[0];
                                                if (current && current !== opt.value) {
                                                    handleFilterChange('view_type', current, false);
                                                }
                                                if (opt.value !== 'all' && current !== opt.value) {
                                                    handleFilterChange('view_type', opt.value, true);
                                                }
                                            }}
                                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${isActive
                                                ? 'bg-white text-indigo-600 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                    <ZeroAccessViewsAnalysis />
                ) : (
                    <HotViewsAnalysis />
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
