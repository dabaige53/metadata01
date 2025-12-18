'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import { FolderOpen, Loader2 } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    description?: string;
    datasource_count?: number;
    workbook_count?: number;
    total_assets?: number;
}

export default function ProjectsPage() {
    const [data, setData] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/projects')
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">项目</h1>
                    <p className="text-sm text-gray-500 mt-1">{data.length} 个项目</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">项目名称</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">简介</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">数据源</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">工作簿</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">资产总数</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => openDrawer(item.id, 'projects')}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <FolderOpen className="w-4 h-4 text-purple-500" />
                                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-gray-500 truncate max-w-[200px] block">
                                        {item.description || '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm text-gray-700">{item.datasource_count || 0}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm text-gray-700">{item.workbook_count || 0}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm font-bold text-gray-900">{item.total_assets || 0}</span>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                    暂无项目数据
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
