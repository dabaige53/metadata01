'use client';

import {
    BookOpen,
    GitBranch,
    Layout,
    Layers,
    TrendingUp
} from 'lucide-react';

export default function ViewIntroDemoPage() {
    return (
        <div className="space-y-8 p-4">
            {/* 1. Header & Intro */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left: Title & Quick Intro */}
                    <div className="lg:w-1/3 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
                                <Layout className="w-8 h-8" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">平台术语与概念指南</h1>
                                <div className="text-sm font-medium text-indigo-600 mt-1">视图 (View) 专题</div>
                            </div>
                        </div>
                        <p className="text-base text-gray-600 leading-relaxed">
                            本页旨在帮助您快速理解平台中的核心概念、数据流转逻辑以及关键指标含义，助您更高效地使用元数据治理平台。
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">数据可视化</span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">BI 报表</span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Tableau</span>
                        </div>
                    </div>

                    {/* Right: Object Definition Grid */}
                    <div className="lg:w-2/3 bg-gray-50 rounded-xl p-6 border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
                            对象定义：视图 (View)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">定义</div>
                                <div className="text-sm text-gray-800">
                                    Tableau 中用于展示数据的可视化工件。它是用户与数据交互的最终界面，可以是单张图表（工作表）或多张图表的组合（仪表板）。
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">层级关系</div>
                                <div className="text-sm text-gray-800 flex items-center gap-2">
                                    项目 <span className="text-gray-400">→</span> 工作簿 <span className="text-gray-400">→</span> <span className="font-bold text-indigo-700">视图</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">主要用途</div>
                                <div className="text-sm text-gray-800">
                                    数据分析、业务监控、决策支持、报表分发。
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-500 mb-1">关键属性</div>
                                <div className="text-sm text-gray-800">
                                    访问量、所属工作簿、认证状态、包含字段数。
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Visual Lineage (Top) - Fixed & Cleaned */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3 mb-8">
                    <GitBranch className="w-5 h-5 text-violet-600" />
                    术语图解：数据流转全景
                </h2>
                <div className="overflow-x-auto flex justify-center">
                    <svg viewBox="0 0 840 200" className="w-full max-w-[840px] h-auto">
                                <defs>
                                    <marker id="arrow-sm" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                        <path d="M0,0 L6,3 L0,6" fill="#9ca3af" />
                                    </marker>
                                    <marker id="arrow-usage" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                        <path d="M0,0 L6,3 L0,6" fill="#e11d48" />
                                    </marker>
                                </defs>

                                {/* Background Container */}
                                <rect x="10" y="10" width="820" height="180" rx="12" fill="#f9fafb" stroke="#f3f4f6" />

                                {/* 1. Physical Layer (Top) */}
                                <g transform="translate(40, 40)">
                                    {/* DB */}
                                    <rect width="100" height="40" rx="6" fill="#eef2ff" stroke="#c7d2fe" />
                                    <text x="50" y="24" textAnchor="middle" fontSize="11" fill="#3730a3" fontWeight="600">数据库</text>
                                    {/* DB -> Table */}
                                    <line x1="100" y1="20" x2="160" y2="20" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                                    <text x="130" y="15" textAnchor="middle" fontSize="9" fill="#9ca3af">数据读取</text>
                                </g>

                                <g transform="translate(200, 40)">
                                    {/* Table */}
                                    <rect width="100" height="40" rx="6" fill="#ecfeff" stroke="#bae6fd" />
                                    <text x="50" y="24" textAnchor="middle" fontSize="11" fill="#0369a1" fontWeight="600">数据表</text>
                                    {/* Table -> DS */}
                                    <line x1="100" y1="20" x2="160" y2="20" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                                    <text x="130" y="15" textAnchor="middle" fontSize="9" fill="#9ca3af">物理连接</text>
                                </g>

                                <g transform="translate(360, 40)">
                                    {/* Datasource */}
                                    <rect width="120" height="40" rx="6" fill="#ecfdf3" stroke="#bbf7d0" />
                                    <text x="60" y="24" textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="600">数据源</text>
                                </g>
                                
                                {/* DS -> Workbook (Long arrow) */}
                                <line x1="480" y1="60" x2="640" y2="60" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                                <text x="560" y="55" textAnchor="middle" fontSize="9" fill="#9ca3af">作为数据源发布到</text>

                                <g transform="translate(640, 40)">
                                    {/* Workbook */}
                                    <rect width="120" height="40" rx="6" fill="#fef3c7" stroke="#fde68a" />
                                    <text x="60" y="24" textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="600">工作簿</text>
                                </g>

                                {/* 2. Logical Layer (Bottom) */}
                                
                                {/* Link Down: DS -> Fields */}
                                <path d="M 420 80 L 420 120" fill="none" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                                <text x="425" y="100" fontSize="9" fill="#9ca3af">包含字段</text>

                                <g transform="translate(360, 120)">
                                    {/* Fields */}
                                    <rect width="120" height="36" rx="6" fill="#fff7ed" stroke="#fed7aa" />
                                    <text x="60" y="22" textAnchor="middle" fontSize="11" fill="#9a3412">原始字段</text>
                                    {/* Fields -> Metrics */}
                                    <line x1="120" y1="18" x2="160" y2="18" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                                    <text x="140" y="14" textAnchor="middle" fontSize="9" fill="#9ca3af">计算加工</text>
                                </g>

                                <g transform="translate(520, 120)">
                                    {/* Metrics */}
                                    <rect width="100" height="36" rx="6" fill="#fffbeb" stroke="#fde68a" />
                                    <text x="50" y="22" textAnchor="middle" fontSize="11" fill="#b45309">计算指标</text>
                                </g>

                                {/* Link Down: Workbook -> View */}
                                <path d="M 700 80 L 700 110" fill="none" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                                <text x="705" y="95" fontSize="9" fill="#9ca3af">包含视图</text>

                                <g transform="translate(640, 110)">
                                    {/* View */}
                                    <rect width="120" height="56" rx="8" fill="#ffe4e6" stroke="#fecdd3" strokeWidth="2" />
                                    <text x="60" y="24" textAnchor="middle" fontSize="12" fill="#be123c" fontWeight="700">视图 (View)</text>
                                    <text x="60" y="42" textAnchor="middle" fontSize="10" fill="#9f1239">你在这里</text>
                                </g>
                                
                                {/* Usage Lines: Field/Metric -> View */}
                                {/* Metric -> View */}
                                <path d="M 620 138 L 640 138" fill="none" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3" markerEnd="url(#arrow-usage)" />
                                <text x="630" y="134" textAnchor="middle" fontSize="9" fill="#e11d48">最终展示</text>

                                {/* Legend */}
                                <g transform="translate(40, 130)">
                                    <text x="0" y="10" fontSize="10" fill="#6b7280">── 实线: 物理血缘（数据流向）</text>
                                    <text x="0" y="30" fontSize="10" fill="#e11d48">- - 虚线: 引用关系（计算口径）</text>
                                </g>
                    </svg>
                </div>
            </div>

            {/* 3. Info Cards Grid (3 Columns) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Col 1: Definitions */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3 mb-6">
                        <BookOpen className="w-5 h-5 text-indigo-600" />
                        核心概念
                    </h2>
                    <div className="space-y-4 flex-1">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">视图 (View)</div>
                            <div className="text-sm text-gray-600">
                                最终的展示画面。由“仪表板”或“工作表”组成。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">访问量 vs 引用量</div>
                            <div className="text-sm text-gray-600">
                                <span className="font-medium text-amber-700">访问量</span>代表热度（谁在看）；<br/>
                                <span className="font-medium text-indigo-700">引用量</span>代表影响范围（被多少图用了）。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">血缘关系 (Lineage)</div>
                            <div className="text-sm text-gray-600">
                                显示数据上下游关系，帮助追踪数据来源和影响范围。
                            </div>
                        </div>
                    </div>
                </div>

                {/* Col 2: Tabs Logic */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-emerald-600" />
                        系统功能说明
                    </h2>
                    <div className="space-y-4 flex-1">
                        <div className="text-sm text-gray-700 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                            系统会自动判断显示哪些 Tab：
                        </div>
                        <ul className="space-y-3 text-sm text-gray-600">
                            <li className="flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[80px]">概览/统计</span>
                                <span>永远显示。基础信息与访问热度。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[80px]">所属工作簿</span>
                                <span>有归属关系时显示。用于定位负责人。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[80px]">包含视图</span>
                                <span>仅<span className="text-indigo-600 font-bold">仪表板</span>显示。用于下钻看子图详情。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[80px]">字段/指标</span>
                                <span>有使用口径时显示。用于核对计算逻辑。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[80px]">访问统计</span>
                                <span>显示历史访问趋势。帮助分析热度变化。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[80px]">血缘图</span>
                                <span>可视化展示数据流向。点击节点可跳转详情。</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* 4. Full Width Field Dictionary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-amber-600" />
                    字段详细释义 (Field Dictionary)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Group 1: 基础属性 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">基础属性</h3>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">视图类型 (Type)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                <span className="font-medium text-blue-700">Dashboard</span> (仪表板) vs <span className="font-medium text-blue-700">Sheet</span> (工作表)。
                                <br />仪表板是组合看板，适合总览；工作表是单张图表，适合深入分析。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">认证状态 (Certified)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                <span className="text-green-600 font-medium">已认证</span>：官方核准，数据准确可信。
                                <br /><span className="text-amber-600 font-medium">警告</span>：数据可能过时或存在质量问题，需谨慎使用。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">项目 (Project)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                Tableau 中的文件夹层级，用于权限管理和资源分类。通常对应业务部门或主题域。
                            </div>
                        </div>
                    </div>

                    {/* Group 2: 统计指标 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">统计指标</h3>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">访问量 (Hits)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                过去 30 天内的用户查看次数。反映了该视图的<b>热度</b>。
                                <br />高访问量 = 核心资产，需优先保障稳定性。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">引用量 (References)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                该资源被下游依赖的次数。反映了<b>影响范围</b>。
                                <br />修改高引用量的字段或数据源时需格外小心。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">字段数 (Field Count)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                视图中实际使用的字段数量。反映了<b>复杂度</b>。
                                <br />字段 &gt; 50 个通常意味着逻辑复杂，维护成本高，建议拆分。
                            </div>
                        </div>
                    </div>

                    {/* Group 3: 数据源与血缘 */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">数据与血缘</h3>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">数据源连接 (Connection)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                <span className="font-medium">Live (实时)</span>：直接查询数据库，数据最新但可能慢。
                                <br /><span className="font-medium">Extract (提取)</span>：快照数据，性能好但需定时刷新 (T+1)。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">更新时间 (Updated At)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                数据最后一次成功抽取的时刻。
                                <br />如果时间久远（如 &gt; 2天），说明数据可能已停止更新。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="text-sm font-bold text-gray-900 mb-1">所有者 (Owner)</div>
                            <div className="text-sm text-gray-600 leading-snug">
                                资源的发布者或当前负责人。
                                <br />数据问题请直接联系所有者，或查看其所属的项目组。
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
