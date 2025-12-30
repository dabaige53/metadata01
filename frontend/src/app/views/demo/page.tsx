'use client';

import { useMemo, useState } from 'react';
import {
    Layout,
    GitBranch,
    Columns,
    Layers,
    BookOpen,
    Database,
    Eye,
    ShieldAlert,
    Info,
    X
} from 'lucide-react';

type IntroTag = {
    id: string;
    label: string;
    icon: React.ElementType;
    tone: string;
    title: string;
    summary: string;
    userStory: string;
    bullets: string[];
    notes: string[];
};

const VIEW_INTRO_TAGS: IntroTag[] = [
    {
        id: 'overview',
        label: '我是谁',
        icon: Info,
        tone: 'indigo',
        title: '视图是什么样的资产',
        summary: '这是一个可以被访问、被复用的可视化视图，它连接了数据、字段与业务说明。',
        userStory: '我是使用报表的人，我只想知道这个视图能回答什么问题、数据是否可靠、是否有人在维护。',
        bullets: [
            '视图名称、所属工作簿与负责人',
            '是否认证、是否有描述、最近是否更新',
            '被多少人用、热度与访问趋势',
            '从哪里来、会影响哪些地方'
        ],
        notes: [
            '备注: 认证来自 Tableau 认证标记',
            '备注: 访问统计来自 view usage 统计接口'
        ]
    },
    {
        id: 'data-source',
        label: '数据来源',
        icon: Layers,
        tone: 'emerald',
        title: '这个视图用到了哪些数据源',
        summary: '你可以看见数据从哪里接入，是否是嵌入式数据源，是否容易出错。',
        userStory: '我是数据使用者，我想知道这张图到底连的是哪个数据源，能否被信任。',
        bullets: [
            '已发布数据源与嵌入式数据源区分',
            '数据源负责人、项目归属',
            '是否认证、是否有说明'
        ],
        notes: [
            '备注: embedded 表示嵌入式数据源',
            '备注: 数据源数量来自预计算统计'
        ]
    },
    {
        id: 'fields',
        label: '字段定义',
        icon: Columns,
        tone: 'blue',
        title: '这个视图具体用了哪些字段',
        summary: '字段告诉你图表的含义，是维度还是度量，是否有描述。',
        userStory: '我是分析师，我关心字段含义与口径是否一致，避免误读。',
        bullets: [
            '字段角色(维度/度量)与数据类型',
            '是否有描述、是否有认证',
            '字段来自哪些表或数据源'
        ],
        notes: [
            '备注: 字段与原始列通过 upstream_column 关联',
            '备注: 字段数量为预计算统计'
        ]
    },
    {
        id: 'lineage',
        label: '血缘路径',
        icon: GitBranch,
        tone: 'violet',
        title: '这张图和上游数据的关系',
        summary: '血缘图展示“数据从哪里来、会影响哪些下游”。',
        userStory: '我是变更负责人，我要知道改了上游数据会不会影响这张视图。',
        bullets: [
            '从数据库到数据表、数据源、工作簿、视图',
            '标出穿透是否成功、血缘来源方式',
            '让风险一眼可见'
        ],
        notes: [
            '备注: 血缘来源包含 API 直返/推导/预计算',
            '备注: 穿透失败会标记为风险'
        ]
    },
    {
        id: 'usage',
        label: '访问情况',
        icon: Eye,
        tone: 'amber',
        title: '这个视图有没有人在用',
        summary: '访问情况帮助你判断视图是否值得维护，是否需要优化。',
        userStory: '我是管理员，我想知道哪些视图是热门，哪些视图可以下线。',
        bullets: [
            '总访问次数、近期增量',
            '是否是热门或冷门视图',
            '访问趋势(简化列表展示)'
        ],
        notes: [
            '备注: 统计来自 view usage 数据',
            '备注: 热度阈值可配置'
        ]
    },
    {
        id: 'risk',
        label: '风险提示',
        icon: ShieldAlert,
        tone: 'rose',
        title: '这张视图可能的问题',
        summary: '用最直白的方式告诉你“哪里可能不可靠”。',
        userStory: '我是业务负责人，希望在使用前先知道潜在问题。',
        bullets: [
            '无描述字段过多',
            '血缘穿透失败',
            '数据源未认证'
        ],
        notes: [
            '备注: 风险规则可由治理策略配置'
        ]
    }
];

const toneMap: Record<string, { chip: string; panel: string; ring: string; text: string }> = {
    indigo: { chip: 'bg-indigo-50 text-indigo-700 border-indigo-200', panel: 'bg-indigo-50/40', ring: 'ring-indigo-200', text: 'text-indigo-700' },
    emerald: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', panel: 'bg-emerald-50/40', ring: 'ring-emerald-200', text: 'text-emerald-700' },
    blue: { chip: 'bg-blue-50 text-blue-700 border-blue-200', panel: 'bg-blue-50/40', ring: 'ring-blue-200', text: 'text-blue-700' },
    violet: { chip: 'bg-violet-50 text-violet-700 border-violet-200', panel: 'bg-violet-50/40', ring: 'ring-violet-200', text: 'text-violet-700' },
    amber: { chip: 'bg-amber-50 text-amber-700 border-amber-200', panel: 'bg-amber-50/40', ring: 'ring-amber-200', text: 'text-amber-700' },
    rose: { chip: 'bg-rose-50 text-rose-700 border-rose-200', panel: 'bg-rose-50/40', ring: 'ring-rose-200', text: 'text-rose-700' }
};

export default function ViewIntroDemoPage() {
    const [activeTag, setActiveTag] = useState<IntroTag | null>(null);
    const tagGroups = useMemo(() => VIEW_INTRO_TAGS, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Layout className="w-6 h-6 text-indigo-600" />
                        Views 详情页介绍 Demo
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        这是一个静态展示示例，用“视图详情页”为例说明用户能看到什么、为什么有用。
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Layout className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">示例视图</div>
                            <div className="text-lg font-bold text-gray-900">航线收益看板 · 月度视图</div>
                            <div className="text-xs text-gray-400">所属工作簿: 经营分析 · 负责人: 陈**</div>
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                            <div className="text-2xl font-bold text-indigo-600">1,248</div>
                            <div className="text-xs text-gray-500">总访问</div>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                            <div className="text-2xl font-bold text-emerald-600">+62</div>
                            <div className="text-xs text-gray-500">近7天</div>
                        </div>
                        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
                            <div className="text-2xl font-bold text-amber-600">已认证</div>
                            <div className="text-xs text-gray-500">可信状态</div>
                        </div>
                    </div>
                    <div className="mt-6">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">标签入口</div>
                        <div className="flex flex-wrap gap-2">
                            {tagGroups.map(tag => {
                                const tone = toneMap[tag.tone];
                                const Icon = tag.icon;
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => setActiveTag(tag)}
                                        className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold rounded-full transition-all hover:shadow-sm ${tone.chip}`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {tag.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="text-sm font-semibold text-gray-700 mb-4">视图血缘一眼看懂</div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <svg viewBox="0 0 640 260" className="w-full h-auto">
                            <defs>
                                <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                                    <path d="M0,0 L9,3 L0,6" fill="#6366f1" />
                                </marker>
                            </defs>
                            <rect x="20" y="30" width="110" height="44" rx="10" fill="#eef2ff" stroke="#c7d2fe" />
                            <text x="75" y="58" textAnchor="middle" fontSize="12" fill="#4338ca">数据库</text>

                            <rect x="170" y="30" width="120" height="44" rx="10" fill="#ecfeff" stroke="#bae6fd" />
                            <text x="230" y="58" textAnchor="middle" fontSize="12" fill="#0369a1">数据表</text>

                            <rect x="330" y="30" width="120" height="44" rx="10" fill="#ecfdf3" stroke="#bbf7d0" />
                            <text x="390" y="58" textAnchor="middle" fontSize="12" fill="#15803d">数据源</text>

                            <rect x="490" y="30" width="120" height="44" rx="10" fill="#fef3c7" stroke="#fde68a" />
                            <text x="550" y="58" textAnchor="middle" fontSize="12" fill="#b45309">工作簿</text>

                            <rect x="250" y="150" width="140" height="54" rx="12" fill="#ffe4e6" stroke="#fecdd3" />
                            <text x="320" y="180" textAnchor="middle" fontSize="13" fill="#be123c">视图</text>

                            <line x1="130" y1="52" x2="170" y2="52" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow)" />
                            <line x1="290" y1="52" x2="330" y2="52" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow)" />
                            <line x1="450" y1="52" x2="490" y2="52" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow)" />

                            <line x1="550" y1="74" x2="360" y2="150" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow)" />
                            <line x1="390" y1="74" x2="320" y2="150" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow)" />
                        </svg>
                        <div className="mt-3 text-xs text-gray-500">
                            这张图只做示意，真实页面会按资产关系展开详细血缘路径。
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-gray-100 p-3">
                            <div className="text-xs text-gray-400">血缘来源</div>
                            <div className="text-sm font-semibold text-gray-800">API 直返</div>
                        </div>
                        <div className="rounded-lg border border-gray-100 p-3">
                            <div className="text-xs text-gray-400">穿透状态</div>
                            <div className="text-sm font-semibold text-emerald-600">穿透成功</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-700 mb-3">你会看到什么</div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { icon: Database, title: '数据来源', desc: '清楚知道视图来自哪些数据源与数据表。' },
                        { icon: Columns, title: '字段口径', desc: '字段定义、维度/度量与数据类型一目了然。' },
                        { icon: BookOpen, title: '业务归属', desc: '工作簿、负责人、项目归属清晰可见。' },
                        { icon: Eye, title: '使用热度', desc: '热度与访问趋势帮助判断价值。' },
                        { icon: GitBranch, title: '血缘路径', desc: '上游与下游关系，风险影响一眼看懂。' },
                        { icon: ShieldAlert, title: '治理风险', desc: '无描述、未认证等问题提前提示。' }
                    ].map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                                <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
                                    <Icon className="w-4 h-4 text-indigo-500" />
                                    {item.title}
                                </div>
                                <div className="mt-2 text-xs text-gray-500">{item.desc}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {activeTag && (
                <div className="fixed inset-0 z-50">
                    <div
                        className="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]"
                        onClick={() => setActiveTag(null)}
                    />
                    <div className="absolute inset-x-0 top-10 mx-auto max-w-3xl px-4">
                        <div className={`rounded-2xl border border-gray-200 bg-white shadow-2xl ring-1 ${toneMap[activeTag.tone].ring}`}>
                            <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 ${toneMap[activeTag.tone].panel}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${toneMap[activeTag.tone].chip}`}>
                                        <activeTag.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500">标签说明</div>
                                        <div className="text-lg font-bold text-gray-900">{activeTag.title}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setActiveTag(null)}
                                    className="p-2 rounded-full hover:bg-white/80 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div className="text-sm text-gray-700">{activeTag.summary}</div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                    <div className="text-xs font-semibold text-gray-500 mb-2">网友视角</div>
                                    <div className="text-sm text-gray-700">{activeTag.userStory}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-500 mb-2">你会看到</div>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                                        {activeTag.bullets.map(item => (
                                            <li key={item} className="flex items-center gap-2">
                                                <span className={`w-1.5 h-1.5 rounded-full ${toneMap[activeTag.tone].text}`} />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-gray-500 mb-2">简单血缘示意</div>
                                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                                        <svg viewBox="0 0 520 160" className="w-full h-auto">
                                            <defs>
                                                <marker id="arrow2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                                                    <path d="M0,0 L7,3 L0,6" fill="#6366f1" />
                                                </marker>
                                            </defs>
                                            <rect x="20" y="20" width="110" height="36" rx="8" fill="#eef2ff" stroke="#c7d2fe" />
                                            <text x="75" y="44" textAnchor="middle" fontSize="11" fill="#4338ca">数据库</text>
                                            <rect x="160" y="20" width="110" height="36" rx="8" fill="#ecfeff" stroke="#bae6fd" />
                                            <text x="215" y="44" textAnchor="middle" fontSize="11" fill="#0369a1">数据表</text>
                                            <rect x="300" y="20" width="110" height="36" rx="8" fill="#ecfdf3" stroke="#bbf7d0" />
                                            <text x="355" y="44" textAnchor="middle" fontSize="11" fill="#15803d">数据源</text>
                                            <rect x="200" y="92" width="130" height="44" rx="10" fill="#ffe4e6" stroke="#fecdd3" />
                                            <text x="265" y="120" textAnchor="middle" fontSize="12" fill="#be123c">视图</text>
                                            <line x1="130" y1="38" x2="160" y2="38" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow2)" />
                                            <line x1="270" y1="38" x2="300" y2="38" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow2)" />
                                            <line x1="355" y1="56" x2="260" y2="92" stroke="#6366f1" strokeWidth="2" markerEnd="url(#arrow2)" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                                    <div className="text-xs font-semibold text-gray-500 mb-2">备注(技术)</div>
                                    <ul className="space-y-1 text-xs text-gray-600">
                                        {activeTag.notes.map(note => (
                                            <li key={note}>{note}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
