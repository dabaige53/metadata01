'use client';

import { FunctionSquare, Layers, Code } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface MetricCatalogItem {
    name: string;
    formula?: string;
    formula_hash?: string;
    role?: string;
    data_type?: string;
    description?: string;
    representative_id?: string;
    instance_count: number;
    complexity: number;
    complexity_level: string;
    total_references: number;
    datasources: Array<{ id: string; name: string }>;
    datasource_count: number;
    workbooks: Array<{ id: string; name: string }>;
    workbook_count: number;
    formula_length?: number;
}

export interface MetricCatalogCardProps {
    metric: MetricCatalogItem;
    onClick?: () => void;
}

export default function MetricCatalogCard({ metric, onClick }: MetricCatalogCardProps) {

    const isMeasure = metric.role?.toLowerCase() === 'measure';
    const roleName = isMeasure ? '度量' : (metric.role?.toLowerCase() === 'dimension' ? '维度' : metric.role || '未知');

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

    // 实例数徽章
    if (metric.instance_count > 1) {
        badges.push({
            text: `${metric.instance_count} 个实例`,
            color: 'purple',
        });
    }

    // 构建详情信息
    const details = [
        {
            label: '引用数',
            value: `${metric.total_references} 次`,
            highlight: metric.total_references > 0,
        },
        {
            label: '公式长度',
            value: `${metric.formula?.length || 0} 字符`,
        },
        {
            label: '数据源',
            value: `${metric.datasource_count} 个`,
        },
        {
            label: '工作簿',
            value: `${metric.workbook_count} 个`,
        },
    ];

    // 构建标签
    const tags: Array<{ icon?: React.ReactNode; label: string; color: 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'red' | 'orange' }> = [];

    if (metric.instance_count > 1) {
        tags.push({
            icon: <Layers className="w-3 h-3" />,
            label: `共有 ${metric.instance_count} 个实例`,
            color: 'purple',
        });
    }

    if (metric.formula) {
        const truncatedFormula = metric.formula.length > 60
            ? metric.formula.substring(0, 60) + '...'
            : metric.formula;
        tags.push({
            icon: <Code className="w-3 h-3" />,
            label: `公式: ${truncatedFormula}`,
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
