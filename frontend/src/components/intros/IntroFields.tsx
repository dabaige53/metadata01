'use client';

import React from 'react';
import {
    Columns,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Link2,
    FileText,
    Eye,
    Shield,
    TrendingUp,
    Lightbulb,
    ArrowRight,
    Tag,
    ShieldCheck,
    Activity,
    ListFilter,
    Copy,
    Search,
    Info,
    Database
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

export function IntroFields() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 - 强化字段去重概念 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-orange-200/40 via-amber-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-yellow-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg ring-4 ring-orange-50">
                                <Columns className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">字段治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-orange-600 uppercase tracking-wider">Field Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">标准字段 (Standard) vs 原始列 (Raw)</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            您当前查看的是<strong>标准字段定义</strong>。字段是语义层的原子单元。
                            系统已将物理层的<strong>原始列 (Raw Columns)</strong> 和语义层的<strong>计算字段</strong>进行了映射与去重。
                            此处展示的引用统计，汇总了该字段在所有工作簿中的使用情况。
                        </p>

                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 border border-gray-200 shadow-sm backdrop-blur-sm">
                                <Activity className="w-4 h-4 text-emerald-600" />
                                <span className="text-sm font-medium text-gray-700">物理映射追踪</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 border border-gray-200 shadow-sm backdrop-blur-sm">
                                <Layers className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">维度/度量自动识别</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/60 border border-gray-200 shadow-sm backdrop-blur-sm">
                                <Tag className="w-4 h-4 text-amber-600" />
                                <span className="text-sm font-medium text-gray-700">孤立字段检测</span>
                            </div>
                        </div>
                    </div>

                    {/* 右侧：血缘缩略图 */}
                    <div className="hidden lg:block relative w-80 h-48 rounded-2xl bg-white/50 border border-white/60 shadow-inner overflow-hidden">
                        <div className="absolute inset-0 p-4 opacity-80 hover:opacity-100 transition-opacity">
                            <IntroComplexLineage highlight="raw_field" />
                        </div>
                        <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-mono bg-white/80 px-2 py-0.5 rounded-full backdrop-blur-sm">
                            Lineage Preview
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
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <ListFilter className="w-4 h-4 text-orange-600" />
                                <span className="font-bold text-gray-900">同名定义 (Duplicates)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>发现“同名异义”</strong>。聚合所有<em>名字相同</em>的字段。用于发现不同数据源中名字相同但物理意义可能不同的字段。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Copy className="w-4 h-4 text-purple-600" />
                                <span className="font-bold text-gray-900">同定义实例 (Instances)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>发现“同义异名”</strong>。聚合所有映射到<em>同一物理列</em>的字段实例。
                                <br /><span className="text-purple-700 font-medium">统计数据为所有实例的累加值。</span>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <GitBranch className="w-4 h-4 text-green-600" />
                                <span className="font-bold text-gray-900">视图引用 (References)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>聚合后的静态引用</strong>。展示该字段及其所有同义实例被下游视图/工作簿使用的总次数，反映字段的重要程度。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Search className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">影响分析 (Impact)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                <strong>血缘上下游</strong>。
                                <br />上游：追溯物理表/列；
                                <br />下游：分析依赖此字段的<strong>计算指标</strong>及报表。
                            </div>
                        </div>
                    </div>
                </div>

                {/* 核心定义解析 (保留并适配字段逻辑) */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Info className="w-5 h-5 text-gray-400" />
                        <span>核心字段定义</span>
                    </h2>
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <Tag className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">角色 (Role)</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    <span className="font-semibold text-indigo-600">维度</span>：用于分类/筛选 (如: 地区)<br />
                                    <span className="font-semibold text-emerald-600">度量</span>：用于聚合计算 (如: 销售额)
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                                <Eye className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">孤立字段 (Orphan)</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    既没有被视图直接使用，也没有被任何计算指标引用的字段。通常建议评估后进行清理。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Database className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">物理映射 (Mapping)</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    字段是物理列在逻辑层（工作簿）的投影。一个物理列可能对应多个字段别名。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== 最佳实践 ========== */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <Lightbulb className="w-5 h-5 text-emerald-600" />
                    字段治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">规范命名约定</div>
                            <div className="text-sm text-gray-600">使用统一的命名规则，如"业务域_字段含义"</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">完善字段描述</div>
                            <div className="text-sm text-gray-600">包含业务含义、取值说明、数据来源</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">正确定义角色</div>
                            <div className="text-sm text-gray-600">确保维度/度量设置正确，避免误用</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">清理孤立字段</div>
                            <div className="text-sm text-gray-600">定期清理无引用的冗余字段定义</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========== 风险提示 ========== */}
            <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    常见风险与规避
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white/60 rounded-xl">
                        <div className="font-medium text-red-700 mb-1">🚨 角色定义错误</div>
                        <div className="text-sm text-gray-600">维度被误设为度量，导致聚合计算错误</div>
                        <div className="text-xs text-red-600 mt-2">→ 检查概览页的角色设置</div>
                    </div>
                    <div className="p-4 bg-white/60 rounded-xl">
                        <div className="font-medium text-red-700 mb-1">🚨 无描述字段</div>
                        <div className="text-sm text-gray-600">字段含义不明，使用者难以理解</div>
                        <div className="text-xs text-red-600 mt-2">→ 补充业务描述和取值说明</div>
                    </div>
                    <div className="p-4 bg-white/60 rounded-xl">
                        <div className="font-medium text-amber-700 mb-1">⚠️ 高影响字段变更</div>
                        <div className="text-sm text-gray-600">被多个指标引用的字段变更需谨慎</div>
                        <div className="text-xs text-amber-600 mt-2">→ 先评估「影响指标」标签</div>
                    </div>
                    <div className="p-4 bg-white/60 rounded-xl">
                        <div className="font-medium text-amber-700 mb-1">⚠️ 跨数据源同名</div>
                        <div className="text-sm text-gray-600">不同数据源存在同名字段，易造成混淆</div>
                        <div className="text-xs text-amber-600 mt-2">→ 使用筛选器排查同名情况</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
