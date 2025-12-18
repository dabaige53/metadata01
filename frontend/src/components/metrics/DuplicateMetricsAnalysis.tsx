'use client';

import { useEffect, useState } from 'react';
import { api, type DuplicateGroup } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    AlertTriangle,
    Link2,
    Database,
    BookOpen,
    ExternalLink,
    ChevronDown,
    ChevronUp
} from 'lucide-react';

export default function DuplicateMetricsAnalysis() {
    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const { openDrawer } = useDrawer();

    useEffect(() => {
        api.getDuplicateMetrics()
            .then(setDuplicates)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const toggleGroup = (index: number) => {
        setExpandedGroups(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (duplicates.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">未发现明显的重复指标</h3>
                <p className="text-green-600 text-sm">您的计算公式一致性非常好，没有发现具有完全相同公式但名称不同的指标。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">重复组数</div>
                    <div className="text-2xl font-bold text-gray-800">{duplicates.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">不同名称重复</div>
                    <div className="text-2xl font-bold text-red-600">
                        {duplicates.filter(d => d.type === 'NAME_VARIANT').length}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">同名异地 (地址说明)</div>
                    <div className="text-2xl font-bold text-blue-600">
                        {duplicates.filter(d => d.type === 'LOCATION_VARIANT').length}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {duplicates.map((group, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* 组头部 */}
                        <div
                            className="p-4 bg-gray-50/50 flex items-center justify-between cursor-pointer"
                            onClick={() => toggleGroup(idx)}
                        >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${group.type === 'NAME_VARIANT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    {group.type === 'NAME_VARIANT' ? <AlertTriangle className="w-5 h-5" /> : <Link2 className="w-5 h-5" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-800 text-[15px] flex items-center gap-2">
                                        {group.type === 'NAME_VARIANT' ? '检测到公式完全相同，但名称不一致' : '同名异地：名称相同，分布在不同工作簿'}
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${group.type === 'NAME_VARIANT' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                                            }`}>
                                            {group.count} 个实例
                                        </span>
                                    </h4>
                                    <div className="mt-1 flex items-center gap-1.5 overflow-hidden">
                                        <span className="text-xs text-gray-400 font-medium">公式:</span>
                                        <code className="bg-gray-100/50 px-2 py-0.5 rounded text-[11px] text-gray-600 font-mono truncate max-w-[500px]" title={group.formula}>
                                            {group.formula}
                                        </code>
                                    </div>
                                </div>
                            </div>
                            <div className="ml-4 text-gray-400">
                                {expandedGroups[idx] ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
                        </div>

                        {/* 详情内容 */}
                        {expandedGroups[idx] && (
                            <div className="border-t border-gray-100">
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left">名称</th>
                                                <th className="px-6 py-3 text-left">数据源</th>
                                                <th className="px-6 py-3 text-left">工作簿 / 项目</th>
                                                <th className="px-6 py-3 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.items.map((item, itemIdx) => (
                                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                                            <span className="font-medium text-gray-800">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">
                                                        <div className="flex items-center gap-1.5">
                                                            <Database className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-[13px]">{item.datasource_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5 text-gray-700 group cursor-pointer" onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDrawer(item.workbook_id, 'workbooks');
                                                            }}>
                                                                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                                                                <span className="text-[13px] font-medium group-hover:text-indigo-600 transition-colors underline decoration-dotted underline-offset-4">{item.workbook_name}</span>
                                                            </div>
                                                            <span className="text-[11px] text-gray-400 ml-5">{item.project_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => openDrawer(item.id, 'metrics')}
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
                                <div className="p-4 bg-yellow-50/30 border-t border-gray-100 flex items-start gap-3">
                                    <div className="p-1 bg-yellow-100 rounded text-yellow-700 flex-shrink-0 mt-0.5">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="text-[12px] text-yellow-800 leading-relaxed">
                                        {group.type === 'NAME_VARIANT'
                                            ? <strong>建议：</strong> + ' 发现相同计算逻辑使用了多种名称，建议统一为标准名称以降低维护成本和理解负担。'
                                            : <strong>注：</strong> + ' 该组指标名称一致，这通常是由于数据源在不同工作簿中复用造成的。只需确认各处含义的确一致即可。'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
