'use client';

import { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import { FolderOpen, Loader2 } from 'lucide-react';
import InlineFilter from '@/components/data-table/InlineFilter';
import SortButtons from '@/components/data-table/SortButtons';
import Pagination from '@/components/data-table/Pagination';
import { useDataTable } from '@/hooks/useDataTable';

interface Project {
    id: string;
    name: string;
    description?: string;
    datasource_count?: number;
    workbook_count?: number;
    total_assets?: number;
    [key: string]: any;
}

function ProjectsContent() {
    const [allData, setAllData] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const { openDrawer } = useDrawer();

    // 加载数据
    useEffect(() => {
        setLoading(true);
        fetch('/api/projects?page=1&page_size=500')
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
        moduleName: 'projects',
        data: allData,
        facetFields: [], // 项目暂无分类字段
        defaultPageSize: 50,
        searchFields: ['name', 'description'],
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

    return (
        <div className="space-y-4">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-indigo-600" />
                    项目
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
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '25%' }}>项目名称</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider" style={{ width: '35%' }}>简介</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-right" style={{ width: '10%' }}>数据源</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-right" style={{ width: '10%' }}>工作簿</th>
                            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wider text-right" style={{ width: '10%' }}>资产总数</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-400">
                                    {totalCount === 0 ? '暂无项目数据' : '未找到匹配的项目'}
                                </td>
                            </tr>
                        ) : (
                            displayData.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => openDrawer(item.id, 'projects')}
                                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <FolderOpen className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                            <span className="font-medium text-gray-800 truncate text-[13px]">{item.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="text-gray-500 truncate max-w-[300px] block text-[13px]" title={item.description}>
                                            {item.description || '-'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-gray-600 font-mono text-xs">{item.datasource_count || 0}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="text-gray-600 font-mono text-xs">{item.workbook_count || 0}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="font-medium text-gray-900 font-mono text-xs">{item.total_assets || 0}</span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* 分页 */}
                <Pagination
                    pagination={paginationState}
                    onPageChange={handlePageChange}
                />
            </div>
        </div>
    );
}

export default function ProjectsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        }>
            <ProjectsContent />
        </Suspense>
    );
}
