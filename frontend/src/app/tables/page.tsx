'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Table2, AlertCircle } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';

interface TableItem {
    id: string;
    name: string;
    schema?: string;
    database?: string;
    database_name?: string;
    databaseName?: string;
    column_count?: number;  // 原始列数
    field_count?: number;   // Tableau 字段数
    fieldCount?: number;
    datasource_count?: number;
    workbook_count?: number;
    isEmbedded?: boolean;
    preview_fields?: {
        measures?: string[];
        dimensions?: string[];
    };
    [key: string]: any;
}

function TablesContent() {
    const [allData, setAllData] = useState<TableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        setLoading(true);
        fetch('/api/tables?page=1&page_size=500')
            .then(res => res.json())
            .then(result => {
                const items = Array.isArray(result) ? result : (result.items || []);
                setAllData(items);
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
        moduleName: 'tables',
        data: allData,
        facetFields: ['schema'],
        defaultPageSize: 50,
        searchFields: ['name', 'schema', 'database', 'database_name', 'databaseName'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'field_count', label: '字段数' },
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
                    <Table2 className="w-5 h-5 text-indigo-600" />
                    数据表
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
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '20%' }}>表名</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '12%' }}>数据库</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '8%' }}>Schema</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '6%' }}>原始列</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '6%' }}>字段</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '6%' }}>数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '6%' }}>工作簿</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '24%' }}>预览字段</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '12%' }}>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="text-center py-12 text-gray-400">
                                    {totalCount === 0 ? '暂无数据' : '未找到匹配的数据表'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => {
                                const dbName = item.database_name || item.databaseName || item.database || '-';
                                const colCount = item.column_count || 0;
                                const fieldCount = item.field_count || item.fieldCount || 0;
                                const dsCount = item.datasource_count || 0;
                                const wbCount = item.workbook_count || 0;
                                const previewFields = item.preview_fields || {};
                                const measures = previewFields.measures || [];
                                const dimensions = previewFields.dimensions || [];

                                // 状态判断
                                let statusColor = 'green';
                                let statusText = '使用中';
                                if (wbCount === 0 && dsCount > 0) {
                                    statusColor = 'orange';
                                    statusText = '仅关联';
                                } else if (wbCount === 0 && dsCount === 0) {
                                    statusColor = 'red';
                                    statusText = '孤立';
                                }

                                return (
                                    <tr
                                        key={item.id}
                                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => openDrawer(item.id, 'tables')}
                                    >
                                        {/* 表名 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <Table2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium text-gray-800 truncate text-[13px]">{item.name}</span>
                                                    {item.isEmbedded && (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-200 inline-block w-fit mt-0.5">
                                                            嵌入
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* 数据库 */}
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs text-gray-600 truncate block" title={dbName}>{dbName}</span>
                                        </td>

                                        {/* Schema */}
                                        <td className="px-3 py-2.5">
                                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                                                {item.schema || 'public'}
                                            </span>
                                        </td>

                                        {/* 原始列 */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="font-mono text-xs text-gray-600">{colCount || '-'}</span>
                                        </td>

                                        {/* 字段 */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="font-mono text-xs text-gray-600">{fieldCount || '-'}</span>
                                        </td>

                                        {/* 数据源 */}
                                        <td className="px-3 py-2.5 text-center">
                                            {dsCount > 0 ? (
                                                <span className="text-xs font-medium text-indigo-600">{dsCount}</span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        {/* 工作簿 */}
                                        <td className="px-3 py-2.5 text-center">
                                            {wbCount > 0 ? (
                                                <span className="text-xs font-medium text-green-600">{wbCount}</span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>

                                        {/* 预览字段 */}
                                        <td className="px-3 py-2.5">
                                            {(measures.length > 0 || dimensions.length > 0) ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {measures.slice(0, 2).map((m, idx) => (
                                                        <span key={`m-${idx}`} className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded border border-green-200">
                                                            #{m}
                                                        </span>
                                                    ))}
                                                    {dimensions.slice(0, 2).map((d, idx) => (
                                                        <span key={`d-${idx}`} className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                                                            {d}
                                                        </span>
                                                    ))}
                                                    {(measures.length + dimensions.length > 4) && (
                                                        <span className="text-[9px] text-gray-400">
                                                            +{measures.length + dimensions.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>

                                        {/* 状态 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                    statusColor === 'green' ? 'bg-green-500' :
                                                    statusColor === 'orange' ? 'bg-orange-400' : 'bg-red-500'
                                                }`}></span>
                                                <span className={`text-[10px] ${
                                                    statusColor === 'green' ? 'text-green-700' :
                                                    statusColor === 'orange' ? 'text-orange-700' : 'text-red-700'
                                                }`}>
                                                    {statusText}
                                                </span>
                                            </div>
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

export default function TablesPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <TablesContent />
        </Suspense>
    );
}
