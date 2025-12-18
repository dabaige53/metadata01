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
    const [allData, setAllData] = useState<FieldItem[]>([]);
    const [apiTotal, setApiTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'list' | 'noDescription'>('list');
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        fetch('/api/fields?page=1&page_size=10000')  // 加载更多数据以支持客户端筛选
            .then(res => res.json())
            .then(result => {
                const items = result.items || result || [];
                // 只显示基础字段（非计算字段）
                const baseFields = items.filter((item: FieldItem) => {
                    const isCalc = item.isCalculated ?? item.is_calculated;
                    return !isCalc;
                });
                setAllData(baseFields);
                setApiTotal(baseFields.length);
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
        moduleName: 'fields',
        data: allData,
        facetFields: ['role', 'data_type', 'hasDescription'],
        defaultPageSize: 50,
        searchFields: ['name', 'formula', 'table', 'table_name', 'datasource', 'datasource_name'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'usageCount', label: '热度' },
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
                        <Columns className="w-5 h-5 text-indigo-600" />
                        字段字典
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {apiTotal.toLocaleString()} 项
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
                    <div className="space-y-3">
                        {displayData.length === 0 ? (
                            <div className="py-20 text-center text-gray-400">
                                {totalCount === 0 ? '暂无数据' : '未找到匹配的字段'}
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
                    {displayData.length > 0 && (
                        <Pagination
                            pagination={paginationState}
                            onPageChange={handlePageChange}
                        />
                    )}
                </>
            ) : (
                <NoDescriptionFieldsAnalysis />
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

