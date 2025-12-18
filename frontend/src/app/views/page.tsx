'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Layout, FileSpreadsheet, LayoutDashboard } from 'lucide-react';

interface ViewItem {
    id: string;
    luid?: string;
    name: string;
    viewType?: string;
    path?: string;
    workbookId?: string;
    workbookName?: string;
    index?: number;
    createdAt?: string;
    updatedAt?: string;
}

export default function ViewsPage() {
    const [data, setData] = useState<ViewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/views')
            .then(res => res.json())
            .then(result => {
                if (Array.isArray(result)) {
                    setData(result);
                } else if (result.items) {
                    setData(result.items);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const getViewTypeIcon = (type?: string) => {
        switch (type) {
            case 'dashboard':
                return <LayoutDashboard className="w-4 h-4 text-purple-500" />;
            case 'sheet':
                return <FileSpreadsheet className="w-4 h-4 text-blue-500" />;
            default:
                return <Layout className="w-4 h-4 text-gray-500" />;
        }
    };

    const getViewTypeBadge = (type?: string) => {
        switch (type) {
            case 'dashboard':
                return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">仪表板</span>;
            case 'sheet':
                return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">工作表</span>;
            case 'story':
                return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">故事</span>;
            default:
                return <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">{type || '-'}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">视图</h1>
                    <p className="text-sm text-gray-500 mt-1">{data.length} 个视图/仪表板</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">视图名称</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">类型</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">所属工作簿</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">路径</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">序号</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => openDrawer(item.id, 'views')}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {getViewTypeIcon(item.viewType)}
                                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {getViewTypeBadge(item.viewType)}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-gray-600">{item.workbookName || '-'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-gray-500 font-mono truncate max-w-[200px] block" title={item.path}>
                                        {item.path || '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm text-gray-500">{item.index ?? '-'}</span>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                    暂无视图数据
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
