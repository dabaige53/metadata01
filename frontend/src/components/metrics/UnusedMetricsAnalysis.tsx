'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Ghost,
    ExternalLink,
    AlertTriangle,
    Code,
    Database
} from 'lucide-react';

interface MetricItem {
    id: string;
    name: string;
    formula?: string;
    reference_count?: number;
    referenceCount?: number;
    datasource_name?: string;
    datasourceName?: string;
}

interface DatasourceGroup {
    name: string;
    metrics: MetricItem[];
}

export default function UnusedMetricsAnalysis() {
    const [groupedData, setGroupedData] = useState<DatasourceGroup[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics?page=1&page_size=500')
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                // 筛选未使用指标（引用数为0）
                const unusedMetrics = items.filter((m: MetricItem) => {
                    const refCount = m.reference_count ?? m.referenceCount ?? 0;
                    return refCount === 0;
                });

                // 按数据源分组
                const grouped = unusedMetrics.reduce((acc: Record<string, MetricItem[]>, metric: MetricItem) => {
                    const key = metric.datasource_name || metric.datasourceName || '未知数据源';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(metric);
                    return acc;
                }, {} as Record<string, MetricItem[]>);

                // 转换为数组并按数量排序
                const groupArray = Object.entries(grouped)
                    .map(([name, metrics]) => ({ name, metrics: metrics as MetricItem[] }))
                    .sort((a, b) => b.metrics.length - a.metrics.length);

                setGroupedData(groupArray);
                setTotalCount(unusedMetrics.length);
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
                    <Ghost className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有未使用的指标</h3>
                <p className="text-green-600 text-sm">所有指标都被视图引用，资产利用率很高！</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-gray-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">未使用指标</div>
                    <div className="text-2xl font-bold text-gray-600">{totalCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">引用次数为0</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">涉及数据源</div>
                    <div className="text-2xl font-bold text-amber-600">{groupedData.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否需要保留
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
                                    <Database className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-800 text-[15px] flex items-center gap-2">
                                        {group.name}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                            {group.metrics.length} 个未使用指标
                                        </span>
                                    </h4>
                                    <div className="mt-1 text-xs text-gray-400">
                                        这些指标未被任何视图引用，可能为冗余资产
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
                                                <th className="px-6 py-3 text-left">指标名称</th>
                                                <th className="px-6 py-3 text-left">公式预览</th>
                                                <th className="px-6 py-3 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.metrics.slice(0, 15).map((metric) => (
                                                <tr key={metric.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Code className="w-4 h-4 text-gray-400" />
                                                            <span className="font-medium text-gray-800">{metric.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-[12px] max-w-[300px] truncate font-mono">
                                                        {metric.formula?.slice(0, 50) || '-'}
                                                        {(metric.formula?.length || 0) > 50 && '...'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => openDrawer(metric.id, 'metrics', metric.name)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                                        >
                                                            查看详情 <ExternalLink className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {group.metrics.length > 15 && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-3 text-center text-gray-400 text-[12px]">
                                                        还有 {group.metrics.length - 15} 个指标未显示...
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
