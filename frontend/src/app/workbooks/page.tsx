'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, BookOpen } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
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
    [key: string]: any;
}

function WorkbooksContent() {
    const [allData, setAllData] = useState<WorkbookItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        setLoading(true);
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

            {/* 数据表格 */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-left">
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>工作簿</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '15%' }}>项目</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '12%' }}>所有者</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '8%' }}>视图数</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>上游数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '15%' }}>状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-12 text-gray-400">
                                    {totalCount === 0 ? '暂无数据' : '未找到匹配的工作簿'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => {
                                const viewCount = item.viewCount ?? item.view_count ?? 0;
                                const projectName = item.projectName || item.project_name || item.project || '-';
                                const upDs = item.upstream_datasources || [];

                                return (
                                    <tr
                                        key={item.id}
                                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                                        onClick={() => openDrawer(item.id, 'workbooks')}
                                    >
                                        {/* 工作簿名称 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                <span className="font-medium text-gray-800 truncate text-[13px]">{item.name}</span>
                                            </div>
                                        </td>

                                        {/* 项目 */}
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs text-gray-600">{projectName}</span>
                                        </td>

                                        {/* 所有者 */}
                                        <td className="px-3 py-2.5">
                                            <span className="text-xs text-gray-600">{item.owner || '-'}</span>
                                        </td>

                                        {/* 视图数 */}
                                        <td className="px-3 py-2.5 text-center">
                                            <span className="font-mono text-xs text-gray-600">{viewCount}</span>
                                        </td>

                                        {/* 上游数据源 */}
                                        <td className="px-3 py-2.5">
                                            {upDs.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {upDs.slice(0, 3).map((ds, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200"
                                                        >
                                                            {ds}
                                                        </span>
                                                    ))}
                                                    {upDs.length > 3 && (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                                            +{upDs.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs">-</span>
                                            )}
                                        </td>

                                        {/* 状态 */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                    viewCount > 0 ? 'bg-green-500' : 'bg-orange-400'
                                                }`}></span>
                                                <span className={`text-[10px] ${
                                                    viewCount > 0 ? 'text-green-700' : 'text-orange-700'
                                                }`}>
                                                    {viewCount > 0 ? '有视图' : '空工作簿'}
                                                </span>
                                            </div>
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
