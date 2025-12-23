'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Layers,
    Shield,
    ShieldOff,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Search
} from 'lucide-react';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';
import FacetFilterBar from '../data-table/FacetFilterBar';
import Pagination from '../data-table/Pagination';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'workbook_count', label: '引用数' },
    { key: 'field_count', label: '字段数' },
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
    issue_type?: 'uncertified' | 'orphaned';
    is_orphaned?: boolean;
    [key: string]: any;
}

interface UncertifiedDatasourcesAnalysisProps {
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function UncertifiedDatasourcesAnalysis({ onSortUpdate }: UncertifiedDatasourcesAnalysisProps) {
    const [allData, setAllData] = useState<DatasourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        api.getDatasources(1, 1000)
            .then(res => {
                const items = (Array.isArray(res) ? res : (res.items || [])) as unknown as DatasourceItem[];

                // 给所有数据打标签，并合并
                // 未认证
                const uncert = items.filter(d => !(d.isCertified ?? d.is_certified)).map(d => ({ ...d, issue_type: 'uncertified' as const }));
                // 孤立 (且已认证，避免重复，或者保留重复由筛选器处理)
                const orph = items.filter(d => (!d.workbook_count || d.workbook_count === 0)).map(d => ({ ...d, issue_type: 'orphaned' as const }));

                // 去重合并：一个数据源可能既未认证也是孤立的。这里我们选择展示所有问题记录，搜索和筛选会处理它。
                // 如果想去重，则需要唯一标识符。
                const merged: DatasourceItem[] = [...uncert];
                orph.forEach(o => {
                    if (!merged.find(m => m.id === o.id)) {
                        merged.push(o);
                    } else {
                        // 如果已存在，标记为 dual issue 或增加属性
                        const existing = merged.find(m => m.id === o.id);
                        if (existing) {
                            existing.is_orphaned = true; // 额外补充标记
                        }
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
        moduleName: 'datasources-governance',
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
                <h3 className="text-green-800 font-bold mb-1">数据源治理状况良好</h3>
                <p className="text-green-600 text-sm">所有数据源均已认证且在使用中。</p>
            </div>
        );
    }

    const uncertCount = allData.filter(d => d.issue_type === 'uncertified').length;
    const orphanCount = allData.filter(d => d.issue_type === 'orphaned' || d.is_orphaned).length;

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">未认证数据源</div>
                    <div className="text-2xl font-bold text-amber-600">{uncertCount}</div>
                    <div className="text-xs text-gray-400 mt-1">未通过官方认证标准</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">孤立数据源</div>
                    <div className="text-2xl font-bold text-red-600">{orphanCount}</div>
                    <div className="text-xs text-gray-400 mt-1">未被任何工作簿引用</div>
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
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索数据源、项目..."
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
                                <th className="px-6 py-3 text-left">数据源名称</th>
                                <th className="px-6 py-3 text-left">项目</th>
                                <th className="px-6 py-3 text-left">负责人</th>
                                <th className="px-6 py-3 text-center">工作簿引用</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {displayData.map((ds) => (
                                <tr key={`${ds.id}-${ds.issue_type}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {!(ds.isCertified ?? ds.is_certified) && (
                                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold uppercase tracking-wider border border-amber-100">未认证</span>
                                            )}
                                            {(ds.workbook_count === 0 || ds.is_orphaned) && (
                                                <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold uppercase tracking-wider border border-red-100">孤立</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className={`w-4 h-4 ${ds.issue_type === 'orphaned' ? 'text-red-400' : 'text-amber-400'}`} />
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
                                        {ds.workbook_count || 0}
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
