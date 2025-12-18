'use client';

import React from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginationProps {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}

export default function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, total, totalPages } = pagination;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="pagination-bar flex items-center justify-between py-3 px-4 bg-white border-t border-gray-200 rounded-b-lg">
      <div className="pagination-info text-sm text-gray-600">
        共 <strong className="font-semibold text-gray-900">{total}</strong> 项，
        第 {page} / {totalPages} 页
      </div>

      <div className="pagination-btns flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="pg-btn px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="首页"
        >
          «
        </button>

        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="pg-btn px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="上一页"
        >
          ‹
        </button>

        <span className="pg-current px-3 py-1 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded">
          {page}
        </span>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="pg-btn px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="下一页"
        >
          ›
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="pg-btn px-2 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="末页"
        >
          »
        </button>
      </div>
    </div>
  );
}
