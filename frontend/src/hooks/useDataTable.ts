'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FacetConfig, ActiveFilters } from '@/components/data-table/InlineFilter';
import type { SortState } from '@/components/data-table/SortButtons';
import type { PaginationState } from '@/components/data-table/Pagination';

export interface FacetFieldConfig {
  [moduleName: string]: string[]; // module -> facet keys
}

// 默认的 Facet 配置
const DEFAULT_FACET_CONFIG: FacetFieldConfig = {
  databases: ['connection_type'],
  tables: ['schema'],
  fields: ['role', 'data_type', 'hasDescription'],
  datasources: ['is_certified', 'hasExtract'],
  metrics: ['metricType', 'role', 'hasDuplicate'],
  workbooks: [],
  projects: [],
  users: [],
};

interface UseDataTableOptions<T> {
  moduleName: string;
  data: T[];
  facetFields?: string[];
  defaultPageSize?: number;
  searchFields?: (keyof T)[];
}

export function useDataTable<T extends Record<string, any>>({
  moduleName,
  data,
  facetFields,
  defaultPageSize = 50,
  searchFields = ['name', 'description', 'formula'],
}: UseDataTableOptions<T>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 从 URL 读取初始状态
  const initialSort = searchParams.get('sort') || '';
  const initialOrder = (searchParams.get('order') as 'asc' | 'desc') || 'desc';
  const initialPage = parseInt(searchParams.get('page') || '1');
  const initialSearch = searchParams.get('search') || '';

  // 状态管理
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [sortState, setSortState] = useState<SortState>({
    sortKey: initialSort,
    sortOrder: initialOrder,
  });
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // 计算 Facets
  const facets = useMemo<FacetConfig>(() => {
    const keys = facetFields || DEFAULT_FACET_CONFIG[moduleName] || [];
    const result: FacetConfig = {};

    keys.forEach((key) => {
      result[key] = {};
      data.forEach((item) => {
        // 特殊处理：metricType
        if (key === 'metricType') {
          const type = item.role === 'measure' ? 'business' : 'technical';
          result[key][type] = (result[key][type] || 0) + 1;
        } else if (item[key] != null) {
          const value = String(item[key]);
          result[key][value] = (result[key][value] || 0) + 1;
        }
      });
    });

    return result;
  }, [data, moduleName, facetFields]);

  // 应用筛选
  const filteredData = useMemo(() => {
    let result = [...data];

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }

    // Facet 过滤
    Object.entries(activeFilters).forEach(([key, values]) => {
      if (values.length > 0) {
        result = result.filter((item) => {
          if (key === 'metricType') {
            const type = item.role === 'measure' ? 'business' : 'technical';
            return values.includes(type);
          }
          return values.includes(String(item[key]));
        });
      }
    });

    return result;
  }, [data, searchTerm, activeFilters, searchFields]);

  // 应用排序
  const sortedData = useMemo(() => {
    if (!sortState.sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortState.sortKey];
      const bVal = b[sortState.sortKey];

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      return sortState.sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortState]);

  // 应用分页
  const paginationState: PaginationState = {
    page: currentPage,
    pageSize: defaultPageSize,
    total: sortedData.length,
    totalPages: Math.ceil(sortedData.length / defaultPageSize),
  };

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * defaultPageSize;
    const end = start + defaultPageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, defaultPageSize]);

  // 更新 URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (sortState.sortKey) {
      params.set('sort', sortState.sortKey);
      params.set('order', sortState.sortOrder);
    }
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (searchTerm) params.set('search', searchTerm);

    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : '';
    router.replace(newUrl, { scroll: false });
  }, [sortState, currentPage, searchTerm, router]);

  // 处理筛选变化
  const handleFilterChange = (key: string, value: string, checked: boolean) => {
    setActiveFilters((prev) => {
      const current = prev[key] || [];
      const updated = checked
        ? [...current, value]
        : current.filter((v) => v !== value);

      return {
        ...prev,
        [key]: updated,
      };
    });
    setCurrentPage(1); // 重置到第一页
  };

  // 处理排序变化
  const handleSortChange = (key: string) => {
    setSortState((prev) => {
      if (prev.sortKey === key) {
        return {
          sortKey: key,
          sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc',
        };
      }
      return {
        sortKey: key,
        sortOrder: 'desc',
      };
    });
    setCurrentPage(1); // 重置到第一页
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= paginationState.totalPages) {
      setCurrentPage(page);
    }
  };

  return {
    // 数据
    displayData: paginatedData,
    filteredData,
    totalCount: sortedData.length,

    // 筛选
    facets,
    activeFilters,
    handleFilterChange,

    // 排序
    sortState,
    handleSortChange,

    // 分页
    paginationState,
    handlePageChange,

    // 搜索
    searchTerm,
    setSearchTerm,
  };
}
