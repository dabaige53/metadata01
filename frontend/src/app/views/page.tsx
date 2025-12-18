'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { Loader2, Layout, FileSpreadsheet, LayoutDashboard } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import TableCard from '@/components/data-table/TableCard';
import { useDataTable } from '@/hooks/useDataTable';

interface ViewItem {
    id: string;
    luid?: string;
    name: string;
    viewType?: string;
    path?: string;
    workbookId?: string;
    workbookName?: string;
    updatedAt?: string;
    [key: string]: string | number | undefined;
}

function ViewsContent() {
    const [allData, setAllData] = useState<ViewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        fetch('/api/views?page=1&page_size=1000')
            .then(res => res.json())
            .then(result => {
                const items = Array.isArray(result) ? result : (result.items || []);
                setAllData(items);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // 使用 Hook 管理状态
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
        moduleName: 'views',
        data: allData,
        facetFields: ['viewType'],
        defaultPageSize: 50,
        searchFields: ['name', 'workbookName', 'path'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'name', label: '名称' },
        { key: 'workbookName', label: '工作簿' },
        { key: 'index', label: '序号' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const getViewTypeIcon = (type?: string) => {
        switch (type) {
            case 'dashboard':
                return <LayoutDashboard className="w-4 h-4 text-purple-500 flex-shrink-0" />;
            case 'sheet':
                return <FileSpreadsheet className="w-4 h-4 text-blue-500 flex-shrink-0" />;
            default:
                return <Layout className="w-4 h-4 text-gray-500 flex-shrink-0" />;
        }
    };

    const getViewTypeBadge = (type?: string) => {
        switch (type) {
            case 'dashboard':
                return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">仪表板</span>;
            case 'sheet':
                return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">工作表</span>;
            case 'story':
                return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">故事</span>;
            default:
                return <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">{type || '-'}</span>;
        }
    };

    return (
        <div className="space-y-4">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Layout className="w-5 h-5 text-indigo-600" />
                    视图库
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
            <TableCard
                visibleRows={12}
                rowHeight={48}

                pagination={
                    <Pagination

                        pagination={paginationState}
                        onPageChange={handlePageChange}
                    />
                }
            >
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-200 text-left h-12">
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>视图名称</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '10%' }}>类型</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '20%' }}>所属工作簿</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '35%' }}>路径</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-center" style={{ width: '10%' }}>序号</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr className="h-12">
                                <td colSpan={5} className="text-center text-gray-400">
                                    {totalCount === 0 ? '暂无视图数据' : '未找到匹配的视图'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => openDrawer(item.id, 'views', item.name)}
                                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors h-12"
                                >
                                    <td className="px-3">
                                        <div className="flex items-center gap-2">
                                            {getViewTypeIcon(item.viewType)}
                                            <span className="font-medium text-gray-800 text-[13px] truncate">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3">
                                        {getViewTypeBadge(item.viewType)}
                                    </td>
                                    <td className="px-3">
                                        <span className="text-gray-600 text-[13px] truncate block">{item.workbookName || '-'}</span>
                                    </td>
                                    <td className="px-3">
                                        <span className="text-gray-500 font-mono text-xs truncate max-w-[200px] block" title={item.path}>
                                            {item.path || '-'}
                                        </span>
                                    </td>
                                    <td className="px-3 text-center">
                                        <span className="text-gray-500 font-mono text-xs">{item.index ?? '-'}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </TableCard>
        </div>
    );
}

export default function ViewsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <ViewsContent />
        </Suspense>
    );
}
