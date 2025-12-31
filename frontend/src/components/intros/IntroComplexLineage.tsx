'use client';

import React from 'react';

type AssetType =
    | 'databases' | 'tables' | 'columns'
    | 'datasources' | 'embedded_datasources'
    | 'fields' | 'metrics'
    | 'workbooks' | 'views'
    | 'projects' | 'users'
    // 特殊细分类型，用于高亮
    | 'physical_table' | 'embedded_table'
    | 'published_datasource' | 'embedded_datasource'
    | 'raw_field' | 'deduped_field'
    | 'calculated_field' | 'deduped_calculation';

interface IntroComplexLineageProps {
    highlight: AssetType;
    className?: string;
}

export function IntroComplexLineage({ highlight, className = '' }: IntroComplexLineageProps) {
    // 辅助函数：判断是否需要高亮
    const isHighlighted = (type: AssetType) => {
        // 基础类型映射
        if (highlight === 'tables' && (type === 'physical_table' || type === 'embedded_table')) return true;
        if (highlight === 'datasources' && (type === 'published_datasource' || type === 'embedded_datasource')) return true;
        if (highlight === 'fields' && (type === 'raw_field' || type === 'deduped_field' || type === 'calculated_field' || type === 'deduped_calculation')) return true;
        if (highlight === 'metrics' && (type === 'calculated_field' || type === 'deduped_calculation')) return true;
        if (highlight === 'columns' && (type === 'physical_table' || type === 'embedded_table')) return true;
        if (highlight === 'databases' && (type === 'physical_table' || type === 'embedded_table')) return true;
        // projects 和 users 高亮整个消费层
        if (highlight === 'projects' && (type === 'workbooks' || type === 'views')) return true;
        if (highlight === 'users' && (type === 'workbooks' || type === 'views')) return true;

        // 专门的高亮匹配
        return highlight === type;
    };

    // 样式定义
    const getNodeStyle = (type: AssetType) => {
        const isActive = isHighlighted(type);
        const baseStyle = "transition-all duration-300 ease-in-out cursor-default";

        if (isActive) {
            return `${baseStyle} filter drop-shadow-md stroke-2 font-bold`;
        }
        return `${baseStyle} opacity-60 hover:opacity-100`;
    };

    const getStrokeColor = (type: AssetType) => {
        if (isHighlighted(type)) return "#2563eb"; // blue-600
        return "#cbd5e1"; // slate-300
    };

    const getFillColor = (type: AssetType) => {
        if (isHighlighted(type)) return "#eff6ff"; // blue-50
        return "#f8fafc"; // slate-50
    };

    const getTextColor = (type: AssetType) => {
        if (isHighlighted(type)) return "#1e40af"; // blue-800
        return "#64748b"; // slate-500
    };

    return (
        <div className={`w-full overflow-x-auto bg-white rounded-xl border border-gray-100 p-6 ${className}`}>
            <h3 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                全链路数据治理图谱
                <span className="text-xs font-normal text-gray-500 ml-2 border border-gray-200 rounded px-2 py-0.5">
                    Blue = 当前关注对象
                </span>
            </h3>

            <svg viewBox="0 0 1000 380" className="w-full min-w-[800px] h-auto select-none font-sans">
                <defs>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                    </marker>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                {/* ========== 区域背景 (Layers) ========== */}

                {/* Layer 1: 物理存储层 */}
                <rect x="20" y="20" width="160" height="340" rx="16" fill="#f8fafc" stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x="100" y="45" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#94a3b8">物理存储层 (Physical)</text>

                {/* Layer 2: 语义模型层 */}
                <rect x="200" y="20" width="160" height="340" rx="16" fill="#f8fafc" stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x="280" y="45" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#94a3b8">语义模型层 (Semantic)</text>

                {/* Layer 3: 字段实例层 (Raw) */}
                <rect x="380" y="20" width="160" height="340" rx="16" fill="#fff7ed" stroke="#ffedd5" strokeDasharray="4 4" />
                <text x="460" y="45" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#ea580c">实例层 (Instances)</text>

                {/* Layer 4: 治理去重层 (Deduped) */}
                <rect x="560" y="20" width="160" height="340" rx="16" fill="#f0fdf4" stroke="#dcfce7" strokeDasharray="4 4" />
                <text x="640" y="45" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#15803d">治理层 (Governance)</text>

                {/* Layer 5: 应用消费层 */}
                <rect x="740" y="20" width="240" height="340" rx="16" fill="#f8fafc" stroke="#e2e8f0" strokeDasharray="4 4" />
                <text x="860" y="45" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#94a3b8">应用消费层 (Consumption)</text>


                {/* ========== 连线 (Connections) + 说明 ========== */}

                {/* 1. 物理层 -> 数据源层 */}
                {/* Tables -> Datasources */}
                <path d="M 140 100 L 220 100" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <text x="180" y="95" textAnchor="middle" fontSize="9" fill="#94a3b8">发布</text>

                <path d="M 140 100 L 220 220" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <path d="M 140 220 L 220 220" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <text x="180" y="215" textAnchor="middle" fontSize="9" fill="#94a3b8">嵌入</text>

                {/* 2. 数据源层 -> 实例层 */}
                {/* Datasources -> Fields (Raw) */}
                <path d="M 320 100 L 400 100" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <text x="360" y="95" textAnchor="middle" fontSize="9" fill="#94a3b8">包含</text>

                {/* Embedded DS -> Calc Fields (Implicit Containment) */}
                <path d="M 320 220 L 400 200" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <path d="M 320 220 L 400 300" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <path d="M 320 220 L 400 300" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />

                {/* 3. 实例层内部依赖 (New: Raw -> Calculated) */}
                {/* Highlighting the dependency flow: Raw Field -> Calculated Field */}
                <path d="M 450 120 L 450 160 L 450 180" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrow)" fill="none" />
                <text x="465" y="160" textAnchor="middle" fontSize="8" fill="#d97706">引用</text>

                {/* 4. 实例层 -> 治理层 (Normalization) */}
                {/* Fields Mapping [治理映射] */}
                <path d="M 500 100 L 580 100" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrow)" fill="none" />
                <text x="540" y="95" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="bold">归一化</text>

                {/* 多个实例聚合 */}
                <path d="M 500 200 L 530 200 q 25 0 25 50 t 25 50" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrow)" fill="none" />
                <path d="M 500 300 L 580 300" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrow)" fill="none" />
                <text x="535" y="260" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="bold">去重聚合</text>

                {/* 5. 治理层 -> 消费层 */}
                {/* Fields (Deduped) -> Consumption */}
                <path d="M 680 100 L 800 100" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <path d="M 680 300 L 780 250" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <path d="M 680 300 L 780 300" stroke="#cbd5e1" strokeWidth="1.5" markerEnd="url(#arrow)" fill="none" />
                <text x="730" y="270" textAnchor="middle" fontSize="9" fill="#94a3b8">支撑</text>


                {/* ========== 节点 (Nodes) ========== */}

                {/* 1. 物理表 (Physical Table) */}
                <g className={getNodeStyle('physical_table')}>
                    <rect x="40" y="80" width="100" height="40" rx="6" stroke={getStrokeColor('physical_table')} fill={getFillColor('physical_table')} />
                    <text x="90" y="105" textAnchor="middle" fontSize="10" fill={getTextColor('physical_table')}>物理表</text>
                    <text x="90" y="150" textAnchor="middle" fontSize="10" fill="#94a3b8">(DB Table)</text>
                </g>

                {/* 2. 嵌入式表 (Embedded Table) */}
                <g className={getNodeStyle('embedded_table')}>
                    <rect x="40" y="200" width="100" height="40" rx="6" stroke={getStrokeColor('embedded_table')} strokeDasharray="3 2" fill={getFillColor('embedded_table')} />
                    <text x="90" y="225" textAnchor="middle" fontSize="10" fill={getTextColor('embedded_table')}>嵌入式表</text>
                    <text x="90" y="270" textAnchor="middle" fontSize="9" fill="#94a3b8">(Custom SQL/Excel)</text>
                </g>

                {/* 3. 数据源 (Published Datasource) */}
                <g className={getNodeStyle('published_datasource')}>
                    <rect x="220" y="80" width="100" height="40" rx="6" stroke={getStrokeColor('published_datasource')} fill={getFillColor('published_datasource')} />
                    <text x="270" y="105" textAnchor="middle" fontSize="10" fill={getTextColor('published_datasource')}>发布数据源</text>
                </g>

                {/* 4. 嵌入式数据源 (Embedded Datasource) */}
                <g className={getNodeStyle('embedded_datasource')}>
                    <rect x="220" y="200" width="100" height="40" rx="6" stroke={getStrokeColor('embedded_datasource')} strokeDasharray="3 2" fill={getFillColor('embedded_datasource')} />
                    <text x="270" y="225" textAnchor="middle" fontSize="10" fill={getTextColor('embedded_datasource')}>嵌入式数据源</text>
                </g>

                {/* 5. 原始字段 (Raw Field) */}
                <g className={getNodeStyle('raw_field')}>
                    <rect x="400" y="80" width="100" height="40" rx="6" stroke={getStrokeColor('raw_field')} fill={getFillColor('raw_field')} />
                    <text x="450" y="105" textAnchor="middle" fontSize="10" fill={getTextColor('raw_field')}>原始字段实例</text>
                </g>

                {/* 6. 计算字段 (Calculated Field) */}
                <g className={getNodeStyle('calculated_field')}>
                    <rect x="400" y="180" width="100" height="40" rx="6" stroke={getStrokeColor('calculated_field')} strokeDasharray="3 2" fill={getFillColor('calculated_field')} />
                    <text x="450" y="205" textAnchor="middle" fontSize="10" fill={getTextColor('calculated_field')}>计算字段实例 A</text>
                </g>
                <g className={getNodeStyle('calculated_field')}>
                    <rect x="400" y="280" width="100" height="40" rx="6" stroke={getStrokeColor('calculated_field')} strokeDasharray="3 2" fill={getFillColor('calculated_field')} />
                    <text x="450" y="305" textAnchor="middle" fontSize="10" fill={getTextColor('calculated_field')}>计算字段实例 B</text>
                </g>

                {/* 7. 去重原始字段 (Deduped Field) */}
                <g className={getNodeStyle('deduped_field')}>
                    <rect x="580" y="80" width="100" height="40" rx="6" stroke={getStrokeColor('deduped_field')} strokeWidth="2" fill={getFillColor('deduped_field')} />
                    <text x="630" y="105" textAnchor="middle" fontSize="10" fontWeight="bold" fill={getTextColor('deduped_field')}>去重原始字段</text>
                    <text x="630" y="135" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="bold">(Standard Field)</text>
                </g>

                {/* 8. 去重计算字段 (Deduped Calculation) */}
                <g className={getNodeStyle('deduped_calculation')}>
                    <rect x="580" y="280" width="100" height="40" rx="6" stroke={getStrokeColor('deduped_calculation')} strokeWidth="2" fill={getFillColor('deduped_calculation')} />
                    <text x="630" y="305" textAnchor="middle" fontSize="10" fontWeight="bold" fill={getTextColor('deduped_calculation')}>去重计算公式</text>
                    <text x="630" y="335" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="bold">(Standard Metric)</text>
                </g>

                {/* 9. 指标/视图/工作簿 (Consumption) */}
                <g className={getNodeStyle('metrics')}>
                    <rect x="800" y="80" width="120" height="40" rx="6" stroke={getStrokeColor('metrics')} fill={getFillColor('metrics')} />
                    <text x="860" y="105" textAnchor="middle" fontSize="10" fill={getTextColor('metrics')}>最终指标/仪表板</text>
                </g>

                {/* Workbook Container */}
                <rect x="760" y="200" width="200" height="140" rx="8" fill="#f1f5f9" stroke="#cbd5e1" />
                <text x="860" y="220" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#475569">工作簿 (Workbook)</text>

                <g className={getNodeStyle('views')}>
                    <rect x="780" y="230" width="160" height="40" rx="4" stroke={getStrokeColor('views')} fill="#fff" />
                    <text x="860" y="255" textAnchor="middle" fontSize="10" fill={getTextColor('views')}>视图/工作表 (View)</text>
                </g>
                <g className={getNodeStyle('views')}>
                    <rect x="780" y="285" width="160" height="40" rx="4" stroke={getStrokeColor('views')} fill="#fff" />
                    <text x="860" y="310" textAnchor="middle" fontSize="10" fill={getTextColor('views')}>视图/仪表板 (Dashboard)</text>
                </g>

            </svg>
        </div>
    );
}
