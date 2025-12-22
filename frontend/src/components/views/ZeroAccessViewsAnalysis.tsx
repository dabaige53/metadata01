'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    EyeOff,
    ExternalLink,
    AlertTriangle,
    LayoutDashboard,
    FileSpreadsheet
} from 'lucide-react';

interface ViewItem {
    id: string;
    name: string;
    view_type?: string;
    viewType?: string;
    total_view_count?: number;
    totalViewCount?: number;
    workbook_name?: string;
    workbookName?: string;
    workbook_id?: string;
}

interface WorkbookGroup {
    name: string;
    views: ViewItem[];
}

export default function ZeroAccessViewsAnalysis() {
    const [groupedData, setGroupedData] = useState<WorkbookGroup[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 使用专用治理API获取完整的零访问视图数据
        fetch('/api/views/governance/zero-access')
            .then(res => res.json())
            .then(result => {
                // 直接使用后端返回的分组数据
                setGroupedData(result.groups || []);
                setTotalCount(result.total_count || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const toggleGroup = (index: number) => {
        setExpandedGroups(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const getViewTypeIcon = (type?: string) => {
        if (type === 'dashboard') return <LayoutDashboard className="w-4 h-4 text-indigo-500" />;
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (totalCount === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <EyeOff className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有零访问视图</h3>
                <p className="text-green-600 text-sm">所有视图都有人访问，资产利用率良好！</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-gray-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">零访问视图</div>
                    <div className="text-2xl font-bold text-gray-600">{totalCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">从未被访问过</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">涉及工作簿</div>
                    <div className="text-2xl font-bold text-amber-600">{groupedData.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否下线或推广使用
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {groupedData.map((group, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* 组头部 */}
                        <div
                            className="p-4 bg-gray-50/50 flex items-center justify-between cursor-pointer"
                            onClick={() => toggleGroup(idx)}
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-600">
                                    <EyeOff className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-800 text-[15px] flex items-center gap-2">
                                        {group.name}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                            {group.views.length} 个零访问视图
                                        </span>
                                    </h4>
                                    <div className="mt-1 text-xs text-gray-400">
                                        这些视图从未被用户访问过
                                    </div>
                                </div>
                            </div>
                            <div className="ml-4 text-gray-400">
                                {expandedGroups[idx] ? '▲' : '▼'}
                            </div>
                        </div>

                        {/* 详情内容 */}
                        {expandedGroups[idx] && (
                            <div className="border-t border-gray-100">
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left">视图名称</th>
                                                <th className="px-6 py-3 text-left">类型</th>
                                                <th className="px-6 py-3 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.views.slice(0, 20).map((view) => (
                                                <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {getViewTypeIcon(view.view_type || view.viewType)}
                                                            <span className="font-medium text-gray-800">{view.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                                        {(view.view_type || view.viewType) === 'dashboard' ? '仪表板' : '工作表'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => openDrawer(view.id, 'views', view.name)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                                        >
                                                            查看详情 <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {group.views.length > 20 && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-3 text-center text-gray-400 text-[12px]">
                                                        还有 {group.views.length - 20} 个视图未显示...
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
