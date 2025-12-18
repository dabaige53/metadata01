'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, BookOpen } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import WorkbookCard from '@/components/cards/WorkbookCard';
import { useDataTable } from '@/hooks/useDataTable';

interface WorkbookItem {
    id: string;
    name: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    viewCount?: number;
    view_count?: number;
    upstream_datasources?: string[];
    [key: string]: string | number | string[] | undefined;
}

function WorkbooksContent() {
    const [allData, setAllData] = useState<WorkbookItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        fetch('/api/workbooks?page=1&page_size=500')
            .then(res => res.json())
            .then(result => {
                const items = Array.isArray(result) ? result : (result.items || []);
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
        moduleName: 'workbooks',
        data: allData,
        facetFields: [],
        defaultPageSize: 50,
        searchFields: ['name', 'project', 'project_name', 'projectName', 'owner'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'viewCount', label: '视图数' },
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
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    工作簿
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
            {facets && Object.keys(facets).length > 0 && (
                <InlineFilter
                    facets={facets}
                    activeFilters={activeFilters}
                    onFilterChange={handleFilterChange}
                />
            )}

            {/* 横向卡片列表 */}
            <div className="space-y-3">
                {displayData.length === 0 ? (
                    <div className="py-20 text-center text-gray-400">
                        {totalCount === 0 ? '暂无数据' : '未找到匹配的工作簿'}
                    </div>
                ) : (
                    displayData.map((item) => (
                        <WorkbookCard
                            key={item.id}
                            workbook={item}
                            onClick={() => openDrawer(item.id, 'workbooks', item.name)}
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
        </div>
    );
}

export default function WorkbooksPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <WorkbooksContent />
        </Suspense>
    );
}
