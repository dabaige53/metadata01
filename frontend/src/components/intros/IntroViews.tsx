'use client';

import React from 'react';
import {
    Eye,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    BookOpen,
    Database,
    LineChart,
    Lightbulb,
    Layout,
    TrendingUp,
    Info,
    ListFilter,
    BarChart3
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 视图（Views）专属介绍页
 */
export function IntroViews() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-rose-200/40 via-red-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-pink-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg ring-4 ring-rose-50">
                                <Eye className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">视图治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-rose-600 uppercase tracking-wider">View Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">最终消费的展示面</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            视图是业务用户<span className="font-semibold text-gray-900 border-b-2 border-rose-200">直接交互</span>的界面，包括仪表板和工作表。
                            治理重点必须关注<span className="font-semibold text-gray-900 border-b-2 border-rose-200">用户流量（访问热度）</span>，并追溯其<span className="font-semibold text-gray-900 border-b-2 border-rose-200">数据血缘</span>，确保展示数据的准确性。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-lg text-xs font-medium text-rose-900 border border-rose-100">
                                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                                仪表板 (Dashboard)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-50 rounded-lg text-xs font-medium text-pink-900 border border-pink-100">
                                <span className="w-2 h-2 rounded-full bg-pink-500"></span>
                                工作表 (Worksheet)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                流量监控
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Layout className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">组成结构</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">组合关系</div>
                            <div className="text-xs text-gray-500 mt-1">仪表板与子表</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">用户流量</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">访问趋势</div>
                            <div className="text-xs text-gray-500 mt-1">衡量业务影响</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>视图在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        视图位于 <span className="font-bold text-indigo-600">全链路的最末端</span>，直接依赖字段和指标。
                    </p>
                </div>
                <IntroComplexLineage highlight="views" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-rose-200 hover:bg-rose-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                视图的基本信息、<strong>父级工作簿</strong>以及当前的访问量统计。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-rose-200 hover:bg-rose-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-4 h-4 text-orange-600" />
                                <span className="font-bold text-gray-900">使用字段 (Regular Fields)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                该视图直接使用的所有<strong>物理/原始字段</strong>。用于追溯数据来源的表和列。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-rose-200 hover:bg-rose-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">使用指标 (Calculated Metrics)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                该视图引用的复杂<strong>计算字段</strong>。这些是业务逻辑的核心，需重点关注其口径准确性。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-rose-200 hover:bg-rose-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <LineChart className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">访问统计 (Stats)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                30天流量趋势分析。帮助判断该报表是<strong>核心报表</strong>还是<strong>僵尸报表</strong>。
                            </div>
                        </div>
                    </div>
                </div>

                {/* 核心治理场景 */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Info className="w-5 h-5 text-gray-400" />
                        <span>核心治理场景</span>
                    </h2>
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <BarChart3 className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">流量分析</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    基于访问量区分治理优先级。高访问视图变更需严格审批，零访问视图建议下线。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center text-violet-600 shrink-0">
                                <GitBranch className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">口径追溯</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    当业务质疑数据准确性时，通过血缘图追溯其依赖的底层字段和计算逻辑。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                                <Layout className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">结构优化</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    识别过于复杂的仪表盘（包含过多工作表），建议按主题进行拆分，提升加载速度。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 最佳实践 */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <Lightbulb className="w-5 h-5 text-emerald-600" />
                    视图治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">核心报表认证</div>
                            <div className="text-sm text-gray-600">对Top 50热度视图进行人工认证，打上“Golden”标签。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">僵尸视图治理</div>
                            <div className="text-sm text-gray-600">对长期无访问的视图执行归档或隐藏，精简资产库。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
