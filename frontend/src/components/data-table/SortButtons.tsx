'use client';

import React from 'react';

export interface SortConfig {
  key: string;
  label: string;
}

export interface SortState {
  sortKey: string;
  sortOrder: 'asc' | 'desc';
}

interface SortButtonsProps {
  sortOptions: SortConfig[];
  currentSort: SortState;
  onSortChange: (key: string) => void;
}

export default function SortButtons({ sortOptions, currentSort, onSortChange }: SortButtonsProps) {
  if (sortOptions.length === 0) {
    return null;
  }

  return (
    <div className="sort-bar flex items-center gap-2">
      {sortOptions.map(({ key, label }) => {
        const isActive = currentSort.sortKey === key;
        const arrow = isActive ? (currentSort.sortOrder === 'desc' ? ' ↓' : ' ↑') : '';

        return (
          <button
            key={key}
            onClick={() => onSortChange(key)}
            className={`sort-btn px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {label}{arrow}
          </button>
        );
      })}
    </div>
  );
}
