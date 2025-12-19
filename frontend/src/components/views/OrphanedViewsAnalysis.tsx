'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    LayoutGrid,
    EyeOff,
    ExternalLink,
    CheckCircle2,
    BarChart3,
    AlertTriangle
} from 'lucide-react';

interface ViewItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    workbook?: string;
    workbook_name?: string;
    workbookName?: string;
    owner?: string;
    usage?: number;
    hits_total?: number;
    hitsTotal?: number;
    field_count?: number;
    fieldCount?: number;
    [key: string]: string | number | undefined;
}

export default function OrphanedViewsAnalysis() {
    const [unusedViews, setUnusedViews] = useState<ViewItem[]>([]);
    const [complexViews, setComplexViews] = useState<ViewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/views?page=1&page_size=1000') // 获取更多以进行分析
            .then(res => res.json())
            .then(result => {
                const items = Array.isArray(result) ? result : (result.items || []);

                // 无访问视图：访问次数为0
                const unused = items.filter((v: ViewItem) => {
                    const hits = v.hits_total ?? v.hitsTotal ?? v.usage ?? 0;
                    return hits === 0;
                });
                setUnusedViews(unused);

                // 复杂视图：包含字段数超过20的视图
                const complex = items.filter((v: ViewItem) => {
                    const fields = v.field_count ?? v.fieldCount ?? 0;
                    return fields >= 20;
                });
                // 按复杂度降序
                setComplexViews(complex.sort((a: ViewItem, b: ViewItem) => {
                    const fieldsA = a.field_count ?? a.fieldCount ?? 0;
                    const fieldsB = b.field_count ?? b.fieldCount ?? 0;
                    return fieldsB - fieldsA;
                }));
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const hasIssues = unusedViews.length > 0 || complexViews.length > 0;

    if (!hasIssues) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">视图治理状况良好</h3>
                <p className="text-green-600 text-sm">所有视图均有访问记录且复杂度在合理范围内。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-gray-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">无访问视图</div>
                    <div className="text-2xl font-bold text-gray-600">{unusedViews.length}</div>
                    <div className="text-xs text-gray-400 mt-1">近期无用户访问记录</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">复杂视图</div>
                    <div className="text-2xl font-bold text-purple-600">{complexViews.length}</div>
                    <div className="text-xs text-gray-400 mt-1">包含大量字段(20+)，渲染性能可能受影响</div>
                </div>
            </div>

            {/* 无访问视图列表 */}
            {unusedViews.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-gray-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-500">
                                <EyeOff className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-[15px]">无访问视图</h4>
                                <p className="text-xs text-gray-500">这些视图近期无人访问，建议确认是否可以下线以减少维护成本</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">视图名称</th>
                                    <th className="px-6 py-3 text-left">所属工作簿</th>
                                    <th className="px-6 py-3 text-left">项目</th>
                                    <th className="px-6 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {unusedViews.slice(0, 20).map((view) => (
                                    <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <LayoutGrid className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium text-gray-800">{view.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {view.workbook || view.workbook_name || view.workbookName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {view.project || view.project_name || view.projectName || '-'}
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
                            </tbody>
                        </table>
                        {unusedViews.length > 20 && (
                            <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-50">
                                还有 {unusedViews.length - 20} 个无访问视图未显示
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 复杂视图列表 */}
            {complexViews.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-purple-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-[15px]">复杂视图分析</h4>
                                <p className="text-xs text-gray-500">这些视图使用了大量字段（超过20个），可能存在性能问题或设计过于复杂</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">视图名称</th>
                                    <th className="px-6 py-3 text-left">所属工作簿</th>
                                    <th className="px-6 py-3 text-center">字段使用数</th>
                                    <th className="px-6 py-3 text-center">访问量</th>
                                    <th className="px-6 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {complexViews.slice(0, 20).map((view) => (
                                    <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                                <span className="font-medium text-gray-800">{view.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {view.workbook || view.workbook_name || view.workbookName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
                                                {view.field_count ?? view.fieldCount ?? 0}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            {view.hits_total ?? view.hitsTotal ?? view.usage ?? 0}
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
                            </tbody>
                        </table>
                        {complexViews.length > 20 && (
                            <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-50">
                                还有 {complexViews.length - 20} 个复杂视图未显示
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
