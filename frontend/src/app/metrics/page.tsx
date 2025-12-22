'use client';

import { Suspense, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, FunctionSquare } from 'lucide-react';
import DuplicateMetricsAnalysis from '@/components/metrics/DuplicateMetricsAnalysis';
import ComplexMetricsAnalysis from '@/components/metrics/ComplexMetricsAnalysis';
import UnusedMetricsAnalysis from '@/components/metrics/UnusedMetricsAnalysis';
import MetricCatalog from '@/components/metrics/MetricCatalog';

function MetricsContent() {
    const [activeTab, setActiveTab] = useState<'catalog' | 'duplicate' | 'complex' | 'unused'>('catalog');
    const { openDrawer } = useDrawer();

    return (
        <div className="space-y-4">
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <FunctionSquare className="w-5 h-5 text-indigo-600" />
                        指标库
                    </h1>

                    {/* 标签页切换 */}
                    <div className="flex p-1 bg-gray-100/80 rounded-lg">
                        <button
                            onClick={() => setActiveTab('catalog')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'catalog'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            指标目录
                        </button>
                        <button
                            onClick={() => setActiveTab('duplicate')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'duplicate'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            重复指标
                        </button>
                        <button
                            onClick={() => setActiveTab('complex')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'complex'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            高复杂度
                        </button>
                        <button
                            onClick={() => setActiveTab('unused')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'unused'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            未使用指标
                        </button>
                    </div>
                </div>
            </div>

            {/* 内容区域 */}
            {activeTab === 'catalog' ? (
                <MetricCatalog onMetricClick={(metric) => openDrawer(metric.representative_id || '', 'metric')} />
            ) : activeTab === 'duplicate' ? (
                <DuplicateMetricsAnalysis />
            ) : activeTab === 'complex' ? (
                <ComplexMetricsAnalysis />
            ) : (
                <UnusedMetricsAnalysis />
            )}
        </div>
    );
}

export default function MetricsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <MetricsContent />
        </Suspense>
    );
}
