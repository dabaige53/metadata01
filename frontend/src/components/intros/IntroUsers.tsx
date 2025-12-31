'use client';

import React from 'react';
import {
    User,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    BookOpen,
    Server,
    Shield,
    Lightbulb,
    Info,
    Mail,
    Calendar,
    FileText
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 用户（Users）专属介绍页
 */
export function IntroUsers() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-blue-200/40 via-indigo-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-sky-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg ring-4 ring-blue-50">
                                <User className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">用户治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">User Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">资产所有者与消费者</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            用户是数据生态中的<span className="font-semibold text-gray-900 border-b-2 border-blue-200">创造者</span>和<span className="font-semibold text-gray-900 border-b-2 border-blue-200">消费者</span>。
                            治理的核心是明确<span className="font-semibold text-gray-900 border-b-2 border-blue-200">资产责任归属</span>，处理人员离职带来的资产孤儿问题，并监控账号活跃度。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg text-xs font-medium text-blue-900 border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Creator
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-900 border border-indigo-100">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                Explorer
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-50 rounded-lg text-xs font-medium text-sky-900 border border-sky-100">
                                <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                                Viewer
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">发布资产</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">资产总数</div>
                            <div className="text-xs text-gray-500 mt-1">工作簿与数据源</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">活跃状态</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">最后登录</div>
                            <div className="text-xs text-gray-500 mt-1">评估账号活跃度</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>用户在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        用户是数据资产的 <span className="font-bold text-indigo-600">责任主体</span>，作为工作簿和数据源的所有者参与治理。
                    </p>
                </div>
                <IntroComplexLineage highlight="users" className="border-none shadow-none" />
            </div>

            {/* 详情页功能导航 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm h-full">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <Layers className="w-5 h-5 text-gray-400" />
                        <span>详情页功能导航</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-bold text-gray-900">概览 (Overview)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                用户的基本信息、角色权限、邮箱联系方式以及<strong>资产拥有量</strong>统计。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">工作簿 (Owned Workbooks)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                该用户所有的<strong>工作簿资产</strong>。离职交接时的核心清单。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Server className="w-4 h-4 text-green-600" />
                                <span className="font-bold text-gray-900">数据源 (Owned Datasources)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                该用户发布的<strong>数据源资产</strong>。需评估是否需要移交给新的数据管理员。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-blue-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">权限与角色 (Roles)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                查看用户的<strong>站点角色</strong>（Server Admin/Site Admin/Creator等），审查权限是否过大。
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
                                <User className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">离职人员交接</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    员工离职前，必须通过“工作簿”和“数据源”标签页清点其资产，并进行所有权移交。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 shrink-0">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">僵尸账号清理</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    定期扫描长期无登录（&gt;180天）的Viewer账号，释放License资源。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Mail className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">治理协同</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    数据变更时，通过邮箱通知受影响资产的所有者（Owner）。
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
                    用户治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">实名制管理</div>
                            <div className="text-sm text-gray-600">确保账号与真实员工对应，避免使用公用账号。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">License优化</div>
                            <div className="text-sm text-gray-600">定期降级低频Creator为Viewer，节省成本。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
