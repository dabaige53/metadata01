'use client';

import {
    BookOpen,
    Columns,
    GitBranch,
    Info,
    Layout,
    Layers,
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
                        <h1 className="text-2xl font-bold text-gray-900">视图详情页：这页在说什么</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            这是“视图（View）详情抽屉”的说明页：告诉你这张视图是什么、用什么口径、从哪里来、影响到哪里。
                        </p>
                        <div className="mt-3 text-xs text-gray-500">
                            你在任意视图详情抽屉右上角点击 <span className="font-semibold">“详情介绍”</span> 会进入本页。
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">1) 这是什么“详情页类型”</div>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">对象</div>
                        <div className="mt-2 text-sm text-gray-700">
                            <span className="font-semibold">视图（View）</span>：Tableau 里用户真正打开浏览的内容，可能是<span className="font-semibold">仪表板</span>或<span className="font-semibold">工作表</span>。
                        </div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">你在这里能拿到的答案</div>
                        <ul className="mt-2 space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />它在用哪些字段/指标（口径）</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />这些口径追溯到哪些表/列（来源）</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />它是否常被访问、是否值得重点维护（价值）</li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">你会经常用它做什么</div>
                        <div className="mt-2 text-sm text-gray-700">定位口径差异、排查上游变更影响、判断视图是否可治理/下线。</div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">2) 血缘怎么理解（从上游到下游）</div>
                <p className="mt-1 text-xs text-gray-500">上游到下游：数据库 → 表 → 原始列 → 字段 → 指标 → 视图 → 工作簿。</p>

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
                        <div className="mt-2 text-xs text-gray-600">解释视图在“算什么/用什么口径”。</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            表/列/数据源
                        </div>
                        <div className="mt-2 text-xs text-gray-600">解释视图“数据从哪里来”。</div>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <TrendingUp className="w-4 h-4 text-amber-600" />
                            访问统计
                        </div>
                        <div className="mt-2 text-xs text-gray-600">解释视图“是否常用、值不值得维护”。</div>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                        <GitBranch className="w-4 h-4 text-violet-600" />
                        你在血缘里最该看的两件事
                    </div>
                    <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div className="rounded-xl border border-gray-100 bg-white p-4">
                            <div className="font-semibold text-gray-900">口径链路</div>
                            <div className="mt-1">字段/指标 → 视图：这张视图具体用到了什么。</div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-white p-4">
                            <div className="font-semibold text-gray-900">来源链路</div>
                            <div className="mt-1">字段 → 原始列 → 表/数据库：这些口径最终落在什么物理数据上。</div>
                        </div>
                    </div>
                    <div className="mt-3 text-[11px] text-gray-500">
                        备注(技术): 血缘数据来自后端接口 <span className="font-mono">/api/lineage/views/:id</span>。
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">3) 页面里每个“字段”是什么意思</div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Layout className="w-4 h-4 text-indigo-600" />
                            Header（标题区）常见字段
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">名称 / 所属工作簿</div>
                                <div className="mt-1">你现在在看哪张视图，以及它归属在哪本工作簿里。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">视图类型（仪表板 / 工作表）</div>
                                <div className="mt-1">决定它是否会出现“包含视图”Tab（仪表板才会有）。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">认证状态</div>
                                <div className="mt-1">表示这张视图是否经过官方确认，通常用于判断“优先相信谁”。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">字段数 / 指标数</div>
                                <div className="mt-1">这张视图在展示时用到了多少字段/指标，是“口径复杂度”的直观信号。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">访问量（访问热度）</div>
                                <div className="mt-1">回答“是否常用/是否值得维护”。（不是影响范围）</div>
                            </div>
                        </div>
                        <div className="mt-4 text-[11px] text-gray-500">
                            备注(技术): 访问量来自视图 usage stats；字段数/指标数/认证等来自详情接口返回。
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Info className="w-4 h-4 text-emerald-600" />
                            列表项里常见字段
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">引用量（字段/指标）</div>
                                <div className="mt-1">回答“影响范围”：这个字段/指标被多少视图使用，改动要不要谨慎。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">状态（使用中 / 仅关联 / 未使用）</div>
                                <div className="mt-1">帮助你快速判断：这条资产到底有没有被真正用起来。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">更新时间</div>
                                <div className="mt-1">用于判断近期是否有改动，配合血缘更容易定位“最近一次变更引发的问题”。</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">4) 每个模块是如何“出来的”（为什么你会看到这些块）</div>
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            Tabs 是“按数据动态出现”的
                        </div>
                        <ul className="mt-3 space-y-2 text-sm text-gray-700">
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />有“所属工作簿”信息 → 才显示 <span className="font-semibold">所属工作簿</span></li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />有“使用字段/使用指标” → 才显示对应 Tab</li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" />是仪表板且包含子视图 → 才显示 <span className="font-semibold">包含视图</span></li>
                            <li className="flex items-start gap-2"><span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-600" /><span className="font-semibold">访问统计 / 血缘图</span> 在视图里属于核心能力，通常都会有</li>
                        </ul>
                        <div className="mt-4 text-[11px] text-gray-500">备注(技术): Tabs 由详情抽屉组件按返回数据生成，不是写死的。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Layers className="w-4 h-4 text-emerald-600" />
                            “模块块”对应你决策时的 3 个视角
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-gray-700">
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">口径</div>
                                <div className="mt-1">使用字段/使用指标：帮你确认“这张图到底怎么算”。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">来源</div>
                                <div className="mt-1">血缘：把口径一路追溯到表/列，定位真正的数据来源。</div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-white p-4">
                                <div className="font-semibold text-gray-900">价值与风险</div>
                                <div className="mt-1">访问统计 + 引用量：决定维护优先级与变更风险。</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="text-sm font-semibold text-gray-900">5) 如何理解每个 Tab（建议用法）</div>
                <div className="mt-4 grid grid-cols-1 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">概览</div>
                        <div className="mt-1 text-sm text-gray-700">先看“这张视图是什么 + 关键标签/状态”，再决定往哪块深挖。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">所属工作簿（可选）</div>
                        <div className="mt-1 text-sm text-gray-700">确认归属、定位负责人/项目环境；很多治理动作是以工作簿为单位推进的。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">使用字段 / 使用指标（可选）</div>
                        <div className="mt-1 text-sm text-gray-700">这是“口径清单”：看它用哪些字段/指标；遇到口径争议先从这里对齐。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">访问统计</div>
                        <div className="mt-1 text-sm text-gray-700">回答“是否常用”：热门视图优先保障，冷门视图再结合血缘评估治理/下线。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">包含视图（仪表板才会有）</div>
                        <div className="mt-1 text-sm text-gray-700">把仪表板拆成子视图看：口径与血缘往往要下钻到具体子视图才能说清。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-900">血缘图</div>
                        <div className="mt-1 text-sm text-gray-700">回答“从哪里来/影响哪里”：用来评估上游改动风险，或反查口径来源是否一致。</div>
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
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <XCircle className="w-4 h-4 text-gray-500" />
                    为什么有时候血缘/口径看起来“不完整”
                </div>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-800">缺少上游穿透</div>
                        <div className="mt-2 text-sm text-gray-700">你可能只能看到到“字段/指标”为止，暂时追不到物理列/表。此时以字段/指标口径为准，再逐步补齐来源链路。</div>
                    </div>
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                        <div className="text-sm font-semibold text-gray-800">统计口径差异</div>
                        <div className="mt-2 text-sm text-gray-700">访问量（视图热度）与引用量（影响范围）不是一件事；先明确你要回答的问题再选指标。</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
