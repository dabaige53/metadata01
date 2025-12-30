'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export default function Pagination({ pagination, onPageChange, onPageSizeChange }: PaginationProps) {
  const { page, total, totalPages, pageSize } = pagination;

  if (total === 0) return null;

  // 生成页码序列
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      const end = Math.min(totalPages, start + maxVisible - 1);

      if (end === totalPages) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-white border-t border-gray-100 rounded-b-xl shadow-sm">
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div>
          共 <span className="font-semibold text-gray-900">{total.toLocaleString()}</span> 项
        </div>
        <div className="h-4 w-[1px] bg-gray-200" />
        <div className="flex items-center gap-2">
          <span>每页</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-1 px-2 outline-none cursor-pointer hover:bg-white transition-colors"
          >
            {[20, 50, 100, 200].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>项</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none text-gray-600 transition-all"
            title="首页"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none text-gray-600 transition-all"
            title="上一页"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {pageNumbers[0] > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="w-8 h-8 flex items-center justify-center text-sm rounded-lg hover:bg-gray-50 text-gray-600 transition-all"
              >
                1
              </button>
              {pageNumbers[0] > 2 && <span className="text-gray-400 px-1">...</span>}
            </>
          )}

          {pageNumbers.map((num) => (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`w-8 h-8 flex items-center justify-center text-sm font-medium rounded-lg transition-all ${page === num
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                  : 'hover:bg-gray-100 text-gray-600'
                }`}
            >
              {num}
            </button>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && <span className="text-gray-400 px-1">...</span>}
              <button
                onClick={() => onPageChange(totalPages)}
                className="w-8 h-8 flex items-center justify-center text-sm rounded-lg hover:bg-gray-50 text-gray-600 transition-all"
              >
                {totalPages}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center bg-gray-50 p-1 rounded-lg border border-gray-100">
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none text-gray-600 transition-all"
            title="下一页"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-md hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none text-gray-600 transition-all"
            title="末页"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
