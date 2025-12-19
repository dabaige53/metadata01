import React from 'react';
import { Table2, CheckCircle } from 'lucide-react';
import HorizontalCard from './HorizontalCard';
import { formatDateWithRelative, isRecent } from '@/lib/date';

export interface TableCardData {
  id: string;
  name: string;
  schema?: string;
  database_name?: string;
  databaseName?: string;
  column_count?: number;
  columnCount?: number;
  field_count?: number;
  fieldCount?: number;
  datasource_count?: number;
  datasourceCount?: number;
  workbook_count?: number;
  workbookCount?: number;
  preview_fields?: any[] | { measures?: string[], dimensions?: string[] };
  previewFields?: any[] | { measures?: string[], dimensions?: string[] };
  description?: string;
  is_certified?: boolean;
  isCertified?: boolean;
  isEmbedded?: boolean;
  is_embedded?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface TableCardProps {
  table: TableCardData;
  onClick?: () => void;
}

export default function TableCard({ table, onClick }: TableCardProps) {
  const columnCount = table.column_count ?? table.columnCount ?? 0;
  const fieldCount = table.field_count ?? table.fieldCount ?? 0;
  const datasourceCount = table.datasource_count ?? table.datasourceCount ?? 0;
  const workbookCount = table.workbook_count ?? table.workbookCount ?? 0;
  const previewFields = table.preview_fields ?? table.previewFields ?? [];
  const databaseName = table.database_name ?? table.databaseName; // Allow undefined/null for filtering
  const isCertified = table.is_certified ?? table.isCertified ?? false;
  const isEmbedded = table.isEmbedded ?? table.is_embedded ?? false;
  const createdAt = table.created_at ?? table.createdAt;
  const updatedAt = table.updated_at ?? table.updatedAt;

  // 智能状态判断
  let statusText = '使用中';
  let statusColor: 'green' | 'orange' | 'red' = 'green';
  if (workbookCount === 0 && datasourceCount > 0) {
    statusText = '仅关联';
    statusColor = 'orange';
  } else if (workbookCount === 0 && datasourceCount === 0) {
    statusText = '孤立';
    statusColor = 'red';
  }

  // 构建徽章
  const badges: Array<{ text: string; color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'indigo' }> = [
    {
      text: statusText,
      color: statusColor,
    },
    {
      text: table.schema || 'public',
      color: 'gray',
    },
  ];

  if (isCertified) {
    badges.push({
      text: '已认证',
      color: 'blue',
    });
  }

  if (isEmbedded) {
    badges.push({
      text: '嵌入式',
      color: 'orange',
    });
  }

  // 构建详情信息
  const details = [
    {
      label: '数据库',
      value: databaseName,
    },
    {
      label: '原始列',
      value: `${columnCount} 列`,
    },
    {
      label: 'Tableau字段',
      value: `${fieldCount} 个`,
    },
    {
      label: '数据源',
      value: `${datasourceCount} 个`,
      highlight: datasourceCount > 0,
    },
    {
      label: '工作簿',
      value: `${workbookCount} 个`,
      highlight: workbookCount > 0,
    },
    createdAt && {
      label: '创建',
      value: formatDateWithRelative(createdAt),
    },
    updatedAt && {
      label: '更新',
      value: formatDateWithRelative(updatedAt),
      highlight: isRecent(updatedAt),
    },
  ].filter((item): item is { label: string; value: string; highlight?: boolean } =>
    Boolean(item && item.value !== undefined && item.value !== null && item.value !== ''));

  // 构建标签
  const tags = [];

  if (datasourceCount === 0 && workbookCount === 0) {
    tags.push({
      label: '孤立表',
      color: 'gray' as const,
    });
  }

  if (fieldCount > columnCount) {
    tags.push({
      label: '包含计算字段',
      color: 'purple' as const,
    });
  }

  // 添加预览字段标签
  // 添加预览字段标签 (兼容数组模式和对象摘要模式)
  // API 返回的是 { measures: ['度量 (N个)'], dimensions: ['维度 (M个)'] }
  // 或者旧版返回的是 [{ role: 'measure' }, ...]
  if (Array.isArray(previewFields) && previewFields.length > 0) {
    const measureCount = previewFields.filter((f: any) => f && f.role === 'measure').length;
    const dimensionCount = previewFields.length - measureCount;

    if (measureCount > 0) {
      tags.push({
        label: `${measureCount}个度量`,
        color: 'green' as const,
      });
    }

    if (dimensionCount > 0) {
      tags.push({
        label: `${dimensionCount}个维度`,
        color: 'blue' as const,
      });
    }
  } else if (previewFields && !Array.isArray(previewFields)) {
    // 对象模式
    if (previewFields.measures && previewFields.measures.length > 0) {
      tags.push({
        label: previewFields.measures[0], // "度量字段 (X个)"
        color: 'green' as const,
      });
    }
    if (previewFields.dimensions && previewFields.dimensions.length > 0) {
      tags.push({
        label: previewFields.dimensions[0], // "维度字段 (X个)"
        color: 'blue' as const,
      });
    }
  }

  if (table.description) {
    tags.push({
      label: table.description.slice(0, 40) + (table.description.length > 40 ? '...' : ''),
      color: 'gray' as const,
    });
  }

  return (
    <HorizontalCard
      icon={<Table2 className="w-5 h-5" />}
      title={table.name}
      badges={badges}
      details={details}
      tags={tags}
      onClick={onClick}
    />
  );
}
