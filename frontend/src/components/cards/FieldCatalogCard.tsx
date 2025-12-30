'use client';

import React from 'react';
import { Hash, Database, Table2, GitMerge, Layers } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface FieldCatalogItem {
    canonical_name: string;
    table_id?: string;
    table_name?: string;
    table_schema?: string;
    database_name?: string;
    role?: string;
    data_type?: string;
    remote_type?: string;
    description?: string;
    representative_id?: string;
    instance_count: number;
    total_usage: number;
    datasources: Array<{ id: string; name: string }>;
    datasource_count: number;
    dedup_method?: 'physical_table' | 'embedded_table' | 'datasource';  // 新增
}

export interface FieldCatalogCardProps {
    field: FieldCatalogItem;
    onClick?: () => void;
}

export default function FieldCatalogCard({ field, onClick }: FieldCatalogCardProps) {

    const isMeasure = field.role?.toLowerCase() === 'measure';
    const roleName = isMeasure ? '度量' : (field.role?.toLowerCase() === 'dimension' ? '维度' : field.role || '未知');

    // 使用后端返回的去重方式（支持三种：physical_table/embedded_table/datasource）
    const dedupMethodLabels: Record<string, { label: string; icon: 'table' | 'embedded' | 'datasource' }> = {
        'physical_table': { label: '按物理表+列', icon: 'table' },
        'embedded_table': { label: '按嵌入式表', icon: 'embedded' },
        'datasource': { label: '按数据源+名称', icon: 'datasource' },
    };
    const dedupInfo = dedupMethodLabels[field.dedup_method || ''] || dedupMethodLabels['datasource'];

    // 构建去重键显示
    const hasTable = field.table_name && field.table_name !== '-';
    const dedupKey = hasTable
        ? `${field.table_name}.${field.canonical_name}`
        : field.canonical_name;

    // 构建徽章
    const badges: Array<{ text: string; color: 'green' | 'blue' | 'gray' | 'red' | 'purple' | 'orange' }> = [
        {
            text: roleName,
            color: isMeasure ? 'green' : 'blue',
        },
    ];

    // 热门徽章
    if (field.total_usage > 50) {
        badges.push({
            text: '高频使用',
            color: 'red',
        });
    }

    // 构建详情信息 - 包含去重键
    const details = [
        {
            label: '去重键',
            value: dedupKey,
            highlight: true,
        },
        {
            label: '总热度',
            value: `${field.total_usage} 次`,
            highlight: field.total_usage > 0,
        },
        {
            label: '跨数据源',
            value: `${field.datasource_count} 个`,
        },
        field.data_type && {
            label: '类型',
            value: field.data_type,
        },
    ].filter((item): item is { label: string; value: string; highlight?: boolean } =>
        Boolean(item && item.value !== undefined && item.value !== null && item.value !== ''));

    // 构建标签 - 显示具体的去重方式
    const tags: Array<{ icon?: React.ReactNode; label: string; color: 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'red' | 'orange' }> = [];

    // 去重方式标签 (根据类型使用不同图标和颜色)
    const iconElement = dedupInfo.icon === 'table' ? <Table2 className="w-3 h-3" />
        : dedupInfo.icon === 'embedded' ? <Layers className="w-3 h-3" />
            : <Database className="w-3 h-3" />;
    tags.push({
        icon: iconElement,
        label: dedupInfo.label,
        color: dedupInfo.icon === 'embedded' ? 'orange' : 'blue',
    });

    // 聚合数量标签 (仅当有多个实例时显示)
    if (field.instance_count > 1) {
        tags.push({
            icon: <GitMerge className="w-3 h-3" />,
            label: `${field.instance_count} 实例 → 1 标准`,
            color: 'purple',
        });
    }

    // 物理类型
    if (field.remote_type) {
        tags.push({
            icon: <Layers className="w-3 h-3" />,
            label: field.remote_type,
            color: 'gray',
        });
    }

    return (
        <div className="group">
            <div className="flex items-start gap-2">
                <div className="flex-1">
                    <HorizontalCard
                        icon={<Hash className="w-5 h-5" />}
                        title={field.canonical_name}
                        badges={badges}
                        details={details}
                        tags={tags}
                        onClick={onClick}
                    />
                </div>

            </div>
        </div>
    );
}

