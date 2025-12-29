'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { FacetConfig, ActiveFilters } from '@/components/data-table/FacetFilterBar';
import type { SortState, SortConfig } from '@/components/data-table/SortButtons';
import type { PaginationState } from '@/components/data-table/Pagination';

export type { SortState, SortConfig };

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
  serverSide?: boolean;
  totalOverride?: number;
  facetsOverride?: FacetConfig;
  onParamsChange?: (params: Record<string, any>) => void;
}

export function useDataTable<T extends Record<string, any>>({
  moduleName,
  data,
  facetFields,
  defaultPageSize = 50,
  searchFields = ['name', 'description', 'formula'],
  serverSide = false,
  totalOverride,
  facetsOverride,
  onParamsChange,
}: UseDataTableOptions<T>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 使用 ref 存储回调，避免依赖变化导致 effect 重复触发
  const onParamsChangeRef = useRef(onParamsChange);
  onParamsChangeRef.current = onParamsChange;

  const filterKeys = useMemo(() => {
    return facetFields || DEFAULT_FACET_CONFIG[moduleName] || [];
  }, [facetFields, moduleName]);

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
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [searchTerm, setSearchTerm] = useState(initialSearch); // UI 输入状态
  const [appliedSearchTerm, setAppliedSearchTerm] = useState(initialSearch); // 实际搜索生效状态

  // 手动触发搜索（支持可选的新搜索词参数，用于清空场景）
  const handleSearch = useCallback((newSearchTerm?: string) => {
    const termToApply = newSearchTerm !== undefined ? newSearchTerm : searchTerm;
    setSearchTerm(termToApply);
    setAppliedSearchTerm(termToApply);
    setCurrentPage(1); // 搜索时重置页码
  }, [searchTerm]);

  // 清空搜索（清空输入框并立即刷新）
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setAppliedSearchTerm('');
    setCurrentPage(1);
  }, []);

  // 监听初始 URL 参数变化同步到 appliedSearchTerm
  useEffect(() => {
    setAppliedSearchTerm(initialSearch);
    setSearchTerm(initialSearch);
  }, [initialSearch]);

  const areFiltersEqual = useCallback((left: ActiveFilters, right: ActiveFilters) => {
    const leftKeys = Object.keys(left).filter((key) => left[key]?.length);
    const rightKeys = Object.keys(right).filter((key) => right[key]?.length);
    if (leftKeys.length !== rightKeys.length) return false;

    for (const key of leftKeys) {
      const leftValues = left[key] || [];
      const rightValues = right[key] || [];
      if (leftValues.length !== rightValues.length) return false;
      for (let i = 0; i < leftValues.length; i += 1) {
        if (leftValues[i] !== rightValues[i]) return false;
      }
    }
    return true;
  }, []);

  useEffect(() => {
    const parsedFilters: ActiveFilters = {};
    filterKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value) {
        parsedFilters[key] = value.split(',').filter(Boolean);
      }
    });

    setActiveFilters((prev) => {
      if (areFiltersEqual(prev, parsedFilters)) {
        return prev;
      }
      return parsedFilters;
    });
  }, [filterKeys, searchParams, areFiltersEqual]);

  // 计算 Facets
  const facets = useMemo<FacetConfig>(() => {
    if (serverSide && facetsOverride) return facetsOverride;

    const result: FacetConfig = {};

    filterKeys.forEach((key) => {
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
  }, [data, filterKeys, serverSide, facetsOverride]);

  // 应用筛选
  const filteredData = useMemo(() => {
    // 服务器端模式下，筛选和搜索已由后端处理，直接返回
    if (serverSide) {
      return data;
    }

    let result = [...data];

    // 搜索过滤 (使用回车确认后的值 appliedSearchTerm)
    if (appliedSearchTerm) {
      const term = appliedSearchTerm.toLowerCase();
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
  }, [data, appliedSearchTerm, activeFilters, searchFields, serverSide]);

  // 应用排序
  const sortedData = useMemo(() => {
    // 服务器端模式下，排序已由后端处理，直接返回
    if (serverSide) {
      return filteredData;
    }

    if (!sortState.sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortState.sortKey];
      const bVal = b[sortState.sortKey];

      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;

      return sortState.sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortState, serverSide]);

  // 应用分页
  const paginationState: PaginationState = {
    page: currentPage,
    pageSize: pageSize,
    total: serverSide ? (totalOverride ?? 0) : sortedData.length,
    totalPages: Math.ceil((serverSide ? (totalOverride ?? 0) : sortedData.length) / pageSize),
  };

  const paginatedData = useMemo(() => {
    if (serverSide) return data; // 服务器端模式下，data 已经是分页后的
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [serverSide, data, sortedData, currentPage, pageSize]);

  // 初始化请求 (仅服务器端模式)
  useEffect(() => {
    if (serverSide && onParamsChangeRef.current) {
      // 构建初始参数
      const params: Record<string, any> = {};
      if (pageSize !== 50) params.page_size = pageSize.toString();
      params.page = '1';

      // 触发初始请求
      onParamsChangeRef.current(params);
    }
  }, []); // 空依赖数组,仅在组件挂载时执行一次

  // 更新 URL 和通知父组件
  useEffect(() => {
    const params: Record<string, any> = {};
    if (sortState.sortKey) {
      params.sort = sortState.sortKey;
      params.order = sortState.sortOrder;
    }
    if (currentPage > 1) params.page = currentPage.toString();
    if (appliedSearchTerm) params.search = appliedSearchTerm; // 使用确认后的值
    if (pageSize !== 50) params.page_size = pageSize.toString();

    // 同时包含 activeFilters
    Object.entries(activeFilters).forEach(([k, v]) => {
      if (v && v.length > 0) params[k] = v.join(',');
    });

    const urlParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => urlParams.set(k, v as string));

    const queryString = urlParams.toString();
    const newUrl = queryString ? `?${queryString}` : '';
    router.replace(newUrl, { scroll: false });

    // 如果是服务器端模式，通知父组件参数变化以触发 API 请求
    if (serverSide && onParamsChangeRef.current) {
      onParamsChangeRef.current(params);
    }
  }, [sortState, currentPage, appliedSearchTerm, activeFilters, pageSize, router, serverSide]);

  // 处理筛选变化（单项）
  const handleFilterChange = useCallback((key: string, value: string, checked: boolean) => {
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
  }, []);

  // 处理筛选变化（批量更新，用于下拉面板确认）
  const handleBatchFilterChange = useCallback((key: string, values: string[]) => {
    setActiveFilters((prev) => ({
      ...prev,
      [key]: values,
    }));
    setCurrentPage(1);
  }, []);

  // 清空所有筛选
  const handleClearAllFilters = useCallback(() => {
    setActiveFilters({});
    setSearchTerm('');
    // setAppliedSearchTerm(''); // 由防抖 Effect 处理
    setCurrentPage(1);
  }, []);

  // 处理排序变化
  const handleSortChange = useCallback((key: string) => {
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
  }, []);

  // 处理页码变化
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && (serverSide || page <= Math.ceil(sortedData.length / pageSize))) {
      setCurrentPage(page);
    }
  }, [serverSide, sortedData.length, pageSize]);

  // 处理页大小变化
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // 切换每页条数重置到第一页
  }, []);

  return {
    // 数据
    displayData: paginatedData,
    filteredData,
    totalCount: sortedData.length,

    // 筛选
    facets,
    activeFilters,
    handleFilterChange,
    handleBatchFilterChange,
    handleClearAllFilters,

    // 排序
    sortState,
    handleSortChange,

    // 分页
    paginationState,
    handlePageChange,
    handlePageSizeChange,

    // 搜索
    searchTerm,
    setSearchTerm,
    handleSearch, // 暴露手动触发搜索的方法
    clearSearch,  // 清空搜索并刷新
    setPageSize,
  };
}
