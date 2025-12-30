'use client';

import { FunctionSquare, Code, GitMerge, Hash, Database } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface MetricCatalogItem {
    name: string;
    formula?: string;
    formula_hash?: string;
    dedup_key?: string;
    dedup_method?: 'hash_embedded' | 'hash_published' | 'hash_mixed';  // 新增
    is_aggregated?: boolean;
    role?: string;
    data_type?: string;
    description?: string;
    representative_id?: string;
    instance_count: number;
    name_count?: number;
    complexity: number;
    complexity_level: string;
    total_references: number;
    total_usage?: number;
    datasources: Array<{ id: string; name: string; is_embedded?: boolean }>;
    datasource_count: number;
    workbooks: Array<{ id: string; name: string }>;
    workbook_count: number;
    tables?: Array<{ id: string; name: string }>;
    table_count?: number;
    formula_length?: number;
    names?: string[];
    name_variants?: Array<{
        name: string;
        representative_id: string;
        instance_count: number;
        total_references: number;
        total_usage: number;
        complexity: number;
        datasources?: Array<{ id: string; name: string; is_embedded?: boolean }>;
        datasource_count?: number;
        workbooks?: Array<{ id: string; name: string }>;
        workbook_count?: number;
        tables?: Array<{ id: string; name: string }>;
        table_count?: number;
    }>;
}

export interface MetricCatalogCardProps {
    metric: MetricCatalogItem;
    onClick?: () => void;
}

export default function MetricCatalogCard({ metric, onClick }: MetricCatalogCardProps) {

    const isMeasure = metric.role?.toLowerCase() === 'measure';
    const isGroupSet = metric.role?.toLowerCase() === 'group_set' || !metric.role || metric.role === '';
    const roleName = isMeasure ? '度量' : (metric.role?.toLowerCase() === 'dimension' ? '维度' : (isGroupSet ? '组/集' : metric.role || '未知'));

    // 构建徽章
    const badges: Array<{ text: string; color: 'green' | 'blue' | 'gray' | 'red' | 'purple' | 'orange' }> = [
        {
            text: roleName,
            color: isMeasure ? 'green' : 'blue',
        },
    ];

    // 复杂度徽章
    const complexityColor =
        metric.complexity_level === '超高' ? 'red' :
            metric.complexity_level === '高' ? 'orange' :
                metric.complexity_level === '中' ? 'purple' : 'blue';

    badges.push({
        text: `${metric.complexity_level}复杂度`,
        color: complexityColor,
    });

    // 构建详情信息
    const usageCount = metric.total_usage || 0;
    const details = [
        {
            label: '视图引用',
            value: `${usageCount} 次`,
            highlight: usageCount > 0,
        },
        {
            label: '公式长度',
            value: `${metric.formula?.length || 0} 字符`,
        },
        {
            label: '跨数据源',
            value: `${metric.datasource_count} 个`,
        },
        {
            label: '跨工作簿',
            value: `${metric.workbook_count} 个`,
        },
    ];

    // 构建标签
    const tags: Array<{ icon?: React.ReactNode; label: string; color: 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'red' | 'orange' }> = [];

    // 去重方式标签 (根据数据源类型区分)
    const dedupMethodLabels: Record<string, { label: string; color: 'blue' | 'orange' | 'purple' }> = {
        'hash_embedded': { label: '按公式哈希+嵌入式', color: 'orange' },
        'hash_published': { label: '按公式哈希+数据源', color: 'blue' },
        'hash_mixed': { label: '按公式哈希+混合', color: 'purple' },
    };
    const dedupInfo = dedupMethodLabels[metric.dedup_method || 'hash_published'] || dedupMethodLabels['hash_published'];
    tags.push({
        icon: <Hash className="w-3 h-3" />,
        label: dedupInfo.label,
        color: dedupInfo.color,
    });

    // 聚合数量标签 (仅当有多个实例时显示)
    if (metric.instance_count > 1) {
        tags.push({
            icon: <GitMerge className="w-3 h-3" />,
            label: `${metric.instance_count} 实例 → 1 标准`,
            color: 'purple',
        });
    }

    if (metric.name_count && metric.name_count > 1) {
        tags.push({
            icon: <Hash className="w-3 h-3" />,
            label: `${metric.name_count} 个名称`,
            color: 'orange',
        });
    }

    // 数据源分布标签 (显示主要数据源名称)
    if (metric.datasources && metric.datasources.length > 0) {
        const dsNames = metric.datasources.slice(0, 2).map(ds => ds.name).join(', ');
        const suffix = metric.datasources.length > 2 ? ` +${metric.datasources.length - 2}` : '';
        tags.push({
            icon: <Database className="w-3 h-3" />,
            label: `${dsNames}${suffix}`,
            color: 'gray',
        });
    }

    // 公式预览标签
    if (metric.formula) {
        const truncatedFormula = metric.formula.length > 40
            ? metric.formula.substring(0, 40) + '...'
            : metric.formula;
        tags.push({
            icon: <Code className="w-3 h-3" />,
            label: truncatedFormula,
            color: 'gray',
        });
    }

    return (
        <div className="group">
            <HorizontalCard
                icon={<FunctionSquare className="w-5 h-5" />}
                title={metric.name}
                badges={badges}
                details={details}
                tags={tags}
                onClick={onClick}
            />
        </div>
    );
}

