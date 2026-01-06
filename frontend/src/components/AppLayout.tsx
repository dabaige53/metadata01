'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Database,
    Table2,
    Columns,
    FunctionSquare,
    Layers,
    BookOpen,
    FolderOpen,
    Users,
    Search,
    BookText,
    RefreshCw,
    Loader2,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import DetailDrawer from '@/components/DetailDrawer';

interface NavItemProps {
    href: string;
    icon: React.ElementType;
    label: string;
    count?: number;
}

function NavItem({ href, icon: Icon, label, count }: NavItemProps) {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                <span>{label}</span>
            </div>
            {count !== undefined && (
                <span className={`text-xs ml-auto ${isActive ? 'text-indigo-500 font-bold' : 'text-gray-400'}`}>
                    {count > 1000 ? (count / 1000).toFixed(1) + 'k' : count}
                </span>
            )}
        </Link>
    );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    const [stats, setStats] = useState<any>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [syncState, setSyncState] = useState<{
        isRunning: boolean;
        progress: string | null;
        error: string | null;
        lastCompleted: string | null;
        startedAt: string | null;
    }>({ isRunning: false, progress: null, error: null, lastCompleted: null, startedAt: null });
    const [showSyncModal, setShowSyncModal] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        api.getStats().then(setStats).catch(console.error);
        api.getSyncStatus().then(res => {
            setSyncState({
                isRunning: res.current.is_running,
                progress: res.current.progress,
                error: res.current.error,
                lastCompleted: res.current.last_completed,
                startedAt: res.current.started_at,
            });
        }).catch(console.error);
    }, []);

    // Keyboard shortcut: Cmd+K to focus search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim().length >= 2) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleSync = async () => {
        if (syncState.isRunning) return;
        
        setShowSyncModal(true);
        const now = new Date().toISOString();
        setSyncState(prev => ({ ...prev, isRunning: true, progress: '启动中...', error: null, startedAt: now }));
        
        try {
            await api.triggerSync();
            
            const pollStatus = setInterval(async () => {
                try {
                    const res = await api.getSyncStatus();
                    setSyncState({
                        isRunning: res.current.is_running,
                        progress: res.current.progress,
                        error: res.current.error,
                        lastCompleted: res.current.last_completed,
                        startedAt: res.current.started_at,
                    });
                    
                    if (!res.current.is_running) {
                        clearInterval(pollStatus);
                        api.getStats().then(setStats);
                    }
                } catch {
                    clearInterval(pollStatus);
                }
            }, 2000);
        } catch (err) {
            setSyncState(prev => ({ 
                ...prev, 
                isRunning: false, 
                error: err instanceof Error ? err.message : '同步失败' 
            }));
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 z-30">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
                            <Database className="w-5 h-5" />
                        </div>
                        <span className="text-lg font-bold text-gray-800">DataMap</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">数据血缘</div>
                    <NavItem href="/" icon={LayoutDashboard} label="概览" />
                    <NavItem href="/databases" icon={Database} label="数据库" count={stats.databases} />
                    <NavItem href="/tables" icon={Table2} label="数据表" count={stats.tables} />
                    <NavItem href="/datasources" icon={Layers} label="数据源" count={stats.datasources} />
                    <NavItem href="/workbooks" icon={BookOpen} label="工作簿" count={stats.workbooks} />
                    <NavItem href="/views" icon={LayoutDashboard} label="视图" count={stats.views} />

                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2 px-2">字段资产</div>
                    <NavItem href="/fields" icon={Columns} label="原始字段" count={stats.fields} />
                    <NavItem href="/metrics" icon={FunctionSquare} label="计算字段" count={stats.metrics} />

                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2 px-2">组织管理</div>
                    <NavItem href="/projects" icon={FolderOpen} label="项目" count={stats.projects} />
                    <NavItem href="/users" icon={Users} label="用户" count={stats.users} />

                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-2 px-2">知识库</div>
                    <NavItem href="/glossary" icon={BookText} label="术语介绍" />
                </div>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                            营
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">营销数据处</p>
                            <p className="text-xs text-gray-500 truncate">DataOffice@juneyaoair.com</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col ml-64 min-w-0">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-20">
                    <div className="flex-1 max-w-xl">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearch}
                                placeholder="全站搜索 (Cmd+K)"
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {mounted && (
                            <button
                                onClick={handleSync}
                                disabled={syncState.isRunning}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    syncState.isRunning 
                                        ? 'bg-indigo-100 text-indigo-600 cursor-not-allowed'
                                        : syncState.error
                                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                                title={syncState.progress || syncState.error || '点击同步 Tableau 元数据'}
                            >
                                {syncState.isRunning ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : syncState.error ? (
                                    <XCircle className="w-4 h-4" />
                                ) : syncState.lastCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <RefreshCw className="w-4 h-4" />
                                )}
                                {syncState.isRunning ? '同步中...' : '同步数据'}
                            </button>
                        )}
                        <span className="text-sm text-gray-500">本地测试版</span>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-8">
                    {children}
                </div>
            </main>

            {/* Global Components */}
            <DetailDrawer />

            {/* Sync Modal */}
            {mounted && showSyncModal && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/50 z-50"
                        onClick={() => !syncState.isRunning && setShowSyncModal(false)}
                    />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-6 w-[420px] z-50">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl ${
                                syncState.isRunning 
                                    ? 'bg-indigo-100' 
                                    : syncState.error 
                                    ? 'bg-red-100' 
                                    : 'bg-green-100'
                            }`}>
                                {syncState.isRunning ? (
                                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                ) : syncState.error ? (
                                    <XCircle className="w-6 h-6 text-red-600" />
                                ) : (
                                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">数据同步</h3>
                                <p className="text-sm text-gray-500">
                                    {syncState.isRunning ? '正在同步中...' : syncState.error ? '同步失败' : '同步完成'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-50 rounded-xl p-4">
                                <div className="text-xs font-medium text-gray-500 mb-1">当前状态</div>
                                <div className="text-sm text-gray-900 font-medium">
                                    {syncState.progress || '等待中...'}
                                </div>
                            </div>

                            {syncState.startedAt && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <div className="text-xs font-medium text-gray-500 mb-1">开始时间</div>
                                    <div className="text-sm text-gray-900">
                                        {new Date(syncState.startedAt).toLocaleString('zh-CN')}
                                    </div>
                                </div>
                            )}

                            {syncState.error && (
                                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                    <div className="text-xs font-medium text-red-600 mb-1">错误信息</div>
                                    <div className="text-sm text-red-700">{syncState.error}</div>
                                </div>
                            )}

                            {!syncState.isRunning && !syncState.error && syncState.lastCompleted && (
                                <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                    <div className="text-xs font-medium text-green-600 mb-1">完成时间</div>
                                    <div className="text-sm text-green-700">
                                        {new Date(syncState.lastCompleted).toLocaleString('zh-CN')}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowSyncModal(false)}
                            disabled={syncState.isRunning}
                            className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
                                syncState.isRunning
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            {syncState.isRunning ? '同步进行中，请稍候...' : '关闭'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

