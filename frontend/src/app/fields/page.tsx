'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Columns, Eye } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';

interface FieldItem {
    id: string;
    name: string;
    dataType?: string;
    data_type?: string;
    role?: string;
    isCalculated?: boolean;
    is_calculated?: boolean;
    formula?: string;
    table?: string;
    table_name?: string;
    datasource?: string;
    datasource_name?: string;
    usageCount?: number;
    usage_count?: number;
    used_by_metrics?: Array<{ id: string; name: string }>;
    used_in_views?: Array<{ id: string; name: string; workbook_name?: string; workbookName?: string }>;
}

function FieldsContent() {
    const [allData, setAllData] = useState<FieldItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        setLoading(true);
        fetch('/api/fields?page=1&page_size=1000')  // 加载更多数据以支持客户端筛选
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                // 只显示基础字段（非计算字段）
                const baseFields = items.filter((item: FieldItem) => {
                    const isCalc = item.isCalculated ?? item.is_calculated;
                    return !isCalc;
                });
                setAllData(baseFields);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // 使用自定义 Hook 管理表格状态
    const {
        displayData,
        totalCount,
        facets,
        activeFilters,
        handleFilterChange,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
    } = useDataTable({
        moduleName: 'fields',
        data: allData,
        facetFields: ['role', 'data_type', 'hasDescription'],
        defaultPageSize: 50,
        searchFields: ['name', 'formula', 'table', 'table_name', 'datasource', 'datasource_name'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'usageCount', label: '热度' },
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
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Columns className="w-5 h-5 text-indigo-600" />
                    字段字典
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {totalCount} 项
                    </span>
                </h1>

                {/* 排序按钮 */}
                <SortButtons
                    sortOptions={sortOptions}
                    currentSort={sortState}
                    onSortChange={handleSortChange}
                />
            </div>

            {/* 筛选器 */}
            <InlineFilter
                facets={facets}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
            />

            {/* 数据表格 */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>字段名称</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '10%' }}>类型</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '15%' }}>来源表/数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '8%' }}>热度</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '22%' }}>指标依赖 (影响分析)</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '20%' }}>视图引用 (影响分析)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-400">
                                    {totalCount === 0 ? '暂无数据' : '未找到匹配的字段'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => {
                                const role = (item.role || '').toLowerCase();
                                const isMeasure = role === 'measure';
                                const dataType = item.dataType || item.data_type || '-';
                                const source = item.table || item.table_name || item.datasource || item.datasource_name || '-';
                                const usageCount = item.usageCount ?? item.usage_count ?? 0;
                                const metrics = item.used_by_metrics || [];
                                const views = item.used_in_views || [];

                                return (
                                    <tr
                                        key={item.id}
                                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => openDrawer(item.id, 'fields')}
                                    >
                                        {/* 字段名称 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isMeasure ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-gray-800 truncate text-[13px]">{item.name}</span>
                                                    {item.formula && (
                                                        <span className="text-[10px] text-purple-500 font-mono flex items-center gap-1">
                                                            fx <span className="truncate max-w-[150px] text-gray-400 inline-block" title={item.formula}>{item.formula}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 类型 */}
                                        <td className="px-3 py-2.5">
                                            <span className="font-mono text-[11px] text-gray-500">{dataType}</span>
                                        </td>

                                        {/* 来源表/数据源 */}
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs text-gray-600 truncate block" title={source}>{source}</span>
                                        </td>

                                        {/* 热度 */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`text-xs font-mono ${usageCount > 10 ? 'text-orange-600 font-bold' : 'text-gray-500'}`}>
                                                {usageCount}
                                            </span>
                                        </td>

                                        {/* 指标依赖 */}
                                        <td className="px-3 py-2.5">
                                            {metrics.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {metrics.slice(0, 2).map(m => (
                                                        <span
                                                            key={m.id}
                                                            className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100 cursor-pointer transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDrawer(m.id, 'metrics');
                                                            }}
                                                            title={`点击查看指标: ${m.name}`}
                                                        >
                                                            {m.name}
                                                        </span>
                                                    ))}
                                                    {metrics.length > 2 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                                            +{metrics.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>

                                        {/* 视图引用 */}
                                        <td className="px-3 py-2.5">
                                            {views.length > 0 ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Eye className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                                    <span className="text-xs font-medium text-gray-700">{views.length}</span>
                                                    <span className="text-[10px] text-gray-400">个视图</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* 分页控件 */}
                <Pagination
                    pagination={paginationState}
                    onPageChange={handlePageChange}
                />
            </div>
        </div>
    );
}

export default function FieldsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <FieldsContent />
        </Suspense>
    );
}
