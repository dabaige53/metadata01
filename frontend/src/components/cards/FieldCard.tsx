import React from 'react';
import { CircleDot, Eye, AlertCircle } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface FieldCardData {
  id: string;
  name: string;
  caption?: string;
  fullyQualifiedName?: string;
  dataType?: string;
  role?: string;
  aggregation?: string;
  tableName?: string;
  datasourceName?: string;
  usageCount?: number;
  isCalculated?: boolean;
  formula?: string;
  upstreamColumnName?: string;
  description?: string;
  usedByMetrics?: any[];
  metricUsageCount?: number;
  usedInViews?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FieldCardProps {
  field: FieldCardData;
  onClick?: () => void;
}

export default function FieldCard({ field, onClick }: FieldCardProps) {
  const isMeasure = field.role === 'measure';
  const usageCount = field.usageCount || 0;
  const metricUsageCount = field.metricUsageCount || 0;
  const isCalculated = field.isCalculated || false;
  const dataType = field.dataType || 'unknown';
  const usedByMetrics = field.usedByMetrics || [];
  const usedInViews = field.usedInViews || [];

  // 物理列名和别名
  const upstreamColumn = field.upstreamColumnName;
  const displayName = field.name;

  // 主标题：优先显示物理列名，如果没有则显示当前名称
  const mainTitle = upstreamColumn || displayName;

  // 副标题：如果有物理列名且与当前名称不同，显示别名
  const hasAlias = upstreamColumn && upstreamColumn !== displayName;

  // Use counts if arrays are empty (Server-side optimized list)
  const finalMetricUsageCount = metricUsageCount > 0 ? metricUsageCount : usedByMetrics.length;
  const finalViewUsageCount = usageCount > 0 ? usageCount : usedInViews.length;

  // 构建徽章
  const badges: Array<{ text: string; color: 'green' | 'blue' | 'gray' | 'red' | 'purple' | 'orange' | 'indigo' }> = [
    {
      text: isMeasure ? '度量' : '维度',
      color: isMeasure ? 'green' : 'blue',
    },
    {
      text: dataType,
      color: 'gray',
    },
  ];

  // 如果热度很高，添加热门徽章
  if (usageCount > 20) {
    badges.push({
      text: '热门',
      color: 'red',
    });
  }

  // 构建详情信息
  const details = [
    hasAlias && {
      label: '别名',
      value: displayName,
      highlight: true,
    },
    {
      label: '数据源',
      value: field.datasourceName,
    },
    {
      label: '热度',
      value: `${usageCount} 次`,
      highlight: usageCount > 10,
    },
  ].filter((item): item is { label: string; value: string; highlight?: boolean } =>
    Boolean(item && item.value !== undefined && item.value !== null && item.value !== ''));

  // 如果有聚合方式，添加
  if (field.aggregation) {
    details.push({
      label: '聚合',
      value: field.aggregation,
    });
  }

  // 构建标签
  const tags = [];

  if (finalMetricUsageCount > 0) {
    tags.push({
      label: `${finalMetricUsageCount}个指标依赖`,
      color: 'purple' as const,
    });
  }

  if (finalViewUsageCount > 0) {
    tags.push({
      icon: <Eye className="w-3 h-3" />,
      label: `${finalViewUsageCount}个视图引用`,
      color: 'blue' as const,
    });
  }

  // 如果是计算字段，显示
  if (isCalculated) {
    tags.push({
      label: '计算字段',
      color: 'purple' as const,
    });
  }

  if (!field.description) {
    tags.push({
      icon: <AlertCircle className="w-3 h-3" />,
      label: '缺少描述',
      color: 'yellow' as const,
    });
  }

  return (
    <HorizontalCard
      icon={<CircleDot className="w-5 h-5" />}
      title={mainTitle}
      subtitle={hasAlias ? `→ ${displayName} (${field.datasource_name || '数据源'})` : undefined}
      badges={badges}
      details={details}
      tags={tags}
      onClick={onClick}
    />
  );
}
