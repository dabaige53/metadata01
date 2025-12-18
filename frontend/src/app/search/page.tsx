'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Columns,
    Table2,
    Layers,
    BookOpen,
    FunctionSquare,
    SearchX
} from 'lucide-react';

interface SearchResult {
    id: string;
    name: string;
    source?: string;
    schema?: string;
    project?: string;
    datasource?: string;
    formula?: string;
}

interface SearchResults {
    query: string;
    total: number;
    results: {
        fields?: SearchResult[];
        tables?: SearchResult[];
        datasources?: SearchResult[];
        workbooks?: SearchResult[];
        metrics?: SearchResult[];
    };
}

const typeLabels: Record<string, string> = {
    fields: '字段',
    tables: '数据表',
    datasources: '数据源',
    workbooks: '工作簿',
    metrics: '指标'
};

const typeIcons: Record<string, React.ElementType> = {
    fields: Columns,
    tables: Table2,
    datasources: Layers,
    workbooks: BookOpen,
    metrics: FunctionSquare
};

function SearchContent() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q') || '';
    const [data, setData] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        if (query.length >= 2) {
            setLoading(true);
            fetch(`/api/search?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(setData)
                .catch(console.error)
                .finally(() => setLoading(false));
        }
    }, [query]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!query || query.length < 2) {
        return (
            <div className="text-center py-20">
                <SearchX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">请输入至少 2 个字符进行搜索</p>
            </div>
        );
    }

    if (!data || data.total === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900">
                        搜索结果 <span className="text-gray-400 font-normal">"{query}"</span>
                    </h1>
                    <span className="text-sm text-gray-500">无结果</span>
                </div>
                <div className="text-center py-20">
                    <SearchX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">没有找到 "{query}" 相关内容</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">
                    搜索结果 <span className="text-gray-400 font-normal">"{query}"</span>
                </h1>
                <span className="text-sm text-gray-500">{data.total} 项</span>
            </div>

            {Object.entries(data.results).map(([type, items]) => {
                if (!items || items.length === 0) return null;
                const Icon = typeIcons[type] || Columns;
                const label = typeLabels[type] || type;

                return (
                    <div key={type} className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {label} ({items.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => openDrawer(item.id, type)}
                                    className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                                >
                                    <div className="font-medium text-gray-900 mb-1 truncate">{item.name}</div>
                                    <div className="text-xs text-gray-400 truncate">
                                        {item.source || item.schema || item.project || item.datasource || item.formula || '-'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <SearchContent />
        </Suspense>
    );
}
