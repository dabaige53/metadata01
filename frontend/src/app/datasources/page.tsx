'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import { Loader2, Layers } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import DatasourceCard from '@/components/cards/DatasourceCard';
import { useDataTable } from '@/hooks/useDataTable';
import UncertifiedDatasourcesAnalysis from '@/components/datasources/UncertifiedDatasourcesAnalysis';

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
    [key: string]: string | number | boolean | undefined;
}

function DatasourcesContent() {
    const [data, setData] = useState<DatasourceItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'analysis'>('list');
    const { openDrawer } = useDrawer();

    const fetchDatasources = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            const res = await fetch(`/api/datasources?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
        } catch (error) {
            console.error('Failed to fetch datasources:', error);
        } finally {
            setLoading(false);
        }
    };

    // 使用自定义 Hook 管理表格状态 (服务器端模式)
    const {
        displayData,
        facets,
        activeFilters,
        handleFilterChange,
        sortState,
        handleSortChange,
        paginationState,
        handlePageChange,
        handlePageSizeChange,
    } = useDataTable({
        moduleName: 'datasources',
        data: data,
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'list') {
                fetchDatasources(params);
            }
        },
    });

    // 排序选项
    const sortOptions = [
        { key: 'table_count', label: '表数量' },
        { key: 'workbook_count', label: '引用数' },
        { key: 'last_refresh', label: '更新时间' },
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
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        数据源列表
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {total.toLocaleString()} 项
                        </span>
                    </h1>

                    {/* 标签页切换 */}
                    <div className="flex p-1 bg-gray-100/80 rounded-lg">
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'list'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            数据源列表
                        </button>
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${activeTab === 'analysis'
                                ? 'bg-white text-indigo-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            治理分析
                        </button>
                    </div>
                </div>

                {activeTab === 'list' && (
                    <SortButtons
                        sortOptions={sortOptions}
                        currentSort={sortState}
                        onSortChange={handleSortChange}
                    />
                )}
            </div>

            {/* 标签页内容切换 */}
            {activeTab === 'list' && (
                <InlineFilter
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleFilterChange}
                />
            )}

            {activeTab === 'list' ? (
                <>
                    {/* 横向卡片列表 */}
                    <div className="space-y-3 min-h-[400px] relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center items-start pt-20 z-10 transition-all">
                                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            </div>
                        )}

                        {displayData.length === 0 && !loading ? (
                            <div className="py-20 text-center text-gray-400">
                                {total === 0 ? '暂无数据' : '未找到匹配的数据源'}
                            </div>
                        ) : (
                            displayData.map((item) => (
                                <DatasourceCard
                                    key={item.id}
                                    datasource={item}
                                    onClick={() => openDrawer(item.id, 'datasources', item.name)}
                                />
                            ))
                        )}
                    </div>

                    {/* 分页控件 */}
                    {total > 0 && (
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                        />
                    )}
                </>
            ) : (
                <UncertifiedDatasourcesAnalysis />
            )}
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

