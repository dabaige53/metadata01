'use client';

import React from 'react';
import {
    Folder,
    AlertTriangle,
    CheckCircle2,
    GitBranch,
    Layers,
    BookOpen,
    Server,
    Users,
    Shield,
    Lightbulb,
    Info,
    Lock,
    Building2
} from 'lucide-react';
import { IntroComplexLineage } from './IntroComplexLineage';

/**
 * 项目（Projects）专属介绍页
 */
export function IntroProjects() {
    return (
        <div className="space-y-8 p-6 bg-gray-50/50 min-h-screen">
            {/* Hero 区 */}
            <div className="relative overflow-hidden bg-white/40 backdrop-blur-xl rounded-3xl border border-white/50 p-10 shadow-xl ring-1 ring-gray-900/5">
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-gradient-to-bl from-indigo-200/40 via-violet-100/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 left-0 -mb-24 -ml-24 w-72 h-72 bg-gradient-to-tr from-purple-200/30 to-transparent rounded-full blur-3xl" />

                <div className="relative flex flex-col lg:flex-row gap-10 items-start">
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg ring-4 ring-indigo-50">
                                <Folder className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">项目治理指南</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Project Governance</span>
                                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                    <span className="text-sm text-gray-500">资源容器与权限边界</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-lg text-gray-600 leading-relaxed max-w-2xl">
                            项目是Tableau Server中的<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">顶级容器</span>。
                            它不仅从逻辑上隔离了<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">业务域</span>（如财务、销售），更是实施<span className="font-semibold text-gray-900 border-b-2 border-indigo-200">权限控制</span>（Permissions）和责任归属（Ownership）的基本单元。
                        </p>

                        <div className="flex flex-wrap gap-3 pt-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-lg text-xs font-medium text-indigo-900 border border-indigo-100">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                业务域
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-lg text-xs font-medium text-violet-900 border border-violet-100">
                                <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                                权限边界
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg text-xs font-medium text-purple-900 border border-purple-100">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                资产池
                            </div>
                        </div>
                    </div>

                    {/* 关键指标卡片 */}
                    <div className="grid grid-cols-2 gap-4 w-full lg:w-auto min-w-[320px]">
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Building2 className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">包含资产</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">资产总数</div>
                            <div className="text-xs text-gray-500 mt-1">工作簿+数据源</div>
                        </div>
                        <div className="group bg-white/60 hover:bg-white backdrop-blur-md rounded-2xl p-5 border border-white shadow-sm ring-1 ring-gray-900/5 transition-all text-left">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="p-1.5 bg-violet-100 text-violet-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <Users className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">责任人</span>
                            </div>
                            <div className="text-2xl font-black text-gray-900">Owner</div>
                            <div className="text-xs text-gray-500 mt-1">项目第一责任人</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 全链路可视化 */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-1 overflow-hidden">
                <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-6 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                        <GitBranch className="w-5 h-5 text-indigo-600" />
                        <span>项目在全链路治理中的位置</span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 ml-8">
                        项目是 <span className="font-bold text-indigo-600">资源容器层</span>，管理工作簿与数据源等应用层资产的组织边界。
                    </p>
                </div>
                <IntroComplexLineage highlight="projects" className="border-none shadow-none" />
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
                                查看项目的<strong>所有者(Owner)</strong>、创建时间、以及包含的子项目和资产概况。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-4 h-4 text-amber-600" />
                                <span className="font-bold text-gray-900">工作簿 (Workbooks)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                项目下所有的<strong>工作簿列表</strong>。可按访问量排序，识别该项目下的核心报表资产。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Server className="w-4 h-4 text-green-600" />
                                <span className="font-bold text-gray-900">数据源 (Datasources)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                项目下所有的<strong>已发布数据源</strong>。评估该项目的语义层建设完备度。
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors cursor-default h-full">
                            <div className="flex items-center gap-2 mb-2">
                                <Lock className="w-4 h-4 text-indigo-600" />
                                <span className="font-bold text-gray-900">权限管理 (Permissions)</span>
                            </div>
                            <div className="text-xs text-gray-500 leading-relaxed">
                                (需管理员权限) 查看项目的<strong>用户组权限</strong>设置，确保敏感数据不越界。
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
                                <h4 className="font-bold text-gray-900 text-sm">空壳项目清理</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    发现不包含任何资产的废弃项目，建议归档或删除，减少管理噪音。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Users className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">Owner离职交接</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    项目所有者是资产第一责任人。人员变动时，必须及时移交项目的所有权。
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">敏感域隔离</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    财务、人事等敏感业务域应设立独立项目，并实施严格的“封闭式”权限管理。
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
                    项目治理最佳实践
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">扁平化结构</div>
                            <div className="text-sm text-gray-600">尽量避免过深（&gt;3层）的子项目嵌套，保持层级扁平。</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-full bg-emerald-100 text-emerald-600 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="font-medium text-gray-900">按部门/主题划分</div>
                            <div className="text-sm text-gray-600">推荐按“一级部门”或“核心业务线”来划分顶级项目。</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
