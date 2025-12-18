'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    Table2,
    ChevronRight
} from 'lucide-react';

interface TableItem {
    id: string;
    name: string;
    schema?: string;
    database?: string;
    database_name?: string;
    field_count?: number;
    row_count?: number;
    [key: string]: any;
}

export default function TablesPage() {
    const [data, setData] = useState<TableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const { openDrawer } = useDrawer();
    const searchParams = useSearchParams();

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const filters: Record<string, string> = {};
            searchParams.forEach((value, key) => {
                filters[key] = value;
            });

            const res = await api.getTables(1, 100, filters);
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
                    <Table2 className="w-5 h-5 text-indigo-600" />
                    数据表资产
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
                </h1>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[30%]">表名称</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[20%]">Schema</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[20%]">所属数据库</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%] text-right">字段数</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%] text-right">状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-400">暂无数据</td>
                            </tr>
                        ) : (
                            data.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => openDrawer(item.id, 'tables')}
                                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer group transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-indigo-50 p-1.5 rounded text-indigo-600">
                                                <Table2 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{item.name}</div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5 max-w-[200px] truncate">{item.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{item.schema || 'public'}</td>
                                    <td className="px-4 py-3 text-gray-600">{item.database_name || item.database || '-'}</td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-600">{item.field_count || 0}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                                            使用中
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
