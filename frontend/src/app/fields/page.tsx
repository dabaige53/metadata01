'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Columns } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import FieldCard from '@/components/cards/FieldCard';
import { useDataTable } from '@/hooks/useDataTable';
import NoDescriptionFieldsAnalysis from '@/components/fields/NoDescriptionFieldsAnalysis';
import OrphanFieldsAnalysis from '@/components/fields/OrphanFieldsAnalysis';
import HotFieldsAnalysis from '@/components/fields/HotFieldsAnalysis';

interface FieldItem {
    id: string;
    name: string;
    dataType?: string;
    data_type?: string;
    role?: string;
    isCalculated?: boolean;
    is_calculated?: boolean;
    formula?: string;
    table?: string;
    table_name?: string;
    datasource?: string;
    datasource_name?: string;
    usageCount?: number;
    usage_count?: number;
    used_by_metrics?: Array<{ id: string; name: string }>;
    used_in_views?: Array<{ id: string; name: string; workbook_name?: string; workbookName?: string }>;
}

function FieldsContent() {
    const [data, setData] = useState<FieldItem[]>([]);
    const [total, setTotal] = useState(0);
    const [facetsData, setFacetsData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'noDescription' | 'orphan' | 'hot'>('list');
    const { openDrawer } = useDrawer();

    const fetchFields = async (params: Record<string, any>) => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams();
            Object.entries(params).forEach(([k, v]) => {
                if (v != null && v !== '') queryParams.set(k, String(v));
            });

            // 默认只获取非计算字段 (对于字段字典页面)
            const res = await fetch(`/api/fields?${queryParams.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacetsData(result.facets || null);
        } catch (error) {
            console.error('Failed to fetch fields:', error);
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
        moduleName: 'fields',
        data: data,
        facetFields: ['role', 'data_type', 'hasDescription'],
        serverSide: true,
        totalOverride: total,
        facetsOverride: facetsData,
        onParamsChange: (params) => {
            if (activeTab === 'list') {
                fetchFields(params);
            }
        },
    });

    // 排序选项
    const sortOptions = [
        { key: 'usageCount', label: '热度' },
        { key: 'name', label: '名称' },
    ];

    return (
        <div className="space-y-4">
            {/* 页面标题与标签页切换 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Columns className="w-5 h-5 text-indigo-600" />
                        字段字典
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
                            字段列表
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
                                {total === 0 ? '暂无数据' : '未找到匹配的字段'}
                            </div>
                        ) : (
                            displayData.map((item) => (
                                <FieldCard
                                    key={item.id}
                                    field={item}
                                    onClick={() => openDrawer(item.id, 'fields', item.name)}
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

