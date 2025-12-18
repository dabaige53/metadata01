import React from 'react';
import { Database, CheckCircle, AlertTriangle } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface DatasourceCardData {
  id: string;
  name: string;
  project_name?: string;
  projectName?: string;
  owner?: string;
  table_count?: number;
  tableCount?: number;
  field_count?: number;
  fieldCount?: number;
  metric_count?: number;
  metricCount?: number;
  workbook_count?: number;
  workbookCount?: number;
  view_count?: number;
  viewCount?: number;
  has_extract?: boolean;
  hasExtract?: boolean;
  is_certified?: boolean;
  isCertified?: boolean;
  last_refresh?: string;
  lastRefresh?: string;
  contains_unsupported_custom_sql?: boolean;
  containsUnsupportedCustomSql?: boolean;
  has_active_warning?: boolean;
  hasActiveWarning?: boolean;
}

export interface DatasourceCardProps {
  datasource: DatasourceCardData;
  onClick?: () => void;
}

// 计算停更状态
function getRefreshStatus(dateString?: string): { text: string; color: 'green' | 'orange' | 'red' } {
  if (!dateString) return { text: '未刷新', color: 'red' };

  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 30) return { text: `停更${diffDays}天`, color: 'red' };
  if (diffDays > 7) return { text: `${diffDays}天前`, color: 'orange' };
  return { text: '正常', color: 'green' };
}

// 格式化刷新时间
function formatRefreshTime(dateString?: string): string {
  if (!dateString) return '未刷新';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}

export default function DatasourceCard({ datasource, onClick }: DatasourceCardProps) {
  const projectName = datasource.project_name || datasource.projectName || '-';
  const tableCount = datasource.table_count || datasource.tableCount || 0;
  const fieldCount = datasource.field_count || datasource.fieldCount || 0;
  const metricCount = datasource.metric_count || datasource.metricCount || 0;
  const workbookCount = datasource.workbook_count || datasource.workbookCount || 0;
  const viewCount = datasource.view_count || datasource.viewCount || 0;
  const hasExtract = datasource.has_extract || datasource.hasExtract || false;
  const isCertified = datasource.is_certified || datasource.isCertified || false;
  const lastRefresh = datasource.last_refresh || datasource.lastRefresh;
  const hasUnsupportedSql = datasource.contains_unsupported_custom_sql || datasource.containsUnsupportedCustomSql || false;
  const hasWarning = datasource.has_active_warning || datasource.hasActiveWarning || false;

  const refreshStatus = getRefreshStatus(lastRefresh);

  // 构建徽章
  const badges = [
    {
      text: hasExtract ? 'Extract' : 'Live',
      color: (hasExtract ? 'orange' : 'blue') as const,
    },
    {
      text: refreshStatus.text,
      color: refreshStatus.color,
    },
  ];

  if (isCertified) {
    badges.push({
      text: '已认证',
      color: 'blue' as const,
    });
  }

  // 构建详情信息
  const details = [
    {
      label: '项目',
      value: projectName,
    },
    {
      label: '所有者',
      value: datasource.owner || '-',
    },
    {
      label: '表',
      value: `${tableCount} 个`,
    },
    {
      label: '字段',
      value: `${fieldCount} 个`,
    },
    {
      label: '指标',
      value: `${metricCount} 个`,
      highlight: metricCount > 0,
    },
    {
      label: '工作簿',
      value: `${workbookCount} 个`,
      highlight: workbookCount > 0,
    },
    {
      label: '视图',
      value: `${viewCount} 个`,
    },
    {
      label: '刷新',
      value: formatRefreshTime(lastRefresh),
    },
  ];

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

  if (refreshStatus.color === 'red') {
    tags.push({
      label: '停更',
      color: 'red' as const,
    });
  }

  if (workbookCount > 5) {
    tags.push({
      label: '高引用',
      color: 'green' as const,
    });
  }

  if (isCertified) {
    tags.push({
      icon: <CheckCircle className="w-3 h-3" />,
      label: '已认证数据源',
      color: 'blue' as const,
    });
  }

  return (
    <HorizontalCard
      icon={<Database className="w-5 h-5" />}
      title={datasource.name}
      badges={badges}
      details={details}
      tags={tags}
      onClick={onClick}
    />
  );
}
