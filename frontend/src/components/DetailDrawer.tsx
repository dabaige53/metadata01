'use client';

import React, { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
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
    HelpCircle
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

    const toggleGroupExpand = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    };

    useEffect(() => {
        if (isOpen && currentItem) {
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
            // Cache update is handled by prefetch, but here we are manual.
            // Note: Our Context 'prefetch' updates cache. We could also update cache here if we exposed setCache, 
            // but for simplicity, allow prefetch to handle pre-loading. 
            // Ideally, we should update cache here too. 
            // Since we can't easily access setCache from here, we rely on prefetch or just local state.
            // Future improvement: expose setCache or updateCache in context.
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
            if (data.tables && data.tables.length > 0) {
                tabs.push({ id: 'tables', label: `数据表 (${data.tables.length})`, icon: Table2 });
            }
        }

        if (type === 'tables') {
            if (data.columns && data.columns.length > 0) {
                tabs.push({ id: 'columns', label: `原始列 (${data.columns.length})`, icon: List });
            }
            if (data.datasources && data.datasources.length > 0) {
                tabs.push({ id: 'datasources', label: `关联数据源 (${data.datasources.length})`, icon: Layers });
            }
        }

        if (type === 'fields' || type === 'metrics') {
            const deps = data.dependencyFields || [];
            // 上游且只有一个：放到概览；多个依赖才单独开 Tab
            if (deps.length > 1) tabs.push({ id: 'deps', label: `依赖字段 (${deps.length})`, icon: Columns });

            const m_down = data.used_by_metrics || [];
            if (m_down.length > 0) tabs.push({ id: 'impact_metrics', label: `影响指标 (${m_down.length})`, icon: FunctionSquare });

            const v_down = data.used_in_views || data.usedInViews || [];
            if (v_down.length > 0) tabs.push({ id: 'views', label: `关联视图 (${v_down.length})`, icon: Layout });

            const wb_down = data.usedInWorkbooks || [];
            if (wb_down.length > 0) tabs.push({ id: 'workbooks', label: `引用工作簿 (${wb_down.length})`, icon: BookOpen });
        }

        if (type === 'datasources') {
            // 上游且只有一个：放到概览；多个上游表才单独开 Tab
            if (data.tables && data.tables.length > 1) {
                tabs.push({ id: 'tables', label: `原始表 (${data.tables.length})`, icon: Table2 });
            }
            if (data.workbooks && data.workbooks.length > 0) {
                tabs.push({ id: 'workbooks', label: `关联工作簿 (${data.workbooks.length})`, icon: BookOpen });
            }
            if (data.full_fields && data.full_fields.length > 0) {
                tabs.push({ id: 'fields', label: `包含字段 (${data.full_fields.length})`, icon: Columns });
            }
            if (data.metrics && data.metrics.length > 0) {
                tabs.push({ id: 'metrics', label: `包含指标 (${data.metrics.length})`, icon: FunctionSquare });
            }
        }

        if (type === 'workbooks') {
            if (data.views && data.views.length > 0) {
                tabs.push({ id: 'views', label: `视图/看板 (${data.views.length})`, icon: Layout });
            }
            // 上游且只有一个：放到概览；多个上游数据源才单独开 Tab
            if (data.datasources && data.datasources.length > 1) {
                tabs.push({ id: 'datasources', label: `使用数据源 (${data.datasources.length})`, icon: Layers });
            }
            if (data.used_fields && data.used_fields.length > 0) {
                tabs.push({ id: 'fields', label: `使用字段 (${data.used_fields.length})`, icon: Columns });
            }
            if (data.used_metrics && data.used_metrics.length > 0) {
                tabs.push({ id: 'metrics', label: `使用指标 (${data.used_metrics.length})`, icon: FunctionSquare });
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

        // 重复指标
        if (data.similarMetrics && data.similarMetrics.length > 0) {
            tabs.push({ id: 'duplicates', label: `重复指标 (${data.similarMetrics.length})`, icon: AlertTriangle });
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
     * 通用的资产列表部分渲染函数
     */
    const renderAssetSection = (title: string, icon: React.ElementType, items: any[], type: string, colorClass: string) => {
        if (!items || items.length === 0) return null;
        const groupKey = `section-${title}`;

        return (
            <div className={`bg-${colorClass}-50/50 rounded-lg border border-${colorClass}-100 p-4 animate-in slide-in-up`}>
                <h3 className={`text-xs font-bold text-${colorClass}-900 mb-3 flex items-center gap-2`}>
                    {icon && React.createElement(icon, { className: `w-3.5 h-3.5 text-${colorClass}-600` })} {title}
                </h3>
                <div className="space-y-1">
                    {(expandedGroups[groupKey] ? items : items.slice(0, 10)).map((asset: any, ai: number) => (
                        <div key={ai}
                            onClick={() => handleAssetClick(asset.id, type, asset.name)}
                            onMouseEnter={() => asset.id && prefetch(asset.id, type)} // 添加预加载触发器
                            style={{ animationDelay: `${ai * 30}ms` }}
                            className={`flex items-center justify-between bg-white p-2 rounded border border-${colorClass}-100 ${asset.id ? 'cursor-pointer hover:border-${colorClass}-300 hover:bg-${colorClass}-50 hover:scale-[1.01] active:scale-[0.99]' : ''} transition-all shadow-sm animate-in fade-in slide-in-up fill-mode-backwards`}>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[13px] text-gray-700 font-medium truncate">{asset.name}</span>
                                {asset.subtitle && <span className="text-[10px] text-gray-400">{asset.subtitle}</span>}
                                {(asset.remote_type || asset.dataType) && (
                                    <span className="text-[10px] font-mono text-gray-400 capitalize">
                                        {asset.remote_type || asset.dataType}
                                    </span>
                                )}
                            </div>
                            {asset.id && <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
                        </div>
                    ))}
                    {items.length > 10 && (
                        <button
                            onClick={() => toggleGroupExpand(groupKey)}
                            className={`text-[10px] text-${colorClass}-600 pl-2 hover:underline cursor-pointer font-medium mt-2`}
                        >
                            {expandedGroups[groupKey] ? '收起' : `显示更多 (+${items.length - 10})`}
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // ========== 重复指标渲染 ==========
    const renderDuplicatesTab = () => {
        const dups = data?.similarMetrics || [];
        if (dups.length === 0) return <div className="text-center text-gray-400 py-8">无重复指标</div>;
        return (
            <div className="bg-red-50 rounded-lg border border-red-100 p-4">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-[13px] font-bold text-red-800 mb-1">发现重复定义的指标</h3>
                        <p className="text-[11px] text-red-600 mb-3">以下 {dups.length} 个指标使用了相同计算公式：</p>
                        <div className="space-y-2">
                            {dups.map((d: any, i: number) => (
                                <div key={i} onClick={() => handleAssetClick(d.id, 'metrics', d.name)}
                                    className="bg-white/80 p-2.5 rounded border border-red-100 cursor-pointer hover:bg-white transition-colors">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-bold text-red-900">{d.name}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-500">数据源: {d.datasourceName || '-'}</div>
                                </div>
                            ))}
                        </div>
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

    // ========== 概览 Tab 重构 PRO (Description List 风格) ==========
    const renderOverviewTab = () => {
        if (!data) return null;
        const isFieldType = currentItem?.type === 'fields' || currentItem?.type === 'metrics';
        const currentType = currentItem?.type;

        // Mock数据策略: 如果后端没返回，通过现有字段计算一些 "假的" 治理状态
        const mockQuality = (data.description ? 90 : 60);
        const mockCertified = data.is_certified === true;
        const mockHotness = (data.referenceCount || data.views?.length || 0) > 5 ? 'High' : 'Normal';

        // 上游：只有一个时，放到概览里展示（减少 Tab 噪音）
        const upstreamOverviewSections: React.ReactNode[] = [];
        if (currentType === 'tables') {
            const dbItem = data.database_info
                ? [{ ...data.database_info, subtitle: data.database_info.connection_type ? `Type: ${data.database_info.connection_type}` : undefined }]
                : (data.databaseName ? [{ id: data.databaseId, name: data.databaseName }] : []);
            if (dbItem.length === 1) {
                upstreamOverviewSections.push(renderAssetSection('所属数据库', Database, dbItem, 'databases', 'blue'));
            }
        }
        if (currentType === 'fields' || currentType === 'metrics') {
            if (data.datasource_info?.id) {
                upstreamOverviewSections.push(
                    renderAssetSection('所属数据源', Layers, [{
                        ...data.datasource_info,
                        subtitle: data.datasource_info.project_name || data.datasource_info.owner || undefined
                    }], 'datasources', 'indigo')
                );
            }

            // 优先使用 table_info；否则（部分字段仅挂在数据源上）用 upstream_tables 单表回退
            if (data.table_info?.id) {
                upstreamOverviewSections.push(
                    renderAssetSection('所属数据表', Table2, [{
                        ...data.table_info,
                        subtitle: [data.table_info.database_name, data.table_info.schema].filter(Boolean).join(' / ') || undefined
                    }], 'tables', 'blue')
                );
            } else if (Array.isArray(data.upstream_tables) && data.upstream_tables.length === 1) {
                const t = data.upstream_tables[0];
                upstreamOverviewSections.push(
                    renderAssetSection('上游数据表', Table2, [{
                        ...t,
                        subtitle: [t.database_name, t.schema].filter(Boolean).join(' / ') || undefined
                    }], 'tables', 'blue')
                );
            }

            // 指标依赖：仅一个时放概览，多个才开 Tab
            if (Array.isArray(data.dependencyFields) && data.dependencyFields.length === 1) {
                upstreamOverviewSections.push(
                    renderAssetSection('依赖字段', Columns, data.dependencyFields, 'fields', 'indigo')
                );
            }
        }
        if (currentType === 'datasources') {
            if (Array.isArray(data.tables) && data.tables.length === 1) {
                const t = data.tables[0];
                upstreamOverviewSections.push(
                    renderAssetSection('上游数据表', Table2, [{
                        ...t,
                        subtitle: [t.database_name || t.databaseName, t.schema].filter(Boolean).join(' / ') || undefined
                    }], 'tables', 'blue')
                );
            }
        }
        if (currentType === 'workbooks') {
            if (Array.isArray(data.datasources) && data.datasources.length === 1) {
                const ds = data.datasources[0];
                upstreamOverviewSections.push(
                    renderAssetSection('上游数据源', Layers, [{
                        ...ds,
                        subtitle: ds.project_name || ds.owner || undefined
                    }], 'datasources', 'indigo')
                );
            }
        }
        if (currentType === 'views') {
            if (data.workbook_info?.id) {
                upstreamOverviewSections.push(
                    renderAssetSection('所属工作簿', BookOpen, [{
                        ...data.workbook_info,
                        subtitle: data.workbook_info.project_name || data.workbook_info.owner || undefined
                    }], 'workbooks', 'red')
                );
            }
        }

        return (
            <div className="space-y-6 animate-in slide-in-up">
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

                {/* 核心属性列表 - Grid 布局 */}
                <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">基础属性</h3>
                    <div className="grid grid-cols-2 gap-px bg-gray-200 rounded-lg border border-gray-200">
                        <div className="bg-white p-3">
                            <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                                资产类型
                                <span data-tooltip="元数据资产的具体分类，如字段、指标、视图等">
                                    <HelpCircle className="w-2.5 h-2.5" />
                                </span>
                            </div>
                            <div className="text-xs font-medium text-gray-800 capitalize">{data.dataType || data.type}</div>
                        </div>
                        <div className="bg-white p-3">
                            <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                                所有者
                                <span data-tooltip="该资产在 Tableau Server 上的负责人或创建者">
                                    <HelpCircle className="w-2.5 h-2.5" />
                                </span>
                            </div>
                            <div className="text-xs font-medium text-gray-800 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                {data.owner || 'Unknown'}
                            </div>
                        </div>
                        <div className="bg-white p-3">
                            <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                                项目归属
                                <span data-tooltip="该资产所属的 Tableau 项目路径">
                                    <HelpCircle className="w-2.5 h-2.5" />
                                </span>
                            </div>
                            <div className="text-xs font-medium text-gray-800 truncate" title={data.projectName || data.project_name}>
                                {data.projectName || data.project_name || '-'}
                            </div>
                        </div>
                        <div className="bg-white p-3">
                            <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                                引用次数
                                <span data-tooltip="该资产被下游视图或指标引用的总次数">
                                    <HelpCircle className="w-2.5 h-2.5" />
                                </span>
                            </div>
                            <div className="text-xs font-medium text-gray-800 flex items-center gap-1">
                                {data.referenceCount !== undefined ? data.referenceCount : (data.views?.length || 0)}
                                {mockHotness === 'High' && <span className="text-[8px] bg-amber-50 text-amber-600 px-1 rounded border border-amber-100">🔥 Hot</span>}
                            </div>
                        </div>
                        {data.role && (
                            <div className="bg-white p-3 col-span-2">
                                <div className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-1">
                                    字段角色
                                    <span data-tooltip="区分该字段是维度（分类）还是度量（数值）">
                                        <HelpCircle className="w-2.5 h-2.5" />
                                    </span>
                                </div>
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${data.role === 'measure' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                                    {data.role === 'measure' ? '度量 (Measure)' : '维度 (Dimension)'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 上游血缘（上游且只有一个时展示在概览） */}
                {upstreamOverviewSections.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">上游血缘</h3>
                        <div className="space-y-3">
                            {upstreamOverviewSections.map((section, idx) => (
                                <React.Fragment key={idx}>{section}</React.Fragment>
                            ))}
                        </div>
                    </div>
                )}

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
                                <div className="text-sm font-bold text-gray-800">{data.caption || data.name}</div>
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
            case 'lineage': return renderLineageTab();

            // 数据库相关
            case 'tables':
                {
                    const title =
                        type === 'databases' ? '包含的数据表' :
                            type === 'datasources' ? '上游数据表' :
                                '关联数据表';
                    return renderAssetSection(title, Table2, data.tables || [], 'tables', 'blue');
                }

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
                return renderAssetSection('下游受影响的指标', FunctionSquare, data.used_by_metrics || [], 'metrics', 'amber');

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

    // ========== Header 渲染 ==========
    const renderHeader = () => {
        const Icon = currentItem ? getModuleIcon(currentItem.type) : Info;

        // 防止数据滞后：如果 data.id 与 currentItem.id 不一致，视为 stale 数据，不予使用
        const isStale = data?.id !== currentItem?.id;
        const safeData = isStale ? null : data;

        // 使用 currentItem 信息作为兜底，实现立即渲染
        const displayId = safeData?.id || currentItem?.id || '-';
        const displayName = safeData?.name || currentItem?.name || '资产详情';

        const mockQuality = (safeData?.description ? 98 : 65);
        const mockCertified = safeData?.is_certified === true;
        const mockRef = (safeData?.referenceCount || safeData?.views?.length || 0);

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
                            <div className={`p-3 rounded-xl shadow-sm border ${mockCertified ? 'bg-green-50 border-green-100 text-green-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                                <Icon className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 leading-tight mb-2">{displayName}</h2>
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
                                    {mockCertified && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-100">
                                            <CheckCircle2 className="w-3 h-3" /> 已认证
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 状态 Badges */}
                        <div className="flex flex-col items-end gap-2">
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${mockQuality >= 80 ? 'bg-green-50 border-green-100 text-green-700' : 'bg-orange-50 border-orange-100 text-orange-700'}`}>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                质量分: {mockQuality}
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-100 bg-gray-50 text-xs font-medium text-gray-600">
                                <Flame className="w-3.5 h-3.5 text-orange-500" />
                                热度: {mockRef > 5 ? 'High' : 'Normal'}
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
            <div className={`fixed inset-y-0 right-0 w-[640px] bg-white shadow-2xl z-50 transform transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] border-l border-gray-100 ${isOpen && readyToShow ? 'translate-x-0' : 'translate-x-full'}`}>
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
