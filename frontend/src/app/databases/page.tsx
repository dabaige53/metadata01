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
    [key: string]: any;
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
            setData(items);
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
                            onClick={() => openDrawer(db.id, 'databases')}
                            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Database className="w-5 h-5" />
                                </div>
                                <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">
                                    使用中
                                </div>
                            </div>

                            <h3 className="font-bold text-gray-800 mb-1 truncate text-sm" title={db.name}>{db.name}</h3>
                            <p className="text-[11px] text-gray-500 font-mono mb-4">{db.connectionType || db.connection_type || 'Unknown'}</p>

                            <div className="border-t border-gray-50 pt-3 flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold text-gray-700">{db.table_count || db.tables || 0}</span> 数据表
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
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
