'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    FunctionSquare,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Beaker
} from 'lucide-react';

interface MetricItem {
    id: string;
    name: string;
    formula?: string;
    complexity?: number;
    hasDuplicate?: boolean;
    has_duplicate?: boolean;
    [key: string]: any;
}

interface PaginatedResponse {
    items: MetricItem[];
    total: number;
    page: number;
    total_pages: number;
}

export default function MetricsPage() {
    const [data, setData] = useState<MetricItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const pageSize = 100;

    const { openDrawer } = useDrawer();
    const searchParams = useSearchParams();

    const loadData = useCallback(async (pageNum: number) => {
        setLoading(true);
        try {
            const filters: Record<string, string> = {};
            searchParams.forEach((value, key) => {
                filters[key] = value;
            });

            const res = await api.getMetrics(pageNum, pageSize, filters);
            const items = res.items || [];
            setData(items);
            setTotal(res.total);
            setTotalPages(res.total_pages);
            setPage(res.page);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        loadData(1);
    }, [loadData]);


    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FunctionSquare className="w-5 h-5 text-indigo-600" />
                    指标库
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
                </h1>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[25%]">指标名称</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[35%]">计算公式</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%]">复杂度</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[10%]">重复风险</th>
                            <th className="px-4 py-3 font-medium text-gray-500 text-xs uppercase w-[15%] text-right">操作</th>
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
                                <td colSpan={5} className="text-center py-12 text-gray-400">
                                    {searchParams.has('hasDuplicate') ? '没有发现重复指标' : '暂无数据'}
                                </td>
                            </tr>
                        ) : (
                            data.map((item) => {
                                const complexity = item.complexity || 0;
                                // 计算复杂度颜色
                                const complexityColor = complexity > 50 ? 'bg-red-500' : complexity > 20 ? 'bg-orange-400' : 'bg-green-400';
                                const hasDup = item.hasDuplicate || item.has_duplicate; // API可能有变化

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => openDrawer(item.id, 'metrics')}
                                        className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer group transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-800">{item.name}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <code className="block bg-gray-50 px-2 py-1 rounded text-[11px] font-mono text-gray-500 truncate max-w-md" title={item.formula}>
                                                {item.formula || '-'}
                                            </code>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className={`h-full ${complexityColor}`} style={{ width: `${Math.min(complexity, 100)}%` }}></div>
                                                </div>
                                                <span className="text-xs text-gray-400 font-mono">{complexity}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {hasDup && (
                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-bold">
                                                    <AlertTriangle className="w-3 h-3" /> 重复
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">查看血缘</button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* 分页 */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                        <div className="text-sm text-gray-500">
                            共 {total} 条，第 {page} / {totalPages} 页
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => loadData(page - 1)}
                                disabled={page <= 1 || loading}
                                className="p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-600 min-w-[60px] text-center">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => loadData(page + 1)}
                                disabled={page >= totalPages || loading}
                                className="p-1.5 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
