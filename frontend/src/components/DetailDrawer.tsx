'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import { api } from '@/lib/api';
import {
    X,
    Info,
    ArrowUpCircle,
    ArrowDownCircle,
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
    User
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
    stats?: any;
    // 上游资产
    upstream_column_info?: any;
    table_info?: any;
    database_info?: any;
    upstream_tables?: any[];
    dependencyFields?: any[];
    tables?: any[];
    connected_tables?: any[];
    databaseId?: string;
    databaseName?: string;
    // 下游资产
    used_by_metrics?: any[];
    used_in_views?: any[];
    usedInViews?: any[];
    usedInWorkbooks?: any[];
    workbooks?: any[];
    full_fields?: any[];
    metrics?: any[];
    columns?: any[];
    datasources?: any[];
    datasource_info?: any;
    workbook_info?: any;
    views?: any[];
    used_fields?: any[];
    used_metrics?: any[];
    // 重复指标
    similarMetrics?: any[];
    [key: string]: any;
}

interface AssetGroup {
    type: string;
    icon: React.ElementType;
    label: string;
    items: Array<{ id?: string; name: string; subtitle?: string }>;
}

export default function DetailDrawer() {
    const { isOpen, closeDrawer, currentItem, openDrawer } = useDrawer();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DetailItem | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lineageData, setLineageData] = useState<any>(null);
    const [lineageLoading, setLineageLoading] = useState(false);

    useEffect(() => {
        if (isOpen && currentItem) {
            loadData(currentItem.id, currentItem.type);
            setActiveTab('overview');
            setLineageData(null);
        } else {
            setData(null);
        }
    }, [isOpen, currentItem]);

    const loadData = async (id: string, type: string) => {
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

    const handleAssetClick = (id: string | undefined, type: string) => {
        if (!id) return;
        openDrawer(id, type);
    };

    if (!isOpen) return null;

    const tabs = [
        { id: 'overview', label: '概览', icon: Info },
        { id: 'upstream', label: '上游资产', icon: ArrowUpCircle },
        { id: 'downstream', label: '下游资产', icon: ArrowDownCircle },
    ];

    if (data?.similarMetrics && data.similarMetrics.length > 0) {
        tabs.push({ id: 'duplicates', label: `重复指标 (${data.similarMetrics.length})`, icon: AlertTriangle });
    }

    if (currentItem && ['fields', 'metrics', 'datasources', 'tables'].includes(currentItem.type)) {
        tabs.push({ id: 'lineage', label: '血缘图', icon: GitBranch });
    }

    const getModuleName = (type: string) => {
        const names: Record<string, string> = {
            databases: '数据库', tables: '数据表', fields: '字段', metrics: '指标',
            datasources: '数据源', workbooks: '工作簿', projects: '项目', users: '用户', views: '视图'
        };
        return names[type] || type;
    };

    // ========== 渲染上游资产 ==========
    const renderUpstreamTab = () => {
        if (!data || !currentItem) return <div className="text-center text-gray-400 py-8">无上游资产</div>;
        const upstreamItems: AssetGroup[] = [];
        const type = currentItem.type;

        // 字段的上游: 表、原始列
        if (type === 'fields') {
            if (data.table_info) {
                upstreamItems.push({
                    type: 'tables', icon: Table2, label: '所属数据表',
                    items: [{ id: data.table_info.id, name: data.table_info.name, subtitle: data.table_info.schema || undefined }]
                });
            }
            if (data.upstream_column_info) {
                upstreamItems.push({
                    type: 'columns', icon: List, label: '原始数据库列',
                    items: [{ name: data.upstream_column_info.name, subtitle: data.upstream_column_info.remote_type }]
                });
            }
        }

        // 指标的上游: 依赖字段
        if (type === 'metrics') {
            const deps = data.dependencyFields || [];
            if (deps.length) {
                upstreamItems.push({
                    type: 'fields', icon: Columns, label: '依赖的字段',
                    items: deps.map((d: any) => ({ id: d.id, name: d.name, subtitle: d.role === 'measure' ? '度量' : '维度' }))
                });
            }
        }

        // 数据源的上游: 表
        if (type === 'datasources') {
            const tables = data.tables || data.connected_tables || [];
            if (tables.length) {
                upstreamItems.push({
                    type: 'tables', icon: Table2, label: '连接的数据表',
                    items: tables.map((t: any) => typeof t === 'string' ? { name: t } : { id: t.id, name: t.name, subtitle: t.database_name || t.schema })
                });
            }
        }

        // 表的上游: 数据库
        if (type === 'tables') {
            if (data.database_info) {
                upstreamItems.push({
                    type: 'databases', icon: Database, label: '所属数据库',
                    items: [{ id: data.database_info.id, name: data.database_info.name, subtitle: data.database_info.connection_type }]
                });
            } else if (data.databaseId || data.databaseName) {
                upstreamItems.push({
                    type: 'databases', icon: Database, label: '所属数据库',
                    items: [{ id: data.databaseId, name: data.databaseName || '-' }]
                });
            }
        }

        if (upstreamItems.length === 0) return <div className="text-center text-gray-400 py-8">无上游资产</div>;

        return (
            <div className="bg-blue-50 rounded-lg border border-blue-100 p-4">
                <h3 className="text-xs font-bold text-blue-900 mb-3 flex items-center gap-2">
                    <ArrowUpCircle className="w-3.5 h-3.5 text-blue-600" /> 上游资产 (数据来源)
                </h3>
                <div className="space-y-3">
                    {upstreamItems.map((group, gi) => (
                        <div key={gi}>
                            <div className="text-[10px] text-blue-600 font-medium mb-1.5 flex items-center gap-1">
                                <group.icon className="w-3 h-3" /> {group.label}
                            </div>
                            <div className="space-y-1">
                                {group.items.slice(0, 5).map((asset, ai) => (
                                    <div key={ai} onClick={() => handleAssetClick(asset.id, group.type)}
                                        className={`flex items-center justify-between bg-white p-2 rounded border border-blue-100 ${asset.id ? 'cursor-pointer hover:border-blue-300' : ''} transition-colors`}>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs text-gray-700 font-medium truncate">{asset.name}</span>
                                            {asset.subtitle && <span className="text-[10px] text-gray-400">{asset.subtitle}</span>}
                                        </div>
                                        {asset.id && <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                    </div>
                                ))}
                                {group.items.length > 5 && <div className="text-[10px] text-blue-500 pl-2">+{group.items.length - 5} 更多...</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ========== 渲染下游资产 ==========
    const renderDownstreamTab = () => {
        if (!data || !currentItem) return <div className="text-center text-gray-400 py-8">无下游资产</div>;
        const downstreamItems: AssetGroup[] = [];
        const type = currentItem.type;

        // 字段的下游: 指标、视图
        if (type === 'fields') {
            const metrics = data.used_by_metrics || [];
            if (metrics.length) {
                downstreamItems.push({ type: 'metrics', icon: FunctionSquare, label: '使用此字段的指标', items: metrics.map((m: any) => ({ id: m.id, name: m.name })) });
            }
            const views = data.used_in_views || [];
            if (views.length) {
                downstreamItems.push({ type: 'views', icon: Layout, label: '使用此字段的视图', items: views.map((v: any) => ({ id: v.id, name: v.name, subtitle: v.workbook_name || v.workbookName })) });
            }
        }

        // 指标的下游: 视图、工作簿
        if (type === 'metrics') {
            const views = data.usedInViews || [];
            if (views.length) {
                downstreamItems.push({ type: 'views', icon: Layout, label: '使用此指标的视图', items: views.map((v: any) => ({ id: v.id, name: v.name, subtitle: v.workbook_name || v.workbookName })) });
            }
            const workbooks = data.usedInWorkbooks || [];
            if (workbooks.length) {
                downstreamItems.push({ type: 'workbooks', icon: BookOpen, label: '使用此指标的工作簿', items: workbooks.map((wb: any) => ({ id: wb.id, name: wb.name, subtitle: wb.owner ? `Owner: ${wb.owner}` : undefined })) });
            }
        }

        // 数据源的下游: 工作簿、字段、指标
        if (type === 'datasources') {
            const workbooks = data.workbooks || [];
            if (workbooks.length) {
                downstreamItems.push({ type: 'workbooks', icon: BookOpen, label: '使用此数据源的工作簿', items: workbooks.map((wb: any) => ({ id: wb.id, name: wb.name, subtitle: wb.owner ? `Owner: ${wb.owner}` : undefined })) });
            }
            const fields = data.full_fields || [];
            if (fields.length) {
                downstreamItems.push({ type: 'fields', icon: Columns, label: '包含的字段', items: fields.slice(0, 10).map((f: any) => ({ id: f.id, name: f.name, subtitle: f.role === 'measure' ? '度量' : '维度' })) });
            }
            const metrics = data.metrics || [];
            if (metrics.length) {
                downstreamItems.push({ type: 'metrics', icon: FunctionSquare, label: '包含的指标', items: metrics.slice(0, 10).map((m: any) => ({ id: m.id, name: m.name })) });
            }
        }

        // 表的下游: 数据源、列、字段
        if (type === 'tables') {
            const columns = data.columns || [];
            if (columns.length) {
                downstreamItems.push({ type: 'columns', icon: List, label: '原始数据库列', items: columns.slice(0, 10).map((c: any) => ({ name: c.name, subtitle: c.remote_type })) });
            }
            const datasources = data.datasources || [];
            if (datasources.length) {
                downstreamItems.push({ type: 'datasources', icon: Layers, label: '使用此表的数据源', items: datasources.map((ds: any) => ({ id: ds.id, name: ds.name })) });
            }
        }

        // 工作簿的下游: 视图、字段、指标
        if (type === 'workbooks') {
            const views = data.views || [];
            if (views.length) {
                downstreamItems.push({ type: 'views', icon: Layout, label: '包含的视图', items: views.map((v: any) => ({ id: v.id, name: v.name, subtitle: v.view_type })) });
            }
            const usedFields = data.used_fields || [];
            if (usedFields.length) {
                downstreamItems.push({ type: 'fields', icon: Columns, label: '使用的字段', items: usedFields.slice(0, 10).map((f: any) => ({ id: f.id, name: f.name })) });
            }
            const usedMetrics = data.used_metrics || [];
            if (usedMetrics.length) {
                downstreamItems.push({ type: 'metrics', icon: FunctionSquare, label: '使用的指标', items: usedMetrics.slice(0, 10).map((m: any) => ({ id: m.id, name: m.name })) });
            }
        }

        // 项目的下游: 数据源、工作簿
        if (type === 'projects') {
            const datasources = data.datasources || [];
            if (datasources.length) {
                downstreamItems.push({ type: 'datasources', icon: Layers, label: '项目内数据源', items: datasources.map((ds: any) => ({ id: ds.id, name: ds.name, subtitle: ds.is_certified ? '✓ 已认证' : `${ds.field_count || 0} 字段` })) });
            }
            const workbooks = data.workbooks || [];
            if (workbooks.length) {
                downstreamItems.push({ type: 'workbooks', icon: BookOpen, label: '项目内工作簿', items: workbooks.map((wb: any) => ({ id: wb.id, name: wb.name, subtitle: `${wb.view_count || 0} 视图` })) });
            }
        }

        // 用户的下游: 数据源、工作簿
        if (type === 'users') {
            const datasources = data.datasources || [];
            if (datasources.length) {
                downstreamItems.push({ type: 'datasources', icon: Layers, label: '拥有的数据源', items: datasources.map((ds: any) => ({ id: ds.id, name: ds.name })) });
            }
            const workbooks = data.workbooks || [];
            if (workbooks.length) {
                downstreamItems.push({ type: 'workbooks', icon: BookOpen, label: '拥有的工作簿', items: workbooks.map((wb: any) => ({ id: wb.id, name: wb.name })) });
            }
        }

        if (downstreamItems.length === 0) return <div className="text-center text-gray-400 py-8">无下游资产</div>;

        return (
            <div className="bg-green-50 rounded-lg border border-green-100 p-4">
                <h3 className="text-xs font-bold text-green-900 mb-3 flex items-center gap-2">
                    <ArrowDownCircle className="w-3.5 h-3.5 text-green-600" /> 下游资产 (被谁使用)
                </h3>
                <div className="space-y-3">
                    {downstreamItems.map((group, gi) => (
                        <div key={gi}>
                            <div className="text-[10px] text-green-600 font-medium mb-1.5 flex items-center gap-1">
                                <group.icon className="w-3 h-3" /> {group.label} ({group.items.length})
                            </div>
                            <div className="space-y-1">
                                {group.items.slice(0, 5).map((asset, ai) => (
                                    <div key={ai} onClick={() => handleAssetClick(asset.id, group.type)}
                                        className={`flex items-center justify-between bg-white p-2 rounded border border-green-100 ${asset.id ? 'cursor-pointer hover:border-green-300' : ''} transition-colors`}>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-xs text-gray-700 font-medium truncate">{asset.name}</span>
                                            {asset.subtitle && <span className="text-[10px] text-gray-400">{asset.subtitle}</span>}
                                        </div>
                                        {asset.id && <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                                    </div>
                                ))}
                                {group.items.length > 5 && <div className="text-[10px] text-green-500 pl-2">+{group.items.length - 5} 更多...</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ========== 渲染重复指标 ==========
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
                        <div className="space-y-3">
                            {dups.map((d: any, i: number) => {
                                const views = d.usedInViews || [];
                                const workbooks = d.usedInWorkbooks || [];
                                return (
                                    <div key={i} onClick={() => handleAssetClick(d.id, 'metrics')}
                                        className="bg-white/80 p-3 rounded border border-red-100 cursor-pointer hover:bg-white transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-red-900">{d.name}</span>
                                            <span className="text-[10px] text-red-400 bg-red-100 px-1.5 rounded">ID: {d.id?.substring(0, 6) || '-'}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-500 mb-2">数据源: {d.datasourceName || '-'}</div>
                                        {workbooks.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-red-100">
                                                <div className="text-[10px] text-red-700 font-medium mb-1">使用此重复指标的工作簿:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {workbooks.slice(0, 3).map((wb: any, wi: number) => (
                                                        <span key={wi} onClick={(e) => { e.stopPropagation(); handleAssetClick(wb.id, 'workbooks'); }}
                                                            className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-200">{wb.name}</span>
                                                    ))}
                                                    {workbooks.length > 3 && <span className="text-[10px] text-red-400">+{workbooks.length - 3} 更多</span>}
                                                </div>
                                            </div>
                                        )}
                                        {views.length > 0 && workbooks.length === 0 && (
                                            <div className="mt-2 pt-2 border-t border-red-100">
                                                <div className="text-[10px] text-red-700 font-medium mb-1">使用此重复指标的视图:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {views.slice(0, 3).map((v: any, vi: number) => (
                                                        <span key={vi} className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{v.name}</span>
                                                    ))}
                                                    {views.length > 3 && <span className="text-[10px] text-red-400">+{views.length - 3} 更多</span>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ========== 渲染血缘图 ==========
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
                <div className="bg-white rounded-lg border p-4">
                    <div className="text-xs font-bold text-gray-700 mb-2">节点列表</div>
                    <div className="space-y-1.5">
                        {(lineageData.nodes || []).map((n: any, i: number) => (
                            <div key={i} onClick={() => handleAssetClick(n.id, `${n.type}s`)}
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded border cursor-pointer hover:border-indigo-300 transition-colors">
                                <span className="w-2 h-2 rounded-full" style={{ background: nodeColors[n.type] || '#64748b' }}></span>
                                <span className="flex-1 text-xs">{n.name}</span>
                                <span className="text-[10px] text-gray-400">{n.type}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    // ========== 渲染概览 Tab ==========
    const renderOverviewTab = () => {
        if (!data) return null;
        return (
            <div className="space-y-6">
                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-indigo-500" /> 基本信息
                    </h3>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                        <div className="col-span-2 sm:col-span-1 border-b border-gray-50 pb-1">
                            <span className="text-gray-400 text-xs block mb-0.5">ID</span>
                            <span className="font-mono text-gray-600 text-xs select-all">{data.id}</span>
                        </div>
                        {(data.dataType || data.type) && (
                            <div className="col-span-2 sm:col-span-1 border-b border-gray-50 pb-1">
                                <span className="text-gray-400 text-xs block mb-0.5">类型</span>
                                <span className="text-gray-700">{data.dataType || data.type}</span>
                            </div>
                        )}
                        {data.role && (
                            <div className="col-span-2 sm:col-span-1 border-b border-gray-50 pb-1">
                                <span className="text-gray-400 text-xs block mb-0.5">角色</span>
                                <span className="text-gray-700">{data.role}</span>
                            </div>
                        )}
                        {data.owner && (
                            <div className="col-span-2 sm:col-span-1 border-b border-gray-50 pb-1">
                                <span className="text-gray-400 text-xs block mb-0.5">所有者</span>
                                <span className="text-gray-700">{data.owner}</span>
                            </div>
                        )}
                        {(data.projectName || data.project_name) && (
                            <div className="col-span-2 sm:col-span-1 border-b border-gray-50 pb-1">
                                <span className="text-gray-400 text-xs block mb-0.5">项目</span>
                                <span className="text-gray-700">{data.projectName || data.project_name}</span>
                            </div>
                        )}
                        {data.formula && (
                            <div className="col-span-2 mt-2">
                                <div className="text-xs text-gray-400 mb-1">计算公式</div>
                                <div className="bg-gray-50 rounded p-2 font-mono text-xs text-gray-700 break-all border border-gray-100">
                                    {data.formula}
                                </div>
                            </div>
                        )}
                        {data.description && (
                            <div className="col-span-2 mt-2">
                                <div className="text-xs text-gray-400 mb-1">描述</div>
                                <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                    {data.description}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'overview': return renderOverviewTab();
            case 'upstream': return renderUpstreamTab();
            case 'downstream': return renderDownstreamTab();
            case 'duplicates': return renderDuplicatesTab();
            case 'lineage': return renderLineageTab();
            default: return null;
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" onClick={closeDrawer} />
            <div className={`fixed inset-y-0 right-0 w-[600px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div>
                            {loading ? (
                                <div className="h-6 w-32 bg-gray-100 animate-pulse rounded"></div>
                            ) : (
                                <>
                                    <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">{data?.name || '详情'}</h2>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide mt-0.5">
                                        {currentItem ? getModuleName(currentItem.type) : ''} 详情
                                    </p>
                                </>
                            )}
                        </div>
                        <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-6 border-b border-gray-100 overflow-x-auto scrollbar-hide">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                            </div>
                        ) : error ? (
                            <div className="text-center py-10 text-red-500">
                                {error}
                            </div>
                        ) : (
                            renderContent()
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

