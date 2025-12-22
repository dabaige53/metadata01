'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Hash } from 'lucide-react';
import FieldCatalogCard, { FieldCatalogItem } from '../cards/FieldCatalogCard';
import InlineFilter, { FacetConfig, ActiveFilters } from '../data-table/InlineFilter';
import SortButtons, { SortState } from '../data-table/SortButtons';
import Pagination from '../data-table/Pagination';

interface FieldCatalogProps {
    onFieldClick?: (field: FieldCatalogItem) => void;
}

export default function FieldCatalog({ onFieldClick }: FieldCatalogProps) {
    const [data, setData] = useState<FieldCatalogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});

    // 筛选和分页状态
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string[]>([]);
    const [sortKey, setSortKey] = useState('total_usage');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // 获取数据
    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                page_size: String(pageSize),
                sort: sortKey,
                order: sortOrder,
            });
            if (search) params.set('search', search);
            if (roleFilter.length > 0) params.set('role', roleFilter[0]);

            const res = await fetch(`/api/fields/catalog?${params.toString()}`);
            const result = await res.json();

            setData(result.items || []);
            setTotal(result.total || 0);
            setFacets(result.facets || {});
        } catch (error) {
            console.error('Failed to fetch field catalog:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, pageSize, search, roleFilter, sortKey, sortOrder]);

    // 排序选项
    const sortOptions = [
        { key: 'total_usage', label: '热度' },
        { key: 'instance_count', label: '实例数' },
        { key: 'name', label: '名称' },
    ];

    // 处理筛选变化
    const handleFilterChange = (filterKey: string, value: string, checked: boolean) => {
        if (filterKey === 'role') {
            if (checked) {
                setRoleFilter([value]);
            } else {
                setRoleFilter([]);
            }
        }
        setPage(1);
    };

    // 处理排序变化
    const handleSortChange = (key: string) => {
        if (key === sortKey) {
            setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            setSortOrder('desc');
        }
        setPage(1);
    };

    // 构建 facets 数据 (符合 FacetConfig 格式)
    const facetData: FacetConfig = {
        role: facets.role || {},
    };

    // 当前筛选状态
    const activeFilters: ActiveFilters = {
        role: roleFilter,
    };

    // 当前排序状态
    const currentSort: SortState = {
        sortKey,
        sortOrder,
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-4">
            {/* 头部信息 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                        <Hash className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800">字段目录</h2>
                        <p className="text-sm text-gray-500">
                            按物理列聚合，共 <span className="font-medium text-indigo-600">{total.toLocaleString()}</span> 个规范字段
                        </p>
                    </div>
                </div>

                <SortButtons
                    sortOptions={sortOptions}
                    currentSort={currentSort}
                    onSortChange={handleSortChange}
                />
            </div>

            {/* 筛选器 */}
            <InlineFilter
                facets={facetData}
                activeFilters={activeFilters}
                onFilterChange={handleFilterChange}
            />

            {/* 搜索框 */}
            <div className="flex items-center gap-2">
                <input
                    type="text"
                    placeholder="搜索字段名称..."
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                    }}
                    className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
            </div>

            {/* 卡片列表 */}
            <div className="space-y-3 min-h-[400px] relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center items-start pt-20 z-10 transition-all">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                )}

                {data.length === 0 && !loading ? (
                    <div className="py-20 text-center text-gray-400">
                        {total === 0 ? '暂无数据' : '未找到匹配的字段'}
                    </div>
                ) : (
                    data.map((item, idx) => (
                        <FieldCatalogCard
                            key={`${item.canonical_name}-${item.table_id || idx}`}
                            field={item}
                            onClick={() => onFieldClick?.(item)}
                        />
                    ))
                )}
            </div>

            {/* 分页控件 */}
            {total > 0 && (
                <Pagination
                    pagination={{
                        page,
                        pageSize,
                        total,
                        totalPages,
                    }}
                    onPageChange={setPage}
                    onPageSizeChange={() => { }}
                />
            )}
        </div>
    );
}
