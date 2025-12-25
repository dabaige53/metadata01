'use client';
import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';

import {
    Loader2,
    Flame,
    Columns,
    TrendingUp,
    Eye,
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

interface HotFieldsAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function HotFieldsAnalysis({ onCountUpdate, onSortUpdate }: HotFieldsAnalysisProps) {
    const [allData, setAllData] = useState<FieldCatalogItem[]>([]);
    const [maxUsage, setMaxUsage] = useState(0);
    const [avgUsage, setAvgUsage] = useState(0);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/fields/catalog/hot')
            .then(res => res.json())
            .then(result => {
                setAllData(result.items || []);
                setMaxUsage(result.max_usage || 0);
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
        setSearchTerm,
        handleSearch,
        clearSearch
    } = useDataTable({
        moduleName: 'fields-hot',
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

    // 同步统计数量给父组件
    useEffect(() => {
        onCountUpdate?.(paginationState.total);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [paginationState.total]); // 不包含 onCountUpdate，避免匿名回调引起无限循环

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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Flame className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-600 font-bold mb-1">暂无热门字段</h3>
                <p className="text-gray-400 text-sm">没有字段被高频使用（&gt;20次引用）</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">热门规范字段</div>
                    <div className="text-2xl font-bold text-orange-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">公式/名称聚合后引用 &gt; 20次</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">最高引用</div>
                    <div className="text-2xl font-bold text-red-600">{maxUsage}</div>
                    <div className="text-xs text-gray-400 mt-1">次</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源字段</div>
                    <div className="text-2xl font-bold text-purple-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">核心共享资产</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        核心资产，优先保障
                    </div>
                </div>
            </div>

            {/* 工具栏: 右上排序                <div className="flex items-center gap-2">
                    <div className="relative w-64">

            {/* 工具栏: 左下筛选 + 右下搜索 */}
            <div className="flex items-center justify-between gap-4">
                <FacetFilterBar
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleBatchFilterChange}
                    onClearAll={handleClearAllFilters}
                />

                {/* 搜索框组件 */}
                <div className="flex items-center gap-2">
                    <div className="relative w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索字段或表名..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="block w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={clearSearch}
                                className="absolute inset-y-0 right-0 pr-2 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                                title="清空搜索"
                            >
                                <span className="text-xs">✕</span>
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => handleSearch()}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        搜索
                    </button>
                </div>
            </div>

            {/* 热门字段卡片列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        热门规范字段排行榜
                        <span className="text-xs text-gray-500 font-normal">按规范引用次数排序</span>
                    </h3>
                </div>
                <div className="space-y-0 divide-y divide-gray-100">
                    {displayData.map((item, idx) => {
                        const usageCount = item.total_usage || 0;
                        const heatLevel = (count: number) => {
                            if (count >= 200) return { color: 'text-red-600 bg-red-50', label: '🔥🔥🔥 超热门' };
                            if (count >= 100) return { color: 'text-orange-600 bg-orange-50', label: '🔥🔥 热门' };
                            if (count >= 50) return { color: 'text-amber-600 bg-amber-50', label: '🔥 活跃' };
                            return { color: 'text-yellow-600 bg-yellow-50', label: '⚡ 常用' };
                        };
                        const level = heatLevel(usageCount);
                        return (
                            <div
                                key={`${item.canonical_name}-${item.table_id || idx}`}
                                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                                onClick={() => openDrawer(item.representative_id || '', 'fields')}
                            >
                                <div className="flex items-center gap-4">
                                    {/* 排名 */}
                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${idx < 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {idx + 1}
                                    </span>

                                    {/* 字段信息 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Columns className="w-4 h-4 text-gray-400" />
                                            <span className="font-bold text-gray-800">{item.canonical_name}</span>
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
                                        </div>
                                    </div>

                                    {/* 引用次数 */}
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-gray-400" />
                                        <span className="font-bold text-gray-800 text-lg">{usageCount}</span>
                                    </div>

                                    {/* 热度标签 */}
                                    <span className={`px-2 py-1 text-[10px] rounded-full font-medium ${level.color}`}>
                                        {level.label}
                                    </span>

                                    <div className="text-gray-300">→</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
