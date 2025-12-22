'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    LayoutGrid,
    EyeOff,
    ExternalLink,
    CheckCircle2,
    BarChart3,
    AlertTriangle,
    Search
} from 'lucide-react';
import { useDataTable } from '@/hooks/useDataTable';
import FacetFilterBar from '../data-table/FacetFilterBar';
import SortButtons from '../data-table/SortButtons';
import Pagination from '../data-table/Pagination';

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
    usage?: number;
    hits_total?: number;
    hitsTotal?: number;
    field_count?: number;
    fieldCount?: number;
    issue_type?: 'unused' | 'complex';
    [key: string]: any;
}

export default function OrphanedViewsAnalysis() {
    const [allData, setAllData] = useState<ViewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/views?page=1&page_size=1000') // 获取更多以进行分析
            .then(res => res.json())
            .then(result => {
                const items = Array.isArray(result) ? result : (result.items || []);

                // 分析逻辑
                const analyzed = items.map((v: ViewItem) => {
                    const hits = v.hits_total ?? v.hitsTotal ?? v.usage ?? 0;
                    const fields = v.field_count ?? v.fieldCount ?? 0;

                    let issue_type: 'unused' | 'complex' | undefined;
                    if (hits === 0) issue_type = 'unused';
                    else if (fields >= 20) issue_type = 'complex';

                    return { ...v, issue_type };
                }).filter((v: any) => v.issue_type); // 只保留有问题的数据

                setAllData(analyzed);
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
        moduleName: 'views-governance',
        data: allData,
        facetFields: ['issue_type', 'project'],
        searchFields: ['name', 'workbook_name', 'project'],
        defaultPageSize: 20
    });

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
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">视图治理状况良好</h3>
                <p className="text-green-600 text-sm">所有视图均有访问记录且复杂度在合理范围内。</p>
            </div>
        );
    }

    const unusedCount = allData.filter(v => v.issue_type === 'unused').length;
    const complexCount = allData.filter(v => v.issue_type === 'complex').length;

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-gray-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">无访问视图</div>
                    <div className="text-2xl font-bold text-gray-600">{unusedCount}</div>
                    <div className="text-xs text-gray-400 mt-1">近期无用户访问记录</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">复杂视图</div>
                    <div className="text-2xl font-bold text-purple-600">{complexCount}</div>
                    <div className="text-xs text-gray-400 mt-1">包含大量字段(20+)，影响性能</div>
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
                            { key: 'field_count', label: '字段数' },
                            { key: 'hits_total', label: '访问量' },
                            { key: 'name', label: '名称' }
                        ]}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索视图、工作簿..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* 列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left">治理标签</th>
                                <th className="px-6 py-3 text-left">视图名称</th>
                                <th className="px-6 py-3 text-left">所属工作簿</th>
                                <th className="px-6 py-3 text-left">项目</th>
                                <th className="px-6 py-3 text-center">字段/访问</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {displayData.map((view) => (
                                <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {view.issue_type === 'unused' ? (
                                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase tracking-wider border border-gray-200">无访问</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-[10px] font-bold uppercase tracking-wider border border-purple-100">高复杂度</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {view.issue_type === 'unused' ? (
                                                <EyeOff className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                            )}
                                            <span className="font-medium text-gray-800">{view.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px] max-w-[150px] truncate">
                                        {view.workbook_name || view.workbookName || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {view.project || view.project_name || view.projectName || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[12px] font-bold text-gray-700">{view.field_count ?? view.fieldCount ?? 0} 字段</span>
                                            <span className="text-[10px] text-gray-400">{view.hits_total ?? view.hitsTotal ?? view.usage ?? 0} 访问</span>
                                        </div>
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
                            ))}
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
