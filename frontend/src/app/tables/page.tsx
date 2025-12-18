'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Table2 } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import TableCard from '@/components/cards/TableCard';
import { useDataTable } from '@/hooks/useDataTable';
import UnusedTablesAnalysis from '@/components/tables/UnusedTablesAnalysis';

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
    [key: string]: unknown;
}

function TablesContent() {
    const [allData, setAllData] = useState<TableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
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
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Table2 className="w-5 h-5 text-indigo-600" />
                        数据表
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {totalCount} 项
                        </span>
                    </h1>

                    {/* 标签页切换 */}
                    <div className="flex p-1 bg-gray-100/80 rounded-lg">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            数据表列表
                        </button>
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'analysis'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            表治理分析
                        </button>
                    </div>
                </div>

                {activeTab === 'list' && (
                    <SortButtons
                        sortOptions={sortOptions}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                )}
            </div>

            {/* 标签页内容切换 */}
            {activeTab === 'list' && (
                <InlineFilter
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleFilterChange}
                />
            )}

            {activeTab === 'list' ? (
                <>
                    {/* 横向卡片列表 */}
                    <div className="space-y-3">
                        {displayData.length === 0 ? (
                            <div className="py-20 text-center text-gray-400">
                                {totalCount === 0 ? '暂无数据' : '未找到匹配的数据表'}
                            </div>
                        ) : (
                            displayData.map((item) => (
                                <TableCard
                                    key={item.id}
                                    table={item}
                                    onClick={() => openDrawer(item.id, 'tables', item.name)}
                                />
                            ))
                        )}
                    </div>

                    {/* 分页控件 */}
                    {displayData.length > 0 && (
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                        />
                    )}
                </>
            ) : (
                <UnusedTablesAnalysis />
            )}
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

