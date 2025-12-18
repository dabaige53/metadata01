'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    Layers,
    CheckCircle
} from 'lucide-react';

interface DatasourceItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    isCertified?: boolean;
    is_certified?: boolean;
    hasExtract?: boolean;
    has_extract?: boolean;
    lastRefresh?: string;
    last_refresh?: string;
    table_count?: number;
    tableCount?: number;
    field_count?: number;
    metric_count?: number;
    workbook_count?: number;
    view_count?: number;
    [key: string]: any;
}

function DatasourcesContent() {
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

            const res = await api.getDatasources(1, 50, filters);
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

    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '-';

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
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '20%' }}>数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '12%' }}>项目</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '8%' }}>所有者</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>表</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>字段</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>指标</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>工作簿</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>视图</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-center" style={{ width: '6%' }}>类型</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-center" style={{ width: '5%' }}>认证</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '10%' }}>刷新</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '14%' }}>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={12} className="text-center py-12">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="text-center py-12 text-gray-400">暂无数据</td>
                            </tr>
                        ) : (
                            data.map((item) => {
                                const isCertified = item.isCertified ?? item.is_certified;
                                const hasExtract = item.hasExtract ?? item.has_extract;
                                const live = !hasExtract;
                                const lastRefresh = item.lastRefresh || item.last_refresh;
                                let stale = 0;
                                if (hasExtract && lastRefresh) {
                                    stale = Math.floor((new Date().getTime() - new Date(lastRefresh).getTime()) / 86400000);
                                }

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => openDrawer(item.id, 'datasources')}
                                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer"
                                    >
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                <span className="font-medium text-gray-800 truncate">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-[11px] text-gray-500">{item.projectName || item.project_name || item.project || '-'}</td>
                                        <td className="px-3 py-2 text-[11px] text-gray-500">{item.owner || '-'}</td>
                                        <td className="px-3 py-2 text-right font-mono text-xs">{item.table_count || item.tableCount || 0}</td>
                                        <td className="px-3 py-2 text-right font-mono text-xs">{item.field_count || 0}</td>
                                        <td className="px-3 py-2 text-right font-mono text-xs">{item.metric_count || 0}</td>
                                        <td className="px-3 py-2 text-right">
                                            {(item.workbook_count || 0) > 0 ? (
                                                <span className="font-mono text-xs text-green-600 font-medium">{item.workbook_count}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-xs">{item.view_count || 0}</td>
                                        <td className="px-3 py-2 text-center">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${live ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                                {live ? 'Live' : 'Extract'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {isCertified ? (
                                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-[10px] text-gray-500">{formatDate(lastRefresh)}</td>
                                        <td className="px-3 py-2">
                                            {stale > 30 ? (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">停更{stale}天</span>
                                            ) : stale > 7 ? (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">{stale}天前</span>
                                            ) : (
                                                <span className="text-[10px] text-green-600">● 正常</span>
                                            )}
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

export default function DatasourcesPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <DatasourcesContent />
        </Suspense>
    );
}
