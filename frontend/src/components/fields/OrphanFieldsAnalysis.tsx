'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Unlink,
    Database,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Columns,
    AlertTriangle
} from 'lucide-react';

interface FieldItem {
    id: string;
    name: string;
    dataType?: string;
    data_type?: string;
    role?: string;
    datasource_name?: string;
    datasourceName?: string;
    table?: string;
    table_name?: string;
    isCalculated?: boolean;
    is_calculated?: boolean;
    usage_count?: number;
    usageCount?: number;
}

interface DatasourceGroup {
    datasource_name: string;
    fields: FieldItem[];
}

export default function OrphanFieldsAnalysis() {
    const [groupedData, setGroupedData] = useState<DatasourceGroup[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 获取孤立字段（未被任何视图使用的字段）
        fetch('/api/fields?page=1&page_size=500&orphan=true')
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                // 筛选未使用的字段 (usage_count = 0 或 未被视图引用)
                const orphanFields = items.filter((f: FieldItem) => {
                    const usageCount = f.usage_count ?? f.usageCount ?? 0;
                    return usageCount === 0;
                });

                // 按数据源分组
                const grouped = orphanFields.reduce((acc: Record<string, FieldItem[]>, field: FieldItem) => {
                    const key = field.datasource_name || field.datasourceName || '未知数据源';
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(field);
                    return acc;
                }, {} as Record<string, FieldItem[]>);

                // 转换为数组并按数量排序
                const groupArray = Object.entries(grouped)
                    .map(([name, fields]) => ({ datasource_name: name, fields: fields as FieldItem[] }))
                    .sort((a, b) => b.fields.length - a.fields.length);

                setGroupedData(groupArray);
                setTotalCount(orphanFields.length);
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
                    <Unlink className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有孤立字段</h3>
                <p className="text-green-600 text-sm">所有字段都被视图引用，资产利用率很高！</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">孤立字段数</div>
                    <div className="text-2xl font-bold text-red-600">{totalCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">未被任何视图使用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">涉及数据源</div>
                    <div className="text-2xl font-bold text-amber-600">{groupedData.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估业务必要性，考虑清理或隐藏
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
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-100 text-red-600">
                                    <Database className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-800 text-[15px] flex items-center gap-2">
                                        {group.datasource_name}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-100">
                                            {group.fields.length} 个孤立字段
                                        </span>
                                    </h4>
                                    <div className="mt-1 text-xs text-gray-400">
                                        这些字段未被任何视图使用，可能是冗余资产
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
                                                <th className="px-6 py-3 text-left">字段名称</th>
                                                <th className="px-6 py-3 text-left">角色</th>
                                                <th className="px-6 py-3 text-left">数据类型</th>
                                                <th className="px-6 py-3 text-left">是否计算</th>
                                                <th className="px-6 py-3 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.fields.slice(0, 20).map((field) => (
                                                <tr key={field.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Columns className="w-4 h-4 text-gray-400" />
                                                            <span className="font-medium text-gray-800">{field.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {getRoleLabel(field.role)}
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                                        {field.dataType || field.data_type || '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {(field.isCalculated || field.is_calculated) ? (
                                                            <span className="px-1.5 py-0.5 text-[10px] rounded font-medium bg-purple-50 text-purple-600">计算字段</span>
                                                        ) : (
                                                            <span className="text-gray-400 text-[12px]">基础字段</span>
                                                        )}
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
                                            ))}
                                            {group.fields.length > 20 && (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-3 text-center text-gray-400 text-[12px]">
                                                        还有 {group.fields.length - 20} 个字段未显示...
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
