'use client';

import React from 'react';
import {
    Type,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    BookOpen,
    Table2,
    Lightbulb,
    Info,
    ArrowRight,
    Braces
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 字段实例（Field Instances）专属介绍页
 * 
 * 差异点：
 * - 聚焦"工作簿内的具体字段"、"重命名"、"本地计算"
 * - 强调这是"某个报表里的字段"，而非"全域标准字段"
 */
export function IntroFieldsInstance() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 - Indigo/Violet for Workbook Context */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-indigo-200/40 via-purple-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-blue-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg ring-4 ring-indigo-50">
                                <Type className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">字段实例详情</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Field Instance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">工作簿内的字段引用</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            您正在查看特定工作簿中的<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">字段引用</span>。
                            开发者可能在工作簿中对该字段进行了<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">重命名</span>、修改了别名或改变了数据类型。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-900 border border-indigo-100">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                本地引用
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg text-xs font-medium text-purple-900 border border-purple-100">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                别名覆盖
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                上下文依赖
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">所属环境</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Workbook</div>
                            <div className="text-xs text-gray-500 mt-1">仅在此工作簿生效</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Braces className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">映射关系</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Alias</div>
                            <div className="text-xs text-gray-500 mt-1">可能与物理列名不同</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>字段实例在全链路中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        它位于 <span className="font-bold text-indigo-600">工作簿层</span>，直接被视图 (View) 消费。
                    </p>
                </div>
                {/* 
                   TODO: IntroComplexLineage highlight might need to be 'fields' but focused on workbook usage.
                */}
                <IntroComplexLineage highlight="fields" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看该字段在当前工作簿中的<span className="font-bold text-indigo-600">本地名称</span>、数据角色（维度/度量）及远程源列名。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-4 h-4 text-purple-600" />
                                <span className="font-bold text-gray-900">受影响视图 (Views)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看该字段被当前工作簿的哪些 Sheet/Dashboard 使用。删除前务必检查。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Table2 className="w-4 h-4 text-blue-600" />
                                <span className="font-bold text-gray-900">标准对照 (Source)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                追溯该字段对应的“标准字段”或“物理列”，确认数据来源的准确性。
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
                                <Type className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">重命名混乱</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    避免随意重命名（如将 `sales_amt` 改为 `收入`），这会导致跨工作簿的理解歧义。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Layers className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">清理无用字段</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    如果一个本地字段未被任何视图引用，应在工作簿中将其隐藏或删除，提升性能。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
