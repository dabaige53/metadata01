'use client';

import React from 'react';
import {
    Database,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Link2,
    Server,
    Table2,
    BookOpen,
    Zap,
    RefreshCw,
    Shield,
    Copy,
    Lightbulb,
    Info,
    Layout
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 数据源（Datasources）专属介绍页
 */
export function IntroDatasources() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-emerald-200/40 via-green-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-teal-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg ring-4 ring-emerald-50">
                                <Server className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">数据源治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Datasource Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">语义层的核心入口</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            数据源是连接<span className="font-semibold text-gray-900 border-b-2 border-emerald-200">物理表</span>与<span className="font-semibold text-gray-900 border-b-2 border-emerald-200">业务应用</span>的关键中间层。
                            治理的核心在于推广<span className="font-semibold text-gray-900 border-b-2 border-emerald-200">已发布数据源</span>的使用，收敛零散的嵌入式副本，确保数据口径的一致性。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg text-xs font-medium text-emerald-900 border border-emerald-100">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                已发布 (Published)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg text-xs font-medium text-amber-900 border border-amber-100">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                嵌入式 (Embedded)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                认证管理
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Shield className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">官方认证</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Certified</div>
                            <div className="text-xs text-gray-500 mt-1">金色认证标志</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Copy className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">副本管理</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">嵌入式</div>
                            <div className="text-xs text-gray-500 mt-1">需收敛治理</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>数据源在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        数据源位于 <span className="font-bold text-indigo-600">语义层</span>，向上承接物理表，向下支撑字段与工作簿。
                    </p>
                </div>
                <IntroComplexLineage highlight="datasources" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看数据源的认证状态、连接类型（Live/Extract）及负责的项目所有者。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Table2 className="w-4 h-4 text-cyan-600" />
                                <span className="font-bold text-gray-900">数据表 (Physical Tables)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                数据源连接的底层<strong>物理表</strong>。用于评估表结构变更对当前数据源的影响。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Layout className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">关联工作簿 (Connected Workbooks)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                依赖此数据源的所有<strong>工作簿</strong>。用于评估数据源下线或变更的波及范围。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-amber-50 hover:border-amber-200 hover:bg-amber-100/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Copy className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">嵌入式副本 (Embedded)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                基于此数据源产生的<strong>副本散点</strong>。治理重点：应尽早推动它们回归到统一的已发布版本。
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
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                <Copy className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">去嵌入化</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    嵌入式数据源会导致口径分叉和维护困难。目标是将“嵌入式”比例降至最低。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">认证推广</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    对高复用的核心数据源打上“Certified”标签，建立信任机制。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Zap className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">性能优化</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    评估 Live vs Extract 连接模式，对大数据量且实时性要求不高的场景推荐 Extract。
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
                    数据源治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">单一事实来源</div>
                            <div className="text-sm text-gray-600">原则上一个分析主题只保留一个已认证的发布数据源。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">定期清理副本</div>
                            <div className="text-sm text-gray-600">每季度审查一次嵌入式数据源列表，推动迁移。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
