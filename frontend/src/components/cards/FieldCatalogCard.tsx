'use client';

import React from 'react';
import { Hash, Database, Layers, Zap } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface FieldCatalogItem {
    canonical_name: string;
    table_id?: string;
    table_name?: string;
    table_schema?: string;
    role?: string;
    data_type?: string;
    remote_type?: string;
    description?: string;
    representative_id?: string;
    instance_count: number;
    total_usage: number;
    datasources: Array<{ id: string; name: string }>;
    datasource_count: number;
}

export interface FieldCatalogCardProps {
    field: FieldCatalogItem;
    onClick?: () => void;
}

export default function FieldCatalogCard({ field, onClick }: FieldCatalogCardProps) {

    const isMeasure = field.role?.toLowerCase() === 'measure';
    const roleName = isMeasure ? '度量' : (field.role?.toLowerCase() === 'dimension' ? '维度' : field.role || '未知');

    // 构建徽章
    const badges: Array<{ text: string; color: 'green' | 'blue' | 'gray' | 'red' | 'purple' | 'orange' }> = [
        {
            text: roleName,
            color: isMeasure ? 'green' : 'blue',
        },
    ];

    // 实例数徽章
    if (field.instance_count > 1) {
        badges.push({
            text: `${field.instance_count} 个实例`,
            color: 'purple',
        });
    }

    // 热门徽章
    if (field.total_usage > 50) {
        badges.push({
            text: '高频使用',
            color: 'red',
        });
    }

    // 构建详情信息
    const details = [
        {
            label: '总热度',
            value: `${field.total_usage} 次`,
            highlight: field.total_usage > 0,
        },
        {
            label: '数据源数',
            value: `${field.datasource_count} 个`,
        },
        field.table_name && field.table_name !== '-' && {
            label: '所属表',
            value: field.table_name,
        },
        field.data_type && {
            label: '类型',
            value: field.data_type,
        },
    ].filter((item): item is { label: string; value: string; highlight?: boolean } =>
        Boolean(item && item.value !== undefined && item.value !== null && item.value !== ''));

    // 构建标签
    const tags: Array<{ icon?: React.ReactNode; label: string; color: 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'red' | 'orange' }> = [];

    if (field.instance_count > 1) {
        tags.push({
            icon: <Layers className="w-3 h-3" />,
            label: `共有 ${field.instance_count} 个实例`,
            color: 'purple',
        });
    }

    if (field.remote_type) {
        tags.push({
            icon: <Database className="w-3 h-3" />,
            label: `物理类型: ${field.remote_type}`,
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
