'use client';

import React from 'react';
import {
    Columns,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Database,
    Table2,
    Shield,
    TrendingUp,
    Lightbulb,
    Info,
    FileText,
    Tag,
    ListFilter
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 原始列（Columns）专属介绍页
 */
export function IntroColumns() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-sky-200/40 via-blue-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-indigo-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg ring-4 ring-sky-50">
                                <Columns className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">原始列治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-sky-600 uppercase tracking-wider">Column Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">物理层的基础字段</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            原始列是数据仓库中的<span className="font-semibold text-gray-900 border-b-2 border-sky-200">物理原子</span>。
                            治理重点在于完善<span className="font-semibold text-gray-900 border-b-2 border-sky-200">业务含义（描述）</span>，识别<span className="font-semibold text-gray-900 border-b-2 border-sky-200">敏感数据</span>，并监控其类型变更对下游计算的影响。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-lg text-xs font-medium text-sky-900 border border-sky-100">
                                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                物理Schema
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                数据类型
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-900 border border-indigo-100">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                敏感识别
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-sky-100 text-sky-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Tag className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">元数据</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Type & Desc</div>
                            <div className="text-xs text-gray-500 mt-1">类型与描述</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">下游影响</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">引用链</div>
                            <div className="text-xs text-gray-500 mt-1">字段-&gt;指标-&gt;视图</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>原始列在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        原始列位于 <span className="font-bold text-indigo-600">物理层末端</span>，向上映射为语义层的字段。
                    </p>
                </div>
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
                                查看列的<strong>数据类型</strong>(String/Int等)、是否为主键/NULL以及列的文本描述。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <GitBranch className="w-4 h-4 text-violet-600" />
                                <span className="font-bold text-gray-900">血缘分析 (Lineage)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                追踪该列被映射到了哪些Tableau数据源字段，进而影响了哪些报表。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Table2 className="w-4 h-4 text-cyan-600" />
                                <span className="font-bold text-gray-900">所属表 (Parent Table)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                跳转至所属数仓表的详情页，查看表的完整结构和其他兄弟列。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-sky-100 hover:border-sky-200 hover:bg-sky-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-red-600" />
                                <span className="font-bold text-gray-900">敏感等级 (Classification)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                如果该列涉及PII或其他敏感信息，在此处查看其安全分类标签。
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
                                <FileText className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">完善描述</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    消除“无描述”列。数仓字典的完备性是自助分析的前提。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">敏感数据扫描</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    对电话、身份证、薪资等敏感字段进行标记，防止在自助分析中无意泄露。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Tag className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">类型监控</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    监控字段类型变更（如String变Int），这往往是导致ETL失败或报表报错的元凶。
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
                    原始列治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">命名规范化</div>
                            <div className="text-sm text-gray-600">物理列名应使用下划线命名法，避免使用拼音缩写。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">枚举值备注</div>
                            <div className="text-sm text-gray-600">对于状态类字段（Status），应在描述中注明各枚举值的含义。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
