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
        <div className="space-y-6">
            {/* 1. Header & Intro */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-4">
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <Layout className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">平台术语与概念指南</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        本页旨在帮助您快速理解平台中的核心概念、数据流转逻辑以及关键指标含义，助您更高效地使用元数据治理平台。
                    </p>
                </div>
            </div>

            {/* 2. Visual Lineage (Top) - Fixed & Cleaned */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
                    <GitBranch className="w-4 h-4 text-violet-600" />
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Col 1: Definitions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col h-full">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        核心概念
                    </h2>
                    <div className="space-y-3 flex-1">
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-xs font-semibold text-gray-900">视图 (View)</div>
                            <div className="text-xs text-gray-600 mt-1">
                                最终的展示画面。由“仪表板”或“工作表”组成。
                            </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-xs font-semibold text-gray-900">访问量 vs 引用量</div>
                            <div className="text-xs text-gray-600 mt-1">
                                <span className="font-medium text-amber-700">访问量</span>代表热度（谁在看）；<br/>
                                <span className="font-medium text-indigo-700">引用量</span>代表影响范围（被多少图用了）。
                            </div>
                        </div>
                    </div>
                </div>

                {/* Col 2: Tabs Logic */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col h-full">
                    <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-emerald-600" />
                        系统功能说明
                    </h2>
                    <div className="space-y-3 flex-1">
                        <div className="text-xs text-gray-700 p-2 bg-emerald-50 rounded border border-emerald-100">
                            系统会自动判断显示哪些 Tab：
                        </div>
                        <ul className="space-y-2 text-xs text-gray-600">
                            <li className="flex gap-2 items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[70px]">概览/统计</span>
                                <span>永远显示。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[70px]">所属工作簿</span>
                                <span>有归属关系时显示。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[70px]">包含视图</span>
                                <span>仅<span className="text-indigo-600 font-bold">仪表板</span>显示。</span>
                            </li>
                            <li className="flex gap-2 items-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></div>
                                <span className="font-bold text-gray-900 min-w-[70px]">字段/指标</span>
                                <span>有使用口径时显示。</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Col 3: Key Metrics */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex flex-col h-full">
                    <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-600" />
                        关键术语说明
                    </h2>
                    <div className="flex-1 space-y-4">
                        <div className="space-y-3">
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">视图类型 (View Type)</div>
                                    <div className="text-[10px] text-gray-600">
                                        <span className="font-medium text-blue-700">仪表板 (Dashboard)</span>：多张图表的组合看板；
                                        <span className="font-medium text-blue-700"> 工作表 (Sheet)</span>：单张独立图表。
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">数据认证 (Certification)</div>
                                    <div className="text-[10px] text-gray-600">
                                        <span className="text-green-600 font-medium">已认证</span>：经过官方校验，数据可信；
                                        <span className="text-amber-600 font-medium">警告</span>：数据可能过时或存在问题。
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">复杂度 (Complexity)</div>
                                    <div className="text-[10px] text-gray-600">
                                        基于使用的字段数量计算。字段 > 50 个视为高复杂度，建议优化。
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0"></div>
                                <div>
                                    <div className="text-xs font-bold text-gray-900">数据时效性 (Freshness)</div>
                                    <div className="text-[10px] text-gray-600">
                                        指数据最后一次成功抽取的时刻。平台数据通常为 T+1（隔日）更新。
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
