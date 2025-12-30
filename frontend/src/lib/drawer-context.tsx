'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { api } from './api';

export interface DrawerItem {
    id: string;
    type: string;
    name?: string;
    mode?: string;  // 'aggregate' | 'instance' - 用于计算字段区分聚合/实例模式
    activeTab?: string;  // 当前激活的 tab 页，用于回退时恢复状态
}

interface DrawerContextType {
    openDrawer: (id: string, type: string, name?: string, mode?: string) => void;
    pushItem: (id: string, type: string, name?: string, mode?: string) => void;
    goBack: () => void;
    goToIndex: (index: number) => void;
    closeDrawer: () => void;
    isOpen: boolean;
    currentItem: DrawerItem | null;
    history: DrawerItem[];
    prefetch: (id: string, type: string, mode?: string) => void;
    getCachedItem: (id: string, type: string, mode?: string) => any;
    updateCurrentTab: (tab: string) => void;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<DrawerItem[]>([]);
    const [cache, setCache] = useState<Record<string, any>>({});

    // 预加载数据 (Prefetching)
    const prefetch = async (id: string, type: string, mode?: string) => {
        const key = mode ? `${type}:${id}:${mode}` : `${type}:${id}`;
        if (cache[key]) return; // 如果已有缓存，直接跳过 (假设数据短期内不变)

        try {
            const data = await api.getDetail(type, id, mode);
            setCache(prev => ({ ...prev, [key]: data }));
        } catch (e: any) {
            // 静默处理 404 错误（孤立引用导致的数据不一致），仅开发模式下打印 warn
            if (e?.message?.includes('404')) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn(`[Prefetch] 资源不存在: ${key}`);
                }
            } else {
                console.error('Prefetch failed for', key, e);
            }
        }
    };

    const getCachedItem = (id: string, type: string, mode?: string) => {
        const key = mode ? `${type}:${id}:${mode}` : `${type}:${id}`;
        return cache[key] || null;
    };

    const openDrawer = (id: string, type: string, name?: string, mode?: string) => {
        setHistory([{ id, type, name, mode, activeTab: 'overview' }]);
        setIsOpen(true);
    };

    const pushItem = (id: string, type: string, name?: string, mode?: string) => {
        setHistory(prev => [...prev, { id, type, name, mode, activeTab: 'overview' }]);
    };

    const updateCurrentTab = (tab: string) => {
        setHistory(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], activeTab: tab };
            return updated;
        });
    };

    const goBack = () => {
        setHistory(prev => {
            if (prev.length <= 1) return prev;
            return prev.slice(0, -1);
        });
    };

    const goToIndex = (index: number) => {
        setHistory(prev => prev.slice(0, index + 1));
    };

    const closeDrawer = () => {
        setIsOpen(false);
        // Don't clear history immediately to allow animation to finish
        setTimeout(() => setHistory([]), 300);
    };

    const currentItem = history.length > 0 ? history[history.length - 1] : null;

    return (
        <DrawerContext.Provider value={{
            openDrawer,
            pushItem,
            goBack,
            goToIndex,
            closeDrawer,
            isOpen,
            currentItem,
            history,
            prefetch,
            getCachedItem,
            updateCurrentTab
        }}>
            {children}
        </DrawerContext.Provider>
    );
}

export function useDrawer() {
    const context = useContext(DrawerContext);
    if (context === undefined) {
        throw new Error('useDrawer must be used within a DrawerProvider');
    }
    return context;
}
