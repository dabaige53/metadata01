// API 基础配置
// 在服务端(SSR)使用完整的后端 URL,在客户端使用相对路径
const getApiBase = () => {
    // 检查是否在服务端环境
    if (typeof window === 'undefined') {
        // 服务端: 使用环境变量中的完整后端 URL
        const backendUrl = process.env.BACKEND_URL || 'http://backend:8201';
        return `${backendUrl}/api`;
    }
    // 客户端: 使用相对路径,通过 Next.js rewrites 代理到后端
    return '/api';
};

const API_BASE = getApiBase();

// 通用请求函数
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
}

// API 类型定义
export interface Stats {
    databases: number;
    tables: number;
    fields: number;
    metrics: number;
    datasources: number;
    workbooks: number;
    projects: number;
    users: number;
    views: number;
    calculatedFields: number;
    uniqueFields: number;
    uniqueMetrics: number;
    duplicateMetrics: number;
    orphanedFields: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}

export interface Database {
    id: string;
    name: string;
    connection_type: string;
    table_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface Table {
    id: string;
    name: string;
    schema?: string;
    database_id?: string;
    database_name?: string;
    field_count?: number;
}

export interface Field {
    id: string;
    name: string;
    role: 'measure' | 'dimension';
    data_type?: string;
    description?: string;
    datasource_id?: string;
    datasource_name?: string;
    is_calculated?: boolean;
    formula?: string;
}

export interface Metric {
    id: string;
    name: string;
    formula?: string;
    description?: string;
    datasource_id?: string;
    datasource_name?: string;
}

export interface Datasource {
    id: string;
    name: string;
    is_certified: boolean;
    has_extract: boolean;
    project_name?: string;
    owner?: string;
}

export interface Workbook {
    id: string;
    name: string;
    project_name?: string;
    owner?: string;
    view_count?: number;
}

export interface DashboardAnalysis {
    health_score: number;
    governance_scores: {
        completeness: number;
        timeliness: number;
        consistency: number;
        validity: number;
        standardization: number;
    };
    issues: {
        missing_description: number;
        missing_desc_ratio: number;
        stale_datasources: number;
        dead_datasources: number;
        duplicate_formulas: number;
        orphaned_tables: number;
        calc_field_no_desc: number;
        field_coverage_rate: number;
    };
    quality_metrics: {
        field_coverage: { with_description: number; total: number; coverage_rate: number };
        table_coverage: { with_description: number; total: number; coverage_rate: number };
        metric_coverage: { with_description: number; total: number; coverage_rate: number };
        datasource_coverage: { with_description: number; total: number; coverage_rate: number; certified: number; certification_rate: number };
        workbook_coverage: { with_description: number; total: number; coverage_rate: number };
    };
    role_distribution: Record<string, number>;
    data_type_distribution: Record<string, number>;
    field_source_distribution: Record<string, number>;
    complexity_distribution: Record<string, number>;
    duplicate_formulas_top: Array<{ formula: string; count: number }>;
    last_sync: null | { status?: string; time?: string; records?: number };
    top_fields: Array<{ id: string; name: string; usage: number; source?: string; complexity?: number }>;
    top_workbooks: Array<{ id: string; name: string; project_name?: string; owner?: string; view_count: number; datasource_count: number }>;
    lineage_coverage: {
        tables_with_downstream: number;
        tables_total: number;
        tables_rate: number;
        datasources_with_upstream: number;
        datasources_total: number;
        datasources_rate: number;
        fields_with_views: number;
        fields_total: number;
        fields_rate: number;
        databases_total: number;
    };
    project_distribution: Array<{ name: string; datasources: number; workbooks: number; total: number }>;
    owner_distribution: Array<{ name: string; datasources: number; workbooks: number; total: number }>;
    uncertified_datasources: number;
    total_assets: {
        fields: number;
        calculated_fields: number;
        tables: number;
        datasources: number;
        workbooks: number;
        views: number;
        databases: number;
    };
}

// API 方法
export const api = {
    // 获取统计数据
    getStats: () => request<Stats>('/stats'),

    // 获取仪表盘分析数据
    getDashboardAnalysis: () => request<DashboardAnalysis>('/dashboard/analysis'),

    // 通用详情获取 - 将单数类型映射到复数 API 路径
    getDetail: (type: string, id: string, mode?: string) => {
        const typeToPath: Record<string, string> = {
            'field': 'fields',
            'metric': 'metrics',
            'table': 'tables',
            'database': 'databases',
            'datasource': 'datasources',
            'workbook': 'workbooks',
            'view': 'views',
            'project': 'projects',
            'user': 'users',
        };
        const path = typeToPath[type] || type;
        // 添加时间戳参数以强制禁用缓存，解决聚合数据显示滞后的问题
        const params = new URLSearchParams({ _t: String(Date.now()) });
        if (mode) params.set('mode', mode);
        return request<any>(`/${path}/${id}?${params.toString()}`);
    },

    // 数据库
    getDatabases: (page = 1, pageSize = 50, filters?: Record<string, string>) => {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (filters) Object.entries(filters).forEach(([k, v]) => params.append(k, v));
        return request<PaginatedResponse<Database>>(`/databases?${params}`);
    },

    getDatabase: (id: string) => request<Database>(`/databases/${id}`),

    // 数据表
    getTables: (page = 1, pageSize = 50, filters?: Record<string, string>) => {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (filters) Object.entries(filters).forEach(([k, v]) => params.append(k, v));
        return request<PaginatedResponse<Table>>(`/tables?${params}`);
    },

    getTable: (id: string) => request<Table>(`/tables/${id}`),

    // 字段
    getFields: (page = 1, pageSize = 50, filters?: Record<string, string>) => {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (filters) {
            Object.entries(filters).forEach(([k, v]) => params.append(k, v));
        }
        return request<PaginatedResponse<Field>>(`/fields?${params}`);
    },

    getField: (id: string) => request<Field>(`/fields/${id}`),

    // 指标
    getMetrics: (page = 1, pageSize = 50, filters?: Record<string, string>) => {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (filters) Object.entries(filters).forEach(([k, v]) => params.append(k, v));
        return request<PaginatedResponse<Metric>>(`/metrics?${params}`);
    },

    getMetric: (id: string) => request<Metric>(`/metrics/${id}`),

    // 数据源
    getDatasources: (page = 1, pageSize = 50, filters?: Record<string, string>) => {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (filters) Object.entries(filters).forEach(([k, v]) => params.append(k, v));
        return request<PaginatedResponse<Datasource>>(`/datasources?${params}`);
    },

    getDatasource: (id: string) => request<Datasource>(`/datasources/${id}`),

    // 工作簿
    getWorkbooks: (page = 1, pageSize = 50, filters?: Record<string, string>) => {
        const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
        if (filters) Object.entries(filters).forEach(([k, v]) => params.append(k, v));
        return request<PaginatedResponse<Workbook>>(`/workbooks?${params}`);
    },

    getWorkbook: (id: string) => request<Workbook>(`/workbooks/${id}`),

    // 搜索
    search: (query: string) => request<{ query: string; total: number; results: Record<string, unknown[]> }>(`/search?q=${encodeURIComponent(query)}`),

    // 血缘
    getLineage: (type: string, id: string) => request<unknown>(`/lineage/${type}/${id}`),
    
    // 血缘桑基图
    getLineageSankey: (limit = 50) => request<SankeyData>(`/lineage/sankey?limit=${limit}`),

    // 同步管理
    triggerSync: () => request<{ success: boolean; message: string; status: SyncStatus }>('/sync', { method: 'POST' }),
    getSyncStatus: () => request<{ current: SyncStatus; last_sync: SyncLogInfo | null; history: SyncHistoryItem[] }>('/sync/status'),

    // 质量分析
    getDuplicateMetrics: () => request<PaginatedResponse<DuplicateGroup>>('/quality/duplicates'),

    // 视图使用统计
    getViewUsageStats: (viewId: string) => request<ViewUsageStats>(`/views/${viewId}/usage-stats`),
};

export interface ViewUsageStats {
    viewId: string;
    viewName: string;
    totalViewCount: number;
    dailyDelta: number;
    weeklyDelta: number;
    history: Array<{ count: number; recordedAt: string }>;
}


export interface DuplicateGroup {
    formula: string;
    normalized_formula: string;
    type: 'NAME_VARIANT' | 'LOCATION_VARIANT';
    count: number;
    items: Array<{
        id: string;
        name: string;
        formula: string;
        datasource_id: string;
        datasource_name: string;
        workbook_id: string;
        workbook_name: string;
        project_name: string;
    }>;
}

export interface SankeyNode {
    name: string;
    depth: number;
    itemStyle: { color: string };
}

export interface SankeyLink {
    source: number;
    target: number;
    value: number;
}

export interface SankeyStats {
    databases: number;
    tables: {
        total: number;
        normal: number;
        embedded: number;
        orphan: number;
    };
    datasources: {
        total: number;
        normal: number;
        orphan: number;
        custom_sql: number;
        embedded_ref: number;
        embedded_direct: number;
    };
    fields: {
        total: number;
    };
    calculated_fields: {
        total: number;
    };
    workbooks: number;
    views: number;
}

export interface SankeyData {
    nodes: SankeyNode[];
    links: SankeyLink[];
    stats: SankeyStats;
}

export interface SyncStatus {
    is_running: boolean;
    started_at: string | null;
    progress: string | null;
    error: string | null;
    last_completed: string | null;
}

export interface SyncLogInfo {
    type: string;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    records: number;
    error: string | null;
}

export interface SyncHistoryItem {
    type: string;
    status: string;
    count: number;
    last_run: string;
}

