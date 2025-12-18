// API 基础配置
const API_BASE = '/api';

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
    top_fields: Array<{ id: string; name: string; usage: number }>;
    total_assets: {
        fields: number;
        calculated_fields: number;
        tables: number;
        datasources: number;
        workbooks: number;
        views: number;
    };
}

// API 方法
export const api = {
    // 获取统计数据
    getStats: () => request<Stats>('/stats'),

    // 获取仪表盘分析数据
    getDashboardAnalysis: () => request<DashboardAnalysis>('/dashboard/analysis'),

    // 通用详情获取
    getDetail: (type: string, id: string) => request<any>(`/${type}/${id}`),

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

    // 质量分析
    getDuplicateMetrics: () => request<PaginatedResponse<DuplicateGroup>>('/quality/duplicates'),
};

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

