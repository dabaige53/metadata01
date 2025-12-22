'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    FileQuestion,
    Database,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Columns
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
    description?: string;
    isCalculated?: boolean;
    is_calculated?: boolean;
    [key: string]: string | boolean | undefined;
}

interface DatasourceGroup {
    datasource_name: string;
    fields: FieldItem[];
}

export default function NoDescriptionFieldsAnalysis() {
    const [groupedData, setGroupedData] = useState<DatasourceGroup[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/fields/governance/no-description')
            .then(res => res.json())
            .then(result => {
                // 直接使用后端返回的分组数据
                setGroupedData(result.groups || []);
                setTotalCount(result.total_count || 0);
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
                    <div className="text-xs text-gray-500 uppercase mb-1">无描述字段数</div>
                    <div className="text-2xl font-bold text-gray-800">{totalCount.toLocaleString()}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">涉及数据源</div>
                    <div className="text-2xl font-bold text-amber-600">{groupedData.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">最严重数据源</div>
                    <div className="text-lg font-bold text-red-600 truncate" title={groupedData[0]?.datasource_name}>
                        {groupedData[0]?.datasource_name || '-'} ({groupedData[0]?.fields.length || 0})
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
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
                                    <Database className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-gray-800 text-[15px] flex items-center gap-2">
                                        {group.datasource_name}
                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                                            {group.fields.length} 个字段缺少描述
                                        </span>
                                    </h4>
                                    <div className="mt-1 text-xs text-gray-400">
                                        完善字段描述可提升数据可理解性和业务可追溯性
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
                                                <th className="px-6 py-3 text-left">所属表</th>
                                                <th className="px-6 py-3 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {group.fields.map((field) => (
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
                                                    <td className="px-6 py-4 text-gray-500 text-[13px]">
                                                        {field.table || field.table_name || '-'}
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
