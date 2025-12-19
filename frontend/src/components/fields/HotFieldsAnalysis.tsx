'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Flame,
    Database,
    ExternalLink,
    Columns,
    TrendingUp,
    Eye
} from 'lucide-react';

interface FieldItem {
    id: string;
    name: string;
    dataType?: string;
    data_type?: string;
    role?: string;
    datasource_name?: string;
    datasourceName?: string;
    isCalculated?: boolean;
    is_calculated?: boolean;
    usage_count?: number;
    usageCount?: number;
    used_in_views?: Array<{ id: string; name: string }>;
}

export default function HotFieldsAnalysis() {
    const [data, setData] = useState<FieldItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 获取高频使用字段
        fetch('/api/fields?page=1&page_size=100&sort=usageCount&order=desc')
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                // 筛选高频字段 (usage_count > 20)
                const hotFields = items.filter((f: FieldItem) => {
                    const usageCount = f.usage_count ?? f.usageCount ?? 0;
                    return usageCount > 20;
                }).sort((a: FieldItem, b: FieldItem) => {
                    const aCount = a.usage_count ?? a.usageCount ?? 0;
                    const bCount = b.usage_count ?? b.usageCount ?? 0;
                    return bCount - aCount;
                });

                setData(hotFields);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const getRoleLabel = (role?: string) => {
        if (!role) return null;
        const isMeasure = role.toLowerCase().includes('measure');
        return (
            <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${isMeasure ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                }`}>
                {isMeasure ? '度量' : '维度'}
            </span>
        );
    };

    const getHeatLevel = (count: number) => {
        if (count >= 200) return { color: 'text-red-600 bg-red-50', label: '🔥🔥🔥 超热门' };
        if (count >= 100) return { color: 'text-orange-600 bg-orange-50', label: '🔥🔥 热门' };
        if (count >= 50) return { color: 'text-amber-600 bg-amber-50', label: '🔥 活跃' };
        return { color: 'text-yellow-600 bg-yellow-50', label: '⚡ 常用' };
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Flame className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="text-gray-600 font-bold mb-1">暂无热门字段</h3>
                <p className="text-gray-400 text-sm">没有字段被高频使用（&gt;20次引用）</p>
            </div>
        );
    }

    // 统计数据
    const maxUsage = Math.max(...data.map(f => f.usage_count ?? f.usageCount ?? 0));
    const avgUsage = Math.round(data.reduce((sum, f) => sum + (f.usage_count ?? f.usageCount ?? 0), 0) / data.length);

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-orange-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">热门字段数</div>
                    <div className="text-2xl font-bold text-orange-600">{data.length}</div>
                    <div className="text-xs text-gray-400 mt-1">被引用&gt;20次</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">最高引用</div>
                    <div className="text-2xl font-bold text-red-600">{maxUsage}</div>
                    <div className="text-xs text-gray-400 mt-1">次</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">平均引用</div>
                    <div className="text-2xl font-bold text-gray-700">{avgUsage}</div>
                    <div className="text-xs text-gray-400 mt-1">次</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        核心资产，优先保障
                    </div>
                </div>
            </div>

            {/* 热门字段排行榜 */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-gradient-to-r from-orange-50 to-red-50 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        热门字段排行榜
                        <span className="text-xs text-gray-500 font-normal">按视图引用次数排序</span>
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left w-12">排名</th>
                                <th className="px-6 py-3 text-left">字段名称</th>
                                <th className="px-6 py-3 text-left">引用次数</th>
                                <th className="px-6 py-3 text-left">热度</th>
                                <th className="px-6 py-3 text-left">角色</th>
                                <th className="px-6 py-3 text-left">数据源</th>
                                <th className="px-6 py-3 text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.slice(0, 50).map((field, idx) => {
                                const usageCount = field.usage_count ?? field.usageCount ?? 0;
                                const heatLevel = getHeatLevel(usageCount);
                                return (
                                    <tr key={field.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {idx + 1}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Columns className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium text-gray-800">{field.name}</span>
                                                {(field.isCalculated || field.is_calculated) && (
                                                    <span className="px-1.5 py-0.5 text-[10px] rounded font-medium bg-purple-50 text-purple-600">计算</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Eye className="w-4 h-4 text-gray-400" />
                                                <span className="font-bold text-gray-800">{usageCount}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 text-[10px] rounded-full font-medium ${heatLevel.color}`}>
                                                {heatLevel.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getRoleLabel(field.role)}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px] max-w-[200px] truncate">
                                            {field.datasource_name || field.datasourceName || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openDrawer(field.id, 'fields', field.name)}
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
                </div>
            </div>
        </div>
    );
}
