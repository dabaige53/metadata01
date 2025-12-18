import React from 'react';
import { CircleDot, Eye, AlertCircle } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface FieldCardData {
  id: string;
  name: string;
  caption?: string;
  fullyQualifiedName?: string;
  data_type?: string;
  dataType?: string;
  role?: string;
  aggregation?: string;
  table_name?: string;
  datasource_name?: string;
  usage_count?: number;
  usageCount?: number;
  is_calculated?: boolean;
  isCalculated?: boolean;
  formula?: string;
  upstream_column_name?: string;
  upstreamColumnName?: string;
  description?: string;
  used_by_metrics?: any[];
  used_in_views?: any[];
  usedInViews?: any[];
}

export interface FieldCardProps {
  field: FieldCardData;
  onClick?: () => void;
}

export default function FieldCard({ field, onClick }: FieldCardProps) {
  const isMeasure = field.role === 'measure';
  const usageCount = field.usage_count || field.usageCount || 0;
  const isCalculated = field.is_calculated || field.isCalculated || false;
  const dataType = field.data_type || field.dataType || 'unknown';
  const usedByMetrics = field.used_by_metrics || [];
  const usedInViews = field.used_in_views || field.usedInViews || [];
  const upstreamColumn = field.upstream_column_name || field.upstreamColumnName;

  // 构建徽章
  const badges = [
    {
      text: isMeasure ? '度量' : '维度',
      color: (isMeasure ? 'green' : 'blue') as const,
    },
    {
      text: dataType,
      color: 'gray' as const,
    },
  ];

  // 如果热度很高，添加热门徽章
  if (usageCount > 20) {
    badges.push({
      text: '热门',
      color: 'red' as const,
    });
  }

  // 构建详情信息
  const details = [
    {
      label: '表',
      value: field.table_name || '-',
    },
    {
      label: '数据源',
      value: field.datasource_name || '-',
    },
    {
      label: '热度',
      value: `${usageCount} 次`,
      highlight: usageCount > 10,
    },
  ];

  // 如果有聚合方式，添加
  if (field.aggregation) {
    details.push({
      label: '聚合',
      value: field.aggregation,
    });
  }

  // 构建标签
  const tags = [];

  if (usedByMetrics.length > 0) {
    tags.push({
      label: `${usedByMetrics.length}个指标依赖`,
      color: 'purple' as const,
    });
  }

  if (usedInViews.length > 0) {
    tags.push({
      icon: <Eye className="w-3 h-3" />,
      label: `${usedInViews.length}个视图引用`,
      color: 'blue' as const,
    });
  }

  if (upstreamColumn) {
    tags.push({
      label: `已追溯到 ${upstreamColumn}`,
      color: 'green' as const,
    });
  }

  if (!field.description) {
    tags.push({
      icon: <AlertCircle className="w-3 h-3" />,
      label: '缺少描述',
      color: 'yellow' as const,
    });
  }

  if (isCalculated) {
    tags.push({
      label: '计算字段',
      color: 'purple' as const,
    });
  }

  return (
    <HorizontalCard
      icon={<CircleDot className="w-5 h-5" />}
      title={field.name}
      badges={badges}
      details={details}
      tags={tags}
      onClick={onClick}
    />
  );
}
