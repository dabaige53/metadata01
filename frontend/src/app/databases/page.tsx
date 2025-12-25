'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    Database,
    ArrowRight,
    Search
} from 'lucide-react';
import Pagination from '@/components/data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';

interface DatabaseItem {
    id: string;
    name: string;
    connectionType?: string;
    connection_type?: string;
    hostName?: string;
    host_name?: string;
    port?: number;
    dbName?: string;
    db_name?: string;
    state?: 'active' | 'inactive';
    tables?: number;
    table_count?: number;
    [key: string]: string | number | undefined;
}

function DatabasesContent() {
    const [data, setData] = useState<DatabaseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();
    const searchParams = useSearchParams();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const filters: Record<string, string> = {};
            searchParams.forEach((value, key) => {
                filters[key] = value;
            });

            const res = await api.getDatabases(1, 100, filters);
            const items = Array.isArray(res) ? res : (res.items || []);
            setData(items as DatabaseItem[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 使用 Hook 管理状态
    const {
        displayData,
        totalCount: filteredTotal,
        facets,
        activeFilters,
        handleFilterChange,
        sortState,
        handleSortChange,
        searchTerm,
        setSearchTerm,
        handleSearch,
        clearSearch,
    } = useDataTable({
        moduleName: 'databases',
        data: data,
        facetFields: ['connection_type'],
        searchFields: ['name', 'connection_type', 'host_name', 'db_name'],
    });

    const sortOptions = [
        { key: 'name', label: '名称' },
        { key: 'table_count', label: '表数量' },
    ];

    return (
        <div className="space-y-4">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    数据库连接
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{filteredTotal}</span>
                </h1>

                <SortButtons
                    sortOptions={sortOptions}
                    currentSort={sortState}
                    onSortChange={handleSortChange}
                />
            </div>

            {/* 搜索框 */}
            <div className="flex items-center gap-2">
                <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="输入名称搜索..."
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

            {/* 筛选器 */}
            <InlineFilter
                facets={facets}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full py-20 flex justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : displayData.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-400">暂无匹配数据</div>
                ) : (
                    displayData.map((db: DatabaseItem, i: number) => (
                        <div
                            key={db.id || i}
                            onClick={() => openDrawer(db.id, 'databases', db.name)}
                            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group flex flex-col h-full"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                                    <Database className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white uppercase tracking-wider">
                                        {db.connectionType || db.connection_type || 'Unknown'}
                                    </div>
                                    <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">
                                        使用中
                                    </div>
                                </div>
                            </div>

                            <div className="flex-grow">
                                <h3 className="font-bold text-gray-800 mb-1 truncate text-base group-hover:text-indigo-600 transition-colors" title={db.name}>
                                    {db.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mb-4 text-gray-500 min-h-[1.5rem]">
                                    <div className="shrink-0 w-1 h-1 rounded-full bg-gray-300"></div>
                                    <p className="text-[11px] font-mono truncate" title={db.hostName || db.host_name || 'N/A'}>
                                        {db.hostName || db.host_name || '无物理地址信息'}
                                    </p>
                                </div>
                            </div>

                            <div className="border-t border-gray-50 pt-3 mt-auto flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <span className="font-bold text-gray-900 text-sm">{db.table_count || db.tables || 0}</span>
                                        <span className="text-gray-400">数据表</span>
                                    </div>
                                    {db.total_field_count !== undefined && (
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-gray-900 text-sm">{db.total_field_count}</span>
                                            <span className="text-gray-400">字段</span>
                                        </div>
                                    )}
                                </div>
                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default function DatabasesPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <DatabasesContent />
        </Suspense>
    );
}
