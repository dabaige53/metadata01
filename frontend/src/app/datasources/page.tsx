'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    Layers,
    CheckCircle,
    AlertOctagon,
    Clock,
    RefreshCw
} from 'lucide-react';

interface DatasourceItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    owner?: string;
    isCertified?: boolean;
    is_certified?: boolean;
    hasExtract?: boolean;
    has_extract?: boolean;
    updatedAt?: string;
    updated_at?: string;
    [key: string]: any;
}

export default function DatasourcesPage() {
    const [data, setData] = useState<DatasourceItem[]>([]);
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

            const res = await api.getDatasources(1, 100, filters);
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
                    <Layers className="w-5 h-5 text-indigo-600" />
                    数据源列表
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
                </h1>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[25%]">数据源名称</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%]">项目</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%]">所有者</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%]">类型/认证</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%]">刷新状态</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%] text-right">最后更新</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-400">暂无数据</td>
                            </tr>
                        ) : (
                            data.map((item) => {
                                const isCertified = item.isCertified ?? item.is_certified;
                                const hasExtract = item.hasExtract ?? item.has_extract;
                                // 模拟一个停更时间判断，实际应该由后端给
                                const isStale = false;

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => openDrawer(item.id, 'datasources')}
                                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer group transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800 flex items-center gap-2">
                                                {item.name}
                                                {isCertified && (
                                                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{item.project_name || item.project || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-gray-200 text-[10px] flex items-center justify-center text-gray-600 font-bold">
                                                    {(item.owner || '?').charAt(0).toUpperCase()}
                                                </div>
                                                {item.owner || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${hasExtract ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                                                    {hasExtract ? 'Extract' : 'Live'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {/* 模拟状态 */}
                                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                                {isStale ? (
                                                    <span className="flex items-center gap-1 text-red-600"><AlertOctagon className="w-3 h-3" /> 停更</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-green-600"><RefreshCw className="w-3 h-3" /> 正常</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500 font-mono text-xs">
                                            {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
