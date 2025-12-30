'use client';

import React from 'react';
import DefinitionTooltip from '../ui/DefinitionTooltip';

export interface FacetConfig {
  [key: string]: {
    [value: string]: number; // value -> count
  };
}

export interface ActiveFilters {
  [key: string]: string[]; // key -> selected values
}

interface InlineFilterProps {
  facets: FacetConfig;
  activeFilters: ActiveFilters;
  onFilterChange: (key: string, value: string, checked: boolean) => void;
}

// 标签映射
const FILTER_LABELS: Record<string, string> = {
  // Facet keys
  connection_type: '连接类型',
  role: '角色',
  is_certified: '认证',
  data_type: '类型',
  schema: 'Schema',
  hasDescription: '有描述',
  hasDuplicate: '有重复',
  metricType: '指标类型',
  hasExtract: '抽取类型',
  view_type: '视图类型',
  project_name: '项目名称',
  database_name: '数据库名称',
  workbook_name: '工作簿名称',

  // Facet values
  measure: '度量',
  dimension: '维度',
  'true': '是',
  'false': '否',
  business: '业务指标',
  technical: '技术计算',
  dashboard: '仪表板',
  sheet: '工作表',
};

export default function InlineFilter({ facets, activeFilters, onFilterChange }: InlineFilterProps) {
  const facetEntries = Object.entries(facets).filter(([, values]) => Object.keys(values).length > 0);

  if (facetEntries.length === 0) {
    return null;
  }

  return (
    <div className="inline-facets bg-gray-50 rounded-lg border border-gray-200 p-3 mb-4 overflow-x-auto">
      <div className="flex items-center gap-6 min-w-max">
        {facetEntries.map(([facetKey, counts]) => (
          <div key={facetKey} className="facet-inline-group flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
              <DefinitionTooltip term={FILTER_LABELS[facetKey] || facetKey}>
                {FILTER_LABELS[facetKey] || facetKey}
              </DefinitionTooltip>:
            </span>
            {Object.entries(counts).map(([value, count]) => {
              const isActive = activeFilters[facetKey]?.includes(value) || false;

              return (
                <label
                  key={value}
                  className={`facet-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border whitespace-nowrap ${isActive
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'
                    }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isActive}
                    onChange={(e) => onFilterChange(facetKey, value, e.target.checked)}
                  />
                  <DefinitionTooltip term={FILTER_LABELS[value] || value}>
                    <span>{FILTER_LABELS[value] || value}</span>
                  </DefinitionTooltip>
                  <span className={`chip-cnt text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {count}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
