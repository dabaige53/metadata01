'use client';

import React from 'react';
import {
    FunctionSquare,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Activity,
    Calculator,
    Copy,
    Search,
    Info,
    ListFilter,
    Lightbulb,
    HelpCircle,
    Hash,
    TrendingUp,
    ShieldCheck
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

export function IntroMetrics() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-amber-200/40 via-orange-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-yellow-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg ring-4 ring-orange-50">
                                <FunctionSquare className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">指标治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-orange-600 uppercase tracking-wider">Metrics Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">业务口径的标准定义</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            指标是业务逻辑的数学表达。在治理视角下，我们不仅关注<span className="font-semibold text-gray-900 border-b-2 border-amber-200">具体计算公式（实例）</span>，更关注<span className="font-semibold text-gray-900 border-b-2 border-amber-200">跨工作簿的同名同义性（去重）</span>，确保全企业数据口径的一致性。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg text-xs font-medium text-amber-900 border border-amber-100">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                基础指标 (Base)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg text-xs font-medium text-orange-900 border border-orange-100">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                计算指标 (Calculated)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                聚合方式 (SUM/AVG)
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg group-hover:scale-110 transition-transform"><Calculator className="w-4 h-4" /></div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">计算公式</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">公式哈希</div>
                            <div className="text-xs text-gray-500 mt-1">识别逻辑是否一致</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg group-hover:scale-110 transition-transform"><Copy className="w-4 h-4" /></div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">重复定义</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">去重聚合</div>
                            <div className="text-xs text-gray-500 mt-1">相同名称/口径归一</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 新版高级血缘图 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>指标在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        高亮展示 <span className="font-bold text-indigo-600">计算字段 (实例)</span> 与 <span className="font-bold text-green-600">去重字段 (治理标准)</span> 的映射关系
                    </p>
                </div>
                <IntroComplexLineage highlight="deduped_calculation" className="border-none shadow-none" />
            </div>

            {/* 🔥 新增：去重案例演示 (Case Study) */}
            <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-3xl border border-orange-100/50 p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/20 rounded-full blur-2xl -mt-10 -mr-10"></div>

                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3 relative z-10">
                    <Lightbulb className="w-5 h-5 text-orange-600" />
                    <span>为什么需要“指标去重”？案例演示</span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                    {/* 案例 1：同名异义 */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-red-200 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-md border border-red-100">Case A</span>
                            <h3 className="font-bold text-gray-900">同名异义 (Homonyms)</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                                <span className="text-gray-500">指标名称</span>
                                <span className="font-mono font-bold text-gray-900">"利润率"</span>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="text-xs text-gray-400">报表 A 的公式</div>
                                    <div className="p-2 bg-red-50 rounded border border-red-100 font-mono text-xs text-red-800 break-all">
                                        SUM([Profit]) / SUM([Sales])
                                    </div>
                                    <div className="text-xs text-red-500">聚合后相除 (正确)</div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="text-xs text-gray-400">报表 B 的公式</div>
                                    <div className="p-2 bg-red-50 rounded border border-red-100 font-mono text-xs text-red-800 break-all">
                                        AVG([Profit] / [Sales])
                                    </div>
                                    <div className="text-xs text-red-500">行级相除再平均 (错误)</div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-gray-100 mt-2">
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                                    <span><strong>治理结果：</strong>系统通过 AST 哈希识别出逻辑差异，强制将它们被标记为两个不同的去重指标。</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 案例 2：同义异名 */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-amber-200 hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-md border border-amber-100">Case B</span>
                            <h3 className="font-bold text-gray-900">同义异名 (Synonyms)</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                                <span className="text-gray-500">计算逻辑</span>
                                <span className="font-mono font-bold text-gray-900">SUM([Sales]) - SUM([Cost])</span>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="text-xs text-gray-400">报表 C 命名</div>
                                    <div className="p-2 bg-gray-50 rounded border border-gray-200 font-medium text-xs text-gray-700 text-center">
                                        Total Profit
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="text-xs text-gray-400">报表 D 命名</div>
                                    <div className="p-2 bg-gray-50 rounded border border-gray-200 font-medium text-xs text-gray-700 text-center">
                                        净利润
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-gray-100 mt-2">
                                <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                                    <span><strong>治理结果：</strong>系统识别出公式哈希完全一致，将两个指标归并为同一个“标准指标”，消除冗余。</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 底部功能区 - 对应 DetailDrawer 结构 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 详情页导航 */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <ListFilter className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">同名定义 (Duplicates)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                聚合所有“名称相同”的指标。这是治理的重点，用于发现<strong>同名异义</strong>的问题（如两个“利润率”公式逻辑是否不同）。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Copy className="w-4 h-4 text-purple-600" />
                                <span className="font-bold text-gray-900">同定义实例 (Instances)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                聚合所有“公式逻辑完全一致”的指标。用于发现<strong>同义异名</strong>的重复建设（如“净利”和“纯利”公式一样），推动口径合并。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <GitBranch className="w-4 h-4 text-green-600" />
                                <span className="font-bold text-gray-900">视图引用 (References)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                展示指标被<strong>下游视图</strong>引用的静态次数。引用数越高（如 &gt;290），代表业务依赖度越高，变更风险越大。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Search className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">影响分析 (Impact)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>全域影响范围</strong>。由于这是“标准指标”，修改它意味着您的变更建议将适用到所有关联的<strong>实例</strong>及其下游报表。
                            </div>
                        </div>
                    </div>
                </div>

                {/* 核心定义解析 - 基于真实代码 models.py 和 Card */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Info className="w-5 h-5 text-gray-400" />
                        <span>核心字段定义</span>
                    </h2>
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">复杂度 (Complexity)</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    基于公式嵌套层级和长度的评分。<br />
                                    <span className="text-[10px] bg-red-50 text-red-600 px-1 rounded">&gt;10 高风险</span>
                                    <span className="text-[10px] bg-green-50 text-green-600 px-1 rounded ml-1">&lt;4 低风险</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Hash className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">公式去重 (Check)</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    系统内置 AST 解析器，忽略空格和注释，仅基于代码逻辑结构生成指纹，精准识别重复。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">认证状态 (Certified)</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    <span className="inline-block px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold mr-1">GOLDEN</span>
                                    金标准。标识经过数据委员会人工审核的指标，是全企业的唯一事实来源。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
