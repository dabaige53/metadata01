import React from 'react';
import { FunctionSquare, Eye } from 'lucide-react';
import HorizontalCard from './HorizontalCard';
import { formatDateWithRelative, isRecent } from '@/lib/date';

export interface MetricCardData {
  id: string;
  name: string;
  formula?: string;
  role?: string;
  dataType?: string;
  complexity?: number;
  referenceCount?: number;
  datasourceName?: string;
  owner?: string;
  metricType?: string;
  hasDuplicate?: boolean;
  dependencyFields?: any[];
  dependencyCount?: number;
  usedInViews?: any[];
  usageCount?: number;
  instanceCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MetricCardProps {
  metric: MetricCardData;
  onClick?: () => void;
}

export default function MetricCard({ metric, onClick }: MetricCardProps) {
  const isMeasure = metric.role === 'measure';
  const complexity = metric.complexity || 0;
  const referenceCount = metric.referenceCount || 0;
  const dataType = metric.dataType || 'unknown';
  const datasourceName = metric.datasourceName;
  const metricType = metric.metricType || 'Calculated';

  // 使用 instanceCount 表示相同定义的实例数量
  const instanceCount = metric.instanceCount || 1;
  const dependencyFields = metric.dependencyFields || [];
  const usedInViews = metric.usedInViews || [];
  const createdAt = metric.createdAt;
  const updatedAt = metric.updatedAt;

  // 优先使用预计算的统计值 (List API 返回的是 Count 数字，Array 为空)
  const dependencyCount = metric.dependencyCount || dependencyFields.length;
  const viewCount = metric.usageCount || usedInViews.length;

  // 复杂度级别
  const complexityLevel = complexity > 10 ? '高' : complexity > 4 ? '中' : '低';
  const complexityColor = complexity > 10 ? 'red' : complexity > 4 ? 'orange' : 'green';

  // 构建徽章
  const badges: Array<{ text: string; color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'indigo' }> = [
    {
      text: isMeasure ? '度量' : '维度',
      color: isMeasure ? 'green' : 'blue',
    },
    {
      text: metricType,
      color: 'purple',
    },
    {
      text: `复杂度:${complexityLevel}`,
      color: complexityColor as 'green' | 'orange' | 'red',
    },
  ];

  /* 移除重复标记，改为显示多工作簿使用情况 */
  /*
  if (hasDuplicate) {
    badges.push({
      text: '存在重复',
      color: 'red',
    });
  }
  */

  // 构建详情信息
  const details = [
    {
      label: '数据源',
      value: datasourceName,
    },
    {
      label: '数据类型',
      value: dataType,
    },
    {
      label: '引用次数',
      value: `${referenceCount} 次`,
      highlight: referenceCount > 10,
    },
    {
      label: '依赖字段',
      value: `${dependencyCount} 个`,
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

  if (metric.owner) {
    details.push({
      label: '所有者',
      value: metric.owner,
    });
  }

  // 构建标签
  const tags = [];

  // 显示实例数量（如果大于1，说明有多个相同定义）
  if (instanceCount > 1) {
    tags.push({
      label: `${instanceCount} 个相同定义`,
      color: 'purple' as const,
    });
  }

  if (viewCount > 0) {
    tags.push({
      icon: <Eye className="w-3 h-3" />,
      label: `${viewCount}个视图`,
      color: 'blue' as const,
    });
  }

  // 移除重复风险标签
  /*
  if (hasDuplicate) {
    tags.push({
      icon: <AlertTriangle className="w-3 h-3" />,
      label: '重复风险',
      color: 'red' as const,
    });
  }
  */

  if (dependencyFields.length > 5) {
    tags.push({
      label: '核心依赖',
      color: 'orange' as const,
    });
  }

  if (metric.formula) {
    tags.push({
      label: `公式: ${metric.formula.slice(0, 30)}${metric.formula.length > 30 ? '...' : ''}`,
      color: 'purple' as const,
    });
  }

  return (
    <HorizontalCard
      icon={<FunctionSquare className="w-5 h-5" />}
      title={metric.name}
      badges={badges}
      details={details}
      tags={tags}
      onClick={onClick}
    />
  );
}
