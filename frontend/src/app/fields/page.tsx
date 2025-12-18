'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import { Loader2, ChevronLeft, ChevronRight, Columns } from 'lucide-react';

interface FieldItem {
    id: string;
    name: string;
    dataType?: string;
    data_type?: string;
    role?: string;
    isCalculated?: boolean;
    is_calculated?: boolean;
    formula?: string;
    table?: string;
    table_name?: string;
    datasource?: string;
    datasource_name?: string;
    usageCount?: number;
    usage_count?: number;
}

interface PaginatedResponse {
    items: FieldItem[];
    total: number;
    page: number;
    total_pages: number;
}

export default function FieldsPage() {
    const [data, setData] = useState<FieldItem[]>([]);
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

            const res = await api.getFields(pageNum, pageSize, filters);
            setData(res.items || []);
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
                    <Columns className="w-5 h-5 text-indigo-600" />
                    字段字典 <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{total}</span>
                </h1>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '25%' }}>字段名称</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '8%' }}>角色</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '8%' }}>类型</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '10%' }}>数据类型</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '20%' }}>来源表/数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '29%' }}>公式</th>
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
                                <td colSpan={6} className="text-center py-12 text-gray-400">
                                    {searchParams.has('hasDescription') ? '没有发现缺失描述的字段' : '暂无数据'}
                                </td>
                            </tr>
                        ) : (
                            data.map((item) => {
                                const isCalc = item.isCalculated ?? item.is_calculated;
                                const role = item.role?.toLowerCase();
                                const isMeasure = role === 'measure';
                                const source = item.table || item.table_name || item.datasource || item.datasource_name || '-';
                                return (
                                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openDrawer(item.id, 'fields')}>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${isMeasure ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                                                <span className="font-medium text-gray-800">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${isMeasure ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                                {isMeasure ? '度量' : '维度'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            {isCalc ? (
                                                <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">计算</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">基础</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className="font-mono text-[11px] text-gray-500">{item.dataType || item.data_type || '-'}</span>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[150px]" title={source}>{source}</td>
                                        <td className="px-3 py-2">
                                            {isCalc && item.formula ? (
                                                <code className="font-mono text-[11px] text-gray-500 truncate block max-w-full" title={item.formula}>
                                                    {item.formula.slice(0, 60)}{item.formula.length > 60 ? '...' : ''}
                                                </code>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
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
