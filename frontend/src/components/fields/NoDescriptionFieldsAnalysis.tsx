'use client';
import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';

import {
    Loader2,
    FileQuestion,
    Columns,
    GitBranch,
    Table,
    Search
} from 'lucide-react';
import { FieldCatalogItem } from '../cards/FieldCatalogCard';
import FacetFilterBar from '../data-table/FacetFilterBar';
import SortButtons from '../data-table/SortButtons';
import Pagination from '../data-table/Pagination';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'total_usage', label: '热度' },
    { key: 'instance_count', label: '实例数' },
    { key: 'name', label: '名称' }
];

interface NoDescriptionFieldsAnalysisProps {
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function NoDescriptionFieldsAnalysis({ onSortUpdate }: NoDescriptionFieldsAnalysisProps) {
    const [allData, setAllData] = useState<FieldCatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/fields/catalog/no-description')
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
        moduleName: 'fields-no-description',
        data: allData,
        facetFields: ['role'],
        searchFields: ['canonical_name', 'table_name'],
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

    // 统计多数据源字段数量
    const multiDatasourceCount = allData.filter(f => f.datasource_count > 1).length;

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
                    <FileQuestion className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">所有字段均已完善描述</h3>
                <p className="text-green-600 text-sm">非常棒！您的元数据治理工作非常到位。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">无描述规范字段</div>
                    <div className="text-2xl font-bold text-gray-800">{allData.length.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">公式/名称聚合后的规范资产</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源字段</div>
                    <div className="text-2xl font-bold text-amber-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同一字段被多个数据源使用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">涉及数据表</div>
                    <div className="text-2xl font-bold text-blue-600">
                        {new Set(allData.filter(f => f.table_id).map(f => f.table_id)).size}
                    </div>
                </div>
            </div>

            {/* 工具栏: 左下筛选 + 右下搜索 */}
            <div className="flex items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />

                <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="搜索字段或表名..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* 字段卡片列表 */}
            <div className="space-y-3">
                {displayData.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        未找到匹配的字段
                    </div>
                ) : (
                    displayData.map((item, idx) => (
                        <div
                            key={`${item.canonical_name}-${item.table_id || idx}`}
                            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => openDrawer(item.representative_id || '', 'fields')}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600">
                                        <Columns className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-bold text-gray-800 text-[15px]">
                                                {item.canonical_name}
                                            </h4>
                                            {/* 角色标签 */}
                                            {item.role && (
                                                <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${item.role.toLowerCase().includes('measure')
                                                    ? 'bg-green-50 text-green-600'
                                                    : 'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    {item.role.toLowerCase().includes('measure') ? '度量' : '维度'}
                                                </span>
                                            )}
                                            {/* 多数据源血缘标记 */}
                                            {item.datasource_count > 1 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-600">
                                                    <GitBranch className="w-3 h-3" />
                                                    跨 {item.datasource_count} 数据源
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                            {item.table_name && item.table_name !== '-' && (
                                                <span className="flex items-center gap-1">
                                                    <Table className="w-3 h-3" />
                                                    {item.table_schema ? `${item.table_schema}.` : ''}{item.table_name}
                                                </span>
                                            )}
                                            {item.data_type && (
                                                <span className="text-gray-400">
                                                    {item.data_type}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 右侧统计信息 */}
                                <div className="flex items-center gap-4 text-right">
                                    <div>
                                        <div className="text-lg font-bold text-gray-700">{item.total_usage || 0}</div>
                                        <div className="text-xs text-gray-400">使用次数</div>
                                    </div>
                                    <div className="text-gray-300">→</div>
                                </div>
                            </div>

                            {/* 数据源列表（多数据源时展示） */}
                            {item.datasource_count > 1 && item.datasources && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                    <div className="text-xs text-gray-400 mb-2">涉及数据源：</div>
                                    <div className="flex flex-wrap gap-2">
                                        {item.datasources.map((ds, i) => (
                                            <span
                                                key={i}
                                                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                                            >
                                                {ds.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )))}
            </div>

            {/* 分页控制 */}
            {allData.length > paginationState.pageSize && (
                <div className="mt-6">
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
