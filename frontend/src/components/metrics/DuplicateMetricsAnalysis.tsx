'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    AlertTriangle,
    FunctionSquare,
    Search
} from 'lucide-react';
import Pagination from '../data-table/Pagination';
import { useDataTable, SortState, SortConfig } from '@/hooks/useDataTable';

interface DuplicateMetricsAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

interface NameFormulaConflictItem {
    name: string;
    formula_count: number;
    instance_count: number;
    total_references: number;
    total_usage: number;
    variants: Array<{
        formula_hash: string;
        formula: string;
        instance_count: number;
        total_references: number;
        total_usage: number;
        complexity: number;
        description?: string;
        representative_id: string;
        datasources?: Array<{ id: string; name: string }>;
        datasource_count?: number;
        workbooks?: Array<{ id: string; name: string }>;
        workbook_count?: number;
        tables?: Array<{ id: string; name: string }>;
        table_count?: number;
    }>;
}

const SORT_OPTIONS: SortConfig[] = [
    { key: 'formula_count', label: '公式数' },
    { key: 'instance_count', label: '实例数' },
    { key: 'total_references', label: '被依赖次数' },
    { key: 'name', label: '名称' }
];

export default function DuplicateMetricsAnalysis({ onCountUpdate, onSortUpdate }: DuplicateMetricsAnalysisProps) {
    const [allData, setAllData] = useState<NameFormulaConflictItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    useEffect(() => {
        fetch('/api/metrics/catalog/duplicate')
            .then(res => res.json())
            .then(result => {
                const items = result.items || [];
                setAllData(items);
                onCountUpdate?.(items.length);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const {
        displayData,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
        handlePageSizeChange,
        searchTerm,
        setSearchTerm
    } = useDataTable({
        moduleName: 'metrics-duplicate-name',
        data: allData,
        searchFields: ['name'],
        defaultPageSize: 20
    });

    useEffect(() => {
        onSortUpdate?.({
            options: SORT_OPTIONS,
            state: sortState,
            onChange: handleSortChange
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortState]);

    const totalFormulaVariants = allData.reduce((sum, item) => sum + (item.formula_count || 0), 0);
    const multiFormulaCount = allData.filter(item => item.formula_count >= 3).length;

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (allData.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">未发现同名多公式</h3>
                <p className="text-green-600 text-sm">当前没有发现同名但公式不同的计算字段。</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-red-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">同名多公式</div>
                    <div className="text-2xl font-bold text-red-600">{allData.length}</div>
                    <div className="text-xs text-gray-400 mt-1">同名下出现多个不同公式</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-purple-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">多公式名称</div>
                    <div className="text-2xl font-bold text-purple-600">{multiFormulaCount}</div>
                    <div className="text-xs text-gray-400 mt-1">同名下公式数 ≥ 3</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-blue-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">公式版本总数</div>
                    <div className="text-2xl font-bold text-blue-600">{totalFormulaVariants}</div>
                    <div className="text-xs text-gray-400 mt-1">所有同名分组的公式合计</div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="搜索指标名称..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                </div>
            </div>

            <div className="space-y-3">
                {displayData.length === 0 ? (
                    <div className="py-20 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        未找到匹配的指标
                    </div>
                ) : (
                    displayData.map((item, idx) => {
                        const variants = item.variants || [];
                        return (
                            <div
                                key={`${item.name}-${idx}`}
                                className="bg-white border border-gray-200 rounded-xl p-4"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-50 text-red-600">
                                            <FunctionSquare className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-gray-800 text-[15px]">
                                                    {item.name}
                                                </h4>
                                                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-red-50 text-red-700 border border-red-100">
                                                    {item.formula_count} 个公式
                                                </span>
                                                <span className="px-2 py-0.5 text-[10px] rounded-full font-bold bg-gray-50 text-gray-700 border border-gray-200">
                                                    {item.instance_count} 个实例
                                                </span>
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                总引用 {item.total_references || 0} · 总使用 {item.total_usage || 0}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                    {variants.map((variant, vIdx) => (
                                        <button
                                            key={`${variant.formula_hash}-${vIdx}`}
                                            onClick={() => openDrawer(variant.representative_id, 'metrics', item.name, 'instance')}
                                            className="w-full text-left p-2.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <code className="bg-gray-100/70 px-2 py-1 rounded text-[11px] text-gray-600 font-mono line-clamp-2 flex-1">
                                                    {variant.formula || '-'}
                                                </code>
                                                <div className="text-[11px] text-gray-500 flex-shrink-0">
                                                    引用 {variant.total_references || 0} · 使用 {variant.total_usage || 0}
                                                </div>
                                            </div>
                                            {variant.description && (
                                                <div className="mt-2 text-[11px] text-gray-500">
                                                    描述：{variant.description}
                                                </div>
                                            )}
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
                                                {variant.datasources && variant.datasources.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {variant.datasources.slice(0, 3).map((ds, di) => (
                                                            <span key={`${ds.id}-${di}`} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                                                {ds.name}
                                                            </span>
                                                        ))}
                                                        {variant.datasource_count && variant.datasource_count > 3 && (
                                                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                                                +{variant.datasource_count - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {variant.workbooks && variant.workbooks.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {variant.workbooks.slice(0, 3).map((wb, wi) => (
                                                            <span key={`${wb.id}-${wi}`} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                                                {wb.name}
                                                            </span>
                                                        ))}
                                                        {variant.workbook_count && variant.workbook_count > 3 && (
                                                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                                                                +{variant.workbook_count - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {variant.tables && variant.tables.length > 0 && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {variant.tables.slice(0, 3).map((tb, ti) => (
                                                            <span key={`${tb.id}-${ti}`} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                                                                {tb.name}
                                                            </span>
                                                        ))}
                                                        {variant.table_count && variant.table_count > 3 && (
                                                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded">
                                                                +{variant.table_count - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {allData.length > paginationState.pageSize && (
                <div className="mt-6">
                    <Pagination
                        pagination={paginationState}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                </div>
            )}

            <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-lg flex items-start gap-3">
                <div className="p-1 bg-yellow-100 rounded text-yellow-700 flex-shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-[13px] text-yellow-800 leading-relaxed">
                    <strong>治理建议：</strong> 同名多公式会造成口径混乱，建议明确命名规则并合并为标准指标。
                </div>
            </div>
        </div>
    );
}
