'use client';

import React, { useState } from 'react';
import { FunctionSquare, Database, BookOpen, ChevronDown, ChevronUp, Layers, Zap } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface MetricCatalogItem {
    name: string;
    formula?: string;
    formula_hash?: string;
    role?: string;
    data_type?: string;
    description?: string;
    instance_count: number;
    complexity?: number;
    complexity_level?: string;
    formula_length?: number;
    total_references: number;
    datasources: Array<{ id: string; name: string }>;
    datasource_count: number;
    workbooks: Array<{ id: string; name: string }>;
    workbook_count: number;
}

export interface MetricCatalogCardProps {
    metric: MetricCatalogItem;
    onClick?: () => void;
}

export default function MetricCatalogCard({ metric, onClick }: MetricCatalogCardProps) {
    const [expanded, setExpanded] = useState(false);

    const isMeasure = metric.role?.toLowerCase() === 'measure';
    const roleName = isMeasure ? '业务指标' : '技术计算';

    // 复杂度颜色
    const complexityColor = {
        '超高': 'red',
        '高': 'orange',
        '中': 'purple',
        '低': 'gray',
    }[metric.complexity_level || '低'] as 'red' | 'orange' | 'purple' | 'gray';

    // 构建徽章
    const badges: Array<{ text: string; color: 'green' | 'blue' | 'gray' | 'red' | 'purple' | 'orange' }> = [
        {
            text: roleName,
            color: isMeasure ? 'green' : 'blue',
        },
    ];

    // 实例数徽章
    if (metric.instance_count > 1) {
        badges.push({
            text: `${metric.instance_count} 个实例`,
            color: 'purple',
        });
    }

    // 复杂度徽章
    if (metric.complexity_level && metric.complexity_level !== '低') {
        badges.push({
            text: `复杂度: ${metric.complexity_level}`,
            color: complexityColor,
        });
    }

    // 热门徽章
    if (metric.total_references > 20) {
        badges.push({
            text: '高频使用',
            color: 'red',
        });
    }

    // 构建详情信息
    const details = [
        {
            label: '总引用',
            value: `${metric.total_references} 次`,
            highlight: metric.total_references > 10,
        },
        {
            label: '数据源',
            value: `${metric.datasource_count} 个`,
        },
        metric.workbook_count > 0 && {
            label: '工作簿',
            value: `${metric.workbook_count} 个`,
        },
        metric.formula_length && {
            label: '公式长度',
            value: `${metric.formula_length} 字符`,
        },
    ].filter((item): item is { label: string; value: string; highlight?: boolean } =>
        Boolean(item && item.value !== undefined && item.value !== null && item.value !== ''));

    // 构建标签
    const tags: Array<{ icon?: React.ReactNode; label: string; color: 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'red' | 'orange' }> = [];

    if (metric.instance_count > 1) {
        tags.push({
            icon: <Layers className="w-3 h-3" />,
            label: `在 ${metric.datasource_count} 个数据源中定义`,
            color: 'purple',
        });
    }

    if (metric.total_references > 0) {
        tags.push({
            icon: <Zap className="w-3 h-3" />,
            label: `累计 ${metric.total_references} 次引用`,
            color: 'blue',
        });
    }

    // 右侧展开按钮
    const hasExpandContent = metric.datasources.length > 0 || metric.formula;
    const rightContent = hasExpandContent && (
        <button
            onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
        >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>{expanded ? '收起' : '展开'}</span>
        </button>
    );

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

            {/* 展开的详情 */}
            {expanded && (
                <div className="ml-12 mt-1 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                    {/* 公式 */}
                    {metric.formula && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">公式：</div>
                            <div className="p-2 bg-white rounded border text-xs font-mono text-gray-700 break-all">
                                {metric.formula}
                            </div>
                        </div>
                    )}

                    {/* 数据源列表 */}
                    {metric.datasources.length > 0 && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 mb-2">
                                在以下 {metric.datasources.length} 个数据源中定义：
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {metric.datasources.map((ds, idx) => (
                                    <span
                                        key={ds.id || idx}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white text-indigo-700 border border-indigo-100 rounded-full hover:bg-indigo-50 transition-colors cursor-pointer"
                                    >
                                        <Database className="w-3 h-3" />
                                        {ds.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 工作簿列表 */}
                    {metric.workbooks.length > 0 && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 mb-2">
                                使用此指标的工作簿：
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {metric.workbooks.map((wb, idx) => (
                                    <span
                                        key={wb.id || idx}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-white text-purple-700 border border-purple-100 rounded-full hover:bg-purple-50 transition-colors cursor-pointer"
                                    >
                                        <BookOpen className="w-3 h-3" />
                                        {wb.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
