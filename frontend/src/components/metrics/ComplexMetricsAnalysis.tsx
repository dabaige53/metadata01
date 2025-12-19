'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Zap,
    ExternalLink,
    AlertTriangle,
    Code,
    Eye
} from 'lucide-react';

interface MetricItem {
    id: string;
    name: string;
    formula?: string;
    complexity_score?: number;
    complexityScore?: number;
    reference_count?: number;
    referenceCount?: number;
    datasource_name?: string;
    datasourceName?: string;
}

export default function ComplexMetricsAnalysis() {
    const [data, setData] = useState<MetricItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics?page=1&page_size=500')
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                // 筛选高复杂度指标（公式长度>200字符或复杂度评分>5）
                const complexMetrics = items.filter((m: MetricItem) => {
                    const formulaLen = m.formula?.length || 0;
                    const complexity = m.complexity_score ?? m.complexityScore ?? 0;
                    return formulaLen > 200 || complexity > 5;
                }).sort((a: MetricItem, b: MetricItem) => {
                    const aLen = a.formula?.length || 0;
                    const bLen = b.formula?.length || 0;
                    return bLen - aLen;
                });

                setData(complexMetrics);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getComplexityLevel = (length: number) => {
        if (length >= 500) return { color: 'text-red-600 bg-red-50', label: '超高', icon: '🔴' };
        if (length >= 300) return { color: 'text-orange-600 bg-orange-50', label: '高', icon: '🟠' };
        if (length >= 200) return { color: 'text-amber-600 bg-amber-50', label: '中高', icon: '🟡' };
        return { color: 'text-gray-600 bg-gray-50', label: '正常', icon: '🟢' };
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有高复杂度指标</h3>
                <p className="text-green-600 text-sm">所有指标公式都比较简洁，维护性良好！</p>
            </div>
        );
    }

    // 统计数据
    const superComplex = data.filter(m => (m.formula?.length || 0) >= 500).length;
    const avgLength = Math.round(data.reduce((sum, m) => sum + (m.formula?.length || 0), 0) / data.length);

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">高复杂度指标</div>
                    <div className="text-2xl font-bold text-orange-600">{data.length}</div>
                    <div className="text-xs text-gray-400 mt-1">公式&gt;200字符</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">超高复杂度</div>
                    <div className="text-2xl font-bold text-red-600">{superComplex}</div>
                    <div className="text-xs text-gray-400 mt-1">公式&gt;500字符</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">平均长度</div>
                    <div className="text-2xl font-bold text-gray-700">{avgLength}</div>
                    <div className="text-xs text-gray-400 mt-1">字符</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        考虑拆分或简化
                    </div>
                </div>
            </div>

            {/* 复杂指标列表 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-500" />
                        高复杂度指标列表
                        <span className="text-xs text-gray-500 font-normal">按公式长度排序</span>
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left">指标名称</th>
                                <th className="px-6 py-3 text-left">公式长度</th>
                                <th className="px-6 py-3 text-left">复杂度</th>
                                <th className="px-6 py-3 text-left">引用数</th>
                                <th className="px-6 py-3 text-left">数据源</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.slice(0, 30).map((metric) => {
                                const formulaLen = metric.formula?.length || 0;
                                const level = getComplexityLevel(formulaLen);
                                const refCount = metric.reference_count ?? metric.referenceCount ?? 0;
                                return (
                                    <tr key={metric.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Code className="w-4 h-4 text-purple-500" />
                                                <span className="font-medium text-gray-800">{metric.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-gray-800">{formulaLen}</span>
                                            <span className="text-gray-400 text-xs ml-1">字符</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-[10px] rounded-full font-medium ${level.color}`}>
                                                {level.icon} {level.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-gray-500">
                                                <Eye className="w-3.5 h-3.5" />
                                                {refCount}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px] max-w-[150px] truncate">
                                            {metric.datasource_name || metric.datasourceName || '-'}
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
                                );
                            })}
                        </tbody>
                    </table>
                    {data.length > 30 && (
                        <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-50">
                            还有 {data.length - 30} 个高复杂度指标未显示
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
