'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    ChevronLeft,
    ChevronRight,
    Database,
    ArrowRight
} from 'lucide-react';

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
    state?: 'active' | 'inactive'; // 假设字段
    tables?: number; // 简单假设
    table_count?: number;
}

export default function DatabasesPage() {
    const [data, setData] = useState<DatabaseItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const { openDrawer } = useDrawer();
    const searchParams = useSearchParams();

    // 虽然现在API可能不支持分页的所有元数据，但保留结构
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const filters: Record<string, string> = {};
            searchParams.forEach((value, key) => {
                filters[key] = value;
            });

            // API 返回的是 PaginatedResponse
            const res = await api.getDatabases(1, 100, filters);

            // 兼容直接返回数组或分页对象
            const items = Array.isArray(res) ? res : (res.items || []);
            setData(items);
            setTotal(Array.isArray(res) ? items.length : res.total);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    数据库连接
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full py-20 flex justify-center">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-gray-400">暂无数据</div>
                ) : (
                    data.map((db, i) => (
                        <div
                            key={db.id || i}
                            onClick={() => openDrawer(db.id, 'databases')}
                            className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Database className="w-5 h-5" />
                                </div>
                                {/* 状态徽章模拟 */}
                                <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">
                                    使用中
                                </div>
                            </div>

                            <h3 className="font-bold text-gray-800 mb-1 truncate" title={db.name}>{db.name}</h3>
                            <p className="text-xs text-gray-500 font-mono mb-4">{db.connectionType || db.connection_type || 'Unknown'}</p>

                            <div className="border-t border-gray-50 pt-3 flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                    <span className="font-semibold text-gray-700">{db.table_count || 0}</span> 数据表
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
