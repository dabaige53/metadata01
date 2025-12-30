import React from 'react';
import { BookOpen, AlertTriangle, Eye } from 'lucide-react';
import HorizontalCard from './HorizontalCard';
import { formatDateWithRelative, isRecent } from '@/lib/date';

export interface WorkbookCardData {
  id: string;
  name: string;
  project_name?: string;
  projectName?: string;
  owner?: string;
  view_count?: number;
  viewCount?: number;
  datasource_count?: number;
  datasourceCount?: number;
  upstream_datasources?: any[];
  upstreamDatasources?: any[];
  contains_unsupported_custom_sql?: boolean;
  containsUnsupportedCustomSql?: boolean;
  has_active_warning?: boolean;
  hasActiveWarning?: boolean;
  description?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  field_count?: number;
  fieldCount?: number;
  metric_count?: number;
  metricCount?: number;
}

export interface WorkbookCardProps {
  workbook: WorkbookCardData;
  onClick?: () => void;
  onMouseEnter?: () => void;
}

export default function WorkbookCard({ workbook, onClick, onMouseEnter }: WorkbookCardProps) {
  const projectName = workbook.project_name ?? workbook.projectName; // Allow undefined

  const viewCount = workbook.view_count ?? workbook.viewCount ?? 0;
  const datasourceCount = workbook.datasource_count ?? workbook.datasourceCount ?? 0;
  const upstreamDatasources = workbook.upstream_datasources ?? workbook.upstreamDatasources ?? [];
  const hasUnsupportedSql = workbook.contains_unsupported_custom_sql ?? workbook.containsUnsupportedCustomSql ?? false;
  const hasWarning = workbook.has_active_warning ?? workbook.hasActiveWarning ?? false;
  const createdAt = workbook.created_at ?? workbook.createdAt;
  const updatedAt = workbook.updated_at ?? workbook.updatedAt;

  // 工作簿状态
  const status = viewCount === 0 ? '空工作簿' : viewCount > 10 ? '大型工作簿' : '有视图';
  const statusColor = viewCount === 0 ? 'gray' : viewCount > 10 ? 'purple' : 'green';

  // 构建徽章
  const badges: Array<{ text: string; color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'indigo' }> = [
    {
      text: status,
      color: statusColor as 'gray' | 'purple' | 'green',
    },
    {
      text: `${viewCount}个视图`,
      color: 'blue',
    },
  ];

  // 构建详情信息
  const details = [
    {
      label: '项目',
      value: projectName,
    },
    {
      label: '所有者',
      value: workbook.owner,
    },
    {
      label: '视图数',
      value: `${viewCount} 个`,
      highlight: viewCount > 10,
    },
    {
      label: '数据源数',
      value: `${datasourceCount} 个`,
    },
    {
      label: '使用字段',
      value: `${workbook.field_count ?? workbook.fieldCount ?? 0}`,
    },
    {
      label: '使用指标',
      value: `${workbook.metric_count ?? workbook.metricCount ?? 0}`,
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

  // 添加上游数据源信息
  if (upstreamDatasources.length > 0) {
    const dsNames = upstreamDatasources
      .slice(0, 3)
      .map((ds: any) => (typeof ds === 'string' ? ds : ds.name))
      .join(', ');

    details.push({
      label: '上游数据源',
      value: dsNames + (upstreamDatasources.length > 3 ? `... +${upstreamDatasources.length - 3}` : ''),
    });
  }

  // Explicitly add Usage Metrics (Field & Metric counts)
  if (workbook.fieldCount !== undefined && workbook.fieldCount > 0) {
    details.push({
      label: '使用字段',
      value: `${workbook.fieldCount} 个`
    });
  }

  if (workbook.metricCount !== undefined && workbook.metricCount > 0) {
    details.push({
      label: '使用指标',
      value: `${workbook.metricCount} 个`
    });
  }

  // 构建标签
  const tags = [];

  if (hasWarning) {
    tags.push({
      icon: <AlertTriangle className="w-3 h-3" />,
      label: '有警告',
      color: 'orange' as const,
    });
  }

  if (hasUnsupportedSql) {
    tags.push({
      label: '包含自定义SQL',
      color: 'purple' as const,
    });
  }

  if (datasourceCount > 3) {
    tags.push({
      label: '多数据源',
      color: 'blue' as const,
    });
  }

  if (viewCount > 0) {
    tags.push({
      icon: <Eye className="w-3 h-3" />,
      label: `${viewCount}个视图`,
      color: 'green' as const,
    });
  }

  if (workbook.description) {
    tags.push({
      label: workbook.description.slice(0, 40) + (workbook.description.length > 40 ? '...' : ''),
      color: 'gray' as const,
    });
  }

  return (
    <HorizontalCard
      icon={<BookOpen className="w-5 h-5" />}
      title={workbook.name}
      badges={badges}
      details={details}
      tags={tags}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    />
  );
}
