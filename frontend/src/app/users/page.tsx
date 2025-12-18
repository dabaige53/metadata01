'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { User, Loader2 } from 'lucide-react';

interface UserItem {
    id: string;
    name: string;
    display_name?: string;
    site_role?: string;
    datasource_count?: number;
    workbook_count?: number;
    total_assets?: number;
}

export default function UsersPage() {
    const [data, setData] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/users')
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

    const getRoleBadgeClass = (role?: string) => {
        switch (role) {
            case 'Creator':
            case 'SiteAdministratorCreator':
                return 'bg-purple-100 text-purple-700';
            case 'Explorer':
            case 'SiteAdministratorExplorer':
                return 'bg-blue-100 text-blue-700';
            case 'Viewer':
                return 'bg-gray-100 text-gray-600';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">用户</h1>
                    <p className="text-sm text-gray-500 mt-1">{data.length} 个用户</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">用户名</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">显示名称</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">角色</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">数据源</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">工作簿</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">资产总数</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {data.map((item) => (
                            <tr
                                key={item.id}
                                onClick={() => openDrawer(item.id, 'users')}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-500" />
                                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-sm text-gray-600">{item.display_name || '-'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeClass(item.site_role)}`}>
                                        {item.site_role || 'User'}
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
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                    暂无用户数据
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
