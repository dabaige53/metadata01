'use client';

import React, { useState } from 'react';
import { FunctionSquare, Database, BookOpen, ChevronDown, ChevronUp, Code, Layers } from 'lucide-react';
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
}

export interface MetricCatalogCardProps {
    metric: MetricCatalogItem;
    onClick?: () => void;
}

export default function MetricCatalogCard({ metric, onClick }: MetricCatalogCardProps) {
    const [expanded, setExpanded] = useState(false);

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

    // 判断是否有可展开的内容
    const hasExpandContent = metric.datasources.length > 0 || metric.formula || metric.workbooks.length > 0;

    return (
        <div className="group">
            <div className="flex items-start gap-2">
                <div className="flex-1">
                    <HorizontalCard
                        icon={<FunctionSquare className="w-5 h-5" />}
                        title={metric.name}
                        badges={badges}
                        details={details}
                        tags={tags}
                        onClick={onClick}
                    />
                </div>

                {/* 展开按钮 */}
                {hasExpandContent && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="mt-4 flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg border border-gray-200 transition-all shrink-0"
                    >
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        <span>{expanded ? '收起' : '详情'}</span>
                    </button>
                )}
            </div>

            {/* 展开的详情 */}
            {expanded && (
                <div className="ml-12 mt-1 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
                    {/* 公式 */}
                    {metric.formula && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">完整公式：</div>
                            <div className="p-2 bg-white rounded border text-xs font-mono text-gray-700 break-all">
                                {metric.formula}
                            </div>
                        </div>
                    )}

                    {/* 数据源列表维护 */}
                    {metric.datasources.length > 0 && (
                        <div>
                            <div className="text-xs font-medium text-gray-500 mb-2">
                                在以下 {metric.datasource_count} 个数据源中定义：
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
