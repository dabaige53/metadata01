'use client';

import React from 'react';
import {
    Database, // Keep Database for consistency if needed, but FileCode fits embedded better?
    FileCode, // Better for embedded/files
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Copy,
    Unplug,
    ArrowRight,
    Ban,
    RefreshCw,
    ShieldAlert
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 嵌入式数据源（Embedded Datasources）专属介绍页
 * 
 * 差异点：
 * - 强调"非标"、"副本"、"治理对象"
 * - 颜色基调：Amber (警告/治理) vs Standard (Emerald/Teal)
 */
export function IntroDatasourcesEmbedded() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 - Amber/Orange Warning Theme */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-amber-200/40 via-orange-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-red-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg ring-4 ring-amber-50">
                                <FileCode className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">嵌入式数据源</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-amber-600 uppercase tracking-wider">Embedded Datasource</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">需收敛的临时对象</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            嵌入式数据源是直接<span className="font-semibold text-gray-900 border-b-2 border-amber-200">固化在工作簿内部</span>的私有连接。
                            它们通常包含<span className="font-semibold text-gray-900 border-b-2 border-amber-200">重复的业务逻辑</span>且难以被其他工作簿复用。治理目标是将高频使用的嵌入式数据源<span className="font-semibold text-gray-900 border-b-2 border-amber-200">发布 (Publish)</span> 为标准数据源。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg text-xs font-medium text-amber-900 border border-amber-100">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                私有 (Private)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg text-xs font-medium text-orange-900 border border-orange-100">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                高维护成本
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-lg text-xs font-medium text-red-900 border border-red-100">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                口径分叉风险
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Copy className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">存在形式</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Workbook</div>
                            <div className="text-xs text-gray-500 mt-1">寄生于工作簿文件中</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-red-100 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Unplug className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">复用能力</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">0</div>
                            <div className="text-xs text-gray-500 mt-1">不可作为独立资产复用</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 - Highlight warning/embedded path */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-amber-600" />
                        <span>嵌入式数据源的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        它不是独立的语义层节点，而是<span className="font-bold text-amber-600">工作簿的一部分</span>，直接连接物理表。
                    </p>
                </div>
                {/* 
                    TODO: Update IntroComplexLineage to support a specific 'embedded-datasource' highlight mode if desired.
                    For now, highlighting 'datasources' is accurate conceptually, but we might want to differentiate visually later.
                */}
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
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看其所属工作簿、连接类型（Live/Extract）及包含的表数量。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <GitBranch className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">物理表 (Physical Tables)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                既然是直连物理层，必须监控其引用的底层表是否稳定，以及是否存在复杂的Custom SQL。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <RefreshCw className="w-4 h-4 text-blue-600" />
                                <span className="font-bold text-gray-900">迁移评估 (Migration)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                评估将其发布为标准数据源的潜力：是否包含高价值的计算字段？是否有复用需求？
                            </div>
                        </div>
                    </div>
                </div>

                {/* 核心治理场景 */}
                <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                        <span>治理任务：去嵌入化</span>
                    </h2>
                    <div className="space-y-6">
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">识别重复建设</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    多个工作簿嵌入且重复定义了相同的计算逻辑（如“毛利率”），是治理的首要目标。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <RefreshCw className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">推动发布</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    将嵌入式源发布到Server，成为单一事实来源（SSOT），供全团队复用。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
