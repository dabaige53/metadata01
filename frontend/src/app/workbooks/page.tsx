'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    BookOpen,
    Eye,
    User
} from 'lucide-react';

interface WorkbookItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    owner?: string;
    viewCount?: number;
    view_count?: number;
    [key: string]: any;
}

export default function WorkbooksPage() {
    const [data, setData] = useState<WorkbookItem[]>([]);
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

            const res = await api.getWorkbooks(1, 100, filters);
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
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    工作簿资产
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
                </h1>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[30%]">工作簿名称</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[20%]">项目</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[20%]">所有者</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%] text-right">浏览量</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%] text-right">包含视图</th>
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
                                    onClick={() => openDrawer(item.id, 'workbooks')}
                                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer group transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-900 line-clamp-1" title={item.name}>{item.name}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{item.project_name || item.project || '-'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                            {item.owner || '-'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5 text-gray-600">
                                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                                            {item.view_count || item.viewCount || 0}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-500">
                                        {/* 模拟视图数 */}
                                        {Math.floor(Math.random() * 10) + 1}
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
