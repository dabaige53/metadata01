'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    Database,
    Table2,
    ExternalLink,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

interface TableItem {
    id: string;
    name: string;
    schema?: string;
    database?: string;
    database_name?: string;
    databaseName?: string;
    column_count?: number;
    field_count?: number;
    datasource_count?: number;
    workbook_count?: number;
    [key: string]: string | number | boolean | undefined;
}

export default function UnusedTablesAnalysis() {
    const [unusedTables, setUnusedTables] = useState<TableItem[]>([]);
    const [wideTables, setWideTables] = useState<TableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        // 并行获取未使用表和宽表数据
        Promise.all([
            fetch('/api/tables/governance/unused').then(res => res.json()),
            fetch('/api/tables/governance/wide').then(res => res.json())
        ])
            .then(([unusedResult, wideResult]) => {
                setUnusedTables(unusedResult.items || []);
                setWideTables(wideResult.items || []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    const hasIssues = unusedTables.length > 0 || wideTables.length > 0;

    if (!hasIssues) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">数据表治理状况良好</h3>
                <p className="text-green-600 text-sm">没有发现未使用的表或需要优化的宽表。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 概览统计报告 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">未使用表</div>
                    <div className="text-2xl font-bold text-amber-600">{unusedTables.length}</div>
                    <div className="text-xs text-gray-400 mt-1">未被任何数据源引用</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">宽表 (&gt;50列)</div>
                    <div className="text-2xl font-bold text-purple-600">{wideTables.length}</div>
                    <div className="text-xs text-gray-400 mt-1">建议考虑拆分优化</div>
                </div>
            </div>

            {/* 未使用表列表 */}
            {unusedTables.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-amber-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-100 text-amber-600">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-[15px]">未使用表</h4>
                                <p className="text-xs text-gray-500">这些表未被任何数据源引用，可考虑下线或确认是否需要接入</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">表名</th>
                                    <th className="px-6 py-3 text-left">Schema</th>
                                    <th className="px-6 py-3 text-left">数据库</th>
                                    <th className="px-6 py-3 text-center">列数</th>
                                    <th className="px-6 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {unusedTables.slice(0, 20).map((table) => (
                                    <tr key={table.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Table2 className="w-4 h-4 text-gray-400" />
                                                <span className="font-medium text-gray-800">{table.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {table.schema || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            <div className="flex items-center gap-1.5">
                                                <Database className="w-3.5 h-3.5 text-gray-400" />
                                                {table.database || table.database_name || table.databaseName || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            {table.column_count || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openDrawer(table.id, 'tables', table.name)}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-white hover:bg-indigo-600 rounded-lg transition-all border border-indigo-100 hover:border-indigo-600 shadow-sm active:scale-95"
                                            >
                                                查看详情 <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {unusedTables.length > 20 && (
                            <div className="p-4 text-center text-gray-400 text-sm border-t border-gray-50">
                                还有 {unusedTables.length - 20} 个未使用表未显示
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 宽表列表 */}
            {wideTables.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-purple-50/50 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-100 text-purple-600">
                                <Table2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-[15px]">宽表分析</h4>
                                <p className="text-xs text-gray-500">列数超过50的大表，可能影响查询性能，建议考虑拆分</p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-400 text-[11px] uppercase tracking-wider font-semibold border-b border-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left">表名</th>
                                    <th className="px-6 py-3 text-left">Schema</th>
                                    <th className="px-6 py-3 text-left">数据库</th>
                                    <th className="px-6 py-3 text-center">列数</th>
                                    <th className="px-6 py-3 text-center">引用数据源</th>
                                    <th className="px-6 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {wideTables.map((table) => (
                                    <tr key={table.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Table2 className="w-4 h-4 text-purple-400" />
                                                <span className="font-medium text-gray-800">{table.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            {table.schema || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-[13px]">
                                            <div className="flex items-center gap-1.5">
                                                <Database className="w-3.5 h-3.5 text-gray-400" />
                                                {table.database || table.database_name || table.databaseName || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-bold text-[12px]">
                                                {table.column_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            {table.datasource_count || 0}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => openDrawer(table.id, 'tables', table.name)}
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
    );
}
