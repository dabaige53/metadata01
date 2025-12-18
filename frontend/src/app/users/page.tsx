'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { User, Loader2 } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import TableCard from '@/components/data-table/TableCard';
import { useDataTable } from '@/hooks/useDataTable';

interface UserItem {
    id: string;
    name: string;
    display_name?: string;
    site_role?: string;
    updated_at?: string;
    [key: string]: string | number | undefined;
}

function UsersContent() {
    const [allData, setAllData] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        fetch('/api/users?page=1&page_size=500')
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
        moduleName: 'users',
        data: allData,
        facetFields: ['site_role'],
        defaultPageSize: 50,
        searchFields: ['name', 'display_name'],
    });

    // 排序选项
    const sortOptions = [
        { key: 'name', label: '名称' },
        { key: 'total_assets', label: '资产数' },
    ];

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const getRoleBadgeClass = (role?: string) => {
        switch (role) {
            case 'Creator':
            case 'SiteAdministratorCreator':
                return 'bg-purple-100 text-purple-700';
            case 'Explorer':
            case 'SiteAdministratorExplorer':
                return 'bg-blue-100 text-blue-700';
            case 'Viewer':
                return 'bg-gray-100 text-gray-600';
            default:
                return 'bg-gray-100 text-gray-600';
        }
    };

    return (
        <div className="space-y-4">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <User className="w-5 h-5 text-indigo-600" />
                    用户
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
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>用户名</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>显示名称</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '20%' }}>角色</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-right" style={{ width: '10%' }}>数据源</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-right" style={{ width: '10%' }}>工作簿</th>
                            <th className="px-3 font-medium text-gray-500 text-xs uppercase tracking-wider text-right" style={{ width: '10%' }}>资产总数</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr className="h-12">
                                <td colSpan={5} className="text-center text-gray-400">
                                    {totalCount === 0 ? '暂无用户数据' : '未找到匹配的用户'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => openDrawer(item.id, 'users', item.name)}
                                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors h-12"
                                >
                                    <td className="px-3">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                            <span className="font-medium text-gray-800 text-[13px]">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3">
                                        <span className="text-gray-600 text-[13px]">{item.display_name || '-'}</span>
                                    </td>
                                    <td className="px-3">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${getRoleBadgeClass(item.site_role)}`}>
                                            {item.site_role || 'User'}
                                        </span>
                                    </td>
                                    <td className="px-3 text-right">
                                        <span className="text-gray-600 font-mono text-xs">{item.datasource_count || 0}</span>
                                    </td>
                                    <td className="px-3 text-right">
                                        <span className="text-gray-600 font-mono text-xs">{item.workbook_count || 0}</span>
                                    </td>
                                    <td className="px-3 text-right">
                                        <span className="font-medium text-gray-900 font-mono text-xs">{item.total_assets || 0}</span>
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

export default function UsersPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <UsersContent />
        </Suspense>
    );
}
