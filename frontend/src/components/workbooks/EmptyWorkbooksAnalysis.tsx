'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    BookOpen,
    ExternalLink,
    CheckCircle2,
    Search
} from 'lucide-react';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'view_count', label: '视图数' },
    { key: 'name', label: '名称' }
];

interface EmptyWorkbooksAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

interface WorkbookItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    view_count?: number;
    upstream_datasources?: string[];
    issue_type?: 'empty' | 'single-source';
    is_single_source?: boolean;
    [key: string]: any;
}

export default function EmptyWorkbooksAnalysis({ onSortUpdate }: EmptyWorkbooksAnalysisProps) {
    const [allData, setAllData] = useState<WorkbookItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 并行获取无视图工作簿和单源依赖工作簿数据
        Promise.all([
            fetch('/api/workbooks/governance/empty').then(res => res.json()),
            fetch('/api/workbooks/governance/single-source').then(res => res.json())
        ])
            .then(([emptyResult, singleResult]) => {
                const empty = (emptyResult.items || []).map((w: any) => ({ ...w, issue_type: 'empty' }));
                const single: WorkbookItem[] = (singleResult.items || []).map((w: any) => ({ ...w, issue_type: 'single-source' }));

                // 合并逻辑
                const merged = [...empty];
                single.forEach(s => {
                    const existing = merged.find(m => m.id === s.id);
                    if (existing) {
                        existing.is_single_source = true;
                    } else {
                        merged.push(s);
                    }
                });
                setAllData(merged);
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
        moduleName: 'workbooks-governance',
        data: allData,
        facetFields: ['project', 'issue_type'],
        searchFields: ['name', 'project', 'owner'],
        defaultPageSize: 20
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

    // 注意: 此组件未解构 onCountUpdate props，故不需要同步统计数量

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
                <h3 className="text-green-800 font-bold mb-1">工作簿治理状况良好</h3>
                <p className="text-green-600 text-sm">没有发现空工作簿或单一数据源依赖的工作簿。</p>
            </div>
        );
    }

    const emptyCount = allData.filter(w => w.issue_type === 'empty').length;
    const singleSourceCount = allData.filter(w => w.issue_type === 'single-source' || w.is_single_source).length;

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">无视图工作簿</div>
                    <div className="text-2xl font-bold text-red-600">{emptyCount}</div>
                    <div className="text-xs text-gray-400 mt-1">未包含任何视图的空工作簿</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">单源依赖工作簿</div>
                    <div className="text-2xl font-bold text-blue-600">{singleSourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">只依赖单一数据源，影响范围集中</div>
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
                            placeholder="搜索工作簿、负责人..."
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
                                <th className="px-6 py-3 text-left">工作簿名称</th>
                                <th className="px-6 py-3 text-left">依赖数据源</th>
                                <th className="px-6 py-3 text-left">项目</th>
                                <th className="px-6 py-3 text-center">视图数</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {displayData.map((wb) => (
                                <tr key={`${wb.id}-${wb.issue_type}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {wb.issue_type === 'empty' && (
                                                <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold uppercase tracking-wider border border-red-100">无视图</span>
                                            )}
                                            {(wb.issue_type === 'single-source' || wb.is_single_source) && (
                                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">单源</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className={`w-4 h-4 ${wb.issue_type === 'empty' ? 'text-red-400' : 'text-blue-400'}`} />
                                            <span className="font-medium text-gray-800">{wb.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {(wb.upstream_datasources?.length || 0) > 0 ? (
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[12px] font-medium max-w-[150px] truncate block">
                                                {wb.upstream_datasources?.[0]}
                                                {(wb.upstream_datasources?.length || 0) > 1 && ` (+${wb.upstream_datasources!.length - 1}...)`}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {wb.project || wb.project_name || wb.projectName || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-500 font-medium">
                                        {wb.viewCount ?? wb.view_count ?? 0}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openDrawer(wb.id, 'workbooks', wb.name)}
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
