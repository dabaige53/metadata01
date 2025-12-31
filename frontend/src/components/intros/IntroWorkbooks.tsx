'use client';

import React from 'react';
import {
    BookOpen,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Eye,
    Server,
    Database,
    LineChart,
    Lightbulb,
    Search,
    Info,
    ListFilter,
    Calendar,
    Users
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 工作簿（Workbooks）专属介绍页
 */
export function IntroWorkbooks() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-yellow-200/40 via-amber-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-orange-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg ring-4 ring-yellow-50">
                                <BookOpen className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">工作簿治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-amber-600 uppercase tracking-wider">Workbook Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">业务交付的核心载体</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            工作簿是<span className="font-semibold text-gray-900 border-b-2 border-amber-200">数据产品的最终交付形态</span>。
                            治理重点在于评估其<span className="font-semibold text-gray-900 border-b-2 border-amber-200">访问热度</span>以优化资源，管控其<span className="font-semibold text-gray-900 border-b-2 border-amber-200">数据源依赖</span>以确保稳定性，并清晰化<span className="font-semibold text-gray-900 border-b-2 border-amber-200">责任归属</span>。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg text-xs font-medium text-yellow-900 border border-yellow-100">
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                核心资产
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg text-xs font-medium text-amber-900 border border-amber-100">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                访问热度
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-lg text-xs font-medium text-orange-900 border border-orange-100">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                依赖管理
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 - 动态风格 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Eye className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">包含内容</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">视图/仪表板</div>
                            <div className="text-xs text-gray-500 mt-1">可视化组件集合</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <LineChart className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">业务价值</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">访问统计</div>
                            <div className="text-xs text-gray-500 mt-1">近30天热度趋势</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>工作簿在全链路中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        工作簿作为 <span className="font-bold text-indigo-600">消费层容器</span>，承接数据源并为视图提供环境
                    </p>
                </div>
                <IntroComplexLineage highlight="workbooks" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看工作簿的<strong>基本信息</strong>、所有者、所属项目以及关键的统计指标（视图数、数据源数）。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Server className="w-4 h-4 text-green-600" />
                                <span className="font-bold text-gray-900">数据源 (Direct Datasources)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                所有的<strong>已发布数据源</strong>依赖。这是推荐的连接方式，便于统一治理和口径管理。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">嵌入式数据源 (Embedded)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                工作簿内<strong>私有定义</strong>的数据源。重点治理对象，建议推动迁移至已发布数据源。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-yellow-200 hover:bg-yellow-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <LineChart className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">访问统计 (Stats)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                30天内的访问趋势。识别<strong>零访问</strong>僵尸资产或<strong>高频</strong>核心资产。
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
                                <h4 className="font-bold text-gray-900 text-sm">零访问资产下线</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    长期无访问的工作簿应标记并归档，释放服务器资源，减少维护噪音。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">所有权确认</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    确保每个工作簿都有明确的<strong>在职负责人</strong>。离职人员资产需及时交接。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                                <Server className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">去嵌入化</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    发现使用了 Custom SQL 或本地文件的嵌入式数据源，推动其转化为服务器即席数据源。
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
                    工作簿治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">核心资产SLA保障</div>
                            <div className="text-sm text-gray-600">对高访问（Top 20%）工作簿建立变更审批机制，防止误操作。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">定期清理机制</div>
                            <div className="text-sm text-gray-600">每季度审查一次最近90天无访问的工作簿，执行下线流程。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
