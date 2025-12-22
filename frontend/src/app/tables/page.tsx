'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Table2, Search } from 'lucide-react';
import FacetFilterBar from '@/components/data-table/FacetFilterBar';
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
    const [data, setData] = useState<TableItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
    const { openDrawer } = useDrawer();

    const fetchTables = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/tables?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
        } catch (error) {
            console.error('Failed to fetch tables:', error);
        } finally {
            setLoading(false);
        }
    };

    // 使用自定义 Hook 管理表格状态 (服务器端模式)
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
        moduleName: 'tables',
        data: data,
        facetFields: ['schema', 'database_name'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'list') {
                fetchTables(params);
            }
        },
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
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {total.toLocaleString()} 项
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

            {/* 工具栏: 左下筛选 + 右下搜索 */}
            {activeTab === 'list' && (
                <div className="flex items-center justify-between gap-4">
                    <FacetFilterBar
                        facets={facets}
                        activeFilters={activeFilters}
                        onFilterChange={handleBatchFilterChange}
                        onClearAll={handleClearAllFilters}
                    />

                    {/* 搜索框 */}
                    <div className="relative w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="搜索表名..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                    </div>
                </div>
            )}

            {activeTab === 'list' ? (
                <>
                    {/* 横向卡片列表 */}
                    <div className="space-y-3 min-h-[400px] relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center items-start pt-20 z-10 transition-all">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                        )}

                        {displayData.length === 0 && !loading ? (
                            <div className="py-20 text-center text-gray-400">
                                {total === 0 ? '暂无数据' : '未找到匹配的数据表'}
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
                    {total > 0 && (
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
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

