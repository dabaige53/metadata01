import React from 'react';
import { LayoutGrid, Flame, FileSpreadsheet, LayoutDashboard, Presentation } from 'lucide-react';
import HorizontalCard from './HorizontalCard';
import { formatDateWithRelative, isRecent } from '@/lib/date';

export interface ViewCardData {
    id: string;
    name: string;
    workbookName?: string;
    projectName?: string;
    owner?: string;
    viewType?: string;
    totalViewCount?: number;
    fieldCount?: number;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    containedSheetCount?: number;
    isStandalone?: boolean;
}

export interface ViewCardProps {
    view: ViewCardData;
    onClick?: () => void;
}

export default function ViewCard({ view, onClick }: ViewCardProps) {
    const workbookName = view.workbookName;
    const projectName = view.projectName;
    const hits = view.totalViewCount || 0;
    const fieldCount = view.fieldCount || 0;
    const viewType = (view.viewType || '').toLowerCase();
    const createdAt = view.createdAt;
    const updatedAt = view.updatedAt;

    // 视图类型图标与颜色
    let typeIcon = <LayoutGrid className="w-5 h-5 text-indigo-600" />;
    let typeLabel = '视图';
    let typeColor: 'purple' | 'blue' | 'green' | 'gray' = 'gray';

    if (viewType === 'dashboard') {
        typeIcon = <LayoutDashboard className="w-5 h-5 text-purple-600" />;
        typeLabel = '仪表板';
        typeColor = 'purple';
    } else if (viewType === 'sheet') {
        typeIcon = <FileSpreadsheet className="w-5 h-5 text-blue-600" />;
        typeLabel = view.isStandalone ? '独立工作表' : '工作表';
        typeColor = view.isStandalone ? 'green' : 'blue';
    } else if (viewType === 'story') {
        typeIcon = <Presentation className="w-5 h-5 text-green-600" />;
        typeLabel = '故事';
        typeColor = 'green';
    }

    // 构建徽章
    const badges: Array<{ text: string; color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'indigo' }> = [
        {
            text: typeLabel,
            color: typeColor,
        },
    ];

    if (projectName) {
        badges.push({
            text: projectName,
            color: 'gray',
        });
    }

    // 构建详情信息
    const details = [
        {
            label: '工作簿',
            value: workbookName,
        },
        {
            label: '所有者',
            value: view.owner,
        },
        {
            label: '字段数',
            value: `${fieldCount} 个`,
            highlight: fieldCount > 20,
        },
        // Dashboard 特有信息
        view.containedSheetCount !== undefined && view.containedSheetCount > 0 && {
            label: '包含视图',
            value: `${view.containedSheetCount} 个`,
            highlight: true,
        },
        {
            label: '访问量',
            value: `${hits} 次`,
            highlight: hits > 100,
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

    // 构建标签
    const tags = [];

    if (hits === 0) {
        tags.push({
            label: '未使用',
            color: 'gray' as const,
        });
    } else if (hits > 500) {
        tags.push({
            icon: <Flame className="w-3 h-3" />,
            label: '热门',
            color: 'orange' as const,
        });
    }

    if (fieldCount > 30) {
        tags.push({
            label: '高复杂度',
            color: 'red' as const,
        });
    }

    if (view.description) {
        tags.push({
            label: view.description.slice(0, 40) + (view.description.length > 40 ? '...' : ''),
            color: 'gray' as const,
        });
    }

    return (
        <HorizontalCard
            icon={typeIcon}
            title={view.name}
            badges={badges}
            details={details}
            tags={tags}
            onClick={onClick}
        />
    );
}
