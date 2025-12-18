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
    Bell,
    HelpCircle,
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
    const [stats, setStats] = useState<any>({});
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    useEffect(() => {
        // @ts-ignore
        api.getStats().then(setStats).catch(console.error);
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
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">资源</div>
                    <NavItem href="/" icon={LayoutDashboard} label="概览" />
                    <NavItem href="/databases" icon={Database} label="数据库" count={stats.databases} />
                    <NavItem href="/tables" icon={Table2} label="数据表" count={stats.tables} />
                    <NavItem href="/fields" icon={Columns} label="字段字典" count={stats.fields} />
                    <NavItem href="/metrics" icon={FunctionSquare} label="指标库" count={stats.metrics} />
                    <NavItem href="/datasources" icon={Layers} label="数据源" count={stats.datasources} />
                    <NavItem href="/workbooks" icon={BookOpen} label="工作簿" count={stats.workbooks} />
                    <NavItem href="/projects" icon={FolderOpen} label="项目" count={stats.projects} />
                    <NavItem href="/users" icon={Users} label="用户" count={stats.users} />
                </div>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-2 py-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                            N
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">Admin User</p>
                            <p className="text-xs text-gray-500 truncate">admin@company.com</p>
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
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-8">
                    {children}
                </div>
            </main>

            {/* Global Components */}
            <DetailDrawer />
        </div>
    );
}

