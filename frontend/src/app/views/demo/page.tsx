'use client';

import {
    BookOpen,
    Columns,
    GitBranch,
    Info,
    Layout,
    Layers,
    ShieldAlert,
    TrendingUp,
    XCircle
} from 'lucide-react';

export default function ViewIntroDemoPage() {
    return (
        <div className="space-y-8">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                        <Layout className="w-7 h-7" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900">视图详情页产品说明</h1>
                        <p className="mt-2 text-sm text-gray-600">把一张视图的口径、来源与影响范围，集中在一个页面里看清楚。</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">一图看全：这张视图的来源与口径</div>
                <p className="mt-1 text-xs text-gray-500">上游到下游：数据库 → 表 → 列 → 字段 → 指标 → 视图 → 工作簿。</p>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-5 overflow-auto">
                    <svg viewBox="0 0 1280 560" className="w-full h-auto min-w-[980px]">
                        <defs>
                            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                                <path d="M0,0 L9,3 L0,6" fill="#4f46e5" />
                            </marker>
                        </defs>

                        <text x="30" y="44" fontSize="14" fill="#6b7280">上游</text>
                        <text x="1180" y="44" fontSize="14" fill="#6b7280">下游</text>

                        {/* 顶部主链路：数据库 → 表 → 列 → 数据源 → 视图 → 工作簿 */}
                        <rect x="60" y="98" width="150" height="58" rx="16" fill="#eef2ff" stroke="#c7d2fe" />
                        <text x="135" y="132" textAnchor="middle" fontSize="13" fill="#3730a3" fontWeight="700">数据库</text>

                        <rect x="250" y="98" width="160" height="58" rx="16" fill="#ecfeff" stroke="#bae6fd" />
                        <text x="330" y="132" textAnchor="middle" fontSize="13" fill="#0369a1" fontWeight="700">数据表</text>

                        <rect x="440" y="98" width="160" height="58" rx="16" fill="#fff7ed" stroke="#fed7aa" />
                        <text x="520" y="132" textAnchor="middle" fontSize="13" fill="#9a3412" fontWeight="700">原始列</text>
                        <text x="520" y="150" textAnchor="middle" fontSize="11" fill="#9a3412">Column</text>

                        <rect x="630" y="98" width="160" height="58" rx="16" fill="#ecfdf3" stroke="#bbf7d0" />
                        <text x="710" y="132" textAnchor="middle" fontSize="13" fill="#15803d" fontWeight="700">数据源</text>

                        <rect x="820" y="98" width="180" height="58" rx="16" fill="#ffe4e6" stroke="#fecdd3" />
                        <text x="910" y="132" textAnchor="middle" fontSize="13" fill="#be123c" fontWeight="700">视图</text>
                        <text x="910" y="150" textAnchor="middle" fontSize="11" fill="#9f1239">View</text>

                        <rect x="1040" y="98" width="180" height="58" rx="16" fill="#fef3c7" stroke="#fde68a" />
                        <text x="1130" y="132" textAnchor="middle" fontSize="13" fill="#b45309" fontWeight="700">工作簿</text>
                        <text x="1130" y="150" textAnchor="middle" fontSize="11" fill="#b45309">Workbook</text>

                        <line x1="210" y1="127" x2="250" y2="127" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="410" y1="127" x2="440" y2="127" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="600" y1="127" x2="630" y2="127" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="790" y1="127" x2="820" y2="127" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="1000" y1="127" x2="1040" y2="127" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />

                        {/* 中间：字段/指标两层（对齐列/视图） */}
                        <rect x="360" y="210" width="240" height="70" rx="18" fill="#ffffff" stroke="#e5e7eb" />
                        <text x="480" y="244" textAnchor="middle" fontSize="13" fill="#111827" fontWeight="700">字段</text>
                        <text x="480" y="266" textAnchor="middle" fontSize="11" fill="#6b7280">Field（用于视图展示）</text>

                        <rect x="640" y="210" width="240" height="70" rx="18" fill="#ffffff" stroke="#e5e7eb" />
                        <text x="760" y="244" textAnchor="middle" fontSize="13" fill="#111827" fontWeight="700">指标</text>
                        <text x="760" y="266" textAnchor="middle" fontSize="11" fill="#6b7280">Metric（由字段计算）</text>

                        {/* 列 → 字段 */}
                        <line x1="520" y1="156" x2="480" y2="210" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        {/* 字段 → 指标 */}
                        <line x1="600" y1="245" x2="640" y2="245" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        {/* 字段/指标 → 视图 */}
                        <line x1="600" y1="280" x2="880" y2="156" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="760" y1="280" x2="900" y2="156" stroke="#4f46e5" strokeWidth="2" markerEnd="url(#arrow)" />

                        {/* 底部：页面里对应的三个卡片 */}
                        <rect x="60" y="330" width="1160" height="170" rx="22" fill="#ffffff" stroke="#e5e7eb" />
                        <text x="90" y="368" fontSize="13" fill="#111827" fontWeight="700">在视图详情页里，你会重点看到这三块</text>

                        <rect x="90" y="388" width="330" height="86" rx="18" fill="#f8fafc" stroke="#e2e8f0" />
                        <text x="255" y="424" textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">口径</text>
                        <text x="255" y="446" textAnchor="middle" fontSize="11" fill="#64748b">使用字段 / 使用指标</text>

                        <rect x="450" y="388" width="360" height="86" rx="18" fill="#f8fafc" stroke="#e2e8f0" />
                        <text x="630" y="424" textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">来源</text>
                        <text x="630" y="446" textAnchor="middle" fontSize="11" fill="#64748b">追溯到表/列（穿透状态）</text>

                        <rect x="840" y="388" width="350" height="86" rx="18" fill="#f8fafc" stroke="#e2e8f0" />
                        <text x="1015" y="424" textAnchor="middle" fontSize="12" fill="#0f172a" fontWeight="700">价值与风险</text>
                        <text x="1015" y="446" textAnchor="middle" fontSize="11" fill="#64748b">访问量 / 影响范围</text>
                    </svg>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Columns className="w-4 h-4 text-indigo-600" />
                            字段/指标
                        </div>
                        <div className="mt-2 text-xs text-gray-600">解释视图在“算什么”。</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            表/列/数据源
                        </div>
                        <div className="mt-2 text-xs text-gray-600">解释视图“从哪里来”。</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <TrendingUp className="w-4 h-4 text-amber-600" />
                            访问统计
                        </div>
                        <div className="mt-2 text-xs text-gray-600">解释视图“值不值得维护”。</div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">这页里有哪些信息</div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Layout className="w-4 h-4 text-indigo-600" />
                            Header（标题区）
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />名称与归属：你现在在看哪张视图、属于哪本工作簿。</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />可信提示：是否认证、是否缺少描述（帮助判断可靠性）。</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />关键指标：视图展示“访问量”，字段/指标展示“引用量”。</li>
                        </ul>
                        <div className="mt-4 text-[11px] text-gray-500">
                            备注(技术): 视图的 Header 数值来自 `totalViewCount`；字段/指标来自各自 `usageCount` 统计字段。
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <BookOpen className="w-4 h-4 text-emerald-600" />
                            Tabs（信息分区）
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />概览：先告诉你“这张视图大概是什么”。</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />使用字段/使用指标：告诉你“它在用什么口径”。</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />访问统计：告诉你“它值不值得维护”。</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-600" />血缘图：告诉你“它从哪里来、影响哪里”。</li>
                        </ul>
                        <div className="mt-4 text-[11px] text-gray-500">
                            备注(技术): Tabs 会按数据是否存在动态出现（例如仪表板才有“包含视图”）。
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">访问量 vs 引用量</div>
                <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
                    <table className="min-w-[860px] w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr className="text-left text-xs text-gray-500">
                                <th className="px-4 py-3 font-semibold">名词</th>
                                <th className="px-4 py-3 font-semibold">用来回答什么</th>
                                <th className="px-4 py-3 font-semibold">你应该怎么用</th>
                                <th className="px-4 py-3 font-semibold">常见误区</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            <tr className="bg-white">
                                <td className="px-4 py-3 font-semibold text-gray-900">访问量（视图）</td>
                                <td className="px-4 py-3 text-gray-700">这张视图“是否常用/是否值得维护”。</td>
                                <td className="px-4 py-3 text-gray-700">决定优先级：热门先保障、冷门可治理或下线。</td>
                                <td className="px-4 py-3 text-gray-700">把访问量当成“影响范围”。影响范围要看血缘与引用。</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="px-4 py-3 font-semibold text-gray-900">引用量（字段/指标）</td>
                                <td className="px-4 py-3 text-gray-700">这个字段/指标“影响了多少视图”。</td>
                                <td className="px-4 py-3 text-gray-700">判断风险：引用越多，改动越要谨慎。</td>
                                <td className="px-4 py-3 text-gray-700">把引用量当成“热度”。热度要看访问统计。</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 text-[11px] text-gray-500">
                    备注(技术): 视图访问量来自 views usage stats；字段/指标引用量来自各自详情统计字段与预计算。
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">血缘能回答什么</div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <GitBranch className="w-4 h-4 text-violet-600" />
                            你要改上游表/列
                        </div>
                        <div className="mt-2 text-sm text-gray-700">看血缘，判断这张视图会不会被影响，以及影响通过哪些字段/指标传导。</div>
                        <div className="mt-3 text-xs text-gray-500">结论输出：影响范围 + 风险点（穿透失败/缺失链路）。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <ShieldAlert className="w-4 h-4 text-rose-600" />
                            你发现口径不一致
                        </div>
                        <div className="mt-2 text-sm text-gray-700">从视图的“使用指标/使用字段”追到具体来源列，确认是不是同一字段、同一来源。</div>
                        <div className="mt-3 text-xs text-gray-500">结论输出：口径来源是否一致 + 是否存在重复定义。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <TrendingUp className="w-4 h-4 text-amber-600" />
                            你想治理冷门视图
                        </div>
                        <div className="mt-2 text-sm text-gray-700">先看访问量判断是否可下线；再看血缘判断下线是否会牵连关键指标/下游。</div>
                        <div className="mt-3 text-xs text-gray-500">结论输出：下线建议 + 潜在影响。</div>
                    </div>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <Info className="w-4 h-4 text-indigo-600" />
                        可信度提示
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                        主要看两个标签：<span className="font-semibold">血缘来源</span> 与 <span className="font-semibold">穿透状态</span>。
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500">备注(技术): 标签由后端返回，前端在血缘 Tab 顶部展示。</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <XCircle className="w-4 h-4 text-gray-500" />
                    常见坑：为什么我看到的数据“不完整”
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-800">血缘穿透失败</div>
                        <div className="mt-2 text-sm text-gray-700">你可能只能看到“到字段/指标”为止，追不到原始列。解决方法：先以字段/指标为准，再逐步补齐上游。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-800">缺少描述/认证</div>
                        <div className="mt-2 text-sm text-gray-700">这不是“系统报错”，而是治理信号：说明维护不到位，风险更高。</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
