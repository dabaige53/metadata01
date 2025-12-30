'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Database,
    Table2,
    ExternalLink,
    CheckCircle2,
    Search
} from 'lucide-react';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'column_count', label: '列数' },
    { key: 'name', label: '名称' }
];

interface TableItem {
    id: string;
    name: string;
    schema?: string;
    database?: string;
    database_name?: string;
    databaseName?: string;
    column_count?: number;
    field_count?: number;
    datasource_count?: number;
    workbook_count?: number;
    issue_type?: 'unused' | 'wide';
    [key: string]: any;
}

interface UnusedTablesAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function UnusedTablesAnalysis({ onCountUpdate, onSortUpdate }: UnusedTablesAnalysisProps) {
    const [allData, setAllData] = useState<TableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 并行获取未使用表和宽表数据
        Promise.all([
            fetch('/api/tables/governance/unused').then(res => res.json()),
            fetch('/api/tables/governance/wide').then(res => res.json())
        ])
            .then(([unusedResult, wideResult]) => {
                const unused = (unusedResult.items || []).map((t: any) => ({ ...t, issue_type: 'unused' }));
                const wide = (wideResult.items || []).map((t: any) => ({ ...t, issue_type: 'wide' }));
                setAllData([...unused, ...wide]);
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
        moduleName: 'tables-governance',
        data: allData,
        facetFields: ['issue_type', 'schema'],
        searchFields: ['name', 'schema', 'database'],
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

    // 同步统计数量给父组件
    useEffect(() => {
        onCountUpdate?.(paginationState.total);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paginationState.total]); // 不包含 onCountUpdate，避免匿名回调引起无限循环

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
                <h3 className="text-green-800 font-bold mb-1">数据表治理状况良好</h3>
                <p className="text-green-600 text-sm">没有发现未使用的表或需要优化的宽表。</p>
            </div>
        );
    }

    const unusedCount = allData.filter(t => t.issue_type === 'unused').length;
    const wideCount = allData.filter(t => t.issue_type === 'wide').length;

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">未使用表</div>
                    <div className="text-2xl font-bold text-amber-600">{unusedCount}</div>
                    <div className="text-xs text-gray-400 mt-1">未被任何数据源引用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">宽表 (&gt;50列)</div>
                    <div className="text-2xl font-bold text-purple-600">{wideCount}</div>
                    <div className="text-xs text-gray-400 mt-1">建议考虑拆分优化</div>
                </div>
            </div>

            {/* 工具栏: 筛选与搜索 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索表名或库名..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* 数据列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left">治理类型</th>
                                <th className="px-6 py-3 text-left">表名</th>
                                <th className="px-6 py-3 text-left">Schema</th>
                                <th className="px-6 py-3 text-left">数据库</th>
                                <th className="px-6 py-3 text-center">列数</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {displayData.map((table) => (
                                <tr key={`${table.id}-${table.issue_type}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {table.issue_type === 'unused' ? (
                                            <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[10px] font-bold uppercase tracking-wider">未使用</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-purple-50 text-purple-600 rounded text-[10px] font-bold uppercase tracking-wider">宽表</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Table2 className={`w-4 h-4 ${table.issue_type === 'unused' ? 'text-amber-400' : 'text-purple-400'}`} />
                                            <span className="font-medium text-gray-800">{table.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {table.schema || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        <div className="flex items-center gap-1.5">
                                            <Database className="w-3.5 h-3.5 text-gray-400" />
                                            {table.database || table.database_name || table.databaseName || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full font-bold text-[12px] ${(table.column_count || 0) > 50 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {table.column_count || '-'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openDrawer(table.id, 'tables', table.name)}
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
