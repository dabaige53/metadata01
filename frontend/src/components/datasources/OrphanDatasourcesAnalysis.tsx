'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Layers,
    Unlink,
    ExternalLink,
    AlertTriangle,
    Shield,
    ShieldOff
} from 'lucide-react';

interface DatasourceItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    isCertified?: boolean;
    is_certified?: boolean;
    workbook_count?: number;
    field_count?: number;
}

export default function OrphanDatasourcesAnalysis() {
    const [orphaned, setOrphaned] = useState<DatasourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        api.getDatasources(1, 200)
            .then(res => {
                const items = (Array.isArray(res) ? res : (res.items || [])) as unknown as DatasourceItem[];
                // 孤立数据源：未被任何工作簿引用
                const orph = items.filter(d => !d.workbook_count || d.workbook_count === 0);
                setOrphaned(orph);
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

    if (orphaned.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Unlink className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有孤立数据源</h3>
                <p className="text-green-600 text-sm">所有数据源都被工作簿引用，资源利用率良好！</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">孤立数据源</div>
                    <div className="text-2xl font-bold text-red-600">{orphaned.length}</div>
                    <div className="text-xs text-gray-400 mt-1">未被任何工作簿引用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">字段浪费</div>
                    <div className="text-2xl font-bold text-gray-700">
                        {orphaned.reduce((sum, d) => sum + (d.field_count || 0), 0)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">孤立数据源中的字段数</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否下线或建立引用
                    </div>
                </div>
            </div>

            {/* 孤立数据源列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-red-50/50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-100 text-red-600">
                            <Unlink className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-800 text-[15px]">孤立数据源清单</h4>
                            <p className="text-xs text-gray-500">这些数据源未被任何工作簿引用，可考虑下线或确认是否需要保留</p>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left">数据源名称</th>
                                <th className="px-6 py-3 text-left">项目</th>
                                <th className="px-6 py-3 text-left">负责人</th>
                                <th className="px-6 py-3 text-center">字段数</th>
                                <th className="px-6 py-3 text-center">认证状态</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orphaned.map((ds) => (
                                <tr key={ds.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-red-400" />
                                            <span className="font-medium text-gray-800">{ds.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {ds.project || ds.project_name || ds.projectName || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                        {ds.owner || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-500">
                                        {ds.field_count || 0}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {(ds.isCertified ?? ds.is_certified) ? (
                                            <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                                                <Shield className="w-3.5 h-3.5" /> 已认证
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                                                <ShieldOff className="w-3.5 h-3.5" /> 未认证
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => openDrawer(ds.id, 'datasources', ds.name)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                        >
                                            查看详情 <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
