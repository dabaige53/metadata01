'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
    key: keyof T | string;
    title: string;
    width?: string;
    render?: (value: unknown, record: T) => React.ReactNode;
}

interface DataTableProps<T extends { id: string }> {
    columns: Column<T>[];
    fetchData: (page: number, pageSize: number) => Promise<{
        items: T[];
        total: number;
        page: number;
        total_pages: number;
    }>;
    pageSize?: number;
    onRowClick?: (record: T) => void;
    emptyText?: string;
}

export default function DataTable<T extends { id: string }>({
    columns,
    fetchData,
    pageSize = 50,
    onRowClick,
    emptyText = '暂无数据',
}: DataTableProps<T>) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const loadData = useCallback(async (pageNum: number) => {
        setLoading(true);
        try {
            const result = await fetchData(pageNum, pageSize);
            setData(result.items);
            setTotal(result.total);
            setTotalPages(result.total_pages);
            setPage(pageNum);
        } catch (err) {
            console.error('Failed to load data:', err);
        } finally {
            setLoading(false);
        }
    }, [fetchData, pageSize]);

    useEffect(() => {
        loadData(1);
    }, [loadData]);

    const getValue = (record: T, key: string): unknown => {
        const keys = key.split('.');
        let value: unknown = record;
        for (const k of keys) {
            value = (value as Record<string, unknown>)?.[k];
        }
        return value;
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" ref={containerRef}>
            {/* 表格 */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            {columns.map((col) => (
                                <th
                                    key={String(col.key)}
                                    className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide"
                                    style={{ width: col.width }}
                                >
                                    {col.title}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-12">
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-12 text-gray-400">
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            data.map((record) => (
                                <tr
                                    key={record.id}
                                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                                    onClick={() => onRowClick?.(record)}
                                >
                                    {columns.map((col) => (
                                        <td key={String(col.key)} className="px-4 py-3 text-gray-700">
                                            {col.render
                                                ? col.render(getValue(record, String(col.key)), record)
                                                : String(getValue(record, String(col.key)) ?? '-')}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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
    );
}
