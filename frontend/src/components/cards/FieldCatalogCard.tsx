'use client';

import React, { useState } from 'react';
import { Database, Layers, ChevronDown, ChevronUp, Hash, Eye } from 'lucide-react';
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
    const [expanded, setExpanded] = useState(false);

    const isMeasure = field.role?.toLowerCase() === 'measure';
    const roleName = isMeasure ? '度量' : (field.role?.toLowerCase() === 'dimension' ? '维度' : field.role || '未知');

    // 构建徽章
    const badges: Array<{ text: string; color: 'green' | 'blue' | 'gray' | 'red' | 'purple' | 'orange' }> = [
        {
            text: roleName,
            color: isMeasure ? 'green' : 'blue',
        },
    ];

    if (field.data_type) {
        badges.push({
            text: field.data_type,
            color: 'gray',
        });
    }

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
            text: '热门',
            color: 'red',
        });
    }

    // 构建详情信息
    const details = [
        field.table_name && field.table_name !== '-' && {
            label: '所属表',
            value: field.table_name,
        },
        field.database_name && {
            label: '数据库',
            value: field.database_name,
        },
        {
            label: '总热度',
            value: `${field.total_usage} 次`,
            highlight: field.total_usage > 20,
        },
        {
            label: '数据源数',
            value: `${field.datasource_count} 个`,
        },
    ].filter((item): item is { label: string; value: string; highlight?: boolean } =>
        Boolean(item && item.value !== undefined && item.value !== null && item.value !== ''));

    // 构建标签
    const tags: Array<{ icon?: React.ReactNode; label: string; color: 'green' | 'blue' | 'gray' | 'purple' | 'yellow' | 'red' | 'orange' }> = [];

    if (field.instance_count > 1) {
        tags.push({
            icon: <Layers className="w-3 h-3" />,
            label: `被 ${field.instance_count} 个数据源定义`,
            color: 'purple',
        });
    }

    if (field.total_usage > 0) {
        tags.push({
            icon: <Eye className="w-3 h-3" />,
            label: `累计 ${field.total_usage} 次视图引用`,
            color: 'blue',
        });
    }

    if (field.remote_type) {
        tags.push({
            icon: <Database className="w-3 h-3" />,
            label: `原生类型: ${field.remote_type}`,
            color: 'gray',
        });
    }

    // 右侧展开按钮
    const rightContent = field.datasources.length > 0 && (
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
                icon={<Hash className="w-5 h-5" />}
                title={field.canonical_name}
                badges={badges}
                details={details}
                tags={tags}
                onClick={onClick}
            />

            {/* 展开的数据源列表 */}
            {expanded && field.datasources.length > 0 && (
                <div className="ml-12 mt-1 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-2">
                        在以下 {field.datasources.length} 个数据源中定义：
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {field.datasources.map((ds, idx) => (
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
        </div>
    );
}
