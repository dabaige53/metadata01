'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { User, Loader2, Search } from 'lucide-react';
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
        searchTerm,
        setSearchTerm,
        handleSearch,
        clearSearch,
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

            {/* 搜索框 */}
            <div className="flex items-center gap-2">
                <div className="relative w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="输入用户名搜索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="block w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    {searchTerm && (
                        <button
                            onClick={clearSearch}
                            className="absolute inset-y-0 right-0 pr-2 flex items-center cursor-pointer text-gray-400 hover:text-gray-600"
                            title="清空搜索"
                        >
                            <span className="text-xs">✕</span>
                        </button>
                    )}
                </div>
                <button
                    onClick={() => handleSearch()}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    搜索
                </button>
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
