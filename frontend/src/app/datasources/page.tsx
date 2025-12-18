'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    Loader2,
    Layers,
    CheckCircle
} from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';

interface DatasourceItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    isCertified?: boolean;
    is_certified?: boolean;
    hasExtract?: boolean;
    has_extract?: boolean;
    lastRefresh?: string;
    last_refresh?: string;
    table_count?: number;
    tableCount?: number;
    field_count?: number;
    metric_count?: number;
    workbook_count?: number;
    view_count?: number;
    [key: string]: any;
}

function DatasourcesContent() {
    const [allData, setAllData] = useState<DatasourceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        setLoading(true);
        // 使用较大页面大小以支持客户端过滤/排序
        api.getDatasources(1, 1000)
            .then(res => {
                const items = Array.isArray(res) ? res : (res.items || []);
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
        moduleName: 'datasources',
        data: allData,
        defaultPageSize: 50,
        searchFields: ['name', 'project_name', 'project', 'owner'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'table_count', label: '表数量' },
        { key: 'workbook_count', label: '引用数' },
        { key: 'last_refresh', label: '更新时间' },
        { key: 'name', label: '名称' },
    ];

    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '-';

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
                    <Layers className="w-5 h-5 text-indigo-600" />
                    数据源列表
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
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '20%' }}>数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '12%' }}>项目</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '8%' }}>所有者</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>表</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>字段</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>指标</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>工作簿</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-right" style={{ width: '5%' }}>视图</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-center" style={{ width: '6%' }}>类型</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase text-center" style={{ width: '5%' }}>认证</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '10%' }}>刷新</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase" style={{ width: '14%' }}>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={12} className="text-center py-12 text-gray-400">
                                    {totalCount === 0 ? '暂无数据' : '未找到匹配的数据源'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => {
                                const isCertified = item.isCertified ?? item.is_certified;
                                const hasExtract = item.hasExtract ?? item.has_extract;
                                const live = !hasExtract;
                                const lastRefresh = item.lastRefresh || item.last_refresh;
                                let stale = 0;
                                if (hasExtract && lastRefresh) {
                                    stale = Math.floor((new Date().getTime() - new Date(lastRefresh).getTime()) / 86400000);
                                }

                                return (
                                    <tr
                                        key={item.id}
                                        onClick={() => openDrawer(item.id, 'datasources')}
                                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                                    >
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                                <span className="font-medium text-gray-800 truncate">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5 text-[11px] text-gray-500">{item.projectName || item.project_name || item.project || '-'}</td>
                                        <td className="px-3 py-2.5 text-[11px] text-gray-500">{item.owner || '-'}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs">{item.table_count || item.tableCount || 0}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs">{item.field_count || 0}</td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs">{item.metric_count || 0}</td>
                                        <td className="px-3 py-2.5 text-right">
                                            {(item.workbook_count || 0) > 0 ? (
                                                <span className="font-mono text-xs text-green-600 font-medium">{item.workbook_count}</span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs">{item.view_count || 0}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded ${live ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                                {live ? 'Live' : 'Extract'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                            {isCertified ? (
                                                <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-[10px] text-gray-500">{formatDate(lastRefresh)}</td>
                                        <td className="px-3 py-2.5">
                                            {stale > 30 ? (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded">停更{stale}天</span>
                                            ) : stale > 7 ? (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">{stale}天前</span>
                                            ) : (
                                                <span className="text-[10px] text-green-600">● 正常</span>
                                            )}
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

export default function DatasourcesPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <DatasourcesContent />
        </Suspense>
    );
}
