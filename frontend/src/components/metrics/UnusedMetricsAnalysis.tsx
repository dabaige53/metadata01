'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Ghost,
    AlertTriangle,
    FunctionSquare,
    GitBranch
} from 'lucide-react';
import { MetricCatalogItem } from '../cards/MetricCatalogCard';

export default function UnusedMetricsAnalysis() {
    const [items, setItems] = useState<MetricCatalogItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics/catalog/unused')
            .then(res => res.json())
            .then(result => {
                setItems(result.items || []);
                setTotalCount(result.total_count || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // 统计多数据源数量
    const multiDatasourceCount = items.filter(m => m.datasource_count > 1).length;

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
                    <div className="text-xs text-gray-500 uppercase mb-1">未使用规范指标</div>
                    <div className="text-2xl font-bold text-gray-600">{totalCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">聚合后引用次数为0</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源</div>
                    <div className="text-2xl font-bold text-purple-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同一指标跨多个数据源</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否需要保留
                    </div>
                </div>
            </div>

            {/* 未使用指标卡片列表 */}
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div
                        key={`${item.name}-${item.formula_hash || idx}`}
                        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => openDrawer(item.representative_id || '', 'metric')}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-500">
                                    <FunctionSquare className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-gray-800 text-[15px]">
                                            {item.name}
                                        </h4>
                                        {/* 未使用标签 */}
                                        <span className="px-1.5 py-0.5 text-[10px] rounded font-medium bg-gray-100 text-gray-500">
                                            未使用
                                        </span>
                                        {/* 实例数标签 */}
                                        {item.instance_count > 1 && (
                                            <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-600">
                                                {item.instance_count} 实例
                                            </span>
                                        )}
                                        {/* 多数据源血缘标记 */}
                                        {item.datasource_count > 1 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-full text-xs text-purple-600">
                                                <GitBranch className="w-3 h-3" />
                                                跨 {item.datasource_count} 数据源
                                            </span>
                                        )}
                                    </div>
                                    {/* 公式预览 */}
                                    <div className="mt-2">
                                        <code className="bg-gray-100/50 px-2 py-1 rounded text-[11px] text-gray-600 font-mono line-clamp-2">
                                            {item.formula}
                                        </code>
                                    </div>
                                </div>
                            </div>

                            {/* 右侧箭头 */}
                            <div className="flex items-center gap-2">
                                <div className="text-gray-300">→</div>
                            </div>
                        </div>

                        {/* 数据源列表（多数据源时展示） */}
                        {item.datasource_count > 1 && item.datasources && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="text-xs text-gray-400 mb-1">涉及数据源：</div>
                                <div className="flex flex-wrap gap-1">
                                    {item.datasources.map((ds, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">
                                            {ds.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 治理建议 */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-3">
                <div className="p-1 bg-gray-200 rounded text-gray-600 flex-shrink-0 mt-0.5">
                    <Ghost className="w-4 h-4" />
                </div>
                <div className="text-[13px] text-gray-600 leading-relaxed">
                    <strong>说明：</strong> 未使用的指标可能是历史遗留或预留功能。建议定期清理确认无用的指标，或将其隐藏以保持数据源整洁。
                </div>
            </div>
        </div>
    );
}
