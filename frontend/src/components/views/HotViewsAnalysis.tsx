'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Flame,
    ExternalLink,
    TrendingUp,
    LayoutDashboard,
    FileSpreadsheet,
    Eye,
    Search
} from 'lucide-react';
import { useDataTable } from '@/hooks/useDataTable';
import FacetFilterBar from '../data-table/FacetFilterBar';
import SortButtons from '../data-table/SortButtons';
import Pagination from '../data-table/Pagination';

interface ViewItem {
    id: string;
    name: string;
    view_type?: string;
    viewType?: string;
    total_view_count?: number;
    totalViewCount?: number;
    workbook_name?: string;
    workbookName?: string;
    [key: string]: any;
}

export default function HotViewsAnalysis() {
    const [allData, setAllData] = useState<ViewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/views/governance/hot')
            .then(res => res.json())
            .then(result => {
                setAllData(result.items || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

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
        moduleName: 'views-hot',
        data: allData,
        facetFields: ['view_type', 'workbook_name'],
        searchFields: ['name', 'workbook_name'],
        defaultPageSize: 20
    });

    const getViewTypeIcon = (type?: string) => {
        if (type === 'dashboard') return <LayoutDashboard className="w-4 h-4 text-indigo-500" />;
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    };

    const getHeatLevel = (count: number) => {
        if (count >= 500) return { color: 'text-red-600 bg-red-50', label: '🔥🔥🔥 超热门' };
        if (count >= 200) return { color: 'text-orange-600 bg-orange-50', label: '🔥🔥 热门' };
        if (count >= 100) return { color: 'text-amber-600 bg-amber-50', label: '🔥 活跃' };
        return { color: 'text-yellow-600 bg-yellow-50', label: '⚡ 常用' };
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (allData.length === 0) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Flame className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-600 font-bold mb-1">暂无热门视图</h3>
                <p className="text-gray-400 text-sm">没有视图访问超过50次</p>
            </div>
        );
    }

    const maxViews = allData.length > 0 ? Math.max(...allData.map(v => v.total_view_count ?? v.totalViewCount ?? 0)) : 0;
    const totalViewsCount = allData.reduce((sum, v) => sum + (v.total_view_count ?? v.totalViewCount ?? 0), 0);

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">热门视图数</div>
                    <div className="text-2xl font-bold text-orange-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">访问&gt;50次</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">最高访问量</div>
                    <div className="text-2xl font-bold text-red-600">{maxViews.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">单视图峰值</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">总访问量</div>
                    <div className="text-2xl font-bold text-gray-700">{totalViewsCount.toLocaleString()}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 mt-1 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        核心资产，优先保障
                    </div>
                </div>
            </div>

            {/* 工具栏 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />
                <div className="flex items-center gap-3">
                    <SortButtons
                        sortOptions={[
                            { key: 'total_view_count', label: '访问量' },
                            { key: 'name', label: '名称' }
                        ]}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索视图或工作簿..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* 列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100 uppercase text-[11px] font-bold text-gray-500 tracking-wider">
                    热门视图排行榜
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left w-12">排名</th>
                                <th className="px-6 py-3 text-left">视图名称</th>
                                <th className="px-6 py-3 text-left">访问量</th>
                                <th className="px-6 py-3 text-left">热度</th>
                                <th className="px-6 py-3 text-left">类型</th>
                                <th className="px-6 py-3 text-left">工作簿</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {displayData.map((view, idx) => {
                                const viewCount = view.total_view_count ?? view.totalViewCount ?? 0;
                                const heatLevel = getHeatLevel(viewCount);
                                const rank = ((paginationState.page - 1) * paginationState.pageSize) + idx + 1;
                                return (
                                    <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rank <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {rank}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getViewTypeIcon(view.view_type || view.viewType)}
                                                <span className="font-medium text-gray-800">{view.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Eye className="w-4 h-4 text-gray-400" />
                                                <span className="font-bold text-gray-800">{viewCount.toLocaleString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-[10px] rounded-full font-medium ${heatLevel.color}`}>
                                                {heatLevel.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {(view.view_type || view.viewType) === 'dashboard' ? '仪表板' : '工作表'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px] max-w-[150px] truncate">
                                            {view.workbook_name || view.workbookName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openDrawer(view.id, 'views', view.name)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                            >
                                                查看详情 <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* 分页 */}
                {allData.length > paginationState.pageSize && (
                    <div className="p-4 border-t border-gray-50 bg-gray-50/30">
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
