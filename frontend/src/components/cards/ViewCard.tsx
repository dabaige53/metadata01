import React from 'react';
import { LayoutGrid, AlertTriangle, FileSpreadsheet, LayoutDashboard, Presentation } from 'lucide-react';
import HorizontalCard from './HorizontalCard';

export interface ViewCardData {
    id: string;
    name: string;
    workbook?: string;
    workbook_name?: string;
    workbookName?: string;
    project?: string;
    project_name?: string;
    projectName?: string;
    owner?: string;
    type?: string;     // 'dashboard', 'sheet', 'story'
    viewType?: string;
    hits_total?: number;
    hitsTotal?: number;
    usage?: number;
    field_count?: number;
    fieldCount?: number;
    description?: string;
}

export interface ViewCardProps {
    view: ViewCardData;
    onClick?: () => void;
}

export default function ViewCard({ view, onClick }: ViewCardProps) {
    const workbookName = view.workbook_name || view.workbookName || view.workbook || '-';
    const projectName = view.project_name || view.projectName || view.project || '-';
    const hits = view.hits_total ?? view.hitsTotal ?? view.usage ?? 0;
    const fieldCount = view.field_count ?? view.fieldCount ?? 0;
    const viewType = (view.viewType || view.type || '').toLowerCase();

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
        typeLabel = '工作表';
        typeColor = 'blue';
    } else if (viewType === 'story') {
        typeIcon = <Presentation className="w-5 h-5 text-green-600" />;
        typeLabel = '故事';
        typeColor = 'green';
    }

    // 构建徽章
    const badges = [
        {
            text: typeLabel,
            color: typeColor,
        },
        {
            text: projectName,
            color: 'gray' as const,
        },
    ];

    // 构建详情信息
    const details = [
        {
            label: '工作簿',
            value: workbookName,
        },
        {
            label: '所有者',
            value: view.owner || '-',
        },
        {
            label: '字段数',
            value: `${fieldCount} 个`,
            highlight: fieldCount > 20,
        },
        {
            label: '访问量',
            value: `${hits} 次`,
            highlight: hits > 100,
        },
    ];

    // 构建标签
    const tags = [];

    if (hits === 0) {
        tags.push({
            icon: <AlertTriangle className="w-3 h-3" />,
            label: '无访问',
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
