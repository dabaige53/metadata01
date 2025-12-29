'use client';

import { useEffect, useState } from 'react';
import { useDrawer } from '@/lib/drawer-context';
import {
    Loader2,
    EyeOff,
    AlertTriangle,
    LayoutDashboard,
    FileSpreadsheet,
    Search,
    ChevronDown,
    ChevronUp,
    BookOpen
} from 'lucide-react';
import { SortState, SortConfig } from '@/hooks/useDataTable';

// 定义排序选项
const SORT_OPTIONS: SortConfig[] = [
    { key: 'view_count', label: '视图数' },
    { key: 'name', label: '名称' }
];

interface ViewItem {
    id: string;
    name: string;
    view_type?: string;
}

interface WorkbookGroup {
    workbook_name: string;
    workbook_id: string | null;
    view_count: number;
    views?: ViewItem[];
    isLoading?: boolean;
    isLoaded?: boolean;
}

interface ZeroAccessViewsAnalysisProps {
    onCountUpdate?: (count: number) => void;
    onSortUpdate?: (config: {
        options: SortConfig[];
        state: SortState;
        onChange: (key: string) => void;
    }) => void;
}

export default function ZeroAccessViewsAnalysis({ onCountUpdate, onSortUpdate }: ZeroAccessViewsAnalysisProps) {
    const [groups, setGroups] = useState<WorkbookGroup[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [expandedWorkbooks, setExpandedWorkbooks] = useState<Record<string, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const { openDrawer } = useDrawer();

    // 初始加载：只获取工作簿摘要（不含视图列表）
    useEffect(() => {
        fetch('/api/views/governance/zero-access?summary_only=true')
            .then(res => res.json())
            .then(result => {
                const loadedGroups = (result.groups || []).map((g: any) => ({
                    ...g,
                    isLoading: false,
                    isLoaded: false,
                    views: []
                }));
                setGroups(loadedGroups);
                setTotalCount(result.total_count || 0);
                onCountUpdate?.(result.total_count || 0);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 点击工作簿时懒加载视图列表
    const toggleWorkbook = async (workbookId: string | null, workbookName: string) => {
        const isExpanded = expandedWorkbooks[workbookName];

        // 切换展开状态
        setExpandedWorkbooks(prev => ({
            ...prev,
            [workbookName]: !isExpanded
        }));

        // 如果是展开且未加载过，则请求数据
        if (!isExpanded && workbookId) {
            const group = groups.find(g => g.workbook_id === workbookId);
            if (group && !group.isLoaded) {
                // 标记为加载中
                setGroups(prev => prev.map(g =>
                    g.workbook_id === workbookId ? { ...g, isLoading: true } : g
                ));

                try {
                    const res = await fetch(`/api/views/governance/zero-access/workbook/${workbookId}`);
                    const data = await res.json();

                    // 更新视图列表
                    setGroups(prev => prev.map(g =>
                        g.workbook_id === workbookId
                            ? { ...g, views: data.views || [], isLoading: false, isLoaded: true }
                            : g
                    ));
                } catch (error) {
                    console.error('Failed to load views:', error);
                    setGroups(prev => prev.map(g =>
                        g.workbook_id === workbookId ? { ...g, isLoading: false } : g
                    ));
                }
            }
        }
    };

    const getViewTypeIcon = (type?: string) => {
        if (type === 'dashboard') return <LayoutDashboard className="w-4 h-4 text-indigo-500" />;
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="bg-green-50 border border-green-100 rounded-lg p-12 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <EyeOff className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-green-800 font-bold mb-1">没有零访问视图</h3>
                <p className="text-green-600 text-sm">所有视图都有人访问，资产利用率良好！</p>
            </div>
        );
    }

    // 按搜索词过滤工作簿
    const filteredGroups = searchTerm
        ? groups.filter(g => g.workbook_name.toLowerCase().includes(searchTerm.toLowerCase()))
        : groups;

    return (
        <div className="space-y-6">
            {/* 概览统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-gray-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">零访问视图</div>
                    <div className="text-2xl font-bold text-gray-600">{totalCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-400 mt-1">从未被访问过</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm border-l-4 border-l-amber-500">
                    <div className="text-xs text-gray-500 uppercase mb-1">受影响工作簿</div>
                    <div className="text-2xl font-bold text-amber-600">{groups.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">治理建议</div>
                    <div className="text-sm font-medium text-gray-700 mt-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        评估是否下线或推广使用
                    </div>
                </div>
            </div>

            {/* 搜索栏 */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜索工作簿..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* 工作簿列表 */}
            <div className="space-y-3">
                {filteredGroups.map((group) => (
                    <div key={group.workbook_id || group.workbook_name} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        <div
                            className="p-4 bg-gray-50/50 flex items-center justify-between cursor-pointer"
                            onClick={() => toggleWorkbook(group.workbook_id, group.workbook_name)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 text-gray-400">
                                    <BookOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-800 text-[15px]">{group.workbook_name}</h4>
                                    <p className="text-xs text-gray-500">{group.view_count} 个零访问视图</p>
                                </div>
                            </div>
                            {expandedWorkbooks[group.workbook_name]
                                ? <ChevronUp className="w-5 h-5 text-gray-400" />
                                : <ChevronDown className="w-5 h-5 text-gray-400" />
                            }
                        </div>

                        {expandedWorkbooks[group.workbook_name] && (
                            <div className="border-t border-gray-100">
                                {group.isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                                        <span className="ml-2 text-sm text-gray-500">加载中...</span>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-50">
                                            {(group.views || []).map(view => (
                                                <tr key={view.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {getViewTypeIcon(view.view_type)}
                                                            <span className="text-gray-700">{view.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-400 text-xs text-right">
                                                        {view.view_type === 'dashboard' ? '仪表板' : '工作表'}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openDrawer(view.id, 'views', view.name);
                                                            }}
                                                            className="text-indigo-600 hover:text-indigo-900 font-medium text-xs"
                                                        >
                                                            查看详情
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
