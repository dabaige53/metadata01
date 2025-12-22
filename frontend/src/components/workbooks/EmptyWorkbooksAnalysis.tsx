'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    BookOpen,
    Layers,
    ExternalLink,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';

interface WorkbookItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    viewCount?: number;
    view_count?: number;
    upstream_datasources?: string[];
    [key: string]: string | number | string[] | undefined;
}

export default function EmptyWorkbooksAnalysis() {
    const [emptyWorkbooks, setEmptyWorkbooks] = useState<WorkbookItem[]>([]);
    const [singleSourceWorkbooks, setSingleSourceWorkbooks] = useState<WorkbookItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 并行获取无视图工作簿和单源依赖工作簿数据
        Promise.all([
            fetch('/api/workbooks/governance/empty').then(res => res.json()),
            fetch('/api/workbooks/governance/single-source').then(res => res.json())
        ])
            .then(([emptyResult, singleResult]) => {
                setEmptyWorkbooks(emptyResult.items || []);
                setSingleSourceWorkbooks(singleResult.items || []);
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

    const hasIssues = emptyWorkbooks.length > 0 || singleSourceWorkbooks.length > 0;

    if (!hasIssues) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">工作簿治理状况良好</h3>
                <p className="text-green-600 text-sm">没有发现空工作簿或单一数据源依赖的工作簿。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">无视图工作簿</div>
                    <div className="text-2xl font-bold text-red-600">{emptyWorkbooks.length}</div>
                    <div className="text-xs text-gray-400 mt-1">未包含任何视图的空工作簿</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">单源依赖工作簿</div>
                    <div className="text-2xl font-bold text-blue-600">{singleSourceWorkbooks.length}</div>
                    <div className="text-xs text-gray-400 mt-1">只依赖单一数据源，影响范围集中</div>
                </div>
            </div>

            {/* 无视图工作簿列表 */}
            {emptyWorkbooks.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-red-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-[15px]">无视图工作簿</h4>
                                <p className="text-xs text-gray-500">这些工作簿不包含任何视图，可能是无效资源或正在开发中</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">工作簿名称</th>
                                    <th className="px-6 py-3 text-left">项目</th>
                                    <th className="px-6 py-3 text-left">负责人</th>
                                    <th className="px-6 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {emptyWorkbooks.slice(0, 20).map((wb) => (
                                    <tr key={wb.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-red-400" />
                                                <span className="font-medium text-gray-800">{wb.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {wb.project || wb.project_name || wb.projectName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {wb.owner || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openDrawer(wb.id, 'workbooks', wb.name)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                            >
                                                查看详情 <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {emptyWorkbooks.length > 20 && (
                            <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-50">
                                还有 {emptyWorkbooks.length - 20} 个无视图工作簿未显示
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 单源依赖工作簿列表 */}
            {singleSourceWorkbooks.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-blue-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-[15px]">单源依赖分析</h4>
                                <p className="text-xs text-gray-500">这些工作簿只依赖单一数据源，便于评估数据源变更影响范围</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">工作簿名称</th>
                                    <th className="px-6 py-3 text-left">依赖数据源</th>
                                    <th className="px-6 py-3 text-left">项目</th>
                                    <th className="px-6 py-3 text-center">视图数</th>
                                    <th className="px-6 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {singleSourceWorkbooks.slice(0, 20).map((wb) => (
                                    <tr key={wb.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-blue-400" />
                                                <span className="font-medium text-gray-800">{wb.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[12px] font-medium">
                                                {wb.upstream_datasources?.[0] || '-'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {wb.project || wb.project_name || wb.projectName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            {wb.viewCount ?? wb.view_count ?? 0}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openDrawer(wb.id, 'workbooks', wb.name)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                            >
                                                查看详情 <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {singleSourceWorkbooks.length > 20 && (
                            <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-50">
                                还有 {singleSourceWorkbooks.length - 20} 个单源依赖工作簿未显示
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
