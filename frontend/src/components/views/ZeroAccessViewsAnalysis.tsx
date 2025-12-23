'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    EyeOff,
    ExternalLink,
    AlertTriangle,
    LayoutDashboard,
    FileSpreadsheet,
    Search,
    ChevronDown,
    ChevronUp,
    BookOpen
} from 'lucide-react';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'field_count', label: '字段数' },
    { key: 'name', label: '名称' }
];

interface ViewItem {
    id: string;
    name: string;
    view_type?: string;
    viewType?: string;
    total_view_count?: number;
    totalViewCount?: number;
    workbook_name?: string;
    workbookName?: string;
    workbook_id?: string;
    [key: string]: any;
}

interface ZeroAccessViewsAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function ZeroAccessViewsAnalysis({ onCountUpdate, onSortUpdate }: ZeroAccessViewsAnalysisProps) {
    const [allData, setAllData] = useState<ViewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedWorkbooks, setExpandedWorkbooks] = useState<Record<string, boolean>>({});
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/views/governance/zero-access')
            .then(res => res.json())
            .then(result => {
                // 后端返回的是分组数据，我们将其扁平化以适配 useDataTable
                const flatData: ViewItem[] = [];
                (result.groups || []).forEach((group: any) => {
                    group.views.forEach((view: any) => {
                        flatData.push({
                            ...view,
                            workbook_name: group.name
                        });
                    });
                });
                setAllData(flatData);
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
        moduleName: 'views-zero-access',
        data: allData,
        facetFields: ['view_type', 'workbook_name'],
        searchFields: ['name', 'workbook_name'],
        defaultPageSize: 50
    });

    // 同步排序状态给父组件
    useEffect(() => {
        onSortUpdate?.({
            options: SORT_OPTIONS,
            state: sortState,
            onChange: handleSortChange
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortState]);

    // 同步统计数量给父组件
    useEffect(() => {
        onCountUpdate?.(paginationState.total);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paginationState.total]); // 不包含 onCountUpdate，避免匿名回调引起无限循环

    const toggleWorkbook = (name: string) => {
        setExpandedWorkbooks(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    const getViewTypeIcon = (type?: string) => {
        if (type === 'dashboard') return <LayoutDashboard className="w-4 h-4 text-indigo-500" />;
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
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
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <EyeOff className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有零访问视图</h3>
                <p className="text-green-600 text-sm">所有视图都有人访问，资产利用率良好！</p>
            </div>
        );
    }

    // 按工作簿分组显示
    const groupedDisplay: Record<string, ViewItem[]> = {};
    displayData.forEach(view => {
        const wb = view.workbook_name || '未知工作簿';
        if (!groupedDisplay[wb]) groupedDisplay[wb] = [];
        groupedDisplay[wb].push(view);
    });

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-gray-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">零访问视图</div>
                    <div className="text-2xl font-bold text-gray-600">{allData.length.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">从未被访问过</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">受影响工作簿</div>
                    <div className="text-2xl font-bold text-amber-600">{Object.keys(groupedDisplay).length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 mt-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否下线或推广使用
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

            {/* 分组列表 */}
            <div className="space-y-4">
                {Object.entries(groupedDisplay).map(([wbName, views], idx) => (
                    <div key={wbName} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div
                            className="p-4 bg-gray-50/50 flex items-center justify-between cursor-pointer"
                            onClick={() => toggleWorkbook(wbName)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-[15px]">{wbName}</h4>
                                    <p className="text-xs text-gray-500">{views.length} 个零访问视图</p>
                                </div>
                            </div>
                            {expandedWorkbooks[wbName] ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                        </div>

                        {(expandedWorkbooks[wbName] || searchTerm) && (
                            <div className="border-t border-gray-100">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-gray-50">
                                        {views.map(view => (
                                            <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {getViewTypeIcon(view.view_type || view.viewType)}
                                                        <span className="text-gray-700">{view.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-400 text-xs text-right">
                                                    {(view.view_type || view.viewType) === 'dashboard' ? '仪表板' : '工作表'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDrawer(view.id, 'views', view.name);
                                                        }}
                                                        className="text-indigo-600 hover:text-indigo-900 font-medium text-xs"
                                                    >
                                                        查看详情
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 分页 */}
            {allData.length > paginationState.pageSize && (
                <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-sm">
                    <Pagination
                        pagination={paginationState}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                </div>
            )}
        </div>
    );
}
