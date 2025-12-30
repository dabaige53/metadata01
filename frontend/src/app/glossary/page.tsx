'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Search, BookText, RefreshCw } from 'lucide-react';

interface TermEnum {
    id: number;
    value: string;
    label: string;
    description: string;
}

interface GlossaryItem {
    id: number;
    term: string;
    label?: string;
    definition: string;
    category: string;
    element: string; // database, table, etc.
    enums: TermEnum[];
}

const ELEMENTS = [
    { id: 'all', label: '全部' },
    { id: 'database', label: '数据库' },
    { id: 'table', label: '数据表' },
    { id: 'field', label: '原始字段' },
    { id: 'metric', label: '计算字段' },
    { id: 'datasource', label: '数据源' },
    { id: 'workbook', label: '工作簿' },
    { id: 'view', label: '视图' },
    { id: 'project', label: '项目' },
    { id: 'user', label: '用户' },
];

export default function GlossaryPage() {
    const [items, setItems] = useState<GlossaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeElement, setActiveElement] = useState('all');

    // Pagination state
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;

    useEffect(() => {
        setPage(1); // Reset page when filter changes
    }, [activeElement, searchQuery]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/glossary?search=${encodeURIComponent(searchQuery)}&element=${activeElement}&page=${page}&page_size=${pageSize}`);
            const data = await res.json();
            setItems(data.items || []);
            setTotal(data.total || 0);
        } catch (error) {
            console.error('Failed to fetch glossary:', error);
        } finally {
            setLoading(false);
            setIsFirstLoad(false);
        }
    }, [activeElement, page, pageSize, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]); // Fetch when filter or page changes

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (page !== 1) {
                setPage(1); // will trigger fetch via dependency
            } else {
                fetchData();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchData, page, searchQuery]);

    async function handleSync() {
        if (syncing) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/glossary/sync', { method: 'POST' });
            const result = await res.json();
            if (result.status === 'success') {
                fetchData(); // Reload data
            }
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setSyncing(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <BookText className="w-6 h-6 text-indigo-600" />
                            术语介绍
                        </h1>
                        <p className="mt-1 text-sm text-gray-500">
                            系统全量术语定义与解释 ({total} 条)
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="搜索术语..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${syncing
                                ? 'bg-indigo-50 text-indigo-400 cursor-wait'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-indigo-600'
                                }`}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? '同步中' : '同步'}
                        </button>
                    </div>
                </div>

                {/* Filter Blocks */}
                <div className="flex flex-wrap gap-2">
                    {ELEMENTS.map((el) => (
                        <button
                            key={el.id}
                            onClick={() => setActiveElement(el.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${activeElement === el.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-105'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-white hover:border-gray-300 hover:shadow-sm'
                                }`}
                        >
                            {el.label}
                        </button>
                    ))}
                </div>
            </div>

            {isFirstLoad ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <BookText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">未找到相关术语</p>
                </div>
            ) : (
                <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {items.map((item) => (
                        <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col group">
                            <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-bold text-gray-900 truncate" title={item.label || item.term}>
                                            {item.label || item.term}
                                        </h3>
                                        <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{item.term}</p>
                                    </div>
                                    {item.element && item.element !== 'general' && (
                                        <span className="flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-bold bg-white text-indigo-600 border border-indigo-100 shadow-sm">
                                            {ELEMENTS.find(e => e.id === item.element)?.label || item.element}
                                        </span>
                                    )}
                                </div>

                                {item.category && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                                        {item.category}
                                    </span>
                                )}
                            </div>

                            <div className="p-5 flex-1">
                                <p className="text-gray-600 text-sm leading-relaxed line-clamp-4 group-hover:line-clamp-none transition-all">
                                    {item.definition}
                                </p>
                            </div>

                            {item.enums && item.enums.length > 0 && (
                                <div className="px-5 pb-5 pt-0 mt-auto">
                                    <div className="pt-4 border-t border-gray-100">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">枚举值</h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            {item.enums.slice(0, 3).map((e) => (
                                                <div key={e.id} className="flex items-center gap-2 text-xs">
                                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 min-w-[2.5rem] text-center">
                                                        {e.value}
                                                    </span>
                                                    <span className="text-gray-600 truncate">{e.label}</span>
                                                </div>
                                            ))}
                                            {item.enums.length > 3 && (
                                                <div className="text-xs text-gray-400 italic pl-1">
                                                    + 更多 {item.enums.length - 3} 项...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {total > 0 && (
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-xl">
                    <div className="flex flex-1 justify-between sm:hidden">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            上一页
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page * pageSize >= total}
                            className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            下一页
                        </button>
                    </div>
                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700">
                                显示 <span className="font-medium">{(page - 1) * pageSize + 1}</span> 到 <span className="font-medium">{Math.min(page * pageSize, total)}</span> 条，共 <span className="font-medium">{total}</span> 条
                            </p>
                        </div>
                        <div>
                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                >
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                                    {page}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page * pageSize >= total}
                                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                                >
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
