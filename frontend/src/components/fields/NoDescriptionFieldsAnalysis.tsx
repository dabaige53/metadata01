'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    FileQuestion,
    Columns,
    GitBranch,
    Table
} from 'lucide-react';
import FieldCatalogCard, { FieldCatalogItem } from '../cards/FieldCatalogCard';

export default function NoDescriptionFieldsAnalysis() {
    const [items, setItems] = useState<FieldCatalogItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/fields/catalog/no-description')
            .then(res => res.json())
            .then(result => {
                setItems(result.items || []);
                setTotalCount(result.total_count || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // 统计多数据源字段数量
    const multiDatasourceCount = items.filter(f => f.datasource_count > 1).length;

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
                    <FileQuestion className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">所有字段均已完善描述</h3>
                <p className="text-green-600 text-sm">非常棒！您的元数据治理工作非常到位。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">无描述规范字段</div>
                    <div className="text-2xl font-bold text-gray-800">{totalCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">按物理列聚合后</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">跨数据源字段</div>
                    <div className="text-2xl font-bold text-amber-600">{multiDatasourceCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同一字段被多个数据源使用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">涉及数据表</div>
                    <div className="text-2xl font-bold text-blue-600">
                        {new Set(items.filter(f => f.table_id).map(f => f.table_id)).size}
                    </div>
                </div>
            </div>

            {/* 字段卡片列表 */}
            <div className="space-y-3">
                {items.map((item, idx) => (
                    <div
                        key={`${item.canonical_name}-${item.table_id || idx}`}
                        className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                        onClick={() => openDrawer(item.representative_id || '', 'field')}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-50 text-indigo-600">
                                    <Columns className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-bold text-gray-800 text-[15px]">
                                            {item.canonical_name}
                                        </h4>
                                        {/* 角色标签 */}
                                        {item.role && (
                                            <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${item.role.toLowerCase().includes('measure')
                                                ? 'bg-green-50 text-green-600'
                                                : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {item.role.toLowerCase().includes('measure') ? '度量' : '维度'}
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
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                        {item.table_name && item.table_name !== '-' && (
                                            <span className="flex items-center gap-1">
                                                <Table className="w-3 h-3" />
                                                {item.table_schema ? `${item.table_schema}.` : ''}{item.table_name}
                                            </span>
                                        )}
                                        {item.data_type && (
                                            <span className="text-gray-400">
                                                {item.data_type}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 右侧统计信息 */}
                            <div className="flex items-center gap-4 text-right">
                                <div>
                                    <div className="text-lg font-bold text-gray-700">{item.total_usage || 0}</div>
                                    <div className="text-xs text-gray-400">使用次数</div>
                                </div>
                                <div className="text-gray-300">→</div>
                            </div>
                        </div>

                        {/* 数据源列表（多数据源时展示） */}
                        {item.datasource_count > 1 && item.datasources && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="text-xs text-gray-400 mb-2">涉及数据源：</div>
                                <div className="flex flex-wrap gap-2">
                                    {item.datasources.map((ds, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                                        >
                                            {ds.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
