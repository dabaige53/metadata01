'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DEFINITIONS } from '@/constants/definitions';

interface DefinitionTooltipProps {
    term: string;
    children: React.ReactNode;
    className?: string; // Allow passing layout classes
}

export default function DefinitionTooltip({ term, children, className = '' }: DefinitionTooltipProps) {
    const definition = DEFINITIONS[term];
    const [isHovered, setIsHovered] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Calculate position to center above the element
            // We'll adjust in CSS or here. Let's aim for centered top.
            // 10px offset above
            setPosition({
                top: rect.top - 8,
                left: rect.left + rect.width / 2,
            });
            setIsHovered(true);
        }
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    // Close on scroll to avoid floating ghost tooltips
    useEffect(() => {
        if (!isHovered) return;

        const handleScroll = () => setIsHovered(false);
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [isHovered]);

    // If no definition exists, just return children
    if (!definition) {
        return <>{children}</>;
    }

    return (
        <>
            <span
                ref={triggerRef}
                className={`cursor-help border-b border-dotted border-gray-400/50 hover:border-gray-600 transition-colors ${className}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </span>

            {isHovered && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[9999] pointer-events-none px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-lg max-w-xs transition-opacity duration-200 animate-in fade-in zoom-in-95"
                    style={{
                        top: position.top,
                        left: position.left,
                        transform: 'translate(-50%, -100%)', // Centered above
                    }}
                >
                    {definition}
                    {/* Arrow */}
                    <div
                        className="absolute left-1/2 bottom-0 -mb-1 w-2 h-2 bg-gray-900 rotate-45 -translate-x-1/2"
                    />
                </div>,
                document.body
            )}
        </>
    );
}
