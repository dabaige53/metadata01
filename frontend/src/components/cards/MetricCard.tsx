import React from 'react';
import { FunctionSquare, AlertTriangle, Eye } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface MetricCardData {
  id: string;
  name: string;
  formula?: string;
  role?: string;
  dataType?: string;
  data_type?: string;
  complexity?: number;
  referenceCount?: number;
  reference_count?: number;
  datasourceName?: string;
  datasource_name?: string;
  owner?: string;
  metricType?: string;
  metric_type?: string;
  hasDuplicate?: boolean;
  has_duplicate?: boolean;
  dependencyFields?: any[];
  dependency_fields?: any[];
  dependencyCount?: number;
  dependency_count?: number;
  usedInViews?: any[];
  used_in_views?: any[];
  usageCount?: number;
  usage_count?: number;
}

export interface MetricCardProps {
  metric: MetricCardData;
  onClick?: () => void;
}

export default function MetricCard({ metric, onClick }: MetricCardProps) {
  const isMeasure = metric.role === 'measure';
  const complexity = metric.complexity ?? 0;
  const referenceCount = metric.referenceCount ?? metric.reference_count ?? 0;
  const dataType = metric.dataType ?? metric.data_type ?? 'unknown';
  const datasourceName = metric.datasourceName ?? metric.datasource_name; // Allow undefined/null for filtering
  const metricType = metric.metricType ?? metric.metric_type ?? 'Calculated';
  const hasDuplicate = metric.hasDuplicate ?? metric.has_duplicate ?? false;
  const dependencyFields = metric.dependencyFields ?? metric.dependency_fields ?? [];
  const usedInViews = metric.usedInViews ?? metric.used_in_views ?? [];

  // 优先使用预计算的统计值 (List API 返回的是 Count 数字，Array 为空)
  const dependencyCount = metric.dependencyCount ?? metric.dependency_count ?? dependencyFields.length;
  // const viewCount = metric.usageCount ?? metric.usage_count ?? usedInViews.length; // Not used in component currently?
  // usedInViews.length is used for Tag. Let's use usageCount for Tag logic.
  const viewCount = metric.usageCount ?? metric.usage_count ?? usedInViews.length;

  // 复杂度级别
  const complexityLevel = complexity > 10 ? '高' : complexity > 4 ? '中' : '低';
  const complexityColor = complexity > 10 ? 'red' : complexity > 4 ? 'orange' : 'green';

  // 构建徽章
  const badges = [
    {
      text: isMeasure ? '度量' : '维度',
      color: (isMeasure ? 'green' : 'blue') as const,
    },
    {
      text: metricType,
      color: 'purple' as const,
    },
    {
      text: `复杂度:${complexityLevel}`,
      color: complexityColor as const,
    },
  ];

  if (hasDuplicate) {
    badges.push({
      text: '存在重复',
      color: 'red' as const,
    });
  }

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
  ].filter(item => item.value !== undefined && item.value !== null && item.value !== '');

  if (metric.owner) {
    details.push({
      label: '所有者',
      value: metric.owner,
    });
  }

  // 构建标签
  const tags = [];

  if (viewCount > 0) {
    tags.push({
      icon: <Eye className="w-3 h-3" />,
      label: `${viewCount}个视图`,
      color: 'blue' as const,
    });
  }

  if (hasDuplicate) {
    tags.push({
      icon: <AlertTriangle className="w-3 h-3" />,
      label: '重复风险',
      color: 'red' as const,
    });
  }

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
