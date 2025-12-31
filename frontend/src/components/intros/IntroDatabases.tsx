'use client';

import React from 'react';
import {
    Database,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    Table2,
    Shield,
    Lightbulb,
    Info,
    Server,
    Lock,
    Network
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 数据库（Databases）专属介绍页
 */
export function IntroDatabases() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-violet-200/40 via-purple-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-fuchsia-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg ring-4 ring-violet-50">
                                <Database className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">数据库治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-violet-600 uppercase tracking-wider">Database Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">物理数据的顶层容器</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            数据库（及Schema）是Tableau连接物理世界的入口。
                            治理重点在于收敛<span className="font-semibold text-gray-900 border-b-2 border-violet-200">连接配置</span>，监控<span className="font-semibold text-gray-900 border-b-2 border-violet-200">表结构变更</span>风险，以及管理不同环境（Dev/Prod）的切换。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg text-xs font-medium text-violet-900 border border-violet-100">
                                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                物理容器
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg text-xs font-medium text-purple-900 border border-purple-100">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                连接管理
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-fuchsia-50 rounded-lg text-xs font-medium text-fuchsia-900 border border-fuchsia-100">
                                <span className="w-2 h-2 rounded-full bg-fuchsia-500"></span>
                                Schema
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Table2 className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">包含资产</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">表数量</div>
                            <div className="text-xs text-gray-500 mt-1">Tables/Views</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Network className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">服务对象</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">连接数</div>
                            <div className="text-xs text-gray-500 mt-1">被多少数据源连接</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>数据库在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        数据库是 <span className="font-bold text-indigo-600">最上游的源头</span>，Tableau 的数据源通过连接配置指向具体的数据库实例。
                    </p>
                </div>
                <IntroComplexLineage highlight="databases" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看数据库类型(Snowflake/Postgres/Oracle等)、Schema名称及连接统计。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Table2 className="w-4 h-4 text-cyan-600" />
                                <span className="font-bold text-gray-900">数据表 (Tables)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                该数据库下所有被Tableau引用的<strong>物理表清单</strong>。识别僵尸表和热点表。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <GitBranch className="w-4 h-4 text-violet-600" />
                                <span className="font-bold text-gray-900">血缘影响 (Lineage)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                评估数据库迁移或停机维护时，会波及哪些Tableau报表和用户。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-violet-100 hover:border-violet-200 hover:bg-violet-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Server className="w-4 h-4 text-purple-600" />
                                <span className="font-bold text-gray-900">连接对象 (Connections)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                哪些Tableau数据源直连了此数据库。用于排查账号密码过期或连接串配置错误。
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
                                    DB改表名或切库前，必须根据血缘全景图，提前通知下游所有受影响的业务方。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Server className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">连接治理</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    发现使用个人账号连接生产库的高危行为，推动切换至Service Account。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-fuchsia-50 flex items-center justify-center text-fuchsia-600 shrink-0">
                                <Database className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">废弃库清理</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    及时下线指向已废弃旧数仓的Tableau连接，避免报错和数据误导。
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
                    数据库治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">使用服务账号</div>
                            <div className="text-sm text-gray-600">生产环境必须使用专用的Service Account进行连接。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">读写分离</div>
                            <div className="text-sm text-gray-600">分析连接应指向只读从库，避免拖垮业务主库。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
