'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Search, BookText } from 'lucide-react';

interface TermEnum {
    id: number;
    value: string;
    label: string;
    description: string;
}

interface GlossaryItem {
    id: number;
    term: string;
    definition: string;
    category: string;
    element: string; // database, table, etc.
    enums: TermEnum[];
}

const ELEMENTS = [
    { id: 'all', label: '全部' },
    { id: 'database', label: '数据库' },
    { id: 'table', label: '数据表' },
    { id: 'field', label: '字段字典' },
    { id: 'metric', label: '指标库' },
    { id: 'datasource', label: '数据源' },
    { id: 'workbook', label: '工作簿' },
    { id: 'view', label: '视图' },
    { id: 'project', label: '项目' },
    { id: 'user', label: '用户' },
];

export default function GlossaryPage() {
    const [items, setItems] = useState<GlossaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeElement, setActiveElement] = useState('all');

    useEffect(() => {
        fetchData();
    }, [activeElement]);

    // Add debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    async function fetchData() {
        setLoading(true);
        try {
            // @ts-ignore - API method might not be typed yet in api.ts
            const res = await fetch(`/api/glossary?search=${encodeURIComponent(searchQuery)}&element=${activeElement}`);
            const data = await res.json();
            setItems(data.items || []);
        } catch (error) {
            console.error('Failed to fetch glossary:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex gap-8">
            {/* Sidebar Filters */}
            <div className="w-48 flex-shrink-0">
                <div className="flex items-center gap-2 mb-6 px-2 text-indigo-700 font-bold">
                    <BookText className="w-5 h-5" />
                    <span>知识库导航</span>
                </div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">所属元素</h3>
                <div className="space-y-1">
                    {ELEMENTS.map((el) => (
                        <button
                            key={el.id}
                            onClick={() => setActiveElement(el.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeElement === el.id
                                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            {el.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-6">
                <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">术语介绍</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {ELEMENTS.find(e => e.id === activeElement)?.label}相关的专业术语定义 ({items.length})
                        </p>
                    </div>

                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索术语..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">未找到相关术语</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {items.map((item) => (
                            <div key={item.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-gray-900">{item.term}</h3>
                                            {item.element && item.element !== 'General' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 uppercase border border-indigo-100">
                                                    {ELEMENTS.find(e => e.id === item.element)?.label || item.element}
                                                </span>
                                            )}
                                            {item.category && (
                                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                                                    {item.category}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-gray-600 leading-relaxed text-sm">{item.definition}</p>
                                    </div>
                                </div>

                                {item.enums && item.enums.length > 0 && (
                                    <div className="p-6 bg-white">
                                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                                            枚举值定义
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {item.enums.map((e) => (
                                                <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 transition-colors hover:bg-gray-100 hover:border-gray-200">
                                                    <div className="min-w-[4rem] px-2 py-1.5 bg-white border border-gray-200 rounded text-center text-xs font-mono font-bold text-indigo-600 shadow-sm">
                                                        {e.value}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-gray-900">{e.label}</div>
                                                        {e.description && (
                                                            <div className="text-xs text-gray-500 mt-1 leading-snug">{e.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
