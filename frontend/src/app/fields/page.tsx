'use client';

import { Suspense, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Columns } from 'lucide-react';
import NoDescriptionFieldsAnalysis from '@/components/fields/NoDescriptionFieldsAnalysis';
import OrphanFieldsAnalysis from '@/components/fields/OrphanFieldsAnalysis';
import HotFieldsAnalysis from '@/components/fields/HotFieldsAnalysis';
import FieldCatalog from '@/components/fields/FieldCatalog';

function FieldsContent() {
    const [activeTab, setActiveTab] = useState<'catalog' | 'noDescription' | 'orphan' | 'hot'>('catalog');
    const { openDrawer } = useDrawer();

    return (
        <div className="space-y-4">
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Columns className="w-5 h-5 text-indigo-600" />
                        字段字典
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
                            字段目录
                        </button>
                        <button
                            onClick={() => setActiveTab('noDescription')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'noDescription'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            无描述字段
                        </button>
                        <button
                            onClick={() => setActiveTab('orphan')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'orphan'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            孤立字段
                        </button>
                        <button
                            onClick={() => setActiveTab('hot')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'hot'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            热门字段
                        </button>
                    </div>
                </div>
            </div>

            {/* 内容区域 */}
            {activeTab === 'catalog' ? (
                <FieldCatalog onFieldClick={(field) => openDrawer(field.representative_id || '', 'field')} />
            ) : activeTab === 'noDescription' ? (
                <NoDescriptionFieldsAnalysis />
            ) : activeTab === 'orphan' ? (
                <OrphanFieldsAnalysis />
            ) : (
                <HotFieldsAnalysis />
            )}
        </div>
    );
}

export default function FieldsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <FieldsContent />
        </Suspense>
    );
}
