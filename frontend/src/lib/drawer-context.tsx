'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface DrawerContextType {
    openDrawer: (id: string, type: string) => void;
    closeDrawer: () => void;
    isOpen: boolean;
    currentItem: { id: string; type: string } | null;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<{ id: string; type: string } | null>(null);

    const openDrawer = (id: string, type: string) => {
        setCurrentItem({ id, type });
        setIsOpen(true);
    };

    const closeDrawer = () => {
        setIsOpen(false);
        // Don't clear currentItem immediately to allow animation to finish
        setTimeout(() => setCurrentItem(null), 300);
    };

    return (
        <DrawerContext.Provider value={{ openDrawer, closeDrawer, isOpen, currentItem }}>
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
