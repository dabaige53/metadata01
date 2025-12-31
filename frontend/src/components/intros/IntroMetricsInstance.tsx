'use client';

import React from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    BookOpen,
    Calculator,
    FunctionSquare,
    SearchCode,
    Lightbulb,
    Info,
    ArrowRight
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 指标实例（Metric Instances）专属介绍页
 * 
 * 差异点：
 * - 聚焦"具体实现"、"公式细节"、"所属工作簿 context"
 * - 强调这是"某个报表里的具体算法"，而非"标准定义"
 */
export function IntroMetricsInstance() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 - Indigo/Violet for specific implementation context */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-indigo-200/40 via-blue-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-violet-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg ring-4 ring-indigo-50">
                                <Calculator className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">指标实例详情</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Metric Instance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">工作簿中的具体计算</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            您正在查看某一个工作簿内的<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">具体指标实现</span>。
                            此处展示的是该指标在特定上下文中的<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">计算公式</span>、本地别名以及它对工作簿内视图的驱动作用。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-900 border border-indigo-100">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                本地计算 (Local Calc)
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg text-xs font-medium text-violet-900 border border-violet-100">
                                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                具体公式
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                视图依赖
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <FunctionSquare className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">计算逻辑</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Formula</div>
                            <div className="text-xs text-gray-500 mt-1">查看详细代码</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">所属来源</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Workbook</div>
                            <div className="text-xs text-gray-500 mt-1">定位具体文件</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>指标实例的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        它位于 <span className="font-bold text-indigo-600">工作簿内部</span>，是“标准指标”的一个具体落地实现。
                    </p>
                </div>
                {/* 
                   TODO: IntroComplexLineage highlight might need to be 'metrics' or a specific subclass 
                   For now, 'metrics' conveys the semantic layer well enough.
                */}
                <IntroComplexLineage highlight="metrics" className="border-none shadow-none" />
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
                                查看该实例的<span className="font-bold text-indigo-600">完整计算公式</span>、数据类型以及它在工作簿中的本地名称。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">所属工作簿 (Workbook)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                跳转到该指标所在的工作簿，查看其在报表中的实际呈现效果。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-4 h-4 text-pink-600" />
                                <span className="font-bold text-gray-900">标准对照 (Standard)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                比较该“实例公式”与“标准定义”是否一致。如果公式被篡改，此处会示警。
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
                                <SearchCode className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">公式审计</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    检查开发者是否在本地修改了标准公式（如 `SUM(Sales)` 改为 `SUM(Sales)*1.1`）。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">溯源定位</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    当报表数据异常时，直接查看此处的实例公式，快速定位逻辑错误。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
