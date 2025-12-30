'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export interface FilterOption {
    value: string;
    label: string;
    count: number;
}

export interface DropdownFilterProps {
    /** 筛选维度的唯一标识 */
    facetKey: string;
    /** 筛选维度的显示名称 */
    label: string;
    /** 所有可选项 */
    options: FilterOption[];
    /** 当前选中的值 */
    selectedValues: string[];
    /** 选择变化时的回调 */
    onSelectionChange: (facetKey: string, values: string[]) => void;
    /** 是否支持搜索（选项超过5个时自动启用） */
    searchable?: boolean;
}

export default function DropdownFilter({
    facetKey,
    label,
    options,
    selectedValues,
    onSelectionChange,
    searchable = true,
}: DropdownFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingSelection, setPendingSelection] = useState<string[]>(selectedValues);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // 同步外部选中状态 - 使用 JSON 比较避免引用变化导致的无限循环
    useEffect(() => {
        const selectedStr = JSON.stringify(selectedValues);
        const pendingStr = JSON.stringify(pendingSelection);
        if (selectedStr !== pendingStr) {
            setPendingSelection(selectedValues);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(selectedValues)]);

    // 点击外部关闭
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                setPendingSelection(selectedValues); // 取消未确认的选择
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedValues]);

    // 打开时聚焦搜索框
    useEffect(() => {
        if (isOpen && searchInputRef.current && options.length > 5) {
            searchInputRef.current.focus();
        }
    }, [isOpen, options.length]);

    // 过滤选项
    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 切换选项
    const toggleOption = (value: string) => {
        setPendingSelection(prev =>
            prev.includes(value)
                ? prev.filter(v => v !== value)
                : [...prev, value]
        );
    };

    // 确认选择
    const handleConfirm = () => {
        onSelectionChange(facetKey, pendingSelection);
        setIsOpen(false);
        setSearchTerm('');
    };

    // 全选/取消全选
    const handleSelectAll = () => {
        if (pendingSelection.length === filteredOptions.length) {
            setPendingSelection([]);
        } else {
            setPendingSelection(filteredOptions.map(opt => opt.value));
        }
    };

    const hasSelection = selectedValues.length > 0;
    const showSearch = searchable && options.length > 5;

    return (
        <div ref={dropdownRef} className="relative">
            {/* 触发按钮 */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`
          inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
          border transition-all duration-200
          ${hasSelection
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }
          ${isOpen ? 'ring-2 ring-indigo-200' : ''}
        `}
            >
                <span>{label}</span>
                {hasSelection && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-indigo-500 text-white rounded-full">
                        {selectedValues.length}
                    </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 下拉面板 */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                    {/* 搜索框 */}
                    {showSearch && (
                        <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={`搜索${label}...`}
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                                />
                            </div>
                        </div>
                    )}

                    {/* 选项列表 */}
                    <div className="max-h-64 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-400 text-center">
                                无匹配选项
                            </div>
                        ) : (
                            <>
                                {/* 全选/取消全选 */}
                                {filteredOptions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="w-full px-3 py-2 text-left text-xs font-medium text-indigo-600 hover:bg-indigo-50 border-b border-gray-100"
                                    >
                                        {pendingSelection.length === filteredOptions.length ? '取消全选' : '全选'}
                                    </button>
                                )}
                                {filteredOptions.map(option => {
                                    const isSelected = pendingSelection.includes(option.value);
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => toggleOption(option.value)}
                                            className={`
                        w-full px-3 py-2 flex items-center justify-between text-sm
                        transition-colors
                        ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                      `}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`
                          w-4 h-4 rounded border flex items-center justify-center
                          ${isSelected
                                                        ? 'bg-indigo-500 border-indigo-500'
                                                        : 'border-gray-300'
                                                    }
                        `}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <span className={isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'}>
                                                    {option.label}
                                                </span>
                                            </div>
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {option.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </>
                        )}
                    </div>

                    {/* 确认按钮 */}
                    <div className="p-2 border-t border-gray-100 bg-gray-50">
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="w-full px-3 py-1.5 text-sm font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 transition-colors"
                        >
                            确认 ({pendingSelection.length} 项)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
