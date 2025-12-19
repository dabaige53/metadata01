'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Search } from 'lucide-react';

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
    enums: TermEnum[];
}

export default function GlossaryPage() {
    const [items, setItems] = useState<GlossaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

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
            const res = await fetch(`/api/glossary?search=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            setItems(data.items || []);
        } catch (error) {
            console.error('Failed to fetch glossary:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">术语介绍</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        项目专业术语定义及枚举值说明
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
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        {item.term}
                                        {item.category && (
                                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                                                {item.category}
                                            </span>
                                        )}
                                    </h3>
                                    <p className="mt-2 text-gray-600">{item.definition}</p>
                                </div>
                            </div>

                            {item.enums && item.enums.length > 0 && (
                                <div className="p-6 bg-white">
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">枚举值定义</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {item.enums.map((e) => (
                                            <div key={e.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                                                <div className="min-w-[4rem] px-2 py-1 bg-white border border-gray-200 rounded text-center text-xs font-mono font-medium text-indigo-600">
                                                    {e.value}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-gray-900">{e.label}</div>
                                                    {e.description && (
                                                        <div className="text-xs text-gray-500 mt-1">{e.description}</div>
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
    );
}
