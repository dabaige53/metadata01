'use client';

import React from 'react';
import {
    Columns,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Table2,
    Shield,
    Lightbulb,
    Info,
    ArrowRight,
    FileText,
    Database,
    Binary
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 原始字段/列（Raw Fields / Columns）专属介绍页
 * 
 * 差异点：
 * - 聚焦"物理属性"、"类型"、"底层Schema"
 * - 强调这是"数据库里的真实样子"，未经Tableau语义加工
 */
export function IntroFieldsRaw() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 - Sky/Blue for Physical/Raw context */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-sky-200/40 via-blue-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-cyan-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg ring-4 ring-sky-50">
                                <Columns className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">原始列 / 物理字段</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-sky-600 uppercase tracking-wider">Raw Column</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">数据库底层定义</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            原始列是数据在<span className="font-semibold text-gray-900 border-b-2 border-sky-200">物理存储层</span>的真实形态。
                            它没有别名、没有计算逻辑，直接映射自<span className="font-semibold text-gray-900 border-b-2 border-sky-200">数据库表结构</span>。理解原始列是进行数据血缘追踪和变更影响分析的起点。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-lg text-xs font-medium text-sky-900 border border-sky-100">
                                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                物理层 (Physical)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                原生类型
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-50 rounded-lg text-xs font-medium text-cyan-900 border border-cyan-100">
                                <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                                基础Schema
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Binary className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">存储类型</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Type</div>
                            <div className="text-xs text-gray-500 mt-1">INT, VARCHAR...</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Table2 className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">所属来源</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Table</div>
                            <div className="text-xs text-gray-500 mt-1">物理表/视图</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-sky-600" />
                        <span>原始列在全链路中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        它位于 <span className="font-bold text-sky-600">最底层的物理层</span>，是所有上层语义字段的根基。
                    </p>
                </div>
                {/* 
                   TODO: IntroComplexLineage highlight might need to be 'columns' or 'raw-fields'
                   Assuming 'columns' highlights the physical layer node.
                */}
                <IntroComplexLineage highlight="columns" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看列的物理名称、数据类型以及<span className="font-bold text-sky-600">是否有NULL值</span>等基础统计。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Table2 className="w-4 h-4 text-blue-600" />
                                <span className="font-bold text-gray-900">所属表 (Table)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                跳转到物理表详情页，查看该列在表结构中的位置以及其他兄弟列。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <GitBranch className="w-4 h-4 text-violet-600" />
                                <span className="font-bold text-gray-900">下游引用 (Usage)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看该物理列被哪些语义层字段引用。如果物理列删除，这些下游字段将直接报错。
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
                                <h4 className="font-bold text-gray-900 text-sm">变更预警</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    DBA修改表结构（如重命名列）前，必须评估对“下游引用”的破坏性。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">敏感标记</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    在物理层级对手机号、身份证等列进行标记，从源头控制数据安全。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
