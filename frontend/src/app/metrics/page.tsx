'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, FunctionSquare, AlertTriangle } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';

interface MetricItem {
    id: string;
    name: string;
    role?: string;
    formula?: string;
    complexity?: number;
    referenceCount?: number;
    reference_count?: number;
    hasDuplicate?: boolean;
    has_duplicate?: boolean;
    similarMetrics?: Array<{ id: string; name: string }>;
    dependencyFields?: Array<{ id: string; name: string; role?: string }>;
    datasourceName?: string;
    datasource_name?: string;
    [key: string]: any;
}

function MetricsContent() {
    const [allData, setAllData] = useState<MetricItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        setLoading(true);
        fetch('/api/metrics?page=1&page_size=1000')
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                setAllData(items);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // 使用自定义 Hook 管理表格状态
    const {
        displayData,
        totalCount,
        facets,
        activeFilters,
        handleFilterChange,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
    } = useDataTable({
        moduleName: 'metrics',
        data: allData,
        facetFields: ['metricType', 'role', 'hasDuplicate'],
        defaultPageSize: 50,
        searchFields: ['name', 'formula', 'datasourceName', 'datasource_name'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'complexity', label: '复杂度' },
        { key: 'referenceCount', label: '引用数' },
        { key: 'name', label: '名称' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FunctionSquare className="w-5 h-5 text-indigo-600" />
                    指标库
                    <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {totalCount} 项
                    </span>
                </h1>

                {/* 排序按钮 */}
                <SortButtons
                    sortOptions={sortOptions}
                    currentSort={sortState}
                    onSortChange={handleSortChange}
                />
            </div>

            {/* 筛选器 */}
            <InlineFilter
                facets={facets}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
            />

            {/* 数据表格 */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>指标名称</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '8%' }}>复杂度</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>计算逻辑 (公式)</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '15%' }}>依赖字段</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '12%' }}>重复风险</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '15%' }}>数据源</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-400">
                                    {totalCount === 0 ? '暂无数据' : '未找到匹配的指标'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => {
                                const cx = item.complexity || 0;
                                const dups = item.similarMetrics || [];
                                const deps = item.dependencyFields || [];
                                const hasDup = dups.length > 0 || item.hasDuplicate || item.has_duplicate;
                                const dsName = item.datasourceName || item.datasource_name || '-';

                                return (
                                    <tr
                                        key={item.id}
                                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => openDrawer(item.id, 'metrics')}
                                    >
                                        {/* 指标名称 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <FunctionSquare className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                <span className="font-medium text-gray-800 truncate text-[13px]">{item.name}</span>
                                            </div>
                                        </td>

                                        {/* 复杂度 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5 justify-center">
                                                <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all ${
                                                            cx > 10 ? 'bg-red-500' :
                                                            cx > 4 ? 'bg-orange-400' :
                                                            'bg-green-500'
                                                        }`}
                                                        style={{ width: `${Math.min(cx * 10, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[10px] font-mono text-gray-600 min-w-[1.5rem] text-right">{cx}</span>
                                            </div>
                                        </td>

                                        {/* 计算逻辑 (公式) */}
                                        <td className="px-3 py-2.5">
                                            <div className="font-mono text-[11px] text-gray-500 truncate" title={item.formula || ''}>
                                                {item.formula || '-'}
                                            </div>
                                        </td>

                                        {/* 依赖字段 - 头像叠加显示 */}
                                        <td className="px-3 py-2.5">
                                            {deps.length > 0 ? (
                                                <div className="flex -space-x-1.5 items-center">
                                                    {deps.slice(0, 4).map((d, idx) => {
                                                        const isMeasure = d.role === 'measure';
                                                        return (
                                                            <div
                                                                key={d.id || idx}
                                                                className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-semibold shadow-sm ${
                                                                    isMeasure
                                                                        ? 'bg-green-100 text-green-700'
                                                                        : 'bg-blue-100 text-blue-700'
                                                                }`}
                                                                title={`${d.name} (${isMeasure ? '度量' : '维度'})`}
                                                            >
                                                                {d.name[0].toUpperCase()}
                                                            </div>
                                                        );
                                                    })}
                                                    {deps.length > 4 && (
                                                        <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[9px] text-gray-600 font-semibold shadow-sm">
                                                            +{deps.length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>

                                        {/* 重复风险 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex justify-center">
                                                {hasDup ? (
                                                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded border border-red-200 text-[10px] font-bold">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        <span>{dups.length || 1} 重复</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                        <span className="text-[10px] text-gray-400">正常</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* 数据源 */}
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs text-gray-600 truncate block" title={dsName}>
                                                {dsName}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* 分页控件 */}
                <Pagination
                    pagination={paginationState}
                    onPageChange={handlePageChange}
                />
            </div>
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
