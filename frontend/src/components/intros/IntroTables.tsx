'use client';

import React from 'react';
import {
    Table2,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Database,
    Columns,
    Server,
    BookOpen,
    Shield,
    Lightbulb,
    Info,
    Link2,
    Eye
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 数据表（Tables）专属介绍页
 */
export function IntroTables() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-cyan-200/40 via-sky-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-blue-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-lg ring-4 ring-cyan-50">
                                <Table2 className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">数据表治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-cyan-600 uppercase tracking-wider">Table Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">物理层的基础承载单元</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            数据表是所有分析数据的<span className="font-semibold text-gray-900 border-b-2 border-cyan-200">物理源头</span>。
                            治理重点在于监控<span className="font-semibold text-gray-900 border-b-2 border-cyan-200">表结构变更</span>（如删列、改名）对下游的破坏性影响，并识别<span className="font-semibold text-gray-900 border-b-2 border-cyan-200">敏感数据</span>。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 rounded-lg text-xs font-medium text-cyan-900 border border-cyan-100">
                                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                物理表 (Physical)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-lg text-xs font-medium text-sky-900 border border-sky-100">
                                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                Custom SQL
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                结构监控
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-cyan-100 text-cyan-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Columns className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">结构复杂度</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">列数量</div>
                            <div className="text-xs text-gray-500 mt-1">字段越多越需关注</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Server className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">下游影响</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">引用数</div>
                            <div className="text-xs text-gray-500 mt-1">被多少数据源使用</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>数据表在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        数据表位于 <span className="font-bold text-indigo-600">物理层</span>，是所有下游分析资产的根基。
                    </p>
                </div>
                <IntroComplexLineage highlight="tables" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                表的基本信息、列数统计、归属数据库以及<strong>是否被引用</strong>（活跃/僵尸表识别）。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Columns className="w-4 h-4 text-cyan-600" />
                                <span className="font-bold text-gray-900">原始列 (Raw Columns)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看表的完整<strong>物理Schema</strong>。治理任务：补充列描述，识别敏感字段。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Server className="w-4 h-4 text-green-600" />
                                <span className="font-bold text-gray-900">数据源 (Datasources)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                直接引用该表的所有<strong>已发布数据源</strong>。表变更将直接影响这些对象。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-cyan-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">嵌入式引用 (Embedded)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                被工作簿以<strong>Custom SQL</strong>或直连方式引用的情况。这是高风险点，变更前极易被忽略。
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
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">变更影响评估</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    DBA在修改表结构前，必须检查此表被多少上层应用引用，防止生产事故。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Database className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">孤立表清理</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    发现未被任何数据源引用的“僵尸表”，建议进行归档或删除，节省存储资源。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">敏感数据标记</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    对包含手机号、身份证的列进行系统级标记，作为数据脱敏的依据。
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
                    数据表治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">使用率 &gt; 0</div>
                            <div className="text-sm text-gray-600">确保数仓中的表都被有效使用，避免无效建设。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">禁止 Select *</div>
                            <div className="text-sm text-gray-600">自定义 SQL 中应明确列名，避免表结构变更导致错位。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
