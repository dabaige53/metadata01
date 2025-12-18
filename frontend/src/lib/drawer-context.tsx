'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface DrawerItem {
    id: string;
    type: string;
    name?: string;
}

interface DrawerContextType {
    openDrawer: (id: string, type: string, name?: string) => void;
    pushItem: (id: string, type: string, name?: string) => void;
    goBack: () => void;
    goToIndex: (index: number) => void;
    closeDrawer: () => void;
    isOpen: boolean;
    currentItem: DrawerItem | null;
    history: DrawerItem[];
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<DrawerItem[]>([]);

    const openDrawer = (id: string, type: string, name?: string) => {
        setHistory([{ id, type, name }]);
        setIsOpen(true);
    };

    const pushItem = (id: string, type: string, name?: string) => {
        setHistory(prev => [...prev, { id, type, name }]);
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
            history
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
