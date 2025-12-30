'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import { formatDateWithRelative, isRecent } from '@/lib/date';
import {
    X,
    Info,
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
    ChevronDown,
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
    upstream_column_name?: string;  // 新增
    upstream_column_info?: any;
    table_info?: any;
    database_info?: any;
    databaseId?: string;
    databaseName?: string;
    // Downstream
    used_by_metrics?: any[];
    used_in_views?: any[];
    usedInViews?: any[];
    used_in_workbooks?: any[];
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
    const { isOpen, closeDrawer, currentItem, history, pushItem, goBack, goToIndex, prefetch, getCachedItem, updateCurrentTab } = useDrawer();
    const activeTab = currentItem?.activeTab || 'overview';
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

    // 影响指标分页加载状态
    const [impactMetrics, setImpactMetrics] = useState<{
        items: any[];
        total: number;
        page: number;
        hasMore: boolean;
        loading: boolean;
    }>({ items: [], total: 0, page: 0, hasMore: false, loading: false });

    // Infinite Scroll State & Observer
    const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const groupKey = (entry.target as HTMLElement).dataset.groupKey;
                    if (groupKey) {
                        setVisibleCounts(prev => ({
                            ...prev,
                            [groupKey]: (prev[groupKey] || 10) + 20
                        }));
                    }
                }
            });
        }, { root: null, rootMargin: '100px', threshold: 0.1 });

        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, []);

    const toggleGroupExpand = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    // 加载更多影响指标
    const loadMoreImpactMetrics = useCallback(async () => {
        if (!currentItem || impactMetrics.loading || !impactMetrics.hasMore) return;

        setImpactMetrics(prev => ({ ...prev, loading: true }));
        try {
            const nextPage = impactMetrics.page + 1;
            const res = await fetch(`/api/metrics/${currentItem.id}/impact-metrics?page=${nextPage}&page_size=50`);
            const result = await res.json();

            setImpactMetrics(prev => ({
                items: [...prev.items, ...result.items],
                total: result.total,
                page: nextPage,
                hasMore: nextPage < result.total_pages,
                loading: false
            }));
        } catch (err) {
            console.error('加载影响指标失败:', err);
            setImpactMetrics(prev => ({ ...prev, loading: false }));
        }
    }, [currentItem, impactMetrics.loading, impactMetrics.hasMore, impactMetrics.page]);

    const loadData = useCallback(async (id: string, type: string, mode?: string) => {
        // 1. 优先使用缓存 (Instant Load)
        const cached = getCachedItem(id, type, mode);
        if (cached) {
            setData(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const result = await api.getDetail(type, id, mode);
            setData(result);
        } catch (err) {
            console.error(err);
            setError('加载失败');
        } finally {
            setLoading(false);
        }
    }, [getCachedItem]);

    useEffect(() => {
        if (isOpen && currentItem) {
            // 兼容性映射：处理单数类型标识符
            if (currentItem.type === 'field') currentItem.type = 'fields';
            if (currentItem.type === 'metric') currentItem.type = 'metrics';

            // 1. 如果 ID 变化，检查缓存或重置数据
            if (data && data.id !== currentItem.id) {
                const cached = getCachedItem(currentItem.id, currentItem.type, currentItem.mode);
                if (cached) {
                    setData(cached);
                } else {
                    setData(null);
                }
                return; // 等待下一次渲染 (数据更新后)
            }

            // 2. 如果数据已加载且匹配，停止处理 (防止死循环)
            if (data && data.id === currentItem.id) {
                if (!readyToShow) setReadyToShow(true);
                return;
            }

            // 3. 开始加载新数据 (此时 data 为 null)
            setTimeout(() => setReadyToShow(true), 50);
            loadData(currentItem.id, currentItem.type, currentItem.mode);
            setLineageData(null);
            setUsageStats(null); // 重置访问统计
            setImpactMetrics({ items: [], total: 0, page: 0, hasMore: false, loading: false }); // 重置影响指标
        } else {
            setData(null);
            setReadyToShow(false);
        }
    }, [currentItem, data, getCachedItem, isOpen, loadData, readyToShow, setImpactMetrics]);

    // 当数据加载完成后，初始化影响指标状态
    useEffect(() => {
        if (data && (currentItem?.type === 'metrics' || currentItem?.type === 'fields')) {
            const initialItems = data.used_by_metrics || [];
            const totalCount = data.impact_metric_count ?? initialItems.length;
            setImpactMetrics({
                items: initialItems,
                total: totalCount,
                page: 1,
                hasMore: initialItems.length < totalCount,
                loading: false
            });
        }
    }, [data, currentItem?.type]);

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

    const handleAssetClick = (id: string | undefined, type: string, name?: string, mode?: string) => {
        if (!id) return;
        pushItem(id, type, name, mode);
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
            // 关联数据源 - 按嵌入式/非嵌入式拆分为两个Tab
            const dsList = data.datasources || [];
            const publishedDs = dsList.filter((ds: any) => !ds.is_embedded);
            const embeddedDs = dsList.filter((ds: any) => ds.is_embedded);

            if (publishedDs.length > 0) {
                tabs.push({ id: 'datasources', label: `数据源 (${publishedDs.length})`, icon: Layers });
            }
            if (embeddedDs.length > 0) {
                tabs.push({ id: 'embedded_datasources', label: `嵌入式数据源 (${embeddedDs.length})`, icon: Copy });
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
            // 所属数据表 - 始终显示
            tabs.push({ id: 'table', label: '所属数据表', icon: Table2 });

            // 依赖字段 - 仅对计算字段/指标显示
            const deps = data.dependencyFields || data.formula_references || [];
            if (data.isCalculated || data.formula) {
                tabs.push({ id: 'deps', label: `依赖字段 (${deps.length})`, icon: Columns });
            }

            // 所属数据源 - 按嵌入式/已发布拆分
            const allDs = data.all_datasources || data.related_datasources || [];
            const fldPublishedDs = allDs.filter((ds: any) => !ds.is_embedded);
            const fldEmbeddedDs = allDs.filter((ds: any) => ds.is_embedded);

            // 如果 allDs 为空，尝试从单条 datasource_info 补充
            const hasDirectDs = data.datasource_info;
            const isDirectDsEmbedded = data.datasource_info?.is_embedded;

            if (fldPublishedDs.length > 0 || (hasDirectDs && !isDirectDsEmbedded)) {
                const pubCount = fldPublishedDs.length > 0 ? fldPublishedDs.length : 1;
                tabs.push({ id: 'datasources', label: `数据源 (${pubCount})`, icon: Layers });
            }
            if (fldEmbeddedDs.length > 0 || (hasDirectDs && isDirectDsEmbedded)) {
                const embCount = fldEmbeddedDs.length > 0 ? fldEmbeddedDs.length : 1;
                tabs.push({ id: 'embedded_datasources', label: `嵌入式数据源 (${embCount})`, icon: Copy });
            }

            // 影响指标 - 始终显示（仅对普通字段有意义，计算字段一般不被其他指标引用）
            const m_down = data.used_by_metrics || [];
            // 优先使用预计算的总数，否则使用当前加载的数量
            const impactCount = data.impact_metric_count ?? m_down.length;
            tabs.push({ id: 'impact_metrics', label: `影响指标 (${impactCount})`, icon: FunctionSquare });

            // 关联视图 - 始终显示
            const v_down = data.used_in_views || data.usedInViews || [];
            tabs.push({ id: 'views', label: `关联视图 (${v_down.length})`, icon: Layout });

            // 引用工作簿 - 合并所有工作簿来源（优先使用有数据的字段，空数组不算有效）
            const allWbSources = [
                data.all_workbooks,
                data.usedInWorkbooks,
                data.used_in_workbooks,
                data.workbooks
            ];
            const allWb = allWbSources.find(arr => arr && arr.length > 0) || [];
            tabs.push({ id: 'workbooks', label: `引用工作簿 (${allWb.length})`, icon: BookOpen });
        }

        if (type === 'datasources') {
            // 原始表 - 按嵌入式/非嵌入式拆分为两个Tab
            const tablesList = data.tables || [];
            const physicalTables = tablesList.filter((t: any) => !t.is_embedded);
            const embeddedTables = tablesList.filter((t: any) => t.is_embedded);

            if (physicalTables.length > 0) {
                tabs.push({ id: 'tables', label: `数据表 (${physicalTables.length})`, icon: Table2 });
            }
            if (embeddedTables.length > 0) {
                tabs.push({ id: 'embedded_tables', label: `嵌入式表 (${embeddedTables.length})`, icon: Copy });
            }
            // 原始列 - 只有有列时才显示
            if (data.columns && data.columns.length > 0) {
                tabs.push({ id: 'columns', label: `原始列 (${data.columns.length})`, icon: List });
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
            // 嵌入式副本 Tab - 针对已发布数据源
            if (data.embedded_datasources && data.embedded_datasources.length > 0) {
                tabs.push({ id: 'embedded', label: `嵌入式副本 (${data.embedded_datasources.length})`, icon: Copy });
            }
        }

        if (type === 'workbooks') {
            // 视图/看板 - 只有有视图时才显示
            if (data.views && data.views.length > 0) {
                tabs.push({ id: 'views', label: `视图/看板 (${data.views.length})`, icon: Layout });
            }
            // 使用数据源 - 按嵌入式/已发布拆分
            const wbDsList = data.datasources || [];
            const wbPublishedDs = wbDsList.filter((ds: any) => !ds.is_embedded);
            const wbEmbeddedDs = wbDsList.filter((ds: any) => ds.is_embedded);

            if (wbPublishedDs.length > 0) {
                tabs.push({ id: 'datasources', label: `数据源 (${wbPublishedDs.length})`, icon: Layers });
            }
            if (wbEmbeddedDs.length > 0) {
                tabs.push({ id: 'embedded_datasources', label: `嵌入式数据源 (${wbEmbeddedDs.length})`, icon: Copy });
            }

            // 关联数据表 - 按物理/嵌入式拆分
            const wbTablesList = data.tables || [];
            const wbPhysicalTables = wbTablesList.filter((t: any) => !t.is_embedded);
            const wbEmbeddedTables = wbTablesList.filter((t: any) => t.is_embedded);

            if (wbPhysicalTables.length > 0) {
                tabs.push({ id: 'tables', label: `数据表 (${wbPhysicalTables.length})`, icon: Table2 });
            }
            if (wbEmbeddedTables.length > 0) {
                tabs.push({ id: 'embedded_tables', label: `嵌入式表 (${wbEmbeddedTables.length})`, icon: Copy });
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

            // 包含的视图 (Dashboard only)
            if (data.contained_views && data.contained_views.length > 0) {
                tabs.push({ id: 'contained_views', label: `包含视图 (${data.contained_views.length})`, icon: Layout });
            }
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

        // 同定义指标实例 - 只在 metrics 模块显示，且有多个实例时才显示
        if (type === 'metrics' && data.instances && data.instances.length > 1) {
            tabs.push({ id: 'instances', label: `同定义指标 (${data.instances.length})`, icon: Copy });
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
     * @param mode - 可选，用于计算字段区分聚合/实例模式
     */
    const renderAssetSection = (title: string, icon: React.ElementType, items: any[], type: string, colorClass: string, mode?: string) => {
        // 空数据时显示友好提示
        if (!items || items.length === 0) {
            return (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
                    <div className="text-gray-400 text-sm">暂无{title}数据</div>
                </div>
            );
        }
        const groupKey = `section-${title}`;
        const limit = visibleCounts[groupKey] || 10;
        const visibleItems = items.slice(0, limit);
        const hasMore = items.length > limit;

        return (
            <div className={`bg-${colorClass}-50/50 rounded-lg border border-${colorClass}-100 p-3 animate-in slide-in-up`}>
                <h3 className={`text-xs font-bold text-${colorClass}-900 mb-2 flex items-center gap-2`}>
                    {icon && React.createElement(icon, { className: `w-3.5 h-3.5 text-${colorClass}-600` })} {title}
                </h3>
                <div className="space-y-1">
                    {visibleItems.map((asset: any, ai: number) => (
                        <div key={ai}
                            onClick={() => handleAssetClick(asset.id, type, asset.name, mode)}
                            onMouseEnter={() => asset.id && prefetch(asset.id, type, mode)}
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
                                    {!!asset.is_certified && (
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
                                        &quot;{asset.description.length > 25 ? asset.description.slice(0, 25) + '...' : asset.description}&quot;
                                    </span>
                                )}
                            </div>
                        </div>

                    ))}
                    {hasMore && (
                        <div
                            data-group-key={groupKey}
                            ref={el => { if (el && observerRef.current) observerRef.current.observe(el) }}
                            className="h-8 w-full flex items-center justify-center py-2"
                        >
                            <Loader2 className={`w-4 h-4 text-${colorClass}-400 animate-spin opacity-50`} />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    /**
     * 按原始列分组的字段渲染函数
     * 用于数据表详情页的"包含字段"Tab
     * 第一层：按原始列分组
     * 第二层：按字段名聚合，显示来源数据源统计
     * 超过50个分组时默认全部折叠
     */
    const renderFieldsGroupedByColumn = (fields: any[]) => {
        if (!fields || fields.length === 0) {
            return (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
                    <div className="text-gray-400 text-sm">暂无字段数据</div>
                </div>
            );
        }

        // 第一层：按原始列分组
        const groupedByColumn: Record<string, any[]> = {};
        fields.forEach(f => {
            const columnName = f.upstreamColumnName || f.upstream_column_name || '未关联原始列';
            if (!groupedByColumn[columnName]) {
                groupedByColumn[columnName] = [];
            }
            groupedByColumn[columnName].push(f);
        });

        const columnNames = Object.keys(groupedByColumn).sort((a, b) => {
            if (a === '未关联原始列') return 1;
            if (b === '未关联原始列') return -1;
            return a.localeCompare(b);
        });

        const shouldDefaultCollapse = columnNames.length > 50;

        // Infinite Scroll Logic
        const groupKey = 'group-fields-by-column';
        const limit = visibleCounts[groupKey] || 10;
        const visibleColumnNames = columnNames.slice(0, limit);
        const hasMore = columnNames.length > limit;

        // 对分组内字段按名称聚合的辅助函数
        const aggregateFieldsByName = (groupFields: any[]) => {
            const byName: Record<string, {
                name: string;
                role: string;
                dataType: string;
                fields: any[];
                sources: Map<string, number>;  // 数据源名 -> 次数
            }> = {};

            groupFields.forEach(f => {
                const fieldName = f.name || '未命名';
                if (!byName[fieldName]) {
                    byName[fieldName] = {
                        name: fieldName,
                        role: f.role || '',
                        dataType: f.dataType || f.remote_type || '',
                        fields: [],
                        sources: new Map()
                    };
                }
                byName[fieldName].fields.push(f);

                // 统计来源数据源
                const sourceName = f.via_datasource || f.datasourceName || f.datasource_name || '未知数据源';
                byName[fieldName].sources.set(
                    sourceName,
                    (byName[fieldName].sources.get(sourceName) || 0) + 1
                );
            });

            return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name));
        };

        return (
            <div className="space-y-2">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-blue-900 flex items-center gap-2">
                        <Columns className="w-3.5 h-3.5 text-blue-600" />
                        包含字段 (共 {fields.length} 个实例，按 {columnNames.length} 个原始列分组)
                    </h3>
                    {shouldDefaultCollapse && (
                        <span className="text-[10px] text-gray-400">
                            超过50个分组，默认全部折叠
                        </span>
                    )}
                </div>

                {/* 分组列表 */}
                {visibleColumnNames.map((columnName, gi) => {
                    const columnFields = groupedByColumn[columnName];
                    const aggregatedFields = aggregateFieldsByName(columnFields);
                    const groupKey = `field-group-${columnName}`;
                    const isExpanded = expandedGroups[groupKey] ?? !shouldDefaultCollapse;

                    return (
                        <div
                            key={gi}
                            className="bg-blue-50/50 rounded-lg border border-blue-100 overflow-hidden"
                            style={{ animationDelay: `${gi * 20}ms` }}
                        >
                            {/* 分组标题（可点击展开/折叠） */}
                            <button
                                onClick={() => toggleGroupExpand(groupKey)}
                                className="w-full px-3 py-2 flex items-center justify-between bg-blue-50 hover:bg-blue-100/70 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <List className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                    <span className="text-[13px] font-bold text-gray-900 truncate">
                                        {columnName}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium flex-shrink-0">
                                        {aggregatedFields.length} 种字段 · {columnFields.length} 个实例
                                    </span>
                                    {columnName === '未关联原始列' && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                                            计算字段/派生字段
                                        </span>
                                    )}
                                </div>
                                <ChevronDown
                                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                />
                            </button>

                            {/* 分组内容 - 聚合后的字段列表 */}
                            {isExpanded && (
                                <div className="p-2 space-y-1">
                                    {aggregatedFields.map((agg, ai) => {
                                        const subGroupKey = `${groupKey}-${agg.name}`;
                                        const isSubExpanded = expandedGroups[subGroupKey] ?? false;
                                        const sourceList = Array.from(agg.sources.entries())
                                            .sort((a, b) => b[1] - a[1])  // 按数量降序
                                            .slice(0, 3);  // 只显示前3个来源

                                        return (
                                            <div key={ai} className="bg-white rounded border border-blue-100">
                                                {/* 聚合字段主行 */}
                                                <div
                                                    className="p-2 hover:bg-blue-50/50 transition-all cursor-pointer"
                                                    onClick={() => {
                                                        // 如果只有一个实例，直接跳转；否则展开子列表
                                                        if (agg.fields.length === 1) {
                                                            handleAssetClick(agg.fields[0].id, 'fields', agg.name);
                                                        } else {
                                                            toggleGroupExpand(subGroupKey);
                                                        }
                                                    }}
                                                >
                                                    {/* 第一行：字段名 + 标签 */}
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <span className="text-[12px] text-gray-900 font-medium truncate">
                                                                {agg.name}
                                                            </span>
                                                            {agg.role && (
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${agg.role === 'measure' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} flex-shrink-0`}>
                                                                    {agg.role === 'measure' ? '度量' : '维度'}
                                                                </span>
                                                            )}
                                                            {agg.dataType && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono flex-shrink-0">
                                                                    {agg.dataType}
                                                                </span>
                                                            )}
                                                            {agg.fields.length > 1 && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium flex-shrink-0">
                                                                    {agg.fields.length} 个来源
                                                                </span>
                                                            )}
                                                        </div>
                                                        {agg.fields.length === 1 ? (
                                                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                                        ) : (
                                                            <ChevronDown
                                                                className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isSubExpanded ? 'rotate-0' : '-rotate-90'}`}
                                                            />
                                                        )}
                                                    </div>
                                                    {/* 第二行：来源数据源统计 */}
                                                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500 flex-wrap">
                                                        {sourceList.map(([sourceName, count], si) => (
                                                            <span key={si} className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                <Layers className="w-3 h-3 text-indigo-500" />
                                                                <span className="truncate max-w-[100px]">{sourceName}</span>
                                                                {count > 1 && <span className="text-indigo-600 font-medium">×{count}</span>}
                                                            </span>
                                                        ))}
                                                        {agg.sources.size > 3 && (
                                                            <span className="text-gray-400">
                                                                +{agg.sources.size - 3} 个其他来源
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 子列表：展开显示所有实例 */}
                                                {isSubExpanded && agg.fields.length > 1 && (
                                                    <div className="border-t border-blue-100 bg-gray-50/50 p-2 space-y-1">
                                                        {agg.fields.map((field: any, fi: number) => (
                                                            <div
                                                                key={fi}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAssetClick(field.id, 'fields', field.name);
                                                                }}
                                                                onMouseEnter={() => field.id && prefetch(field.id, 'fields')}
                                                                className="bg-white p-2 rounded border border-gray-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-all text-[11px]"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                            <Layers className="w-3 h-3 text-indigo-500" />
                                                                            {field.via_datasource || field.datasourceName || field.datasource_name || '未知数据源'}
                                                                        </span>
                                                                        {field.workbook_name && (
                                                                            <span className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded">
                                                                                <BookOpen className="w-3 h-3 text-rose-500" />
                                                                                {field.workbook_name}
                                                                            </span>
                                                                        )}
                                                                        {field.is_certified && (
                                                                            <span className="flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                                                                                <ShieldCheck className="w-3 h-3" /> 认证
                                                                            </span>
                                                                        )}
                                                                        {!field.description && (
                                                                            <span className="flex items-center gap-0.5 text-amber-600">
                                                                                <AlertTriangle className="w-3 h-3" /> 无描述
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {hasMore && (
                    <div
                        data-group-key={groupKey}
                        ref={el => { if (el && observerRef.current) observerRef.current.observe(el) }}
                        className="h-8 w-full flex items-center justify-center py-2 bg-gray-50 rounded-lg border border-gray-100 border-dashed"
                    >
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin opacity-50" />
                    </div>
                )}
            </div>
        );
    };


    /**
     * 按上游表分组的字段渲染函数
     * 用于数据源详情页的"包含字段"Tab
     * 第一层：按上游表分组
     * 第二层：按原始列分组
     * 第三层：字段列表
     */
    const renderFieldsGroupedByTable = (fields: any[]) => {
        if (!fields || fields.length === 0) {
            return (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
                    <div className="text-gray-400 text-sm">暂无字段数据</div>
                </div>
            );
        }

        // 第一层：按上游表分组
        const groupedByTable: Record<string, any[]> = {};
        fields.forEach(f => {
            const tableName = f.upstream_table_name || '未关联数据表';
            if (!groupedByTable[tableName]) {
                groupedByTable[tableName] = [];
            }
            groupedByTable[tableName].push(f);
        });

        const tableNames = Object.keys(groupedByTable).sort((a, b) => {
            if (a === '未关联数据表') return 1;
            if (b === '未关联数据表') return -1;
            return a.localeCompare(b);
        });

        const shouldDefaultCollapse = tableNames.length > 10;

        // Infinite Scroll Logic
        const groupKey = 'group-fields-by-table';
        const limit = visibleCounts[groupKey] || 10;
        const visibleTableNames = tableNames.slice(0, limit);
        const hasMore = tableNames.length > limit;

        // 表内按原始列分组的辅助函数
        const groupByColumn = (tableFields: any[]) => {
            const grouped: Record<string, any[]> = {};
            tableFields.forEach(f => {
                const colName = f.upstream_column_name || '未关联原始列';
                if (!grouped[colName]) {
                    grouped[colName] = [];
                }
                grouped[colName].push(f);
            });
            return grouped;
        };

        // 按字段名聚合的辅助函数（合并重复字段，记录来源）
        const aggregateByFieldName = (colFields: any[]) => {
            const byName: Record<string, {
                name: string;
                role: string;
                dataType: string;
                fields: any[];
                sources: { workbook?: string; datasource?: string; isEmbedded?: boolean; id: string }[];
            }> = {};

            colFields.forEach(f => {
                const fieldName = f.name || '未命名';
                if (!byName[fieldName]) {
                    byName[fieldName] = {
                        name: fieldName,
                        role: f.role || '',
                        dataType: f.data_type || '',
                        fields: [],
                        sources: []
                    };
                }
                byName[fieldName].fields.push(f);
                byName[fieldName].sources.push({
                    workbook: f.workbook_name,
                    datasource: f.datasource_name,
                    isEmbedded: f.is_embedded_ds,
                    id: f.id
                });
            });

            return Object.values(byName).sort((a, b) => a.name.localeCompare(b.name));
        };

        return (
            <div className="space-y-2">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-blue-900 flex items-center gap-2">
                        <Columns className="w-3.5 h-3.5 text-blue-600" />
                        包含字段 (共 {fields.length} 个字段，按 {tableNames.length} 个数据表分组)
                    </h3>
                    {shouldDefaultCollapse && (
                        <span className="text-[10px] text-gray-400">
                            超过10个表，默认全部折叠
                        </span>
                    )}
                </div>

                {/* 第一层：表分组列表 */}
                {visibleTableNames.map((tableName, gi) => {
                    const tableFields = groupedByTable[tableName];
                    const tableGroupKey = `field-table-${tableName}`;
                    const isTableExpanded = expandedGroups[tableGroupKey] ?? !shouldDefaultCollapse;

                    // 表内按原始列分组
                    const columnGroups = groupByColumn(tableFields);
                    const columnNames = Object.keys(columnGroups).sort((a, b) => {
                        if (a === '未关联原始列') return 1;
                        if (b === '未关联原始列') return -1;
                        return a.localeCompare(b);
                    });
                    const shouldCollapseColumns = columnNames.length > 20;

                    return (
                        <div
                            key={gi}
                            className="bg-blue-50/50 rounded-lg border border-blue-100 overflow-hidden"
                            style={{ animationDelay: `${gi * 20}ms` }}
                        >
                            {/* 表分组标题 */}
                            <button
                                onClick={() => toggleGroupExpand(tableGroupKey)}
                                className="w-full px-3 py-2 flex items-center justify-between bg-blue-50 hover:bg-blue-100/70 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Table2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                    <span className="text-[13px] font-bold text-gray-900 truncate">
                                        {tableName}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium flex-shrink-0">
                                        {tableFields.length} 个字段
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium flex-shrink-0">
                                        {columnNames.length} 个原始列
                                    </span>
                                    {tableName === '未关联数据表' && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                                            计算字段/派生字段
                                        </span>
                                    )}
                                </div>
                                <ChevronDown
                                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isTableExpanded ? 'rotate-0' : '-rotate-90'}`}
                                />
                            </button>

                            {/* 表内内容：按原始列分组 */}
                            {isTableExpanded && (
                                <div className="p-2 space-y-1">
                                    {/* 第二层：原始列分组 */}
                                    {columnNames.map((colName, ci) => {
                                        const colFields = columnGroups[colName];
                                        const colGroupKey = `${tableGroupKey}-col-${colName}`;
                                        const isColExpanded = expandedGroups[colGroupKey] ?? !shouldCollapseColumns;

                                        return (
                                            <div
                                                key={ci}
                                                className="bg-white rounded border border-blue-100 overflow-hidden"
                                            >
                                                {/* 原始列标题 */}
                                                <button
                                                    onClick={() => toggleGroupExpand(colGroupKey)}
                                                    className="w-full px-2.5 py-1.5 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <List className="w-3 h-3 text-violet-500 flex-shrink-0" />
                                                        <span className="text-[12px] font-medium text-gray-800 truncate">
                                                            {colName}
                                                        </span>
                                                        <span className="text-[9px] px-1 py-0.5 rounded bg-gray-200 text-gray-600 font-medium flex-shrink-0">
                                                            {colFields.length} 个字段
                                                        </span>
                                                        {colName === '未关联原始列' && (
                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                                                                计算/派生
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronDown
                                                        className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isColExpanded ? 'rotate-0' : '-rotate-90'}`}
                                                    />
                                                </button>

                                                {/* 字段列表（按字段名聚合） */}
                                                {isColExpanded && (
                                                    <div className="p-1.5 space-y-0.5 bg-gray-50/50">
                                                        {aggregateByFieldName(colFields).map((agg, ai) => {
                                                            const subGroupKey = `${colGroupKey}-field-${agg.name}`;
                                                            const isSubExpanded = expandedGroups[subGroupKey] ?? false;
                                                            // 去重的来源列表
                                                            const uniqueSources = agg.sources.reduce((acc: any[], s) => {
                                                                const key = s.workbook || s.datasource || 'unknown';
                                                                if (!acc.find(x => (x.workbook || x.datasource) === key)) {
                                                                    acc.push(s);
                                                                }
                                                                return acc;
                                                            }, []);

                                                            return (
                                                                <div key={ai} className="bg-white rounded border border-gray-100">
                                                                    {/* 聚合字段主行 */}
                                                                    <div
                                                                        className="px-2 py-1.5 cursor-pointer hover:bg-blue-50/50 transition-all"
                                                                        onClick={() => {
                                                                            if (agg.fields.length === 1) {
                                                                                handleAssetClick(agg.fields[0].id, 'fields', agg.name);
                                                                            } else {
                                                                                toggleGroupExpand(subGroupKey);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                                                                                <span className="text-[11px] text-gray-900 font-medium truncate">
                                                                                    {agg.name}
                                                                                </span>
                                                                                {agg.role && (
                                                                                    <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${agg.role === 'measure' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} flex-shrink-0`}>
                                                                                        {agg.role === 'measure' ? '度量' : '维度'}
                                                                                    </span>
                                                                                )}
                                                                                {agg.dataType && (
                                                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 font-mono flex-shrink-0">
                                                                                        {agg.dataType}
                                                                                    </span>
                                                                                )}
                                                                                {agg.fields.length > 1 && (
                                                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-medium flex-shrink-0">
                                                                                        {agg.fields.length} 个来源
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {agg.fields.length === 1 ? (
                                                                                <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                                                            ) : (
                                                                                <ChevronDown className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isSubExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                                            )}
                                                                        </div>
                                                                        {/* 来源预览 */}
                                                                        {uniqueSources.length > 0 && (
                                                                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                                                {uniqueSources.slice(0, 3).map((src, si) => (
                                                                                    <span key={si} className={`text-[8px] px-1 py-0.5 rounded ${src.isEmbedded ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'}`}>
                                                                                        {src.isEmbedded ? '📦' : '📕'} {src.workbook || src.datasource || '未知'}
                                                                                    </span>
                                                                                ))}
                                                                                {uniqueSources.length > 3 && (
                                                                                    <span className="text-[8px] text-gray-400">+{uniqueSources.length - 3}</span>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* 展开：显示所有来源实例 */}
                                                                    {isSubExpanded && agg.fields.length > 1 && (
                                                                        <div className="border-t border-gray-100 bg-gray-50/50 p-1 space-y-0.5">
                                                                            {agg.fields.map((field: any, fi: number) => (
                                                                                <div
                                                                                    key={fi}
                                                                                    onClick={(e) => { e.stopPropagation(); handleAssetClick(field.id, 'fields', field.name); }}
                                                                                    className="bg-white px-2 py-1 rounded border border-gray-100 cursor-pointer hover:border-blue-300 text-[10px] flex items-center gap-2"
                                                                                >
                                                                                    {field.workbook_name && (
                                                                                        <span className="flex items-center gap-0.5 bg-rose-50 px-1 py-0.5 rounded text-rose-600">
                                                                                            <BookOpen className="w-2.5 h-2.5" /> {field.workbook_name}
                                                                                        </span>
                                                                                    )}
                                                                                    {field.is_embedded_ds && field.datasource_name && (
                                                                                        <span className="flex items-center gap-0.5 bg-purple-50 px-1 py-0.5 rounded text-purple-600">
                                                                                            <Layers className="w-2.5 h-2.5" /> {field.datasource_name}
                                                                                        </span>
                                                                                    )}
                                                                                    <ChevronRight className="w-2.5 h-2.5 text-gray-400 ml-auto" />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
                {hasMore && (
                    <div
                        data-group-key={groupKey}
                        ref={el => { if (el && observerRef.current) observerRef.current.observe(el) }}
                        className="h-8 w-full flex items-center justify-center py-2 bg-gray-50 rounded-lg border border-blue-100 border-dashed"
                    >
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin opacity-50" />
                    </div>
                )}
            </div>
        );
    };


    /**
     * 按上游表分组的原始列渲染函数
     * 用于数据源详情页的"原始列"Tab
     */
    const renderColumnsGroupedByTable = (columns: any[]) => {
        if (!columns || columns.length === 0) {
            return (
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 text-center">
                    <div className="text-gray-400 text-sm">暂无原始列数据</div>
                </div>
            );
        }

        // 按表分组
        const groupedByTable: Record<string, any[]> = {};
        columns.forEach(col => {
            const tableName = col.table_name || '未知表';
            if (!groupedByTable[tableName]) {
                groupedByTable[tableName] = [];
            }
            groupedByTable[tableName].push(col);
        });

        const tableNames = Object.keys(groupedByTable).sort();
        const shouldDefaultCollapse = tableNames.length > 20;

        // Infinite Scroll Logic
        const groupKey = 'group-columns-by-table';
        const limit = visibleCounts[groupKey] || 10;
        const visibleTableNames = tableNames.slice(0, limit);
        return (
            <div className="space-y-2">
                {/* 标题栏 */}
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                        <List className="w-3.5 h-3.5 text-gray-500" />
                        原始列 (共 {columns.length} 列，来自 {tableNames.length} 个数据表)
                    </h3>
                </div>

                {/* 分组列表 */}
                {visibleTableNames.map((tableName, gi) => {
                    const tableColumns = groupedByTable[tableName];
                    const groupKey = `column-table-group-${tableName}`;
                    const isExpanded = expandedGroups[groupKey] ?? !shouldDefaultCollapse;

                    return (
                        <div
                            key={gi}
                            className="bg-gray-50/50 rounded-lg border border-gray-200 overflow-hidden"
                        >
                            {/* 分组标题 */}
                            <button
                                onClick={() => toggleGroupExpand(groupKey)}
                                className="w-full px-3 py-2 flex items-center justify-between bg-gray-100 hover:bg-gray-200/70 transition-colors text-left"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Table2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                                    <span className="text-[13px] font-bold text-gray-900 truncate">
                                        {tableName}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-medium flex-shrink-0">
                                        {tableColumns.length} 列
                                    </span>
                                </div>
                                <ChevronDown
                                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                />
                            </button>

                            {/* 列列表 */}
                            {isExpanded && (
                                <div className="p-2 space-y-1">
                                    {tableColumns.map((col: any, ci: number) => (
                                        <div
                                            key={ci}
                                            className="bg-white p-2 rounded border border-gray-100 hover:border-gray-300 transition-all"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-[12px] text-gray-900 font-medium">
                                                    {col.name}
                                                </span>
                                                {col.remote_type && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono flex-shrink-0">
                                                        {col.remote_type}
                                                    </span>
                                                )}
                                                {col.is_nullable === false && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium flex-shrink-0">
                                                        NOT NULL
                                                    </span>
                                                )}
                                            </div>
                                            {col.description && (
                                                <div className="text-[10px] text-gray-500 mt-1 truncate">
                                                    {col.description}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
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


    // ========== 同定义指标实例渲染 ==========
    const renderInstancesTab = () => {
        const instances = data?.instances || [];
        if (instances.length === 0) return <div className="text-center text-gray-400 py-8">无同定义指标实例</div>;

        // 计算总计
        const totalUsage = instances.reduce((sum: number, inst: any) => sum + (inst.usageCount || 0), 0);

        return (
            <div className="space-y-3">
                {/* 统计卡片 */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100 p-3">
                    <h3 className="text-[13px] font-bold text-purple-800 mb-2 flex items-center gap-2">
                        <Copy className="w-4 h-4 text-purple-600" />
                        同定义指标实例 <span className="text-purple-500 font-normal text-[11px]">(共 {instances.length} 个副本)</span>
                    </h3>
                    <div className="flex items-center gap-4 text-[11px]">
                        <div className="flex items-center gap-1.5">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-gray-600">总引用次数:</span>
                            <span className="font-bold text-orange-600">{totalUsage}</span>
                        </div>
                    </div>
                </div>

                {/* 实例列表 */}
                <div className="bg-purple-50/50 rounded-lg border border-purple-100 p-3">
                    <div className="space-y-2">
                        {instances.map((inst: any, i: number) => (
                            <div key={inst.id}
                                onClick={() => handleAssetClick(inst.id, 'metrics', inst.name, 'instance')}
                                style={{ animationDelay: `${i * 30}ms` }}
                                className="bg-white p-2.5 rounded border border-purple-100 cursor-pointer hover:border-purple-300 hover:bg-purple-50 transition-all shadow-sm animate-in fade-in slide-in-up fill-mode-backwards">
                                {/* 第一行：名称 + 使用状态 */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="text-[13px] font-bold text-purple-900 truncate">{inst.name}</span>
                                        {inst.usageCount > 0 ? (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium flex-shrink-0">
                                                使用中
                                            </span>
                                        ) : (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0">
                                                未使用
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                </div>

                                {/* 第二行：来源路径 */}
                                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-600 flex-wrap">
                                    {/* 数据源 */}
                                    <span className="flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded">
                                        <Layers className="w-3 h-3 text-indigo-500" />
                                        <span className="truncate max-w-[150px] font-medium">{inst.datasourceName}</span>
                                    </span>
                                    {inst.datasourceProject && (
                                        <span className="text-[10px] text-gray-400">({inst.datasourceProject})</span>
                                    )}

                                    {/* 工作簿 */}
                                    {inst.workbookName && (
                                        <>
                                            <span className="text-gray-400">→</span>
                                            <span className="flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded">
                                                <BookOpen className="w-3 h-3 text-rose-500" />
                                                <span className="truncate max-w-[120px] font-medium">{inst.workbookName}</span>
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* 第三行：统计指标 */}
                                <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                                    <span className="flex items-center gap-0.5 text-orange-600 font-medium">
                                        <Flame className="w-3 h-3" /> {inst.usageCount || 0}个视图
                                    </span>
                                    {inst.referenceCount > 0 && (
                                        <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                                            <GitBranch className="w-3 h-3" /> {inst.referenceCount}次依赖
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
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
        // 血缘标签映射
        const sourceLabels: Record<string, { text: string; color: string }> = {
            'api': { text: 'API 直返', color: 'bg-blue-100 text-blue-700' },
            'derived': { text: '智能重连', color: 'bg-amber-100 text-amber-700' },
            'computed': { text: '预计算', color: 'bg-purple-100 text-purple-700' }
        };
        const penetrationLabels: Record<string, { text: string; color: string }> = {
            'success': { text: '穿透成功', color: 'bg-green-100 text-green-700' },
            'failed': { text: '穿透失败', color: 'bg-red-100 text-red-700' },
            'not_applicable': { text: '无需穿透', color: 'bg-gray-100 text-gray-600' }
        };

        return (
            <div className="space-y-4">
                {/* 血缘标签信息 */}
                {lineageData.labels && (lineageData.labels.lineage_source || lineageData.labels.penetration_status) && (
                    <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                        <span className="text-[11px] text-gray-500 font-medium">血缘来源:</span>
                        {lineageData.labels.lineage_source && (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${sourceLabels[lineageData.labels.lineage_source]?.color || 'bg-gray-100 text-gray-600'}`}>
                                {sourceLabels[lineageData.labels.lineage_source]?.text || lineageData.labels.lineage_source}
                            </span>
                        )}
                        {lineageData.labels.penetration_status && lineageData.labels.penetration_status !== 'not_applicable' && (
                            <>
                                <span className="text-gray-300">|</span>
                                <span className="text-[11px] text-gray-500 font-medium">穿透状态:</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${penetrationLabels[lineageData.labels.penetration_status]?.color || 'bg-gray-100 text-gray-600'}`}>
                                    {penetrationLabels[lineageData.labels.penetration_status]?.text || lineageData.labels.penetration_status}
                                </span>
                            </>
                        )}
                    </div>
                )}
                <div className="bg-gray-50 rounded-lg border p-4 overflow-auto">
                    <div className="text-xs font-bold text-gray-700 mb-2">Mermaid 血缘图</div>
                    <pre className="text-[10px] font-mono bg-white p-2 rounded border overflow-x-auto">{lineageData.mermaid}</pre>
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
                setUsageStats({
                    ...stats,
                    history: stats.history || []
                });
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

        const history = usageStats.history || [];
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
                {history.length > 0 && (
                    <div className="bg-gray-50 rounded-lg border p-4">
                        <div className="text-xs font-bold text-gray-700 mb-3">历史记录</div>
                        <div className="space-y-2">
                            {history.slice(0, 5).map((h, i) => (
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

    const getReferenceCount = () => {
        if (!data) return 0;
        const type = currentItem?.type;

        // 各类型使用明确的字段，不做回退
        if (type === 'metrics') return data.usageCount || 0;
        if (type === 'fields') return data.usageCount || 0;
        if (type === 'projects') return (data.stats?.datasource_count || 0) + (data.stats?.workbook_count || 0);
        if (type === 'users') return (data.datasources?.length || 0) + (data.workbooks?.length || 0);
        if (type === 'tables') return data.stats?.workbook_count || 0;
        if (type === 'datasources') return data.stats?.workbook_count || 0;
        if (type === 'views') return data.totalViewCount || 0;
        return 0;
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

        // 获取引用次数标签
        const getReferenceLabel = () => {
            if (isProjectType) return '包含资产';
            if (isUserType) return '拥有资产';
            if (isFieldType) return '引用次数';
            if (type === 'datasources') return '关联工作簿';
            if (type === 'workbooks') return '包含视图';
            if (type === 'views') return '访问热度';  // 视图使用访问热度，而非引用数
            return '关联资产';
        };

        return (
            <div className="space-y-6 animate-in slide-in-up">
                {/* 统计指标卡片 (Grid) - 强制 4 列布局解决挤压展示不全问题 */}
                {data.stats && (
                    <div className="grid grid-cols-4 gap-3 bg-white/50 p-1 rounded-xl">
                        {type === 'projects' && (
                            <>
                                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-3 text-center">
                                    <div className="text-xl font-bold text-blue-700">{data.stats.datasource_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">数据源</div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-100 p-3 text-center">
                                    <div className="text-xl font-bold text-purple-700">{data.stats.workbook_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">工作簿</div>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 p-3 text-center">
                                    <div className="text-xl font-bold text-green-700">{data.stats.total_views || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">视图</div>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-3 text-center">
                                    <div className="text-xl font-bold text-indigo-700">{data.stats.total_fields || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">字段</div>
                                </div>
                            </>
                        )}

                        {type === 'tables' && (
                            <>
                                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-3 text-center">
                                    <div className="text-xl font-bold text-blue-700">{data.stats.column_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">原始列</div>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-3 text-center">
                                    <div className="text-xl font-bold text-indigo-700">{data.stats.field_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">包含字段</div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-100 p-3 text-center">
                                    <div className="text-xl font-bold text-purple-700">{data.stats.datasource_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">关联数据源</div>
                                </div>
                                <div className="bg-gradient-to-br from-red-50 to-white rounded-lg border border-red-100 p-3 text-center">
                                    <div className="text-xl font-bold text-red-700">{data.stats.workbook_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">引用工作簿</div>
                                </div>
                            </>
                        )}

                        {type === 'datasources' && (
                            <>
                                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-3 text-center">
                                    <div className="text-xl font-bold text-blue-700">{data.stats.table_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">包含数据表</div>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-3 text-center">
                                    <div className="text-xl font-bold text-indigo-700">{data.stats.field_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">字段数</div>
                                </div>
                                <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg border border-amber-100 p-3 text-center">
                                    <div className="text-xl font-bold text-amber-700">{data.stats.metric_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">计算指标</div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-white rounded-lg border border-purple-100 p-3 text-center">
                                    <div className="text-xl font-bold text-purple-700">{data.stats.workbook_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">关联工作簿</div>
                                </div>
                            </>
                        )}

                        {type === 'workbooks' && (
                            <>
                                <div className="bg-gradient-to-br from-green-50 to-white rounded-lg border border-green-100 p-3 text-center">
                                    <div className="text-xl font-bold text-green-700">{data.stats.view_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">包含视图</div>
                                </div>
                                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border border-indigo-100 p-3 text-center">
                                    <div className="text-xl font-bold text-indigo-700">{data.stats.field_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">使用字段</div>
                                </div>
                                <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg border border-amber-100 p-3 text-center">
                                    <div className="text-xl font-bold text-amber-700">{data.stats.metric_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">使用指标</div>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border border-blue-100 p-3 text-center">
                                    <div className="text-xl font-bold text-blue-700">{data.stats.datasource_count || 0}</div>
                                    <div className="text-[10px] text-gray-500 mt-1">上游数据源</div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* 用户类型特有的统计卡片 (兜底) */}
                {isUserType && !data.stats && (
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

                {/* ========== 血缘标签信息卡片 ========== */}
                {(data.lineage_source || data.lineageSource || data.penetration_status || data.penetrationStatus) && (
                    <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 rounded-lg border border-blue-100 p-4">
                        <div className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <GitBranch className="w-3.5 h-3.5 text-purple-600" />
                            血缘标签
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {/* 血缘来源 */}
                            {(data.lineage_source || data.lineageSource) && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">来源方式:</span>
                                    <span className={`text-[10px] px-2 py-1 rounded font-medium ${(data.lineage_source || data.lineageSource) === 'api' ? 'bg-blue-100 text-blue-700' :
                                        (data.lineage_source || data.lineageSource) === 'derived' ? 'bg-amber-100 text-amber-700' :
                                            'bg-purple-100 text-purple-700'
                                        }`}>
                                        {(data.lineage_source || data.lineageSource) === 'api' ? '🔗 API 直接返回' :
                                            (data.lineage_source || data.lineageSource) === 'derived' ? '🔄 智能重连推导' :
                                                '📊 预计算存储'}
                                    </span>
                                </div>
                            )}
                            {/* 穿透状态 */}
                            {(data.penetration_status || data.penetrationStatus) && (data.penetration_status || data.penetrationStatus) !== 'not_applicable' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">穿透状态:</span>
                                    <span className={`text-[10px] px-2 py-1 rounded font-medium ${(data.penetration_status || data.penetrationStatus) === 'success' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                        }`}>
                                        {(data.penetration_status || data.penetrationStatus) === 'success' ? '✅ 穿透成功' : '❌ 穿透失败'}
                                    </span>
                                </div>
                            )}
                            {/* 无需穿透时显示物理表标识 */}
                            {(data.penetration_status || data.penetrationStatus) === 'not_applicable' && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500">表类型:</span>
                                    <span className="text-[10px] px-2 py-1 rounded font-medium bg-gray-100 text-gray-600">
                                        📋 物理表 (无需穿透)
                                    </span>
                                </div>
                            )}
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
                            {data.upstream_column_name && (
                                <div>
                                    <div className="text-[10px] text-indigo-400 font-mono mb-0.5 flex items-center gap-1">
                                        原始列名
                                        <span data-tooltip="对应底层数据库中的原始物理列名称">
                                            <HelpCircle className="w-2.5 h-2.5" />
                                        </span>
                                    </div>
                                    <div className="text-xs font-mono text-gray-500 bg-gray-50 inline-block px-1.5 py-0.5 rounded border border-gray-100">
                                        {data.upstream_column_name}
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
        switch (activeTab) {
            case 'overview': return renderOverviewTab();
            case 'duplicates': return renderDuplicatesTab();
            case 'instances': return renderInstancesTab();
            case 'lineage': return renderLineageTab();
            case 'usage': return renderUsageTab();

            // 数据库相关
            case 'tables': {
                const physicalTables = (data.tables || []).filter((t: any) => !t.is_embedded);
                return renderAssetSection('数据表', Table2, physicalTables, 'tables', 'blue');
            }
            case 'embedded_tables': {
                const embeddedTables = (data.tables || []).filter((t: any) => t.is_embedded);
                return renderAssetSection('嵌入式表', Copy, embeddedTables, 'tables', 'purple');
            }

            // 表相关
            case 'db':
                return renderAssetSection('所属数据库', Database, data.database_info ? [data.database_info] : (data.databaseName ? [{ id: data.databaseId, name: data.databaseName }] : []), 'databases', 'blue');
            case 'columns': {
                const columnsData = data.columns || [];
                // 数据源详情页：按表分组显示原始列
                if (currentItem?.type === 'datasources' && columnsData.length > 0) {
                    return renderColumnsGroupedByTable(columnsData);
                }
                // 数据表详情页：直接列表显示
                return renderAssetSection('数据库原始列', List, columnsData, 'columns', 'gray');
            }

            // 字段/指标相关
            case 'table':
                // 优先显示直接物理表，其次显示通过血缘穿透获得的关联表
                const directTable = data.table_info ? [data.table_info] : [];
                const derivedTables = data.derived_tables || data.derivedTables || [];
                const tablesToShow = directTable.length > 0 ? directTable : derivedTables;
                const tableLabel = directTable.length > 0 ? '所属数据表' : '关联数据表 (血缘穿透)';
                return renderAssetSection(tableLabel, Table2, tablesToShow, 'tables', 'blue');
            case 'deps':
                return renderAssetSection('依赖的基础字段', Columns, data.dependencyFields || [], 'fields', 'indigo');
            case 'impact_metrics': {
                // 使用分页状态中的数据
                const impactItems = impactMetrics.items.map((m: any) => {
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

                return (
                    <div className="space-y-3">
                        {renderAssetSection('下游受影响的指标', FunctionSquare, impactItems, 'metrics', 'amber', 'instance')}

                        {/* 加载更多按钮 */}
                        {impactMetrics.hasMore && (
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={loadMoreImpactMetrics}
                                    disabled={impactMetrics.loading}
                                    className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors disabled:opacity-50"
                                >
                                    {impactMetrics.loading ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            加载中...
                                        </span>
                                    ) : (
                                        `加载更多 (${impactMetrics.items.length}/${impactMetrics.total})`
                                    )}
                                </button>
                            </div>
                        )}

                        {/* 已全部加载提示 */}
                        {!impactMetrics.hasMore && impactMetrics.total > 0 && impactMetrics.items.length >= impactMetrics.total && (
                            <div className="text-center text-xs text-gray-400 pt-2">
                                已加载全部 {impactMetrics.total} 个影响指标
                            </div>
                        )}
                    </div>
                );
            }
            // 业务消费端
            case 'views':
                const viewItems = (data.used_in_views || data.usedInViews || data.views || []).map((v: any) => ({
                    ...v,
                    subtitle: v.workbook_name || v.workbookName || v.view_type
                }));
                return renderAssetSection('关联视图/仪表板', Layout, viewItems, 'views', 'green');
            case 'contained_views':
                return renderAssetSection('包含的工作表', Layout, data.contained_views || [], 'views', 'indigo');
            case 'workbooks':
                // 统一工作簿来源优先级（与 Tab 标签保持一致）
                const wbSources = [
                    data.all_workbooks,
                    data.usedInWorkbooks,
                    data.used_in_workbooks,
                    data.workbooks
                ];
                const wbData = wbSources.find(arr => arr && arr.length > 0) || [];
                const wbItems = wbData.map((wb: any) => ({
                    ...wb,
                    subtitle: wb.is_defining_workbook
                        ? `✏️ 定义于此工作簿${wb.owner ? ` · ${wb.owner}` : ''}`
                        : (wb.owner ? `使用于 · ${wb.owner}` : (wb.projectName || undefined))
                }));
                return renderAssetSection('引用此资产的工作簿', BookOpen, wbItems, 'workbooks', 'red');
            case 'workbook':
                // Views 模块：所属工作簿（单个）
                return renderAssetSection('所属工作簿', BookOpen, data.workbook_info ? [data.workbook_info] : [], 'workbooks', 'red');

            // 架构容器相关
            case 'datasources': {
                const pubDsItems = (data.datasources || data.all_datasources || data.related_datasources || []).filter((ds: any) => !ds.is_embedded);
                // 兜底单体 datasource_info
                const items = pubDsItems.length > 0 ? pubDsItems : (data.datasource_info && !data.datasource_info.is_embedded ? [data.datasource_info] : []);
                return renderAssetSection('数据源', Layers, items, 'datasources', 'indigo');
            }
            case 'embedded_datasources': {
                const embDsItems = (data.datasources || data.all_datasources || data.related_datasources || []).filter((ds: any) => ds.is_embedded);
                // 兜底单体 datasource_info
                const items = embDsItems.length > 0 ? embDsItems : (data.datasource_info && data.datasource_info.is_embedded ? [data.datasource_info] : []);
                return renderAssetSection('嵌入式数据源', Copy, items, 'datasources', 'purple');
            }
            case 'fields': {
                const fieldItems = data.full_fields || data.used_fields || [];
                // 数据表详情页使用按原始列分组的渲染方式
                if (currentItem?.type === 'tables' && data.full_fields) {
                    return renderFieldsGroupedByColumn(fieldItems);
                }
                // 数据源详情页使用按上游表分组的渲染方式
                if (currentItem?.type === 'datasources' && data.full_fields) {
                    return renderFieldsGroupedByTable(fieldItems);
                }
                // 其他类型（视图等）使用原有的列表展示
                const mappedFields = fieldItems.map((f: any) => ({
                    ...f,
                    subtitle: f.role === 'measure' ? '度量' : '维度'
                }));
                return renderAssetSection('包含/使用的字段', Columns, mappedFields, 'fields', 'blue');
            }
            case 'metrics': {
                // 从工作簿/视图/数据源详情点击计算字段时，使用实例模式
                const metricsMode = ['workbooks', 'views', 'datasources'].includes(currentItem?.type || '') ? 'instance' : undefined;
                return renderAssetSection('包含/使用的指标', FunctionSquare, data.metrics || data.used_metrics || [], 'metrics', 'amber', metricsMode);
            }
            case 'embedded': {
                const embItems = (data?.embedded_datasources || []).map((ds: any) => ({
                    ...ds,
                    subtitle: ds.workbook?.name ? `位于: ${ds.workbook.name}` : undefined
                }));
                return renderAssetSection('以此为源的嵌入式数据源', Copy, embItems, 'datasources', 'blue');
            }

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
        let displayName = safeData?.name || currentItem?.name || '资产详情';
        let displaySubtitle = '';

        // 针对字段：优先显示物理列名，显示别名作为副标题
        if (safeData && (currentItem?.type === 'fields' || data?.type === 'fields')) {
            const upstreamName = safeData.upstream_column_info?.name || safeData.upstream_column_name;
            if (upstreamName && upstreamName !== displayName) {
                displaySubtitle = `别名: ${displayName}`;
                displayName = upstreamName;
            }
        }

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
                                <h2 className="text-xl font-bold text-gray-900 leading-tight mb-1 flex items-center gap-2">
                                    <span className="break-all line-clamp-2" title={displayName}>{displayName}</span>
                                    {nameIsTruncated && (
                                        <span className="flex-shrink-0 text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded font-normal" title="Tableau API 返回的名称已被截断">
                                            (截断)
                                        </span>
                                    )}
                                </h2>
                                {displaySubtitle && (
                                    <div className="text-sm text-gray-500 mb-2 font-medium">
                                        {displaySubtitle}
                                    </div>
                                )}
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
                                    {currentItem?.type === 'views' && (
                                        <a
                                            href="/views/demo"
                                            className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                            title="查看视图详情介绍示例"
                                        >
                                            详情介绍
                                        </a>
                                    )}
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
                            {/* 引用数/访问热度徽章 - 视图显示访问热度，其他显示引用数 */}
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-100 bg-gray-50 text-xs font-medium text-gray-600">
                                <Flame className="w-3.5 h-3.5 text-orange-500" />
                                {currentItem?.type === 'views' ? '访问热度' : '引用数'}: {getReferenceCount()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex px-6 space-x-6 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => updateCurrentTab(tab.id)}
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

