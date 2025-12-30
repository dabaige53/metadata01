'use client';

import React from 'react';
import { BookOpen, GitBranch, Layout, Layers } from 'lucide-react';

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
    | 'fields_grouped_by_column'
    | 'fields_grouped_by_table'
    | 'metrics_duplicates'
    | 'metrics_instances';

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

type IntroCopy = {
    title: string;
    bullets: string[];
};

const typeCn: Record<IntroDemoType, string> = {
    databases: '数据库',
    tables: '数据表',
    columns: '原始列',
    datasources: '数据源',
    workbooks: '工作簿',
    views: '视图',
    fields: '字段',
    metrics: '指标',
    projects: '项目',
    users: '用户'
};

const tabCn: Partial<Record<IntroDemoTab, string>> = {
    overview: '概览',
    tables: '数据表',
    db: '所属数据库',
    columns: '原始列',
    fields: '字段',
    datasources: '数据源',
    embedded_datasources: '嵌入式数据源',
    workbooks: '工作簿',
    table: '所属数据表',
    deps: '依赖字段',
    impact_metrics: '影响指标',
    views: '关联视图',
    contained_views: '包含视图',
    workbook: '所属工作簿',
    embedded_tables: '嵌入式表',
    metrics: '指标',
    usage: '访问统计',
    embedded: '嵌入式副本',
    duplicates: '同名定义',
    instances: '同定义指标',
    lineage: '血缘图'
};

function getCopy(type: IntroDemoType, tab: IntroDemoTab, scene: IntroDemoScene): IntroCopy {
    const t = typeCn[type];
    const tabName = tabCn[tab] || tab;
    const baseBullets = [
        `你当前在：${t} 详情页的「${tabName}」标签。`,
        '该介绍用于解释这一屏的字段含义与口径，不影响真实数据。'
    ];

    if (tab === 'lineage') {
        return {
            title: `${t} · 血缘图（当前节点已标注）`,
            bullets: [
                `你当前在：${t}。血缘图会用高亮标记当前节点类型，帮助你定位“我在哪一层”。`,
                '上游：数据从哪里来；下游：改动会影响谁。',
                '如果你只想确认位置：先找高亮节点，再沿箭头看上下游。'
            ]
        };
    }

    if (type === 'metrics' && tab === 'duplicates') {
        return {
            title: '指标 · 同名定义（聚合页）',
            bullets: [
                '你当前在：指标的“同名定义”聚合视角。',
                '这里用于治理“同名不同口径”的情况：把同名指标集中展示便于对比。',
                '进入某一项后再看公式/依赖字段，确认是否应合并/重命名。'
            ]
        };
    }

    if (type === 'metrics' && tab === 'instances') {
        return {
            title: '指标 · 同定义指标（实例列表）',
            bullets: [
                '你当前在：指标的“同口径多实例”视角。',
                '这里用于治理“口径重复”：同一公式/同一哈希的多个实例同时存在。',
                '建议保留一个主指标，其余做引用替换或下线。'
            ]
        };
    }

    if (scene === 'fields_grouped_by_column') {
        return {
            title: '数据表 · 字段（按原始列分组/聚合）',
            bullets: [
                '你当前在：数据表详情页的“字段”聚合视角。',
                '第一层按原始列分组；第二层按字段名聚合，同名字段会合并，避免实例刷屏。',
                '展开后可看到各来源（数据源/工作簿）对应的字段实例。'
            ]
        };
    }

    if (scene === 'fields_grouped_by_table') {
        return {
            title: '数据源 · 字段（按上游表分组/聚合）',
            bullets: [
                '你当前在：数据源详情页的“字段”聚合视角。',
                '按上游表分组 → 按原始列分组 → 按字段名聚合，并记录来源用于展开查看。',
                '这不是数据去重，是展示去重（口径聚合）。'
            ]
        };
    }

    const byTypeAndTab: Record<IntroDemoType, Partial<Record<IntroDemoTab, IntroCopy>>> = {
        databases: {
            overview: {
                title: '数据库 · 概览',
                bullets: [...baseBullets, '关注点：包含多少数据表、是否为核心库、责任人/项目归属。', '治理动作：先从下游表与数据源入手排查影响范围。']
            },
            tables: {
                title: '数据库 · 数据表',
                bullets: [...baseBullets, '这里列出该库下的物理表集合（资产清单）。', '常用做法：按“使用中/仅关联”等状态筛查孤立或风险资产。']
            },
            lineage: {
                title: '数据库 · 血缘图',
                bullets: [
                    `你当前在：数据库。血缘图会标注当前节点类型，帮助你快速定位。`,
                    '从数据库出发，下游通常是数据表/数据源。',
                    '用于评估库级变更影响范围。'
                ]
            }
        },
        tables: {
            overview: {
                title: '数据表 · 概览',
                bullets: [...baseBullets, '关注点：列数、被多少数据源引用、是否存在“仅关联/未使用”。', '治理动作：优先补齐描述、确认负责人、减少无人维护的高影响表。']
            },
            db: {
                title: '数据表 · 所属数据库',
                bullets: [...baseBullets, '用于确认物理归属与权限边界（来自哪个库/Schema）。', '排查问题时：先定位库，再定位上游同步/权限。']
            },
            columns: {
                title: '数据表 · 原始列',
                bullets: [...baseBullets, '展示物理列（Column）清单，是字段/指标的物理基础。', '常用治理：识别无描述列、敏感列、类型异常列。']
            },
            fields: {
                title: '数据表 · 字段',
                bullets: [...baseBullets, '该标签在此类型下通常会以“按原始列分组/按字段名聚合”的方式展示字段实例。', '如果你想看具体来源：展开聚合项查看各数据源/工作簿实例。']
            },
            datasources: {
                title: '数据表 · 数据源',
                bullets: [...baseBullets, '这里是“哪些数据源引用了这张表”。', '用于评估：表结构变更会影响哪些数据源与下游报表。']
            },
            embedded_datasources: {
                title: '数据表 · 嵌入式数据源',
                bullets: [...baseBullets, '嵌入式数据源是工作簿内的副本，通常更分散、更难统一治理。', '治理建议：优先推动发布数据源、减少嵌入式副本。']
            },
            workbooks: {
                title: '数据表 · 关联工作簿',
                bullets: [...baseBullets, '这里回答：哪些工作簿（业务消费端）最终用到了这张表。', '用于通知与协同：表变更前先通知这些工作簿负责人。']
            },
            lineage: {
                title: '数据表 · 血缘图',
                bullets: [
                    '你当前在：数据表。血缘图会标注当前节点类型（当前层级）。',
                    '上游一般是数据库；下游一般是数据源/工作簿/视图。',
                    '用于评估表结构/口径变更影响链路。'
                ]
            }
        },
        columns: {
            overview: {
                title: '原始列 · 概览',
                bullets: [...baseBullets, '原始列是最底层物理字段；上层“字段/指标”通常依附其上。', '治理动作：补齐描述、统一命名、标识敏感字段。']
            },
            table: {
                title: '原始列 · 所属数据表',
                bullets: [...baseBullets, '用于回到物理表维度查看该列的上下文与其他列。', '排查血缘：从表再到数据源/工作簿/视图。']
            },
            db: {
                title: '原始列 · 所属数据库',
                bullets: [...baseBullets, '用于确认列所在数据库及潜在权限边界。', '常用于跨库同名列误用排查。']
            },
            lineage: {
                title: '原始列 · 血缘图',
                bullets: ['你当前在：原始列。高亮节点用于定位当前层级。', '下游通常表现为字段实例与报表使用关系。', '用于排查列级改动影响范围。']
            }
        },
        datasources: {
            overview: {
                title: '数据源 · 概览',
                bullets: [...baseBullets, '数据源是语义层入口，连接物理表并向工作簿提供字段/指标。', '治理动作：认证、描述完善、减少嵌入式副本。']
            },
            tables: {
                title: '数据源 · 数据表',
                bullets: [...baseBullets, '这里是该数据源连接到的物理表集合（上游）。', '用于确认数据来源是否正确、是否存在多表混用。']
            },
            embedded_tables: {
                title: '数据源 · 嵌入式表',
                bullets: [...baseBullets, '嵌入式表通常来自工作簿内嵌连接，治理与复用成本更高。', '建议推动沉淀为可复用的已发布数据源/物理表映射。']
            },
            columns: {
                title: '数据源 · 原始列',
                bullets: [...baseBullets, '展示从上游表透出的列清单，便于核对字段类型与来源。', '常用排查：字段类型不一致/列缺失/列名变更。']
            },
            fields: {
                title: '数据源 · 字段',
                bullets: [...baseBullets, '该标签在此类型下通常是“按上游表分组→按原始列→按字段名聚合”。', '用于快速定位字段来自哪个上游表/列。']
            },
            metrics: {
                title: '数据源 · 指标',
                bullets: [...baseBullets, '这里是数据源内定义/包含的计算指标集合。', '治理动作：识别重复口径、过高复杂度指标、无描述指标。']
            },
            workbooks: {
                title: '数据源 · 关联工作簿',
                bullets: [...baseBullets, '这里回答：哪些工作簿在消费该数据源。', '用于通知与风险评估：数据源变更会影响哪些工作簿/视图。']
            },
            embedded: {
                title: '数据源 · 嵌入式副本',
                bullets: [...baseBullets, '这里展示“由该已发布数据源派生/复制”的嵌入式数据源。', '治理建议：减少副本分叉，统一到主数据源。']
            },
            lineage: {
                title: '数据源 · 血缘图',
                bullets: ['你当前在：数据源（语义层）。高亮节点用于定位当前层级。', '上游通常是数据库/数据表；下游通常是工作簿/视图。', '用于评估数据源口径变更的影响面。']
            }
        },
        workbooks: {
            overview: {
                title: '工作簿 · 概览',
                bullets: [...baseBullets, '工作簿是交付载体，包含多个视图/看板。', '治理动作：识别无人访问/高访问工作簿，优先保障核心资产。']
            },
            views: {
                title: '工作簿 · 视图/看板',
                bullets: [...baseBullets, '展示该工作簿包含的视图集合（业务消费入口）。', '下钻到视图可查看访问统计与血缘影响。']
            },
            datasources: {
                title: '工作簿 · 数据源',
                bullets: [...baseBullets, '展示工作簿使用的已发布数据源集合。', '用于确认工作簿的数据依赖入口是否可控。']
            },
            embedded_datasources: {
                title: '工作簿 · 嵌入式数据源',
                bullets: [...baseBullets, '嵌入式数据源分散在工作簿内，容易造成口径分叉。', '治理建议：尽量迁移为已发布数据源。']
            },
            tables: {
                title: '工作簿 · 数据表',
                bullets: [...baseBullets, '展示工作簿最终触达的物理表集合（可能经由数据源）。', '用于评估工作簿对物理层的依赖面。']
            },
            embedded_tables: {
                title: '工作簿 · 嵌入式表',
                bullets: [...baseBullets, '嵌入式表通常表示直接内嵌连接，治理与复用成本较高。', '建议收敛到统一数据源/表映射。']
            },
            fields: {
                title: '工作簿 · 使用字段',
                bullets: [...baseBullets, '展示工作簿在所有视图中用到的字段集合。', '用于识别：无描述字段、敏感字段、口径不一致字段。']
            },
            metrics: {
                title: '工作簿 · 使用指标',
                bullets: [...baseBullets, '展示工作簿使用的指标集合。', '治理动作：排查重复指标、过高复杂度指标。']
            },
            usage: {
                title: '工作簿 · 访问统计',
                bullets: [...baseBullets, '展示工作簿整体访问趋势/热度。', '高热度工作簿变更需更谨慎并提前通知。']
            },
            lineage: {
                title: '工作簿 · 血缘图',
                bullets: ['你当前在：工作簿。高亮节点用于定位当前层级。', '上游通常是数据源/表；下游是视图。', '用于评估工作簿改动的影响链路。']
            }
        },
        views: {
            overview: {
                title: '视图 · 概览',
                bullets: [...baseBullets, '视图是最终展示面（工作表/仪表板）。', '治理动作：优先保障高访问视图；低访问视图可评估下线。']
            },
            workbook: {
                title: '视图 · 所属工作簿',
                bullets: [...baseBullets, '用于回到交付载体（工作簿）维度查看同域视图。', '常用于定位负责人/项目归属。']
            },
            fields: {
                title: '视图 · 使用字段',
                bullets: [...baseBullets, '展示该视图实际使用的字段集合。', '用于核对展示口径与字段来源。']
            },
            metrics: {
                title: '视图 · 使用指标',
                bullets: [...baseBullets, '展示该视图使用的计算指标集合。', '用于核对指标公式与依赖字段。']
            },
            usage: {
                title: '视图 · 访问统计',
                bullets: [...baseBullets, '访问统计用于衡量热度（谁在看/看多少）。', '热门视图改动需更严格的评审与回滚准备。']
            },
            contained_views: {
                title: '视图 · 包含视图（仪表板）',
                bullets: [...baseBullets, '仅仪表板（Dashboard）会出现：表示包含的工作表集合。', '用于下钻定位某个子图的字段/指标口径。']
            },
            lineage: {
                title: '视图 · 血缘图',
                bullets: ['你当前在：视图（消费端）。高亮节点用于定位当前层级。', '上游通常是工作簿/数据源/表/字段/指标。', '用于回答：这张图的数据从哪里来、改动哪里会影响它。']
            }
        },
        fields: {
            overview: {
                title: '字段 · 概览',
                bullets: [...baseBullets, '字段是语义字段实例，可能来自某个物理列/数据源。', '治理动作：补齐描述、确认角色（维度/度量）、核对数据类型。']
            },
            table: {
                title: '字段 · 所属数据表',
                bullets: [...baseBullets, '用于回到物理表维度确认该字段的真实物理来源（可能穿透）。', '当显示“血缘穿透”时，说明是推导关联表。']
            },
            deps: {
                title: '字段 · 依赖字段',
                bullets: [...baseBullets, '若该字段为计算字段/派生字段，这里展示其依赖的基础字段集合。', '用于解释口径与排查计算链路。']
            },
            datasources: {
                title: '字段 · 数据源',
                bullets: [...baseBullets, '展示该字段关联/出现的已发布数据源。', '用于确认该字段被哪些语义入口复用。']
            },
            embedded_datasources: {
                title: '字段 · 嵌入式数据源',
                bullets: [...baseBullets, '展示该字段来自的嵌入式数据源副本。', '治理建议：减少副本，统一到已发布数据源。']
            },
            impact_metrics: {
                title: '字段 · 影响指标',
                bullets: [...baseBullets, '这里回答：这个字段被哪些下游指标引用。', '改动该字段会影响这些指标及其下游视图。']
            },
            views: {
                title: '字段 · 关联视图',
                bullets: [...baseBullets, '这里回答：哪些视图在使用该字段。', '用于评估字段口径变更的影响面。']
            },
            workbooks: {
                title: '字段 · 引用工作簿',
                bullets: [...baseBullets, '这里回答：哪些工作簿在使用该字段。', '用于找到业务负责人并协同治理。']
            },
            lineage: {
                title: '字段 · 血缘图',
                bullets: ['你当前在：字段。高亮节点用于定位当前层级。', '上游通常是表/列/数据源；下游通常是指标/视图。', '用于追溯来源与影响范围。']
            }
        },
        metrics: {
            overview: {
                title: '指标 · 概览',
                bullets: [...baseBullets, '指标是计算字段（口径定义），通常有公式与复杂度。', '治理动作：识别重复口径、过高复杂度、无描述指标。']
            },
            table: {
                title: '指标 · 所属数据表',
                bullets: [...baseBullets, '用于回到物理表维度确认指标所依赖字段的物理来源（可能穿透）。', '排查口径问题常从这里开始。']
            },
            deps: {
                title: '指标 · 依赖字段',
                bullets: [...baseBullets, '这里是指标口径的关键：由哪些基础字段组成。', '治理建议：依赖越多越复杂，优先拆分与复用。']
            },
            datasources: {
                title: '指标 · 数据源',
                bullets: [...baseBullets, '展示该指标关联/出现的已发布数据源。', '用于确认指标的复用范围与入口。']
            },
            embedded_datasources: {
                title: '指标 · 嵌入式数据源',
                bullets: [...baseBullets, '展示该指标来自的嵌入式数据源副本。', '治理建议：收敛到已发布数据源，避免口径分叉。']
            },
            impact_metrics: {
                title: '指标 · 影响指标',
                bullets: [...baseBullets, '这里回答：这个指标被哪些下游指标再次引用（级联影响）。', '用于评估指标变更的影响链。']
            },
            views: {
                title: '指标 · 关联视图',
                bullets: [...baseBullets, '这里回答：哪些视图在使用该指标。', '用于评估口径变更对报表的影响。']
            },
            workbooks: {
                title: '指标 · 引用工作簿',
                bullets: [...baseBullets, '这里回答：哪些工作簿在使用该指标。', '用于找到业务负责人并协同治理。']
            },
            lineage: {
                title: '指标 · 血缘图',
                bullets: ['你当前在：指标。高亮节点用于定位当前层级。', '上游通常是字段/表/数据源；下游通常是视图。', '用于追溯口径来源与影响范围。']
            }
        },
        projects: {
            overview: {
                title: '项目 · 概览',
                bullets: [...baseBullets, '项目是资源容器/权限边界，常对应业务域。', '治理动作：按项目梳理责任人、统一命名与发布规范。']
            },
            datasources: {
                title: '项目 · 数据源',
                bullets: [...baseBullets, '展示该项目下的数据源资产清单。', '用于识别该域的主数据源与嵌入式副本风险。']
            },
            workbooks: {
                title: '项目 · 工作簿',
                bullets: [...baseBullets, '展示该项目下的工作簿资产清单。', '用于识别核心交付与低访问可下线资产。']
            }
        },
        users: {
            overview: {
                title: '用户 · 概览',
                bullets: [...baseBullets, '用户用于定位资产发布者/负责人。', '治理动作：高影响资产需要明确 owner 与交接机制。']
            },
            datasources: {
                title: '用户 · 数据源',
                bullets: [...baseBullets, '展示该用户名下的数据源。', '用于治理：找回无人维护数据源的负责人。']
            },
            workbooks: {
                title: '用户 · 工作簿',
                bullets: [...baseBullets, '展示该用户名下的工作簿。', '用于治理：找回无人维护工作簿的负责人。']
            }
        }
    };

    const copy = byTypeAndTab[type]?.[tab];
    if (copy) return copy;

    return {
        title: `${t} · ${tabName}（未配置）`,
        bullets: [...baseBullets, '该标签尚未配置专属说明（属于配置缺口）。']
    };
}

const metaByType: Record<IntroDemoType, { title: string; subtitle: string; badge: string; blurb: string }> = {
    views: {
        title: '平台术语与概念指南',
        subtitle: '视图 (View) 专题',
        badge: '数据可视化',
        blurb: '视图是最终展示面（工作表/仪表板）。关注访问热度、口径一致性与下游影响。'
    },
    tables: {
        title: '平台术语与概念指南',
        subtitle: '数据表 (Table) 专题',
        badge: '物理层',
        blurb: '数据表是物理数据承载单元。关注上游库归属、列结构变化风险、下游数据源/工作簿影响范围。'
    },
    datasources: {
        title: '平台术语与概念指南',
        subtitle: '数据源 (Datasource) 专题',
        badge: '语义层',
        blurb: '数据源是语义入口，连接物理表并向工作簿提供字段/指标。关注认证、复用范围与嵌入式副本。'
    },
    fields: {
        title: '平台术语与概念指南',
        subtitle: '原始字段 (Field) 专题',
        badge: '字段治理',
        blurb: '字段是语义层的字段实例。关注角色（维度/度量）、数据类型、描述完备性与引用影响。'
    },
    metrics: {
        title: '平台术语与概念指南',
        subtitle: '计算指标 (Metric) 专题',
        badge: '指标治理',
        blurb: '指标是口径定义（计算字段）。关注公式、依赖字段、复杂度与重复口径（同名/同定义）。'
    },
    workbooks: {
        title: '平台术语与概念指南',
        subtitle: '工作簿 (Workbook) 专题',
        badge: '交付载体',
        blurb: '工作簿是交付载体，包含视图。关注访问热度、依赖数据源与变更影响面。'
    },
    databases: {
        title: '平台术语与概念指南',
        subtitle: '数据库 (Database) 专题',
        badge: '物理层',
        blurb: '数据库是最上游物理容器。关注库级变更影响（下游表/数据源/工作簿/视图），以及责任域与权限边界。'
    },
    columns: {
        title: '平台术语与概念指南',
        subtitle: '原始列 (Column) 专题',
        badge: '物理层',
        blurb: '原始列是最底层物理字段。关注类型/敏感性/描述，以及列级改动对下游字段与报表影响。'
    },
    projects: {
        title: '平台术语与概念指南',
        subtitle: '项目 (Project) 专题',
        badge: '权限/组织',
        blurb: '项目是资源容器与权限边界。用于按业务域梳理资产归属与治理责任。'
    },
    users: {
        title: '平台术语与概念指南',
        subtitle: '用户 (User) 专题',
        badge: '权限/组织',
        blurb: '用户用于定位资产负责人/发布者。用于治理协同与无人维护资产回收。'
    }
};

type IntroSection =
    | 'header'
    | 'lineage'
    | 'coreConcepts'
    | 'systemTabs'
    | 'fieldDictionary'
    | 'fieldDedupe'
    | 'metricDedupe';

const sectionsByType: Record<IntroDemoType, IntroSection[]> = {
    views: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary'],
    tables: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary', 'fieldDedupe'],
    datasources: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary', 'fieldDedupe'],
    fields: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary', 'fieldDedupe'],
    metrics: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary', 'metricDedupe'],
    workbooks: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary'],
    databases: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary'],
    columns: ['header', 'lineage', 'coreConcepts', 'systemTabs', 'fieldDictionary'],
    projects: ['header', 'lineage', 'coreConcepts', 'systemTabs'],
    users: ['header', 'lineage', 'coreConcepts', 'systemTabs']
};

export function IntroDemo({ type }: { type: IntroDemoType }) {
    const meta = metaByType[type];
    const sections = sectionsByType[type];

    return (
        <div className="space-y-8 p-4">
            {sections.includes('header') && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-8">
                        <div className="lg:w-1/3 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
                                    <Layout className="w-8 h-8" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">{meta.title}</h1>
                                    <div className="text-sm font-medium text-indigo-600 mt-1">{meta.subtitle}</div>
                                </div>
                            </div>
                            <p className="text-base text-gray-600 leading-relaxed">{meta.blurb}</p>
                            <div className="flex flex-wrap gap-2 pt-2">
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{meta.badge}</span>
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Tableau</span>
                            </div>
                        </div>

                        <div className="lg:w-2/3 bg-gray-50 rounded-xl p-6 border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">
                                对象定义：{meta.subtitle}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">你在看什么</div>
                                    <div className="text-sm text-gray-800">该弹窗是“介绍页”，用于解释该类型详情页的标签（Tab）与关键字段。</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">怎么用最快</div>
                                    <div className="text-sm text-gray-800">先看“标签说明”，再根据问题进入“血缘/影响/归属”等标签。</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">常见误解</div>
                                    <div className="text-sm text-gray-800">“去重=数据去重”并不等价；多数是 UI/口径层面的聚合展示。</div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-gray-500 mb-1">你最需要关注</div>
                                    <div className="text-sm text-gray-800">认证、访问热度、引用范围、血缘上下游。</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {sections.includes('lineage') && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3 mb-8">
                        <GitBranch className="w-5 h-5 text-violet-600" />
                        术语图解：数据流转全景
                    </h2>
                    <div className="overflow-x-auto flex justify-center">
                        <svg viewBox="0 0 840 200" className="w-full max-w-[840px] h-auto">
                        <defs>
                            <marker id="arrow-sm" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <path d="M0,0 L6,3 L0,6" fill="#9ca3af" />
                            </marker>
                            <marker id="arrow-usage" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                                <path d="M0,0 L6,3 L0,6" fill="#e11d48" />
                            </marker>
                        </defs>

                        <rect x="10" y="10" width="820" height="180" rx="12" fill="#f9fafb" stroke="#f3f4f6" />

                        <g transform="translate(40, 40)">
                            <rect width="100" height="40" rx="6" fill="#eef2ff" stroke="#c7d2fe" />
                            <text x="50" y="24" textAnchor="middle" fontSize="11" fill="#3730a3" fontWeight="600">数据库</text>
                            <line x1="100" y1="20" x2="160" y2="20" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                            <text x="130" y="15" textAnchor="middle" fontSize="9" fill="#9ca3af">数据读取</text>
                        </g>

                        <g transform="translate(200, 40)">
                            <rect width="100" height="40" rx="6" fill="#ecfeff" stroke="#bae6fd" />
                            <text x="50" y="24" textAnchor="middle" fontSize="11" fill="#0369a1" fontWeight="600">数据表</text>
                            <line x1="100" y1="20" x2="160" y2="20" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                            <text x="130" y="15" textAnchor="middle" fontSize="9" fill="#9ca3af">物理连接</text>
                        </g>

                        <g transform="translate(360, 40)">
                            <rect width="120" height="40" rx="6" fill="#ecfdf3" stroke="#bbf7d0" />
                            <text x="60" y="24" textAnchor="middle" fontSize="11" fill="#15803d" fontWeight="600">数据源</text>
                        </g>

                        <line x1="480" y1="60" x2="640" y2="60" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                        <text x="560" y="55" textAnchor="middle" fontSize="9" fill="#9ca3af">作为数据源发布到</text>

                        <g transform="translate(640, 40)">
                            <rect width="120" height="40" rx="6" fill="#fef3c7" stroke="#fde68a" />
                            <text x="60" y="24" textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="600">工作簿</text>
                        </g>

                        <path d="M 420 80 L 420 120" fill="none" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                        <text x="425" y="100" fontSize="9" fill="#9ca3af">包含字段</text>

                        <g transform="translate(360, 120)">
                            <rect width="120" height="36" rx="6" fill="#fff7ed" stroke="#fed7aa" />
                            <text x="60" y="22" textAnchor="middle" fontSize="11" fill="#9a3412">原始字段</text>
                            <line x1="120" y1="18" x2="160" y2="18" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                            <text x="140" y="14" textAnchor="middle" fontSize="9" fill="#9ca3af">计算加工</text>
                        </g>

                        <g transform="translate(520, 120)">
                            <rect width="100" height="36" rx="6" fill="#fffbeb" stroke="#fde68a" />
                            <text x="50" y="22" textAnchor="middle" fontSize="11" fill="#b45309">计算指标</text>
                        </g>

                        <path d="M 700 80 L 700 110" fill="none" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arrow-sm)" />
                        <text x="705" y="95" fontSize="9" fill="#9ca3af">包含视图</text>

                        <g transform="translate(640, 110)">
                            <rect width="120" height="56" rx="8" fill="#ffe4e6" stroke="#fecdd3" strokeWidth="2" />
                            <text x="60" y="24" textAnchor="middle" fontSize="12" fill="#be123c" fontWeight="700">视图 (View)</text>
                            <text x="60" y="42" textAnchor="middle" fontSize="10" fill="#9f1239">你在这里</text>
                        </g>

                        <path d="M 620 138 L 640 138" fill="none" stroke="#e11d48" strokeWidth="1.5" strokeDasharray="3" markerEnd="url(#arrow-usage)" />
                        <text x="630" y="134" textAnchor="middle" fontSize="9" fill="#e11d48">最终展示</text>

                        <g transform="translate(40, 130)">
                            <text x="0" y="10" fontSize="10" fill="#6b7280">── 实线: 物理血缘（数据流向）</text>
                            <text x="0" y="30" fontSize="10" fill="#e11d48">- - 虚线: 引用关系（计算口径）</text>
                        </g>
                        </svg>
                    </div>
                </div>
            )}

            {(sections.includes('coreConcepts') || sections.includes('systemTabs')) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {sections.includes('coreConcepts') && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-3 mb-6">
                                <BookOpen className="w-5 h-5 text-indigo-600" />
                                核心概念
                            </h2>
                            <div className="space-y-4 flex-1">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="text-sm font-bold text-gray-900 mb-1">访问量 vs 引用量</div>
                                    <div className="text-sm text-gray-600">
                                        <span className="font-medium text-amber-700">访问量</span>代表热度（谁在看）；
                                        <br />
                                        <span className="font-medium text-indigo-700">引用量</span>代表影响范围（被多少下游使用）。
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="text-sm font-bold text-gray-900 mb-1">血缘关系 (Lineage)</div>
                                    <div className="text-sm text-gray-600">显示数据上下游关系，帮助追踪数据来源和影响范围。</div>
                                </div>
                                {sections.includes('fieldDedupe') && (
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="text-sm font-bold text-gray-900 mb-1">字段聚合/去重（你说的“驱虫”）</div>
                                        <div className="text-sm text-gray-600">
                                            在“数据表/数据源”的视角下，字段会按“原始列/上游表”分组，并按字段名聚合，避免同名字段实例刷屏。
                                        </div>
                                    </div>
                                )}
                                {sections.includes('metricDedupe') && (
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <div className="text-sm font-bold text-gray-900 mb-1">指标重复（同名定义 / 同定义实例）</div>
                                        <div className="text-sm text-gray-600">
                                            指标存在“同名定义”与“同定义实例”的专门标签页，用于治理重复口径；与字段聚合逻辑不同。
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {sections.includes('systemTabs') && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                                <Layers className="w-5 h-5 text-emerald-600" />
                                详情页标签说明（Tabs）
                            </h2>
                            <div className="space-y-4 flex-1">
                                <div className="text-sm text-gray-700 p-3 bg-emerald-50 rounded-xl border border-emerald-100">系统会按资产类型动态展示以下标签：</div>
                                <ul className="space-y-3 text-sm text-gray-600">
                                    <li className="flex gap-2 items-center">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                        <span className="font-bold text-gray-900 min-w-[80px]">概览</span>
                                        <span>基础信息、认证、关键统计。</span>
                                    </li>
                                    <li className="flex gap-2 items-center">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                        <span className="font-bold text-gray-900 min-w-[80px]">血缘图</span>
                                        <span>上下游影响范围（可点击下钻）。</span>
                                    </li>
                                    {type === 'metrics' && (
                                        <>
                                            <li className="flex gap-2 items-center">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                <span className="font-bold text-gray-900 min-w-[80px]">同名定义</span>
                                                <span>同名指标聚合入口（治理重复命名）。</span>
                                            </li>
                                            <li className="flex gap-2 items-center">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                                <span className="font-bold text-gray-900 min-w-[80px]">同定义指标</span>
                                                <span>同一口径的多个实例（治理重复口径）。</span>
                                            </li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {sections.includes('fieldDictionary') && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm hover:shadow-md transition-shadow">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-amber-600" />
                        字段详细释义 (Field Dictionary)
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">基础属性</h3>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">类型 (Type)</div>
                                <div className="text-sm text-gray-600 leading-snug">不同资产类型的“类型”字段含义不同（如视图的 Dashboard/Worksheet）。</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">认证状态 (Certified)</div>
                                <div className="text-sm text-gray-600 leading-snug">已认证：可信；未认证：建议先核验口径再使用。</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">项目/所有者</div>
                                <div className="text-sm text-gray-600 leading-snug">用于定位归属与负责人。</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">统计指标</h3>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">访问量 (Hits)</div>
                                <div className="text-sm text-gray-600 leading-snug">衡量热度（被看多少）。</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">引用量 / 影响范围</div>
                                <div className="text-sm text-gray-600 leading-snug">衡量影响（改动会影响多少下游）。</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">复杂度</div>
                                <div className="text-sm text-gray-600 leading-snug">常见于指标：依赖字段越多、逻辑越长，复杂度越高。</div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">数据与血缘</h3>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">连接 (Connection)</div>
                                <div className="text-sm text-gray-600 leading-snug">Live/Extract 的差异会影响实时性与性能。</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">更新时间 (Updated At)</div>
                                <div className="text-sm text-gray-600 leading-snug">用于判断是否停更/延迟。</div>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="text-sm font-bold text-gray-900 mb-1">血缘 (Lineage)</div>
                                <div className="text-sm text-gray-600 leading-snug">用于追溯来源与评估改动影响。</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function IntroDemoFor({ type, scene }: { type: IntroDemoType; scene: IntroDemoScene }) {
    if (type !== 'fields' && scene.startsWith('fields_')) {
        return <IntroDemo type={type} />;
    }
    if (type !== 'metrics' && scene.startsWith('metrics_')) {
        return <IntroDemo type={type} />;
    }

    if (scene === 'fields_grouped_by_column') {
        return (
            <div>
                <IntroDemo type="tables" />
                <div className="px-4 pb-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="text-sm font-bold text-gray-900 mb-2">场景：数据表详情页 · 包含字段（按原始列分组）</div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                            这里展示的是“字段实例”的聚合视角：先按原始列分组，再按字段名聚合，同名字段会合并，并统计来源数据源。
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (scene === 'fields_grouped_by_table') {
        return (
            <div>
                <IntroDemo type="datasources" />
                <div className="px-4 pb-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="text-sm font-bold text-gray-900 mb-2">场景：数据源详情页 · 包含字段（按上游表分组）</div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                            这里展示的是“字段实例”的聚合视角：按上游表分组 → 按原始列分组 → 按字段名聚合，并记录来源工作簿/数据源用于展开查看。
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'metrics' && scene === 'metrics_duplicates') {
        return (
            <div>
                <IntroDemo type="metrics" />
                <div className="px-4 pb-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="text-sm font-bold text-gray-900 mb-2">场景：指标详情页 · 同名定义（聚合）</div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                            “同名定义”用于把同名指标聚合到一起对比（治理命名重复）。它不是某一个指标实例本身。
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (type === 'metrics' && scene === 'metrics_instances') {
        return (
            <div>
                <IntroDemo type="metrics" />
                <div className="px-4 pb-4">
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="text-sm font-bold text-gray-900 mb-2">场景：指标详情页 · 同定义指标（实例列表）</div>
                        <div className="text-sm text-gray-700 leading-relaxed">
                            “同定义指标”用于展示同一口径（公式哈希相同等）的多个实例（治理口径重复）。这里是实例集合视图。
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return <IntroDemo type={type} />;
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
    const copy = getCopy(type, tab, scene);
    return (
        <div className="space-y-4">
            <IntroDemoFor type={type} scene={scene} />
            <div className="px-4 pb-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <div className="text-sm font-bold text-gray-900 mb-2">{copy.title}</div>
                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                        {copy.bullets.map((b, i) => (
                            <li key={i}>{b}</li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
