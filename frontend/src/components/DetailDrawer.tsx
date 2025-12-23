'use client';

import React, { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import { formatDateWithRelative, isRecent } from '@/lib/date';
import {
    X,
    Info,
    ArrowUpCircle,
    ArrowDownCircle,
    ArrowLeft,
    AlertTriangle,
    GitBranch,
    Loader2,
    Database,
    Table2,
    Columns,
    Layers,
    BookOpen,
    FileText,
    ChevronRight,
    Layout,
    FunctionSquare,
    List,
    User,
    Copy,
    CheckCircle2,
    ShieldCheck,
    Flame,
    HelpCircle,
    TrendingUp,
    BarChart3,
    ExternalLink
} from 'lucide-react';

interface DetailItem {
    id: string;
    name: string;
    type?: string;
    dataType?: string;
    role?: string;
    owner?: string;
    projectName?: string;
    project_name?: string;
    formula?: string;
    isCalculated?: boolean;
    description?: string;
    is_certified?: boolean;
    certification_note?: string;
    stats?: any;
    // Upstream
    upstream_column_info?: any;
    table_info?: any;
    database_info?: any;
    databaseId?: string;
    databaseName?: string;
    // Downstream
    used_by_metrics?: any[];
    used_in_views?: any[];
    usedInViews?: any[];
    usedInWorkbooks?: any[];
    workbooks?: any[];
    full_fields?: any[];
    metrics?: any[];
    columns?: any[];
    groupKey?: string; // 已不再使用
    datasources?: any[];
    views?: any[];
    used_fields?: any[];
    used_metrics?: any[];
    // Other
    similarMetrics?: any[];
    created_at?: string;
    updated_at?: string;
    createdAt?: string;
    updatedAt?: string;
    tableau_url?: string;  // Tableau Server 在线查看链接
    [key: string]: any;
}

// ========== 骨架屏组件 ==========
const DetailSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        {/* Content Skeleton */}
        <div className="space-y-4">
            <div className="h-24 bg-gray-100 rounded-lg" />
            <div className="grid grid-cols-2 gap-px bg-gray-200 rounded-lg border border-gray-200 overflow-hidden">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white p-3 space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-12" />
                        <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

export default function DetailDrawer() {
    const { isOpen, closeDrawer, currentItem, openDrawer, history, pushItem, goBack, goToIndex, prefetch, getCachedItem } = useDrawer();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DetailItem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lineageData, setLineageData] = useState<any>(null);
    const [lineageLoading, setLineageLoading] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [readyToShow, setReadyToShow] = useState(false); // 控制侧边栏滑入时机
    const [usageStats, setUsageStats] = useState<{
        totalViewCount: number;
        dailyDelta: number;
        weeklyDelta: number;
        history: Array<{ count: number; recordedAt: string }>;
    } | null>(null);
    const [usageLoading, setUsageLoading] = useState(false);

    const toggleGroupExpand = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    useEffect(() => {
        if (isOpen && currentItem) {
            // 兼容性映射：处理单数类型标识符
            if (currentItem.type === 'field') currentItem.type = 'fields';
            if (currentItem.type === 'metric') currentItem.type = 'metrics';

            // 如果 ID 变化，先清除旧数据
            if (data && data.id !== currentItem.id) {
                // Check cache immediately before clearing!
                const cached = getCachedItem(currentItem.id, currentItem.type);
                if (cached) {
                    setData(cached);
                } else {
                    setData(null);
                }
            } else if (!data) {
                // Check cache if we have no data
                const cached = getCachedItem(currentItem.id, currentItem.type);
                if (cached) setData(cached);
            }

            // 数据开始加载时立即开始滑入
            setTimeout(() => setReadyToShow(true), 50);
            loadData(currentItem.id, currentItem.type);
            setActiveTab('overview');
            setLineageData(null);
            setUsageStats(null); // 重置访问统计，防止缓存问题
        } else {
            setData(null);
            setReadyToShow(false);
        }
    }, [isOpen, currentItem]);

    const loadData = async (id: string, type: string) => {
        // 1. 优先使用缓存 (Instant Load)
        const cached = getCachedItem(id, type);
        if (cached) {
            setData(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const result = await api.getDetail(type, id);
            setData(result);
        } catch (err) {
            console.error(err);
            setError('加载失败');
        } finally {
            setLoading(false);
        }
    };

    const loadLineageGraph = async () => {
        if (!currentItem) return;
        setLineageLoading(true);
        try {
            const type = currentItem.type.replace(/s$/, '');
            const result = await fetch(`/api/lineage/graph/${type}/${currentItem.id}`).then(r => r.json());
            setLineageData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setLineageLoading(false);
        }
    };

    const handleAssetClick = (id: string | undefined, type: string, name?: string) => {
        if (!id) return;
        pushItem(id, type, name);
    };

    if (!isOpen) return null;

    // ========== 动态生成具体的 Tabs ==========
    const getTabs = () => {
        const tabs = [{ id: 'overview', label: '概览', icon: Info }];
        if (!data || !currentItem) return tabs;

        const type = currentItem.type;

        // 根据不同类型添加具体的关联资产 Tab
        if (type === 'databases') {
            // 只有有数据表时才显示
            if (data.tables && data.tables.length > 0) {
                tabs.push({ id: 'tables', label: `数据表 (${data.tables.length})`, icon: Table2 });
            }
        }

        if (type === 'tables') {
            if (data.database_info || data.databaseName) {
                tabs.push({ id: 'db', label: '所属数据库', icon: Database });
            }
            // 原始列 - 只有有列时才显示
            if (data.columns && data.columns.length > 0) {
                tabs.push({ id: 'columns', label: `原始列 (${data.columns.length})`, icon: List });
            }
            // 包含字段 - 只有有字段时才显示
            if (data.full_fields && data.full_fields.length > 0) {
                tabs.push({ id: 'fields', label: `包含字段 (${data.full_fields.length})`, icon: Columns });
            }
            // 关联数据源 - 只有有数据源时才显示
            if (data.datasources && data.datasources.length > 0) {
                tabs.push({ id: 'datasources', label: `关联数据源 (${data.datasources.length})`, icon: Layers });
            }
            // 关联工作簿 - 针对表直接关联的工作簿（包含直连和通过数据源关联）
            if (data.workbooks && data.workbooks.length > 0) {
                tabs.push({ id: 'workbooks', label: `关联工作簿 (${data.workbooks.length})`, icon: BookOpen });
            }
        }

        if (type === 'columns') {
            if (data.table_info) {
                tabs.push({ id: 'table', label: '所属数据表', icon: Table2 });
            }
            if (data.database_info) {
                tabs.push({ id: 'db', label: '所属数据库', icon: Database });
            }
        }

        if (type === 'fields' || type === 'metrics') {
            // 所属数据表 (如有关联)
            const table = data.table_info;
            if (table) tabs.push({ id: 'table', label: '所属数据表', icon: Table2 });

            // 依赖字段 - 仅对计算字段/指标显示，普通字段不需要
            const deps = data.dependencyFields || data.formula_references || [];
            if (deps.length > 0 && (data.isCalculated || data.formula)) {
                tabs.push({ id: 'deps', label: `依赖字段 (${deps.length})`, icon: Columns });
            }

            // 所属数据源 - 多源场景下显示字段所在的各个数据源
            // 优先使用 related_datasources，兜底使用 datasource_info
            const relatedDs = data.related_datasources || [];
            if (relatedDs.length > 0) {
                tabs.push({ id: 'datasources', label: `所属数据源 (${relatedDs.length})`, icon: Layers });
            } else if (data.datasource_info) {
                // 如果只有单个数据源，也显示该 Tab
                tabs.push({ id: 'datasources', label: '所属数据源 (1)', icon: Layers });
            }

            // 影响指标 - 只有被指标引用时才显示
            const m_down = data.used_by_metrics || [];
            if (m_down.length > 0) {
                tabs.push({ id: 'impact_metrics', label: `影响指标 (${m_down.length})`, icon: FunctionSquare });
            }

            // 关联视图 - 只有被视图引用时才显示
            const v_down = data.used_in_views || data.usedInViews || [];
            if (v_down.length > 0) {
                tabs.push({ id: 'views', label: `关联视图 (${v_down.length})`, icon: Layout });
            }

            // 引用工作簿 - 只有被工作簿引用时才显示
            const wb_down = data.usedInWorkbooks || [];
            if (wb_down.length > 0) {
                tabs.push({ id: 'workbooks', label: `引用工作簿 (${wb_down.length})`, icon: BookOpen });
            }
        }

        if (type === 'datasources') {
            // 原始表 - 只有有关联表时才显示
            if (data.tables && data.tables.length > 0) {
                tabs.push({ id: 'tables', label: `原始表 (${data.tables.length})`, icon: Table2 });
            }
            // 包含字段 - 只有有字段时才显示
            if (data.full_fields && data.full_fields.length > 0) {
                tabs.push({ id: 'fields', label: `包含字段 (${data.full_fields.length})`, icon: Columns });
            }
            // 包含指标 - 只有有指标时才显示
            if (data.metrics && data.metrics.length > 0) {
                tabs.push({ id: 'metrics', label: `包含指标 (${data.metrics.length})`, icon: FunctionSquare });
            }
            // 关联工作簿 - 只有有下游工作簿时才显示
            if (data.workbooks && data.workbooks.length > 0) {
                tabs.push({ id: 'workbooks', label: `关联工作簿 (${data.workbooks.length})`, icon: BookOpen });
            }
        }

        if (type === 'workbooks') {
            // 视图/看板 - 只有有视图时才显示
            if (data.views && data.views.length > 0) {
                tabs.push({ id: 'views', label: `视图/看板 (${data.views.length})`, icon: Layout });
            }
            // 使用数据源 - 只有有上游数据源时才显示
            if (data.datasources && data.datasources.length > 0) {
                tabs.push({ id: 'datasources', label: `使用数据源 (${data.datasources.length})`, icon: Layers });
            }
            // 关联数据表 - 针对工作簿直接或间接使用的物理表
            if (data.tables && data.tables.length > 0) {
                tabs.push({ id: 'tables', label: `关联数据表 (${data.tables.length})`, icon: Table2 });
            }
            // 使用字段 - 只有有字段使用时才显示
            if (data.used_fields && data.used_fields.length > 0) {
                tabs.push({ id: 'fields', label: `使用字段 (${data.used_fields.length})`, icon: Columns });
            }
            // 使用指标 - 只有有指标使用时才显示
            if (data.used_metrics && data.used_metrics.length > 0) {
                tabs.push({ id: 'metrics', label: `使用指标 (${data.used_metrics.length})`, icon: FunctionSquare });
            }
            // 访问统计 tab - 始终显示
            tabs.push({ id: 'usage', label: '访问统计', icon: BarChart3 });
        }

        if (type === 'views') {
            // 所属工作簿 - 只有有上级工作簿时才显示
            if (data.workbook_info) {
                tabs.push({ id: 'workbook', label: '所属工作簿', icon: BookOpen });
            }
            // 使用的字段 - 只有有字段使用时才显示
            if (data.used_fields && data.used_fields.length > 0) {
                tabs.push({ id: 'fields', label: `使用字段 (${data.used_fields.length})`, icon: Columns });
            }
            // 使用的指标 - 只有有指标使用时才显示
            if (data.used_metrics && data.used_metrics.length > 0) {
                tabs.push({ id: 'metrics', label: `使用指标 (${data.used_metrics.length})`, icon: FunctionSquare });
            }
            // 访问统计 tab - 始终显示
            tabs.push({ id: 'usage', label: '访问统计', icon: BarChart3 });
        }

        if (type === 'projects' || type === 'users') {
            if (data.datasources && data.datasources.length > 0) {
                tabs.push({ id: 'datasources', label: `数据源 (${data.datasources.length})`, icon: Layers });
            }
            if (data.workbooks && data.workbooks.length > 0) {
                tabs.push({ id: 'workbooks', label: `工作簿 (${data.workbooks.length})`, icon: BookOpen });
            }
        }

        // 同名指标定义 - 只有有重复时才显示
        if (data.similarMetrics && data.similarMetrics.length > 0) {
            tabs.push({ id: 'duplicates', label: `同名定义 (${data.similarMetrics.length})`, icon: Copy });
        }

        // 血缘 - 支持所有核心资产模块
        if (['fields', 'metrics', 'datasources', 'tables', 'databases', 'workbooks', 'views'].includes(type)) {
            tabs.push({ id: 'lineage', label: '血缘图', icon: GitBranch });
        }

        return tabs;
    };

    const tabs = getTabs();

    const getModuleIcon = (type: string) => {
        const icons: Record<string, React.ElementType> = {
            databases: Database, tables: Table2, fields: Columns, metrics: FunctionSquare,
            datasources: Layers, workbooks: BookOpen, projects: FileText, users: User, views: Layout
        };
        return icons[type] || Info;
    };

    const getModuleName = (type: string) => {
        const names: Record<string, string> = {
            databases: '数据库', tables: '数据表', fields: '字段', metrics: '指标',
            datasources: '数据源', workbooks: '工作簿', projects: '项目', users: '用户', views: '视图'
        };
        return names[type] || type;
    };

    /**
     * 通用的资产列表部分渲染函数（紧凑版）
     */
    const renderAssetSection = (title: string, icon: React.ElementType, items: any[], type: string, colorClass: string) => {
        if (!items || items.length === 0) return null;
        const groupKey = `section-${title}`;

        return (
            <div className={`bg-${colorClass}-50/50 rounded-lg border border-${colorClass}-100 p-3 animate-in slide-in-up`}>
                <h3 className={`text-xs font-bold text-${colorClass}-900 mb-2 flex items-center gap-2`}>
                    {icon && React.createElement(icon, { className: `w-3.5 h-3.5 text-${colorClass}-600` })} {title}
                </h3>
                <div className="space-y-1">
                    {(expandedGroups[groupKey] ? items : items.slice(0, 10)).map((asset: any, ai: number) => (
                        <div key={ai}
                            onClick={() => handleAssetClick(asset.id, type, asset.name)}
                            onMouseEnter={() => asset.id && prefetch(asset.id, type)}
                            style={{ animationDelay: `${ai * 30}ms` }}
                            className={`bg-white p-2.5 rounded border border-${colorClass}-100 ${asset.id ? 'cursor-pointer hover:border-${colorClass}-300 hover:bg-${colorClass}-50' : ''} transition-all shadow-sm animate-in fade-in slide-in-up fill-mode-backwards`}>
                            {/* 第一行：标题 + 专属标签 */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[13px] text-gray-900 font-bold truncate">{asset.name}</span>
                                    {/* 字段/指标：角色标签 */}
                                    {(type === 'fields' || type === 'metrics') && asset.role && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${asset.role === 'measure' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} flex-shrink-0`}>
                                            {asset.role === 'measure' ? '度量' : '维度'}
                                        </span>
                                    )}
                                    {/* 字段：数据类型 */}
                                    {type === 'fields' && (asset.dataType || asset.remote_type) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono flex-shrink-0">
                                            {asset.dataType || asset.remote_type}
                                        </span>
                                    )}
                                    {/* 指标：复杂度 */}
                                    {type === 'metrics' && asset.complexity !== undefined && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium flex-shrink-0">
                                            复杂度:{asset.complexity}
                                        </span>
                                    )}
                                    {/* 数据表：连接类型 */}
                                    {type === 'tables' && asset.connectionType && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium flex-shrink-0">
                                            {asset.connectionType}
                                        </span>
                                    )}
                                    {/* 数据表：使用状态 */}
                                    {type === 'tables' && asset.status && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${asset.status === '使用中' ? 'bg-green-100 text-green-700' : asset.status === '仅关联' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {asset.status}
                                        </span>
                                    )}
                                    {/* 视图：类型(仪表板/工作表) */}
                                    {type === 'views' && asset.viewType && (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${asset.viewType === 'Dashboard' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                            {asset.viewType === 'Dashboard' ? '仪表板' : '工作表'}
                                        </span>
                                    )}
                                    {/* 认证状态 */}
                                    {asset.is_certified && (
                                        <span className="flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                            <ShieldCheck className="w-3 h-3" /> 认证
                                        </span>
                                    )}
                                </div>
                                {asset.id && <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                            </div>
                            {/* 第二行：血缘路径/归属信息 */}
                            <div className="flex items-center justify-between mt-1.5 text-[11px] text-gray-600">
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    {/* 数据表：数据库 + Schema */}
                                    {type === 'tables' && asset.databaseName && (
                                        <span className="flex items-center gap-1 bg-violet-50 px-1.5 py-0.5 rounded">
                                            <Database className="w-3 h-3 text-violet-500" />
                                            <span className="font-medium">{asset.databaseName}</span>
                                        </span>
                                    )}
                                    {type === 'tables' && asset.schema && (
                                        <span className="text-gray-500">Schema: {asset.schema}</span>
                                    )}
                                    {/* 数据源 */}
                                    {type !== 'tables' && asset.datasourceName && (
                                        <span className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                            <Layers className="w-3 h-3 text-indigo-500" />
                                            <span className="truncate max-w-[140px] font-medium">{asset.datasourceName}</span>
                                        </span>
                                    )}
                                    {asset.datasourceName && asset.workbookName && <span className="text-gray-400">→</span>}
                                    {/* 工作簿 */}
                                    {asset.workbookName && (
                                        <span className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded">
                                            <BookOpen className="w-3 h-3 text-rose-500" />
                                            <span className="truncate max-w-[140px] font-medium">{asset.workbookName}</span>
                                        </span>
                                    )}
                                    {/* 项目（无血缘时显示） */}
                                    {!asset.datasourceName && !asset.workbookName && !asset.databaseName && (asset.projectName || asset.project_name) && (
                                        <span className="text-gray-500">📁 {asset.projectName || asset.project_name}</span>
                                    )}
                                </div>
                                {asset.owner && (
                                    <span className="text-gray-500 flex-shrink-0 font-medium">👤 {asset.owner}</span>
                                )}
                            </div>
                            {/* 第三行：专属统计指标 */}
                            <div className="flex items-center justify-between mt-1.5 text-[11px]">
                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* 通用：引用次数 */}
                                    {asset.usage_count !== undefined && asset.usage_count > 0 && (
                                        <span className="flex items-center gap-0.5 text-orange-600 font-medium">
                                            <Flame className="w-3 h-3" /> {asset.usage_count}次引用
                                        </span>
                                    )}
                                    {/* 字段/数据源：视图数 */}
                                    {(type === 'fields' || type === 'datasources') && asset.view_count !== undefined && (
                                        <span className="text-gray-500">📄 {asset.view_count}视图</span>
                                    )}
                                    {/* 指标：依赖字段数 */}
                                    {type === 'metrics' && asset.dependency_count !== undefined && (
                                        <span className="text-gray-500">📐 依赖{asset.dependency_count}字段</span>
                                    )}
                                    {/* 数据表：列数 + 数据源引用 */}
                                    {type === 'tables' && asset.column_count !== undefined && (
                                        <span className="text-gray-500">📊 {asset.column_count}列</span>
                                    )}
                                    {type === 'tables' && asset.datasource_count !== undefined && (
                                        <span className="text-gray-500">🗄️ {asset.datasource_count}数据源</span>
                                    )}
                                    {/* 数据源：字段数 + 指标数 + 工作簿数 */}
                                    {type === 'datasources' && asset.field_count !== undefined && (
                                        <span className="text-gray-500">📦 {asset.field_count}字段</span>
                                    )}
                                    {type === 'datasources' && asset.metric_count !== undefined && (
                                        <span className="text-gray-500">📈 {asset.metric_count}指标</span>
                                    )}
                                    {type === 'datasources' && asset.workbook_count !== undefined && (
                                        <span className="text-gray-500">📕 {asset.workbook_count}工作簿</span>
                                    )}
                                    {/* 工作簿：视图数 + 数据源数 + 访问量 */}
                                    {type === 'workbooks' && asset.view_count !== undefined && (
                                        <span className="text-gray-500">📄 {asset.view_count}视图</span>
                                    )}
                                    {type === 'workbooks' && asset.datasource_count !== undefined && (
                                        <span className="text-gray-500">🗄️ {asset.datasource_count}数据源</span>
                                    )}
                                    {type === 'workbooks' && asset.total_view_count !== undefined && (
                                        <span className="text-gray-500">👁 {asset.total_view_count}访问</span>
                                    )}
                                    {/* 视图：字段数 + 指标数 + 访问量 */}
                                    {type === 'views' && asset.field_count !== undefined && (
                                        <span className="text-gray-500">📊 {asset.field_count}字段</span>
                                    )}
                                    {type === 'views' && asset.metric_count !== undefined && (
                                        <span className="text-gray-500">📈 {asset.metric_count}指标</span>
                                    )}
                                    {type === 'views' && asset.total_view_count !== undefined && (
                                        <span className="text-gray-500">👁 {asset.total_view_count}访问</span>
                                    )}
                                    {/* 更新时间 */}
                                    {asset.updated_at && (
                                        <span className="text-gray-400">🕐 {formatDateWithRelative(asset.updated_at)}</span>
                                    )}
                                    {/* 无描述告警 */}
                                    {!asset.description && (
                                        <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                                            <AlertTriangle className="w-3 h-3" /> 无描述
                                        </span>
                                    )}
                                </div>
                                {/* 指标：公式预览 */}
                                {type === 'metrics' && asset.formula && (
                                    <span className="text-gray-400 truncate max-w-[180px] flex-shrink-0 font-mono text-[10px]" title={asset.formula}>
                                        {asset.formula.length > 25 ? asset.formula.slice(0, 25) + '...' : asset.formula}
                                    </span>
                                )}
                                {/* 其他：描述预览 */}
                                {type !== 'metrics' && asset.description && (
                                    <span className="text-gray-500 truncate max-w-[180px] flex-shrink-0 italic" title={asset.description}>
                                        "{asset.description.length > 25 ? asset.description.slice(0, 25) + '...' : asset.description}"
                                    </span>
                                )}
                            </div>
                        </div>

                    ))}
                    {items.length > 10 && (
                        <button
                            onClick={() => toggleGroupExpand(groupKey)}
                            className={`text-[10px] text-${colorClass}-600 pl-2 hover:underline cursor-pointer font-medium mt-1`}
                        >
                            {expandedGroups[groupKey] ? '收起' : `显示更多 (+${items.length - 10})`}
                        </button>
                    )}
                </div>
            </div>
        );
    };


    // ========== 相同定义指标渲染（增强版） ==========
    const renderDuplicatesTab = () => {
        const dups = data?.similarMetrics || [];
        if (dups.length === 0) return <div className="text-center text-gray-400 py-8">未发现相同定义的指标</div>;

        // 计算公式一致性 - 使用第一个作为基准
        const baseFormula = dups[0]?.formula;

        return (
            <div className="bg-blue-50/50 rounded-lg border border-blue-100 p-3">
                <h3 className="text-[13px] font-bold text-blue-800 mb-3 flex items-center gap-2">
                    <FunctionSquare className="w-4 h-4 text-blue-600" />
                    同名指标定义 <span className="text-blue-500 font-normal text-[11px]">(发现 {dups.length} 个源)</span>
                </h3>
                <div className="space-y-2">
                    {dups.map((d: any, i: number) => {
                        const isConsistent = d.formula === baseFormula;
                        return (
                            <div key={i} onClick={() => handleAssetClick(d.id, 'metrics', d.name)}
                                className="bg-white p-2.5 rounded border border-blue-100 cursor-pointer hover:bg-blue-50/50 transition-colors">
                                {/* 第一行：名称 + 一致性状态 */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="text-[13px] font-bold text-blue-900">{d.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-medium ${isConsistent ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {isConsistent ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                            {isConsistent ? '公式一致' : '存在差异'}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                </div>
                                {/* 第二行：血缘路径 */}
                                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-600 flex-wrap">
                                    <span className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                        <Layers className="w-3 h-3 text-indigo-500" />
                                        <span className="truncate max-w-[120px] font-medium">{d.datasourceName || '-'}</span>
                                    </span>
                                    {d.workbookName && (
                                        <>
                                            <span className="text-gray-400">→</span>
                                            <span className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded">
                                                <BookOpen className="w-3 h-3 text-rose-500" />
                                                <span className="truncate max-w-[120px] font-medium">{d.workbookName}</span>
                                            </span>
                                        </>
                                    )}
                                    {d.usage_count !== undefined && (
                                        <span className="flex items-center gap-0.5 text-orange-600 font-medium">
                                            <Flame className="w-3 h-3" /> {d.usage_count}次引用
                                        </span>
                                    )}
                                </div>
                                {/* 第三行：公式预览 */}
                                {d.formula && (
                                    <div className="mt-1.5 text-[10px] font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 truncate" title={d.formula}>
                                        {d.formula.length > 50 ? d.formula.slice(0, 50) + '...' : d.formula}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };



    // ========== 血缘图渲染 (保留原有逻辑) ==========
    const renderLineageTab = () => {
        if (lineageLoading) {
            return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
        }
        if (!lineageData) {
            return (
                <div className="bg-white rounded-lg border p-4 text-center">
                    <button onClick={loadLineageGraph}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors inline-flex items-center gap-2">
                        <GitBranch className="w-4 h-4" /> 加载血缘图
                    </button>
                </div>
            );
        }
        const nodeColors: Record<string, string> = {
            field: '#3b82f6', metric: '#f59e0b', table: '#7c3aed',
            datasource: '#10b981', workbook: '#e11d48', view: '#6366f1'
        };
        return (
            <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg border p-4 overflow-auto">
                    <div className="text-xs font-bold text-gray-700 mb-2">Mermaid 血缘图</div>
                    <pre className="text-[10px] font-mono bg-white p-2 rounded border overflow-x-auto">{lineageData.mermaid}</pre>
                </div>
            </div>
        );
    };

    // ========== 关联数据源渲染（增强版） ==========
    const renderDatasourcesTab = () => {
        // 优先使用 related_datasources，兜底使用 datasource_info
        let items = data?.related_datasources || [];

        // 如果没有 related_datasources，从 datasource_info 构造单条记录
        if (items.length === 0 && data?.datasource_info) {
            items = [data.datasource_info];
        }

        if (items.length === 0) return <div className="text-center text-gray-400 py-8">无关联数据源</div>;

        return (
            <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-3 animate-in slide-in-up">
                <h3 className="text-[13px] font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" /> 包含此字段的数据源
                </h3>
                <div className="space-y-2">
                    {items.map((ds: any, i: number) => (
                        <div key={i}
                            onClick={() => handleAssetClick(ds.id, 'datasources', ds.name)}
                            className="bg-white p-2.5 rounded border border-indigo-100 cursor-pointer hover:bg-indigo-50/50 transition-all">
                            {/* 第一行：数据源名称 + 认证状态 + 发布状态 */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                    <span className="text-[13px] font-bold text-gray-900 truncate">{ds.name}</span>
                                    {ds.is_certified && (
                                        <span className="flex items-center gap-0.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                            <ShieldCheck className="w-3 h-3" /> 认证
                                        </span>
                                    )}
                                    {ds.is_published && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                            已发布
                                        </span>
                                    )}
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </div>
                            {/* 第二行：归属工作簿 + 项目 */}
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-600 flex-wrap">
                                {ds.workbook_name && (
                                    <span className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded">
                                        <BookOpen className="w-3 h-3 text-rose-500" />
                                        <span className="truncate max-w-[140px] font-medium">{ds.workbook_name}</span>
                                    </span>
                                )}
                                {(ds.project_name || ds.projectName) && (
                                    <span className="text-gray-500">📁 {ds.project_name || ds.projectName}</span>
                                )}
                                {ds.owner && (
                                    <span className="text-gray-500">👤 {ds.owner}</span>
                                )}
                                {ds.field_name && ds.field_name !== data?.name && (
                                    <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                        重命名: {ds.field_name}
                                    </span>
                                )}
                                {/* 新增：显示描述或认证说明 (即用户所谓的"标记") */}
                                {(ds.description || ds.certification_note) && (
                                    <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 truncate max-w-[200px]" title={ds.description || ds.certification_note}>
                                        <Info className="w-3 h-3 text-gray-500" />
                                        {ds.description || ds.certification_note}
                                    </span>
                                )}
                            </div>
                            {/* 第三行：统计信息 */}
                            <div className="flex items-center gap-3 mt-1.5 text-[11px] flex-wrap">
                                {ds.field_count !== undefined && (
                                    <span className="text-gray-500">📦 {ds.field_count}字段</span>
                                )}
                                {ds.metric_count !== undefined && (
                                    <span className="text-gray-500">📈 {ds.metric_count}指标</span>
                                )}
                                {ds.workbook_count !== undefined && (
                                    <span className="text-gray-500">📕 {ds.workbook_count}工作簿</span>
                                )}
                                {ds.usage_count !== undefined && ds.usage_count > 0 && (
                                    <span className="flex items-center gap-0.5 text-orange-600 font-medium">
                                        <Flame className="w-3 h-3" /> {ds.usage_count}次引用
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };



    // ========== 访问统计 Tab ==========

    const loadUsageStats = async () => {
        if (!currentItem) return;
        setUsageLoading(true);
        try {
            // 对于 views 类型，直接获取该视图的统计
            // 对于 workbooks 类型，获取其下所有视图的统计
            if (currentItem.type === 'views') {
                const stats = await api.getViewUsageStats(currentItem.id);
                setUsageStats(stats);
            } else if (currentItem.type === 'workbooks' && data?.views) {
                // 工作簿：汇总所有视图统计 (并行请求每个视图的统计)
                let totalViews = 0;
                let totalDaily = 0;
                let totalWeekly = 0;
                const allHistory: Array<{ count: number; recordedAt: string }> = [];

                const viewStatsPromises = data.views.map((v: any) =>
                    api.getViewUsageStats(v.id).catch(() => null)
                );
                const viewsStats = await Promise.all(viewStatsPromises);

                for (const stats of viewsStats) {
                    if (stats) {
                        totalViews += stats.totalViewCount || 0;
                        totalDaily += stats.dailyDelta || 0;
                        totalWeekly += stats.weeklyDelta || 0;
                    }
                }

                setUsageStats({
                    totalViewCount: totalViews,
                    dailyDelta: totalDaily,
                    weeklyDelta: totalWeekly,
                    history: allHistory.slice(0, 10)
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUsageLoading(false);
        }
    };

    const renderUsageTab = () => {
        if (usageLoading) {
            return <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
        }
        if (!usageStats) {
            return (
                <div className="bg-white rounded-lg border p-4 text-center">
                    <button onClick={loadUsageStats}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-medium transition-colors inline-flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> 加载访问统计
                    </button>
                </div>
            );
        }

        const isUnused = usageStats.totalViewCount === 0;
        const isHot = usageStats.totalViewCount > 100;

        return (
            <div className="space-y-4 animate-in slide-in-up">
                {/* 统计卡片 */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-4 text-center">
                        <div className="text-2xl font-bold text-indigo-700">{usageStats.totalViewCount}</div>
                        <div className="text-[10px] text-gray-500 mt-1">总访问次数</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 p-4 text-center">
                        <div className="text-2xl font-bold text-green-700 flex items-center justify-center gap-1">
                            {usageStats.dailyDelta > 0 && <TrendingUp className="w-4 h-4" />}
                            {usageStats.dailyDelta > 0 ? '+' : ''}{usageStats.dailyDelta}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">今日增量</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg border border-amber-100 p-4 text-center">
                        <div className="text-2xl font-bold text-amber-700 flex items-center justify-center gap-1">
                            {usageStats.weeklyDelta > 0 && <TrendingUp className="w-4 h-4" />}
                            {usageStats.weeklyDelta > 0 ? '+' : ''}{usageStats.weeklyDelta}
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">本周增量</div>
                    </div>
                </div>

                {/* 状态标签 */}
                {isUnused && (
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-600">此视图暂无访问记录，可能未被使用</span>
                    </div>
                )}
                {isHot && (
                    <div className="bg-orange-50 rounded-lg border border-orange-200 p-3 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-orange-700 font-medium">热门视图：访问量超过 100 次</span>
                    </div>
                )}

                {/* 历史趋势 */}
                {usageStats.history.length > 0 && (
                    <div className="bg-gray-50 rounded-lg border p-4">
                        <div className="text-xs font-bold text-gray-700 mb-3">历史记录</div>
                        <div className="space-y-2">
                            {usageStats.history.slice(0, 5).map((h, i) => (
                                <div key={i} className="flex justify-between text-xs">
                                    <span className="text-gray-500">{new Date(h.recordedAt).toLocaleString('zh-CN')}</span>
                                    <span className="font-mono text-gray-700">{h.count} 次</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ========== 概览 Tab 重构 PRO (Description List 风格) ==========
    const renderOverviewTab = () => {
        if (!data) return null;
        const type = currentItem?.type;
        const isFieldType = type === 'fields' || type === 'metrics';
        const isProjectType = type === 'projects';
        const isUserType = type === 'users';
        const createdAt = data.createdAt || data.created_at;
        const updatedAt = data.updatedAt || data.updated_at;

        // 对于视图，从 workbook_info 中提取 owner 和 project_name
        const ownerName = data.owner || data.workbook_info?.owner;
        const projectName = data.projectName || data.project_name || data.workbook_info?.project_name;

        // 获取资产类型显示名
        const getAssetTypeName = () => {
            if (data.dataType) return data.dataType;
            if (data.viewType) return data.viewType === 'dashboard' ? '仪表盘' : '视图';
            return getModuleName(type || '');
        };

        // 计算引用次数 - 根据类型使用不同逻辑
        const getReferenceCount = () => {
            if (data.referenceCount !== undefined) return data.referenceCount;
            if (isProjectType) return (data.stats?.datasource_count || 0) + (data.stats?.workbook_count || 0);
            if (isUserType) return (data.datasources?.length || 0) + (data.workbooks?.length || 0);
            return data.views?.length || data.workbooks?.length || 0;
        };

        // 获取引用次数标签
        const getReferenceLabel = () => {
            if (isProjectType) return '包含资产';
            if (isUserType) return '拥有资产';
            if (isFieldType) return '引用次数';
            if (type === 'datasources') return '关联工作簿';
            if (type === 'workbooks') return '包含视图';
            return '关联资产';
        };

        return (
            <div className="space-y-6 animate-in slide-in-up">
                {/* 项目类型特有的统计卡片 */}
                {isProjectType && data.stats && (
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-4 text-center">
                            <div className="text-2xl font-bold text-blue-700">{data.stats.datasource_count || 0}</div>
                            <div className="text-[10px] text-gray-500 mt-1">数据源</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-100 p-4 text-center">
                            <div className="text-2xl font-bold text-purple-700">{data.stats.workbook_count || 0}</div>
                            <div className="text-[10px] text-gray-500 mt-1">工作簿</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 p-4 text-center">
                            <div className="text-2xl font-bold text-green-700">{data.stats.total_views || 0}</div>
                            <div className="text-[10px] text-gray-500 mt-1">视图</div>
                        </div>
                    </div>
                )}

                {/* 用户类型特有的统计卡片 */}
                {isUserType && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-4 text-center">
                            <div className="text-2xl font-bold text-blue-700">{data.datasources?.length || 0}</div>
                            <div className="text-[10px] text-gray-500 mt-1">拥有的数据源</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-100 p-4 text-center">
                            <div className="text-2xl font-bold text-purple-700">{data.workbooks?.length || 0}</div>
                            <div className="text-[10px] text-gray-500 mt-1">拥有的工作簿</div>
                        </div>
                    </div>
                )}

                {/* 描述信息 - 增加高亮 */}
                {data.description ? (
                    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
                        <div className="text-xs font-bold text-indigo-900 mb-1 flex items-center gap-2">
                            <Info className="w-3.5 h-3.5" /> 业务含义
                            <span data-tooltip="对该资产业务逻辑、使用场景和口径的详细描述">
                                <HelpCircle className="w-2.5 h-2.5 text-indigo-300" />
                            </span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                            {data.description}
                        </p>
                    </div>
                ) : (
                    <div className="bg-orange-50 rounded-lg border border-orange-100 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                        <div>
                            <div className="text-xs font-bold text-orange-800">缺失描述</div>
                            <div className="text-[11px] text-orange-600">此资产缺少业务含义描述，建议尽快补充。</div>
                        </div>
                    </div>
                )}

                {/* 核心属性列表 - Flex 布局，解决 Grid 空洞感 */}
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                        {isProjectType ? '项目信息' : isUserType ? '用户信息' : '基础属性'}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {/* 资产类型 */}
                        <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                            <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                {isUserType ? '站点角色' : '资产类型'}
                                <span data-tooltip="元数据资产的具体分类">
                                    <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                </span>
                            </div>
                            <div className="text-xs font-bold text-gray-800">
                                {isUserType ? (
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${data.site_role?.includes('Admin') ? 'bg-red-50 text-red-700' :
                                        data.site_role?.includes('Creator') ? 'bg-blue-50 text-blue-700' :
                                            'bg-gray-100 text-gray-600'
                                        }`}>
                                        {data.site_role || '-'}
                                    </span>
                                ) : (
                                    <span className="capitalize">{getAssetTypeName()}</span>
                                )}
                            </div>
                        </div>

                        {/* 所有者 - 项目/用户不显示 */}
                        {!isProjectType && !isUserType && ownerName && (
                            <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                    所有者
                                    <span data-tooltip="该资产在 Tableau Server 上的负责人或创建者">
                                        <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5 overflow-hidden">
                                    <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-[8px] flex-shrink-0">
                                        {ownerName.substring(0, 1)}
                                    </div>
                                    <span className="truncate" title={ownerName}>{ownerName}</span>
                                </div>
                            </div>
                        )}

                        {/* 用户邮箱 */}
                        {isUserType && data.email && (
                            <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                <div className="text-[10px] text-gray-400 mb-1 font-medium italic">邮箱</div>
                                <div className="text-xs font-bold text-gray-800 truncate" title={data.email}>{data.email}</div>
                            </div>
                        )}

                        {/* 项目统计 - 字段数/认证率 */}
                        {isProjectType && data.stats && (
                            <>
                                <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                    <div className="text-[10px] text-gray-400 mb-1 font-medium italic">总字段数</div>
                                    <div className="text-xs font-bold text-gray-800">{data.stats.total_fields || 0}</div>
                                </div>
                                <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                    <div className="text-[10px] text-gray-400 mb-1 font-medium italic">认证率</div>
                                    <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                        {data.stats.certified_datasources || 0} 已认证
                                        {(data.stats.certification_rate || 0) > 0 && (
                                            <span className="text-[9px] bg-green-50 text-green-600 px-1 rounded">
                                                {data.stats.certification_rate}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 项目归属 - 仅对有项目属性的资产显示 */}
                        {!isProjectType && !isUserType && projectName && (
                            <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                    项目归属
                                    <span data-tooltip="该资产所属的 Tableau 项目路径">
                                        <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-gray-800 truncate" title={projectName}>
                                    {projectName}
                                </div>
                            </div>
                        )}

                        {/* 引用次数/关联资产 */}
                        <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                            <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                {getReferenceLabel()}
                                <span data-tooltip="该资产被下游引用的总次数或关联的资产数量">
                                    <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                </span>
                            </div>
                            <div className="text-xs font-bold text-gray-800 flex items-center gap-1">
                                {getReferenceCount()}
                                {getReferenceCount() > 5 && <span className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100">🔥 Hot</span>}
                            </div>
                        </div>

                        {createdAt && (
                            <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                    创建时间
                                    <span data-tooltip="该资产首次同步到治理平台的时间">
                                        <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-gray-800">{formatDateWithRelative(createdAt)}</div>
                            </div>
                        )}

                        {updatedAt && (
                            <div className="flex-1 min-w-[140px] bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                    更新时间
                                    <span data-tooltip="该资产最近一次变更（字段、公式或血缘）的时间">
                                        <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                    </span>
                                </div>
                                <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                    <span>{formatDateWithRelative(updatedAt)}</span>
                                    {isRecent(updatedAt) && <span className="text-[9px] px-1 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">近期</span>}
                                </div>
                            </div>
                        )}

                        {data.role && (
                            <div className="w-full bg-gray-50/50 rounded-xl border border-gray-100 p-3 hover:bg-white hover:shadow-sm transition-all duration-300">
                                <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-medium italic">
                                    字段角色
                                    <span data-tooltip="区分该字段是维度（分类）还是度量（数值）">
                                        <HelpCircle className="w-2.5 h-2.5 opacity-50" />
                                    </span>
                                </div>
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${data.role === 'measure' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {data.role === 'measure' ? '度量 (Measure)' : '维度 (Dimension)'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 字段名称层次 - 仅对字段/指标类型显示 */}
                {
                    isFieldType && (
                        <div className="relative pl-3 border-l-2 border-indigo-100 space-y-4 py-1">
                            {data.upstreamColumnName && (
                                <div>
                                    <div className="text-[10px] text-indigo-400 font-mono mb-0.5 flex items-center gap-1">
                                        原始列名
                                        <span data-tooltip="对应底层数据库中的原始物理列名称">
                                            <HelpCircle className="w-2.5 h-2.5" />
                                        </span>
                                    </div>
                                    <div className="text-xs font-mono text-gray-500 bg-gray-50 inline-block px-1.5 py-0.5 rounded border border-gray-100">
                                        {data.upstreamColumnName}
                                    </div>
                                </div>
                            )}
                            {data.fullyQualifiedName && (
                                <div>
                                    <div className="text-[10px] text-indigo-400 font-mono mb-0.5 flex items-center gap-1">
                                        完全限定名
                                        <span data-tooltip="该资产在 Tableau 内部的唯一完全限定路径">
                                            <HelpCircle className="w-2.5 h-2.5" />
                                        </span>
                                    </div>
                                    <div className="text-xs font-mono text-gray-600 break-all leading-tight">
                                        {data.fullyQualifiedName}
                                    </div>
                                </div>
                            )}
                            <div>
                                <div className="text-[10px] text-indigo-400 font-mono mb-0.5 flex items-center gap-1">
                                    显示名称
                                    <span data-tooltip="该资产在报表界面上呈现给用户的别名">
                                        <HelpCircle className="w-2.5 h-2.5" />
                                    </span>
                                </div>
                                <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                    {data.caption || data.name}
                                    {!data.caption && (data.name?.endsWith('...') || data.name?.length === 64) && (
                                        <span className="text-[9px] text-red-500 bg-red-50 px-1 rounded border border-red-100">API截断</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* 计算公式展示 */}
                {
                    data.formula && (
                        <div className="group relative">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 flex items-center gap-1">
                                    计算公式
                                    <span title="Tableau 计算字段的逻辑表达式">
                                        <HelpCircle className="w-2.5 h-2.5" />
                                    </span>
                                </h3>
                                <button
                                    onClick={() => navigator.clipboard.writeText(data.formula || '')}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Copy className="w-3 h-3" /> 复制
                                </button>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-3 font-mono text-xs text-green-400 break-all leading-relaxed shadow-inner">
                                {data.formula}
                            </div>
                            {data.formula?.endsWith('...') && (
                                <div className="mt-2 flex items-start gap-2 text-[11px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                    <span>
                                        <b>公式过长提示：</b> 源数据疑似已被 Tableau API 截断（API限制），请在 Tableau Desktop 中查看完整公式。
                                    </span>
                                </div>
                            )}
                        </div>
                    )
                }
            </div >
        );
    };

    const renderContent = () => {
        if (!data || !currentItem) return null;
        const type = currentItem.type;

        switch (activeTab) {
            case 'overview': return renderOverviewTab();
            case 'duplicates': return renderDuplicatesTab();
            case 'datasources': return renderDatasourcesTab();
            case 'lineage': return renderLineageTab();
            case 'usage': return renderUsageTab();

            // 数据库相关
            case 'tables':
                return renderAssetSection(activeTab === 'tables' ? '包含的数据表' : '来源物理表', Table2, data.tables || [], 'tables', 'blue');

            // 表相关
            case 'db':
                return renderAssetSection('所属数据库', Database, data.database_info ? [data.database_info] : (data.databaseName ? [{ id: data.databaseId, name: data.databaseName }] : []), 'databases', 'blue');
            case 'columns':
                return renderAssetSection('数据库原始列', List, data.columns || [], 'columns', 'gray');

            // 字段/指标相关
            case 'table':
                return renderAssetSection('所属数据表', Table2, data.table_info ? [data.table_info] : [], 'tables', 'blue');
            case 'deps':
                return renderAssetSection('依赖的基础字段', Columns, data.dependencyFields || [], 'fields', 'indigo');
            case 'impact_metrics':
                const impactItems = (data.used_by_metrics || []).map((m: any) => {
                    let sourceInfo = '未知来源';
                    if (m.datasourceName && m.datasourceName !== 'Unknown') {
                        sourceInfo = `数据源: ${m.datasourceName}`;
                    } else if (m.workbookName) {
                        sourceInfo = `工作簿: ${m.workbookName}`;
                    } else if (m.tableName) {
                        sourceInfo = `数据表: ${m.tableName}`;
                    }

                    return {
                        ...m,
                        subtitle: sourceInfo,
                        content: m.description // 只显示描述，不显示公式，因为公式太长影响体验
                    };
                });
                return renderAssetSection('下游受影响的指标', FunctionSquare, impactItems, 'metrics', 'amber');

            // 业务消费端
            case 'views':
                const viewItems = (data.used_in_views || data.usedInViews || data.views || []).map((v: any) => ({
                    ...v,
                    subtitle: v.workbook_name || v.workbookName || v.view_type
                }));
                return renderAssetSection('关联视图/仪表板', Layout, viewItems, 'views', 'green');
            case 'workbooks':
                const wbItems = (data.usedInWorkbooks || data.workbooks || []).map((wb: any) => ({
                    ...wb,
                    subtitle: wb.owner ? `Owner: ${wb.owner}` : (wb.projectName || undefined)
                }));
                return renderAssetSection('引用此资产的工作簿', BookOpen, wbItems, 'workbooks', 'red');
            case 'workbook':
                // Views 模块：所属工作簿（单个）
                return renderAssetSection('所属工作簿', BookOpen, data.workbook_info ? [data.workbook_info] : [], 'workbooks', 'red');

            // 架构容器相关
            case 'datasources':
                return renderAssetSection('关联数据源', Layers, data.datasources || [], 'datasources', 'indigo');
            case 'fields':
                const fieldItems = (data.full_fields || data.used_fields || []).map((f: any) => ({
                    ...f,
                    subtitle: f.role === 'measure' ? '度量' : '维度'
                }));
                return renderAssetSection('包含/使用的字段', Columns, fieldItems, 'fields', 'blue');
            case 'metrics':
                return renderAssetSection('包含/使用的指标', FunctionSquare, data.metrics || data.used_metrics || [], 'metrics', 'amber');

            default: return null;
        }
    };

    // Helper to detect truncated automatic names
    const isTruncated = (text?: string) => text?.endsWith('...') && (text.includes('(') || text.includes('ZN') || text.length === 64);

    // ========== Header 渲染 ==========
    const renderHeader = () => {
        const Icon = currentItem ? getModuleIcon(currentItem.type) : Info;

        // 防止数据滞后：如果 data.id 与 currentItem.id 不一致，视为 stale 数据，不予使用
        const isStale = data?.id !== currentItem?.id;
        const safeData = isStale ? null : data;

        // 使用 currentItem 信息作为兜底，实现立即渲染
        const displayId = safeData?.id || currentItem?.id || '-';
        const displayName = safeData?.name || currentItem?.name || '资产详情';

        const nameIsTruncated = isTruncated(displayName);

        const isCertified = safeData?.is_certified === true;
        // const mockRef = (safeData?.referenceCount || safeData?.views?.length || 0);

        return (
            <div className="bg-white border-b border-gray-100">
                {/* 顶部面包屑 (动态生成) */}
                <div className="px-6 pt-4 flex items-center text-[10px] text-gray-400">
                    <div className="flex items-center overflow-x-auto scrollbar-hide py-1">
                        <span className="flex-shrink-0">Datamap</span>
                        {history.map((item, index) => (
                            <div key={`${item.id}-${index}`} className="flex items-center flex-shrink-0">
                                <ChevronRight className="w-3 h-3 mx-1 flex-shrink-0" />
                                <span
                                    className={`capitalize whitespace-nowrap cursor-pointer transition-colors ${index === history.length - 1 ? 'text-gray-600 font-medium' : 'hover:text-indigo-600 text-gray-400'}`}
                                    onClick={() => index < history.length - 1 && goToIndex(index)}
                                >
                                    {item.name || getModuleName(item.type)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                            <div className={`p-3 rounded-xl shadow-sm border ${isCertified ? 'bg-green-50 border-green-100 text-green-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                <Icon className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 leading-tight mb-2 flex items-center gap-2">
                                    <span className="break-all line-clamp-2" title={displayName}>{displayName}</span>
                                    {nameIsTruncated && (
                                        <span className="flex-shrink-0 text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-normal" title="Tableau API 返回的名称已被截断">
                                            (截断)
                                        </span>
                                    )}
                                </h2>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="group flex items-center gap-1 font-mono text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                        <span className="select-all break-all">{displayId}</span>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(displayId)}
                                            className="text-gray-400 hover:text-indigo-600 transition-colors"
                                            title="复制 ID"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {isCertified && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                            <CheckCircle2 className="w-3 h-3" /> 已认证
                                        </span>
                                    )}
                                    {/* Tableau Server 在线查看链接 - 放在标题旁边 */}
                                    {safeData?.tableau_url && (
                                        <a
                                            href={safeData.tableau_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                            title="在 Tableau Server 中打开"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            在 Tableau 中查看
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 状态 Badges */}
                        <div className="flex flex-col items-end gap-2">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${isCertified ? 'bg-green-50 border-green-100 text-green-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                状态: {isCertified ? '已认证' : '未认证'}
                            </div>
                            {/* 引用数徽章 */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-100 bg-gray-50 text-xs font-medium text-gray-600">
                                <Flame className="w-3.5 h-3.5 text-orange-500" />
                                引用数: {safeData?.referenceCount ?? (safeData?.views?.length || 0)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-6 space-x-6 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-600'
                                : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // 计算当前是否处于"数据滞后"状态
    const isStale = data?.id !== currentItem?.id;
    const showSkeleton = loading || isStale || (isOpen && !data && !error);

    return (
        <>
            <div
                className={`fixed inset-0 bg-gray-900/20 backdrop-blur-[2px] z-40 transition-opacity duration-500 ${isOpen && readyToShow ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={closeDrawer}
            />
            <div
                className={`fixed inset-y-0 right-0 w-[800px] bg-white shadow-2xl z-50 transform transition-transform duration-500 ease-out flex flex-col ${isOpen && readyToShow ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="h-full flex flex-col">

                    {/* Navigation Buttons */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                        {history.length > 1 && (
                            <button
                                onClick={goBack}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-indigo-600 group flex items-center gap-1"
                                title="返回"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-[10px] font-bold pr-1 hidden group-hover:inline">返回</span>
                            </button>
                        )}
                        <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-red-500">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* New Header */}
                    {renderHeader()}

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                        <div className="transition-opacity duration-300 ease-out">
                            {showSkeleton ? (
                                <DetailSkeleton />
                            ) : error ? (
                                <div className="text-center py-20 text-red-500">
                                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <span className="text-sm font-medium">{error}</span>
                                </div>
                            ) : (
                                <div key={currentItem?.id} className="animate-in fade-in duration-300" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
                                    {renderContent()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

