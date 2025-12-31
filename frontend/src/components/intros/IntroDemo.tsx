'use client';

import React from 'react';

// 引入专属定制介绍页组件
import { IntroMetrics } from './IntroMetrics';
import { IntroFields } from './IntroFields';
import { IntroDatasources } from './IntroDatasources';
import { IntroTables } from './IntroTables';
import { IntroColumns } from './IntroColumns';
import { IntroDatabases } from './IntroDatabases';
import { IntroWorkbooks } from './IntroWorkbooks';
import { IntroViews } from './IntroViews';
import { IntroProjects } from './IntroProjects';
import { IntroUsers } from './IntroUsers';

// 引入场景化细分组件
import { IntroDatasourcesEmbedded } from './IntroDatasourcesEmbedded';
import { IntroMetricsInstance } from './IntroMetricsInstance';
import { IntroFieldsRaw } from './IntroFieldsRaw';
import { IntroFieldsInstance } from './IntroFieldsInstance';

// ========== 类型定义 (保持与 DetailDrawer 兼容) ==========

export type IntroDemoType =
    | 'databases'
    | 'tables'
    | 'columns'
    | 'datasources'
    | 'workbooks'
    | 'views'
    | 'fields'
    | 'metrics'
    | 'projects'
    | 'users';

export type IntroDemoScene =
    | 'default'
    | 'fields_grouped_by_column' // Raw Fields / Physical View
    | 'fields_grouped_by_table'  // Raw Fields ? Or just table view?
    | 'metrics_duplicates'       // Standard Metric (Deduplicated)
    | 'metrics_instances'        // Metric Instance
    | 'embedded'                 // Embedded Datasource
    | 'published'                // Published Datasource
    | 'workbook_fields'          // Field Instance
    | 'raw_fields';              // Explicit Raw Field request

export type IntroDemoTab =
    | 'overview'
    | 'tables'
    | 'db'
    | 'columns'
    | 'fields'
    | 'datasources'
    | 'embedded_datasources'
    | 'workbooks'
    | 'table'
    | 'deps'
    | 'impact_metrics'
    | 'views'
    | 'contained_views'
    | 'workbook'
    | 'embedded_tables'
    | 'metrics'
    | 'usage'
    | 'embedded'
    | 'duplicates'
    | 'instances'
    | 'lineage';

// ========== 核心分发组件 ==========

export function IntroDemo({ type, scene }: { type: IntroDemoType; scene?: IntroDemoScene }) {
    // 1. 优先处理特定场景 (Scenario-Based Routing)
    if (type === 'datasources' && scene === 'embedded') {
        return <IntroDatasourcesEmbedded />;
    }

    if (type === 'metrics' && scene === 'metrics_instances') {
        return <IntroMetricsInstance />;
    }

    if (type === 'fields') {
        if (scene === 'fields_grouped_by_column' || scene === 'raw_fields') {
            return <IntroFieldsRaw />;
        }
        if (scene === 'workbook_fields') {
            return <IntroFieldsInstance />;
        }
    }

    // 2. 默认类型分发 (Type-Based Routing)
    switch (type) {
        case 'metrics': return <IntroMetrics />; // Default: Standard/Deduplicated
        case 'fields': return <IntroFields />;   // Default: Standard/Deduplicated
        case 'datasources': return <IntroDatasources />; // Default: Published
        case 'tables': return <IntroTables />;
        case 'columns': return <IntroColumns />; // Usually physically columns, distinct from 'fields-raw' but content similar
        case 'databases': return <IntroDatabases />;
        case 'workbooks': return <IntroWorkbooks />;
        case 'views': return <IntroViews />;
        case 'projects': return <IntroProjects />;
        case 'users': return <IntroUsers />;
        default:
            return (
                <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    暂无该类型介绍: {type} {scene ? `(Scene: ${scene})` : ''}
                </div>
            );
    }
}

// ========== 兼容性包装组件 ==========

export function IntroDemoFor({ type, scene }: { type: IntroDemoType; scene: IntroDemoScene }) {
    // 直接透传 scene 参数，触发细分路由
    return <IntroDemo type={type} scene={scene} />;
}

export function IntroDemoForTab({
    type,
    tab,
    scene
}: {
    type: IntroDemoType;
    tab: IntroDemoTab;
    scene: IntroDemoScene;
}) {
    // DetailDrawer 入口，透传 scene
    return <IntroDemo type={type} scene={scene} />;
}
