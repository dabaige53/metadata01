'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Layers,
    Unlink,
    ExternalLink,
    AlertTriangle,
    Shield,
    ShieldOff,
    Search
} from 'lucide-react';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'field_count', label: '字段数' },
    { key: 'last_refresh', label: '更新时间' },
    { key: 'name', label: '名称' }
];

interface DatasourceItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    isCertified?: boolean;
    is_certified?: boolean;
    workbook_count?: number;
    field_count?: number;
    [key: string]: any;
}

interface OrphanDatasourcesAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function OrphanDatasourcesAnalysis({ onCountUpdate, onSortUpdate }: OrphanDatasourcesAnalysisProps) {
    const [allData, setAllData] = useState<DatasourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        api.getDatasources(1, 1000)
            .then(res => {
                const items = (Array.isArray(res) ? res : (res.items || [])) as unknown as DatasourceItem[];
                // 孤立数据源：未被任何工作簿引用
                const orphaned = items.filter(d => !d.workbook_count || d.workbook_count === 0);
                setAllData(orphaned);
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
        moduleName: 'datasources-orphan',
        data: allData,
        facetFields: ['project', 'is_certified'],
        searchFields: ['name', 'project', 'owner'],
        defaultPageSize: 20,
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
                    <Unlink className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有孤立数据源</h3>
                <p className="text-green-600 text-sm">所有数据源都被工作簿引用，资源利用率良好！</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">孤立数据源</div>
                    <div className="text-2xl font-bold text-red-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">未被任何工作簿引用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">字段浪费</div>
                    <div className="text-2xl font-bold text-gray-700">
                        {allData.reduce((sum, d) => sum + (d.field_count || 0), 0)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">孤立数据源中的字段数合计</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 mt-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否下线或建立引用
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
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索数据源、项目或负责人..."
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
                                <th className="px-6 py-3 text-left">数据源名称</th>
                                <th className="px-6 py-3 text-left">项目</th>
                                <th className="px-6 py-3 text-left">负责人</th>
                                <th className="px-6 py-3 text-center">字段数</th>
                                <th className="px-6 py-3 text-center">认证状态</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {displayData.map((ds) => (
                                <tr key={ds.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-red-400" />
                                            <span className="font-medium text-gray-800">{ds.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {ds.project || ds.project_name || ds.projectName || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {ds.owner || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-500 font-medium">
                                        {ds.field_count || 0}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {(ds.isCertified ?? ds.is_certified) ? (
                                            <span className="inline-flex items-center gap-1 text-green-600 text-xs px-2 py-0.5 bg-green-50 rounded-full">
                                                <Shield className="w-3.5 h-3.5" /> 已认证
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-gray-400 text-xs px-2 py-0.5 bg-gray-50 rounded-full">
                                                <ShieldOff className="w-3.5 h-3.5" /> 未认证
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openDrawer(ds.id, 'datasources', ds.name)}
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
