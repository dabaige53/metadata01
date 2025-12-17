// 全局状态
const state = {
    activeModule: 'overview',
    data: [],
    filteredData: [],
    facets: {},
    activeFilters: {},
    searchTerm: '',
    stats: {},
    sortOption: '',
    sortOrder: 'desc',
    // 分页状态
    pagination: {
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0
    }
};

const api = {
    get: async (url) => {
        try {
            const res = await fetch(`/api${url}`);
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (e) {
            console.error("API Error", e);
            return [];
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await updateGlobalStats();
    switchModule('overview');
});

async function switchModule(moduleName, initialFilters = {}) {
    state.activeModule = moduleName;
    state.searchTerm = '';
    state.activeFilters = initialFilters;
    state.sortOption = '';
    // 重置分页
    state.pagination = { page: 1, pageSize: 50, total: 0, totalPages: 0 };

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('onclick')?.includes(moduleName)) item.classList.add('active');
    });

    document.getElementById('main-content').innerHTML = `<div class="loading"><i data-lucide="loader-2" class="spin"></i></div>`;
    lucide.createIcons();

    // 隐藏侧边栏筛选区域（已移到列表上方）
    document.getElementById('filter-section').style.display = 'none';

    if (moduleName === 'overview') {
        renderOverview();
    } else {
        await loadModuleData(moduleName);
    }
    await updateGlobalStats();
}

async function loadModuleData(module, page = 1) {
    state.pagination.page = page;
    let url = `/${module}?page=${page}&page_size=${state.pagination.pageSize}`;
    if (state.sortOption) url += `&sort=${state.sortOption}&order=${state.sortOrder}`;
    if (state.searchTerm) url += `&search=${encodeURIComponent(state.searchTerm)}`;

    const response = await api.get(url);

    // 兼容分页和非分页响应
    if (response.items) {
        state.data = response.items;
        state.pagination.total = response.total;
        state.pagination.totalPages = response.total_pages;
    } else if (Array.isArray(response)) {
        state.data = response;
        state.pagination.total = response.length;
        state.pagination.totalPages = 1;
    }
    applyFilters();
}

async function goToPage(page) {
    if (page < 1 || page > state.pagination.totalPages) return;
    document.getElementById('main-content').innerHTML = `<div class="loading"><i data-lucide="loader-2" class="spin"></i></div>`;
    lucide.createIcons();
    await loadModuleData(state.activeModule, page);
}

async function handleSortChange(sortKey) {
    state.sortOption = state.sortOption === sortKey ? (state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc', sortKey) : (state.sortOrder = 'desc', sortKey);
    await loadModuleData(state.activeModule);
}

function applyFilters() {
    let result = state.data;
    if (state.searchTerm) {
        const t = state.searchTerm.toLowerCase();
        result = result.filter(i => i.name?.toLowerCase().includes(t) || i.description?.toLowerCase().includes(t) || i.formula?.toLowerCase().includes(t));
    }
    for (const [k, v] of Object.entries(state.activeFilters)) {
        if (v.length) result = result.filter(i => v.includes(String(i[k])));
    }
    state.filteredData = result;
    calculateFacets(result);
    renderList();
    renderFacets();
}

function calculateFacets(data) {
    const cfg = {
        databases: ['connection_type'],
        tables: ['schema'],
        fields: ['role', 'data_type', 'hasDescription'],
        datasources: ['is_certified'],
        metrics: ['metricType', 'role', 'hasDuplicate']  // 新增 metricType 分类
    };
    const keys = cfg[state.activeModule] || [];
    state.facets = {};
    keys.forEach(k => {
        state.facets[k] = {};
        data.forEach(i => {
            // 为指标计算 metricType (业务指标 vs 技术计算)
            if (k === 'metricType') {
                const t = i.role === 'measure' ? 'business' : 'technical';
                state.facets[k][t] = (state.facets[k][t] || 0) + 1;
            } else if (i[k] != null) {
                state.facets[k][String(i[k])] = (state.facets[k][String(i[k])] || 0) + 1;
            }
        });
    });
}

// ===================== 核心渲染 =====================
function renderList() {
    const c = document.getElementById('main-content');
    const n = state.filteredData.length;
    const t = state.activeModule;
    const titles = {
        databases: '数据库',
        tables: '数据表',
        fields: '字段字典',
        metrics: '指标库',
        datasources: '数据源',
        workbooks: '工作簿',
        projects: '项目',
        users: '用户'
    };

    // 排序按钮
    const sortCfg = {
        fields: ['usageCount:热度', 'name:名称'],
        metrics: ['complexity:复杂度', 'referenceCount:引用'],
        tables: ['field_count:字段数'],
        projects: ['total_assets:资产数', 'name:名称'],
        users: ['total_assets:资产数', 'name:名称']
    };
    const sortBtns = (sortCfg[t] || []).map(s => {
        const [k, l] = s.split(':');
        const active = state.sortOption === k;
        return `<button onclick="handleSortChange('${k}')" class="sort-btn ${active ? 'active' : ''}">${l}${active ? (state.sortOrder === 'desc' ? '↓' : '↑') : ''}</button>`;
    }).join('');

    // 筛选器渲染在列表上方
    const facetHtml = renderInlineFacets();

    // 分页控件 (仅对支持分页的模块显示)
    const { page, total, totalPages } = state.pagination;
    const hasPagination = (t === 'fields' || t === 'metrics') && totalPages > 1;
    const paginationHtml = hasPagination ? `
        <div class="pagination-bar">
            <span class="pagination-info">共 <strong>${total}</strong> 项，第 ${page} / ${totalPages} 页</span>
            <div class="pagination-btns">
                <button onclick="goToPage(1)" ${page <= 1 ? 'disabled' : ''} class="pg-btn">«</button>
                <button onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''} class="pg-btn">‹</button>
                <span class="pg-current">${page}</span>
                <button onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''} class="pg-btn">›</button>
                <button onclick="goToPage(${totalPages})" ${page >= totalPages ? 'disabled' : ''} class="pg-btn">»</button>
            </div>
        </div>
    ` : '';

    // 顶部信息栏显示分页总数
    const countDisplay = hasPagination ? `${total} 项（第 ${page}/${totalPages} 页）` : `${n} 项`;

    c.innerHTML = `
        <div class="page-header">
            <h1>${titles[t] || t}</h1>
            <span class="count">${countDisplay}</span>
            ${sortBtns ? `<div class="sort-bar">${sortBtns}</div>` : ''}
        </div>
        ${facetHtml}
        ${n === 0 ? '<div class="empty">无数据</div>' : getModuleContent(t)}
        ${paginationHtml}
    `;
    lucide.createIcons();
}

// ===================== 内联筛选器 =====================
function renderInlineFacets() {
    const labels = {
        connection_type: '连接类型',
        role: '角色',
        is_certified: '认证',
        data_type: '类型',
        schema: 'Schema',
        measure: '度量',
        dimension: '维度',
        'true': '是',
        'false': '否',
        hasDescription: '有描述',
        hasDuplicate: '有重复',
        // 新增：指标类型标签
        metricType: '指标类型',
        business: '业务指标',
        technical: '技术计算'
    };
    const facetEntries = Object.entries(state.facets).filter(([, v]) => Object.keys(v).length);

    if (!facetEntries.length) return '';

    return `
    <div class="inline-facets">
        ${facetEntries.map(([k, counts]) => `
            <div class="facet-inline-group">
                <span class="facet-inline-label">${labels[k] || k}:</span>
                ${Object.entries(counts).map(([val, cnt]) => `
                    <label class="facet-chip ${state.activeFilters[k]?.includes(val) ? 'active' : ''}">
                        <input type="checkbox" onchange="toggleFilter('${k}','${val}')" ${state.activeFilters[k]?.includes(val) ? 'checked' : ''}>
                        <span>${labels[val] || val}</span>
                        <span class="chip-cnt">${cnt}</span>
                    </label>
                `).join('')}
            </div>
        `).join('')}
    </div>`;
}

function getModuleContent(t) {
    switch (t) {
        case 'databases': return renderDBTable();
        case 'tables': return renderTablesTable();
        case 'fields': return renderFieldsTable();
        case 'metrics': return renderMetricsTable();
        case 'datasources': return renderDSTable();
        case 'workbooks': return renderWBTable();
        case 'projects': return renderProjectsTable();
        case 'users': return renderUsersTable();
        default: return '';
    }
}

// ===================== 数据库表格 =====================
function renderDBTable() {
    return `<table class="data-table">
        <thead><tr><th style="width:22%">名称</th><th style="width:10%">类型</th><th style="width:6%">表</th><th style="width:6%">字段</th><th style="width:6%">数据源</th><th style="width:28%">包含的表 (预览)</th><th style="width:12%">主机</th><th style="width:10%">状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const tableNames = i.table_names || [];
        const tablePreview = tableNames.length ?
            `<div class="flex flex-wrap gap-1">
                    ${tableNames.slice(0, 4).map(t => `<span class="tag schema text-[9px]">${t}</span>`).join('')}
                    ${tableNames.length > 4 ? `<span class="text-[9px] text-gray-400">+${tableNames.length - 4}</span>` : ''}
                </div>` : '<span class="text-gray-300">-</span>';
        return `
            <tr onclick="showDetail('${i.id}','databases')">
                <td><div class="cell-main"><i data-lucide="database" class="icon db"></i><span class="name">${i.name}</span></div></td>
                <td><span class="tag type text-[9px]">${i.connectionType || i.type || '-'}</span></td>
                <td class="num font-bold">${i.table_count || 0}</td>
                <td class="num">${i.total_field_count || 0}</td>
                <td class="num">${i.datasource_count > 0 ? `<span class="text-indigo-600 font-medium">${i.datasource_count}</span>` : '-'}</td>
                <td>${tablePreview}</td>
                <td class="muted text-[10px]">${i.hostName || i.host || '-'}</td>
                <td>${(i.datasource_count || 0) > 0 ? '<span class="status ok text-[10px]">● 使用中</span>' : (i.table_count || 0) > 0 ? '<span class="status warn text-[10px]">● 未关联</span>' : '<span class="status error text-[10px]">● 空库</span>'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 数据表表格 =====================
function renderTablesTable() {
    return `<table class="data-table">
        <thead><tr><th style="width:20%">表名</th><th style="width:12%">数据库</th><th style="width:7%">Schema</th><th style="width:6%">原始列</th><th style="width:6%">字段</th><th style="width:6%">数据源</th><th style="width:6%">工作簿</th><th style="width:25%">预览字段</th><th style="width:12%">状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const fc = i.field_count || i.fieldCount || 0;
        const colCount = i.column_count || 0;
        const dsCount = i.datasource_count || 0;
        const wbCount = i.workbook_count || 0;
        const pf = i.preview_fields || {};
        const preview = [...(pf.measures || []).slice(0, 2).map(f => `<span class="tag measure text-[10px]">#${f}</span>`), ...(pf.dimensions || []).slice(0, 2).map(f => `<span class="tag dim text-[10px]">${f}</span>`)].join('');
        return `
            <tr onclick="showDetail('${i.id}','tables')">
                <td><div class="cell-main"><i data-lucide="table-2" class="icon tbl"></i><span class="name">${i.name}</span>${i.isEmbedded ? '<span class="tag warn text-[9px]">嵌入</span>' : ''}</div></td>
                <td class="muted text-[11px]" title="${i.databaseName || ''}">${i.databaseName || '-'}</td>
                <td><span class="tag schema text-[10px]">${i.schema || 'public'}</span></td>
                <td class="num">${colCount || '-'}</td>
                <td class="num">${fc || '-'}</td>
                <td class="num">${dsCount > 0 ? `<span class="text-indigo-600 font-medium">${dsCount}</span>` : '-'}</td>
                <td class="num">${wbCount > 0 ? `<span class="text-green-600 font-medium">${wbCount}</span>` : '-'}</td>
                <td class="preview">${preview || '<span class="text-gray-300">-</span>'}</td>
                <td>${wbCount > 0 ? '<span class="status ok text-[10px]">● 使用中</span>' : (dsCount > 0 ? '<span class="status warn text-[10px]">● 仅关联</span>' : '<span class="status error text-[10px]">● 孤立</span>')}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 字段表格 - 超密集 =====================
function renderFieldsTable() {
    return `<table class="data-table compact">
        <thead>
            <tr>
                <th style="width: 25%">字段名称</th>
                <th style="width: 10%">类型</th>
                <th style="width: 15%">来源表/数据源</th>
                <th style="width: 8%">热度</th>
                <th style="width: 25%">指标依赖 (影响分析)</th>
                <th style="width: 17%">视图引用 (影响分析)</th>
            </tr>
        </thead>
        <tbody>${state.filteredData.map(i => {
        const m = i.role === 'measure';
        const u = i.usageCount || 0;
        const metrics = i.used_by_metrics || [];
        const views = i.used_in_views || [];

        // 构建指标依赖显示的 HTML (只显示前2个，超出的显示数量)
        const metricBadges = metrics.length ?
            `<div class="flex flex-wrap gap-1">
                    ${metrics.slice(0, 2).map(m => `<span class="tag calc clickable" onclick="event.stopPropagation(); showDetail('${m.id}', 'metrics')">${m.name}</span>`).join('')}
                    ${metrics.length > 2 ? `<span class="tag text-gray-400">+${metrics.length - 2}</span>` : ''}
                </div>` : '<span class="text-gray-300">-</span>';

        // 构建视图引用显示的 HTML
        const viewBadges = views.length ?
            `<div class="flex items-center gap-1">
                    <span class="num font-medium text-gray-700">${views.length}</span>
                    <span class="text-[10px] text-gray-400">个视图</span>
                </div>` : '<span class="text-gray-300">-</span>';

        return `
            <tr onclick="showDetail('${i.id}','fields')">
                <td>
                    <div class="cell-main">
                        <span class="dot ${m ? 'measure' : 'dim'}"></span>
                        <div class="flex flex-col min-w-0">
                            <span class="name text-[13px]">${i.name}</span>
                            ${i.isCalculated ? '<span class="text-[10px] text-purple-500 font-mono flex items-center gap-1">fx <span class="truncate max-w-[150px] text-gray-400 inline-block align-bottom" title="' + (i.formula || '') + '">' + (i.formula || '') + '</span></span>' : ''}
                        </div>
                    </div>
                </td>
                <td><span class="font-mono text-[11px] text-gray-500">${i.dataType || '-'}</span></td>
                <td>
                    <div class="flex flex-col">
                        <span class="text-[12px] text-gray-700 truncate" title="${i.table || i.datasource || ''}">${i.table || i.datasource || '-'}</span>
                    </div>
                </td>
                <td class="num ${u > 10 ? 'text-orange-600 font-bold' : ''}">${u}</td>
                <td>${metricBadges}</td>
                <td>${viewBadges}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 指标表格 =====================
function renderMetricsTable() {
    return `<table class="data-table">
        <thead>
            <tr>
                <th style="width: 25%">指标名称</th>
                <th style="width: 8%">复杂度</th>
                <th style="width: 25%">计算逻辑 (公式)</th>
                <th style="width: 15%">依赖字段</th>
                <th style="width: 12%">重复风险</th>
                <th style="width: 15%">数据源</th>
            </tr>
        </thead>
        <tbody>${state.filteredData.map(i => {
        const cx = i.complexity || 0;
        const dups = i.similarMetrics || [];
        const deps = i.dependencyFields || [];
        const hasDup = dups.length > 0;

        return `
            <tr onclick="showDetail('${i.id}','metrics')">
                <td>
                    <div class="cell-main">
                        <i data-lucide="function-square" class="icon metric"></i>
                        <span class="name text-[13px]">${i.name}</span>
                    </div>
                </td>
                <td>
                    <div class="flex items-center gap-1">
                        <div class="h-1.5 w-8 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full ${cx > 10 ? 'bg-red-500' : cx > 4 ? 'bg-orange-400' : 'bg-green-500'}" style="width: ${Math.min(cx * 10, 100)}%"></div>
                        </div>
                        <span class="num text-[10px]">${cx}</span>
                    </div>
                </td>
                <td class="font-mono text-[11px] text-gray-500">
                    <div class="truncate max-w-[200px]" title="${i.formula || ''}">${i.formula || '-'}</div>
                </td>
                <td>
                    <div class="flex -space-x-1 overflow-hidden">
                        ${deps.slice(0, 4).map(d => `<span class="w-4 h-4 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px] text-blue-600" title="${d.name}">${d.name[0]}</span>`).join('')}
                        ${deps.length > 4 ? `<span class="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] text-gray-500">+${deps.length - 4}</span>` : ''}
                    </div>
                </td>
                <td>
                    ${hasDup ?
                `<span class="tag error flex items-center gap-1 clickable" onclick="event.stopPropagation(); showDetail('${i.id}', 'metrics')">
                            <i data-lucide="alert-triangle" class="w-3 h-3"></i> ${dups.length} 重复
                        </span>` :
                '<span class="status ok text-gray-300">● 正常</span>'}
                </td>
                <td class="muted truncate" title="${i.datasourceName}">${i.datasourceName || '-'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 数据源表格 =====================
function renderDSTable() {
    const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
    return `<table class="data-table">
        <thead><tr><th style="width:20%">数据源</th><th style="width:12%">项目</th><th style="width:8%">所有者</th><th style="width:5%">表</th><th style="width:5%">字段</th><th style="width:5%">指标</th><th style="width:5%">工作簿</th><th style="width:5%">视图</th><th style="width:6%">类型</th><th style="width:5%">认证</th><th style="width:10%">刷新</th><th style="width:14%">状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const live = !i.hasExtract;
        let stale = 0;
        if (i.hasExtract && i.lastRefresh) stale = Math.floor((new Date() - new Date(i.lastRefresh)) / 86400000);
        return `
            <tr onclick="showDetail('${i.id}','datasources')">
                <td><div class="cell-main"><i data-lucide="layers" class="icon ds"></i><span class="name">${i.name}</span></div></td>
                <td class="muted text-[11px]">${i.projectName || '-'}</td>
                <td class="muted text-[11px]">${i.owner || '-'}</td>
                <td class="num">${i.table_count || i.tableCount || 0}</td>
                <td class="num">${i.field_count || 0}</td>
                <td class="num">${i.metric_count || 0}</td>
                <td class="num">${i.workbook_count > 0 ? `<span class="text-green-600 font-medium">${i.workbook_count}</span>` : '-'}</td>
                <td class="num">${i.view_count || 0}</td>
                <td><span class="tag ${live ? 'live' : 'extract'} text-[9px]">${live ? 'Live' : 'Extract'}</span></td>
                <td>${i.isCertified ? '<span class="tag cert text-[9px]">✓</span>' : '-'}</td>
                <td class="muted text-[10px]">${formatDate(i.lastRefresh)}</td>
                <td>${stale > 30 ? `<span class="tag error text-[9px]">停更${stale}天</span>` : stale > 7 ? `<span class="tag warn text-[9px]">${stale}天前</span>` : '<span class="status ok text-[10px]">● 正常</span>'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 工作簿表格 =====================
function renderWBTable() {
    return `<table class="data-table">
        <thead><tr><th style="width:25%">工作簿</th><th style="width:15%">项目</th><th style="width:12%">所有者</th><th style="width:8%">视图数</th><th style="width:25%">上游数据源</th><th style="width:15%">状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const upDs = i.upstream_datasources || [];
        const dsPreview = upDs.length ?
            `<div class="flex flex-wrap gap-1">
                    ${upDs.slice(0, 3).map(ds => `<span class="tag schema text-[9px]">${ds}</span>`).join('')}
                    ${upDs.length > 3 ? `<span class="text-[9px] text-gray-400">+${upDs.length - 3}</span>` : ''}
                </div>` : '<span class="text-gray-300">-</span>';
        return `
            <tr onclick="showDetail('${i.id}','workbooks')">
                <td><div class="cell-main"><i data-lucide="book-open" class="icon wb"></i><span class="name">${i.name}</span></div></td>
                <td class="muted text-[11px]">${i.projectName || '-'}</td>
                <td class="muted text-[11px]">${i.owner || '-'}</td>
                <td class="num">${i.viewCount || 0}</td>
                <td>${dsPreview}</td>
                <td>${(i.viewCount || 0) > 0 ? '<span class="status ok text-[10px]">● 有视图</span>' : '<span class="status warn text-[10px]">● 空工作簿</span>'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== Facets =====================
function renderFacets() {
    const c = document.getElementById('dynamic-filters');
    const labels = { connection_type: '连接类型', role: '角色', is_certified: '认证', data_type: '类型', schema: 'Schema', measure: '度量', dimension: '维度', 'true': '是', 'false': '否' };
    c.innerHTML = Object.entries(state.facets).filter(([, v]) => Object.keys(v).length).map(([k, counts]) => `
        <div class="facet-group">
            <div class="facet-title">${labels[k] || k}</div>
            ${Object.entries(counts).map(([val, cnt]) => `
                <label class="facet-item">
                    <input type="checkbox" onchange="toggleFilter('${k}','${val}')" ${state.activeFilters[k]?.includes(val) ? 'checked' : ''}>
                    <span>${labels[val] || val}</span><span class="cnt">${cnt}</span>
                </label>`).join('')}
        </div>`).join('');
}

function toggleFilter(k, v) {
    if (!state.activeFilters[k]) state.activeFilters[k] = [];
    const i = state.activeFilters[k].indexOf(v);
    i > -1 ? state.activeFilters[k].splice(i, 1) : state.activeFilters[k].push(v);
    applyFilters();
}

// 从概览页跳转并自动应用筛选器
async function navigateWithFilter(module, filterKey, filterVal) {
    // 构建初始筛选器对象
    const initialFilters = {};
    if (filterKey && filterVal !== undefined) {
        initialFilters[filterKey] = [filterVal];
    }
    await switchModule(module, initialFilters);
}

// ===================== 项目表格 =====================
function renderProjectsTable() {
    return `<table class="data-table">
        <thead><tr><th>项目名称</th><th>简介</th><th>数据源</th><th>工作簿</th><th>资产总数</th></tr></thead>
        <tbody>${state.filteredData.map(i => `
            <tr onclick="showDetail('${i.id}','projects')">
                <td><div class="cell-main"><i data-lucide="folder" class="icon proj"></i><span class="name">${i.name}</span></div></td>
                <td class="muted"><span class="truncate max-w-[200px]">${i.description || '-'}</span></td>
                <td class="num">${i.datasource_count || 0}</td>
                <td class="num">${i.workbook_count || 0}</td>
                <td class="num font-bold">${i.total_assets || 0}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// ===================== 用户表格 =====================
function renderUsersTable() {
    return `<table class="data-table">
        <thead><tr><th>用户名</th><th>显示名称</th><th>角色</th><th>数据源</th><th>工作簿</th><th>资产总数</th></tr></thead>
        <tbody>${state.filteredData.map(i => `
            <tr onclick="showDetail('${i.id}','users')">
                <td><div class="cell-main"><i data-lucide="user" class="icon user"></i><span class="name">${i.name}</span></div></td>
                <td>${i.display_name || '-'}</td>
                <td><span class="tag role">${i.site_role || 'User'}</span></td>
                <td class="num">${i.datasource_count || 0}</td>
                <td class="num">${i.workbook_count || 0}</td>
                <td class="num font-bold">${i.total_assets || 0}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}


// ===================== 概览 (新版治理仪表盘) =====================
async function renderOverview() {
    const c = document.getElementById('main-content');
    try {
        // 获取仪表盘分析数据 (包含 quality_metrics)
        const d = await api.get('/dashboard/analysis');
        const qualityData = d.quality_metrics || {};  // 从同一接口获取质量指标

        // 确保 scores 存在 (兼容旧接口)
        const scores = d.governance_scores || { completeness: 0, timeliness: 0, consistency: 0, validity: 0, standardization: 0 };
        const hc = d.health_score >= 80 ? 'good' : d.health_score >= 60 ? 'warn' : 'bad';

        // 构建资产统计
        const totalAssets = d.total_assets || {};

        // 辅助函数: 构建维度卡片
        const buildDimCard = (label, score, icon, color) => {
            const statusColor = score >= 90 ? 'text-green-600' : score >= 70 ? 'text-orange-500' : 'text-red-500';
            const bgClass = score >= 90 ? 'bg-green-50' : score >= 70 ? 'bg-orange-50' : 'bg-red-50';

            // 评分规则说明
            const tips = {
                '完整性 (Completeness)': '字段/计算字段描述缺失率 (6:4权重)',
                '时效性 (Timeliness)': '长期未刷新 Extract 数据源数量',
                '一致性 (Consistency)': '重复定义的指标公式数量',
                '有效性 (Validity)': '由于缺乏引用而未使用的孤立表/字段'
            };
            const tip = tips[label] || '';

            return `
            <div class="bg-white p-4 rounded-lg border border-gray-200 flex flex-col relative overflow-hidden group" title="${tip}">
                <div class="flex justify-between items-start mb-2 z-10">
                    <div class="flex items-center gap-2">
                        <div class="p-1.5 rounded-md ${bgClass} ${statusColor}">
                            <i data-lucide="${icon}" class="w-4 h-4"></i>
                        </div>
                        <span class="text-[13px] font-medium text-gray-600">${label}</span>
                    </div>
                    <i data-lucide="help-circle" class="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-help"></i>
                </div>
                <div class="flex items-baseline gap-1 mt-auto z-10">
                    <span class="text-2xl font-bold text-gray-800">${score}</span>
                    <span class="text-[10px] text-gray-400">/100</span>
                </div>
                <!-- 进度条背景 -->
                <div class="absolute bottom-0 left-0 h-1 bg-${score >= 90 ? 'green' : score >= 70 ? 'orange' : 'red'}-500 transition-all duration-1000" style="width: ${score}%"></div>
            </div>`;
        };

        // 辅助函数: 分布图表
        const buildDistChart = (data, colorFn) => {
            if (!data) return '<div class="flex items-center justify-center h-full text-gray-300 text-xs">暂无数据</div>';
            const total = Object.values(data).reduce((a, b) => a + b, 0);
            return Object.entries(data).slice(0, 5).map(([k, v]) => {
                const pct = total ? (v / total * 100).toFixed(1) : 0;
                const color = colorFn ? colorFn(k) : '#6366f1';
                return `<div class="mb-2 last:mb-0">
                    <div class="flex justify-between text-[11px] mb-1">
                        <span class="text-gray-600 truncate mr-2" title="${k}">${k}</span>
                        <span class="text-gray-500 font-mono">${pct}%</span>
                    </div>
                    <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width:${pct}%; background:${color}"></div>
                    </div>
                </div>`;
            }).join('');
        };

        // 辅助函数: 问题行动项
        const buildActionItem = (title, count, module, filterKey, filterVal, isCritical = false) => {
            if (!count) return ''; // 没有问题不显示

            return `
            <div onclick="navigateWithFilter('${module}', '${filterKey}', '${filterVal}')" 
                 class="group flex items-center justify-between p-3 bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-orange-400'}"></div>
                    <span class="text-[13px] text-gray-700 font-medium group-hover:text-indigo-600 transition-colors">${title}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${isCritical ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}">${count}</span>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 group-hover:text-indigo-400"></i>
                </div>
            </div>`;
        };

        // 辅助函数: 构建覆盖率进度条 (新)
        const buildCoverageBar = (title, data) => {
            const pct = data.coverage_rate || 0;
            const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
            return `
            <div class="mb-3 last:mb-0">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[12px] text-gray-600">${title}</span>
                    <span class="text-[11px] font-medium text-gray-800">${data.with_description}/${data.total} (${pct}%)</span>
                </div>
                <div class="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full ${color}" style="width: ${pct}%"></div>
                </div>
            </div>`;
        };

        // 辅助函数: 构建认证状态环 (新)
        const buildCertPie = (data) => {
            const pct = data.certification_rate || 0;
            const color = pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-500';

            return `
            <div class="flex items-center gap-4">
                <div class="relative w-16 h-16 flex items-center justify-center">
                    <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f3f4f6" stroke-width="3" />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="${pct}, 100" class="${color}" />
                    </svg>
                    <div class="absolute text-[12px] font-bold text-gray-700">${pct}%</div>
                </div>
                <div class="flex-1">
                    <div class="text-[12px] text-gray-500 mb-1">已认证数据源</div>
                    <div class="text-xl font-bold text-gray-800">${data.certified} <span class="text-xs font-normal text-gray-400">/ ${data.total}</span></div>
                    <div class="text-[10px] text-gray-400 mt-0.5">可信数据比例</div>
                </div>
            </div>`;
        };

        // 颜色映射
        const typeColors = k => ({ 'string': '#10b981', 'integer': '#3b82f6', 'real': '#f59e0b', 'datetime': '#8b5cf6', 'boolean': '#6366f1' }[k] || '#94a3b8');

        c.innerHTML = `
            <div class="max-w-7xl mx-auto space-y-6 pb-10">
                <!-- 头部：健康总览 -->
                <div class="grid grid-cols-12 gap-6">
                    <!-- 左侧：总体健康分 -->
                    <div class="col-span-12 md:col-span-4 lg:col-span-3">
                         <div class="bg-white rounded-xl border border-gray-200 p-6 h-full flex flex-col justify-center items-center relative overflow-hidden shadow-sm">
                            <div class="absolute inset-0 bg-gradient-to-br from-white to-gray-50 z-0"></div>
                            <div class="relative z-10 text-center">
                                <div class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">治理健康分</div>
                                <div class="text-6xl font-black tracking-tight ${hc === 'good' ? 'text-green-600' : hc === 'warn' ? 'text-orange-500' : 'text-red-500'} mb-2">
                                    ${d.health_score}
                                </div>
                                <div class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hc === 'good' ? 'bg-green-100 text-green-800' : hc === 'warn' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}">
                                    ${d.health_score >= 80 ? '状态良好' : d.health_score >= 60 ? '需要关注' : '亟需治理'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右侧：四个治理维度 -->
                    <div class="col-span-12 md:col-span-8 lg:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
                        ${buildDimCard('完整性 (Completeness)', scores.completeness, 'file-text', 'blue')}
                        ${buildDimCard('规范性 (Standardization)', scores.standardization || 0, 'award', 'purple')}
                        ${buildDimCard('时效性 (Timeliness)', scores.timeliness, 'clock', 'orange')}
                        ${buildDimCard('一致性 (Consistency)', scores.consistency, 'git-branch', 'purple')}
                        ${buildDimCard('有效性 (Validity)', scores.validity, 'check-circle', 'green')}
                        
                        <!-- 资产统计条 (嵌入在维度下方) -->
                        <div class="col-span-2 lg:col-span-4 bg-gray-50 rounded-lg p-3 flex justify-around items-center border border-gray-200 border-dashed mt-1">
                             <div class="text-center cursor-pointer hover:opacity-75" onclick="switchModule('fields')">
                                <div class="text-[16px] font-bold text-gray-700">${totalAssets.fields || 0}</div>
                                <div class="text-[10px] text-gray-400 uppercase">字段</div>
                            </div>
                            <div class="w-px h-6 bg-gray-200"></div>
                            <div class="text-center cursor-pointer hover:opacity-75" onclick="switchModule('metrics')">
                                <div class="text-[16px] font-bold text-gray-700">${totalAssets.calculated_fields || 0}</div>
                                <div class="text-[10px] text-gray-400 uppercase">指标</div>
                            </div>
                            <div class="w-px h-6 bg-gray-200"></div>
                             <div class="text-center cursor-pointer hover:opacity-75" onclick="switchModule('tables')">
                                <div class="text-[16px] font-bold text-gray-700">${totalAssets.tables || 0}</div>
                                <div class="text-[10px] text-gray-400 uppercase">数据表</div>
                            </div>
                            <div class="w-px h-6 bg-gray-200"></div>
                             <div class="text-center cursor-pointer hover:opacity-75" onclick="switchModule('datasources')">
                                <div class="text-[16px] font-bold text-gray-700">${totalAssets.datasources || 0}</div>
                                <div class="text-[10px] text-gray-400 uppercase">数据源</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 新增：数据质量仪表盘 (如果有质量数据) -->
                ${qualityData ? `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- 描述覆盖率 -->
                    <div class="col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h4 class="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <i data-lucide="file-text" class="w-4 h-4 text-indigo-500"></i> 元数据描述覆盖率
                        </h4>
                        <div class="grid grid-cols-2 gap-x-8 gap-y-2">
                             ${buildCoverageBar('字段字典', qualityData.field_coverage)}
                             ${buildCoverageBar('数据表', qualityData.table_coverage)}
                             ${buildCoverageBar('数据源', qualityData.datasource_coverage)}
                             ${buildCoverageBar('工作簿', qualityData.workbook_coverage)}
                        </div>
                    </div>
                    
                    <!-- 认证状态 -->
                    <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h4 class="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <i data-lucide="shield-check" class="w-4 h-4 text-green-500"></i> 数据源认证
                        </h4>
                        <div class="py-2">
                            ${buildCertPie(qualityData.datasource_coverage)}
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- 待处理事项 (Action Center) -->
                ${(d.issues.stale_datasources || d.issues.duplicate_formulas || d.issues.orphaned_tables || d.issues.missing_description) ? `
                <div class="space-y-3">
                    <h3 class="text-[13px] font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-4 h-4 text-indigo-500"></i> 行动中心 (Action Items)
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         ${buildActionItem('修复重复公式', d.issues.duplicate_formulas, 'metrics', 'hasDuplicate', 'true', true)}
                         ${buildActionItem('更新停更数据源', d.issues.stale_datasources, 'datasources', 'hasExtract', 'true', true)}
                         ${buildActionItem('清理孤立表', d.issues.orphaned_tables, 'tables', 'schema', '')}
                         ${buildActionItem('补充字段描述', d.issues.missing_description, 'fields', 'hasDescription', 'false')}
                    </div>
                </div>
                ` : ''}

                <!-- 详情分布图表 -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <!-- 字段来源 -->
                    <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h4 class="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <i data-lucide="pie-chart" class="w-4 h-4 text-gray-400"></i> 字段来源分布
                        </h4>
                        <div class="space-y-3">
                             ${buildDistChart(d.field_source_distribution, k => ({ 'datasource': '#6366f1', 'table': '#10b981', 'workbook': '#f59e0b', 'orphan': '#ef4444' }[k] || '#6b7280'))}
                        </div>
                    </div>

                    <!-- 数据类型 -->
                    <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h4 class="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
                             <i data-lucide="bar-chart-2" class="w-4 h-4 text-gray-400"></i> 数据类型分布
                        </h4>
                        <div class="space-y-3">
                            ${buildDistChart(d.data_type_distribution, typeColors)}
                        </div>
                    </div>

                    <!-- 热点资产 -->
                    <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                        <h4 class="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
                             <i data-lucide="flame" class="w-4 h-4 text-orange-500"></i> 热点字段 Top 10
                        </h4>
                        <div class="flex-1 overflow-y-auto custom-scrollbar -mr-2 pr-2">
                            <table class="w-full text-left border-collapse">
                                <tbody class="text-[12px]">
                                    ${(d.top_fields || []).map((f, i) => `
                                        <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors" onclick="showDetail('${f.id}','fields')">
                                            <td class="py-2.5 font-mono text-gray-400 w-6">${i + 1}</td>
                                            <td class="py-2.5 font-medium text-gray-700 truncate max-w-[120px]" title="${f.name}">${f.name}</td>
                                            <td class="py-2.5 text-right w-16">
                                                <div class="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium text-[10px]">
                                                    ${f.usage} 引用
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>`;

        lucide.createIcons();
    } catch (e) {
        console.error(e);
        c.innerHTML = '<div class="empty">加载失败</div>';
    }
}

// ===================== 详情抽屉 (系统性分析核心) =====================
// 全局变量存储当前详情数据和历史记录
let currentDetailItem = null;
let currentDetailType = null;
let detailHistory = []; // 历史记录栈

async function showDetail(id, type, addToHistory = true) {
    const drawer = document.getElementById('detail-drawer');
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('drawer-title');
    const tabs = document.getElementById('drawer-tabs');
    const content = document.getElementById('drawer-content');

    // 添加到历史记录
    if (addToHistory && currentDetailItem && currentDetailType) {
        detailHistory.push({ id: currentDetailItem.id, type: currentDetailType, name: currentDetailItem.name });
    }

    drawer.classList.add('open');
    overlay.classList.add('active');

    // 如果是切换，先清理
    content.innerHTML = '<div class="loading py-10 flex justify-center"><i data-lucide="loader-2" class="spin w-6 h-6 text-indigo-500"></i></div>';
    tabs.innerHTML = '';
    lucide.createIcons();

    // 数据获取 - 优先使用详情API
    let item = null;
    try {
        item = await api.get(`/${type}/${id}`);
        // 兼容 metrics 列表接口返回的是 list
        if (Array.isArray(item)) item = item.find(i => i.id == id);
        // 兼容 metrics 接口返回分页格式
        if (item && item.items) {
            item = item.items.find(i => i.id == id);
        }
    } catch (e) {
        console.error('Detail API error:', e);
        // 回退到本地数据
        item = state.data.find(i => i.id == id);
    }

    if (!item) { content.innerHTML = '<div class="text-center text-gray-400 py-8">未找到数据</div>'; return; }

    // 存储当前数据
    currentDetailItem = item;
    currentDetailType = type;

    title.innerHTML = `<div class="flex flex-col">
        <span>${item.name}</span>
        <span class="text-[10px] font-normal text-gray-400 uppercase tracking-wide mt-0.5">${getModuleName(type)} 详情</span>
    </div>`;

    // 更新返回按钮和面包屑
    updateBackButton();

    // 渲染Tab导航
    renderDetailTabs(item, type);

    // 默认显示概览Tab
    renderDetailTab('overview');
}

// 渲染Tab导航
function renderDetailTabs(item, type) {
    const tabs = document.getElementById('drawer-tabs');
    const tabConfig = [
        { id: 'overview', label: '概览', icon: 'info' },
        { id: 'upstream', label: '上游资产', icon: 'arrow-up-circle' },
        { id: 'downstream', label: '下游资产', icon: 'arrow-down-circle' }
    ];

    // 根据类型添加特定Tab
    if (type === 'metrics' && (item.similarMetrics || []).length > 0) {
        tabConfig.push({ id: 'duplicates', label: `重复指标 (${item.similarMetrics.length})`, icon: 'alert-triangle' });
    }
    if (['fields', 'metrics', 'datasources', 'tables'].includes(type)) {
        tabConfig.push({ id: 'lineage', label: '血缘图', icon: 'git-branch' });
    }

    tabs.innerHTML = tabConfig.map((tab, i) => `
        <button onclick="renderDetailTab('${tab.id}')"
                class="detail-tab px-4 py-3 text-[12px] font-medium border-b-2 transition-colors flex items-center gap-1.5
                       ${i === 0 ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                data-tab="${tab.id}">
            <i data-lucide="${tab.icon}" class="w-3.5 h-3.5"></i>
            ${tab.label}
        </button>
    `).join('');
    lucide.createIcons();
}

// 渲染Tab内容
function renderDetailTab(tabId) {
    const content = document.getElementById('drawer-content');
    const item = currentDetailItem;
    const type = currentDetailType;

    if (!item) return;

    // 更新Tab激活状态
    document.querySelectorAll('.detail-tab').forEach(tab => {
        if (tab.dataset.tab === tabId) {
            tab.classList.add('border-indigo-500', 'text-indigo-600');
            tab.classList.remove('border-transparent', 'text-gray-500');
        } else {
            tab.classList.remove('border-indigo-500', 'text-indigo-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        }
    });

    let html = '<div class="space-y-6">';

    switch (tabId) {
        case 'overview':
            html += renderOverviewTab(item, type);
            break;
        case 'upstream':
            html += renderUpstreamAssets(item, type) || '<div class="text-center text-gray-400 py-8">无上游资产</div>';
            break;
        case 'downstream':
            html += renderDownstreamAssets(item, type) || '<div class="text-center text-gray-400 py-8">无下游资产</div>';
            break;
        case 'duplicates':
            html += renderSimilarAssets(item);
            break;
        case 'lineage':
            html += `<div id="lineage-container" class="bg-white rounded-lg border p-4">
                <div class="text-center py-4">
                    <button onclick="loadLineageGraph('${type.replace(/s$/, '')}', '${item.id}')"
                            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[12px] font-medium transition-colors">
                        <i data-lucide="git-branch" class="w-4 h-4 inline mr-1"></i>
                        加载血缘图
                    </button>
                </div>
            </div>`;
            break;
    }

    html += '</div>';
    content.innerHTML = html;
    lucide.createIcons();
}

// 渲染概览Tab
function renderOverviewTab(item, type) {
    let html = `
    <div class="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
        <h3 class="text-[12px] font-bold text-gray-900 mb-3 flex items-center gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 text-indigo-500"></i> 基本信息
        </h3>
        <div class="grid grid-cols-2 gap-y-3 gap-x-4">
            ${renderPropRow('ID', item.id, true)}
            ${renderPropRow('类型', item.dataType || item.type)}
            ${renderPropRow('角色', item.role)}
            ${renderPropRow('所有者', item.owner)}
            ${renderPropRow('项目', item.projectName || item.project_name)}
            ${item.formula ? `<div class="col-span-2">
                <div class="text-[10px] text-gray-400 mb-1">计算公式</div>
                <div class="bg-gray-50 rounded p-2 font-mono text-[11px] text-gray-700 break-all border border-gray-100">${item.formula}</div>
            </div>` : ''}
            ${item.description ? `<div class="col-span-2">
                <div class="text-[10px] text-gray-400 mb-1">描述</div>
                <p class="text-[12px] text-gray-600">${item.description}</p>
            </div>` : ''}
        </div>
    </div>`;

    // 统计信息
    if (item.stats) {
        html += renderStatsCard(item.stats, type);
    }

    return html;
}

// 加载血缘图
async function loadLineageGraph(entityType, entityId) {
    const container = document.getElementById('lineage-container');
    container.innerHTML = '<div class="text-center py-4"><i data-lucide="loader-2" class="spin w-6 h-6 text-indigo-500 inline"></i></div>';
    lucide.createIcons();

    try {
        const data = await api.get(`/lineage/graph/${entityType}/${entityId}`);
        container.innerHTML = `
            <div class="mb-4">
                <div id="mermaid-graph" class="mermaid bg-gray-50 p-4 rounded-lg border overflow-auto" style="min-height: 200px;">
                    ${data.mermaid}
                </div>
            </div>
            <div class="border-t pt-4">
                <h4 class="text-[11px] font-bold text-gray-500 uppercase mb-3">节点列表</h4>
                <div class="grid grid-cols-2 gap-2">
                    ${data.nodes.map(n => `
                        <div class="flex items-center gap-2 p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100"
                             onclick="showDetail('${n.id}', '${n.type}s')">
                            <span class="w-2 h-2 rounded-full" style="background:${getTypeColor(n.type)}"></span>
                            <span class="text-[12px] text-gray-700 truncate flex-1">${n.name}</span>
                            <span class="text-[10px] text-gray-400">${n.type}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        // 初始化 Mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
            mermaid.run({ nodes: [document.getElementById('mermaid-graph')] });
        }
    } catch (e) {
        container.innerHTML = '<div class="text-center text-red-500 py-4">加载血缘图失败</div>';
        console.error(e);
    }
}


// 渲染上游资产卡片
function renderUpstreamAssets(item, type) {
    let html = '';
    const upstreamItems = [];

    // 字段的上游: 原始列、表、数据源
    if (type === 'fields') {
        // 原始数据库列 (最上游)
        if (item.upstream_column_info) {
            upstreamItems.push({
                type: 'tables', // 使用通用图标
                icon: 'database',
                label: '原始数据库列',
                items: [{
                    id: item.upstream_column_info.id,
                    name: item.upstream_column_info.name,
                    subtitle: `${item.upstream_column_info.remote_type || 'Unknown'} | ${item.upstream_column_info.table_name || '-'}`
                }]
            });
        }

        // 直接关联的表
        if (item.table_info) {
            upstreamItems.push({
                type: 'tables',
                icon: 'table-2',
                label: '所属数据表',
                items: [{
                    id: item.table_info.id,
                    name: item.table_info.name,
                    subtitle: item.table_info.database_name ? `DB: ${item.table_info.database_name}` : (item.table_info.schema ? `Schema: ${item.table_info.schema}` : null)
                }]
            });
        }
        // 通过数据源追溯的上游表
        if (item.upstream_tables && item.upstream_tables.length) {
            upstreamItems.push({
                type: 'tables',
                icon: 'table-2',
                label: '上游数据表 (通过数据源)',
                items: item.upstream_tables.map(t => ({
                    id: t.id,
                    name: t.name,
                    subtitle: t.database_name ? `DB: ${t.database_name}` : (t.schema || null)
                }))
            });
        }
        if (item.datasource_info) {
            upstreamItems.push({
                type: 'datasources',
                icon: 'layers',
                label: '所属数据源',
                items: [{
                    id: item.datasource_info.id,
                    name: item.datasource_info.name,
                    subtitle: item.datasource_info.is_certified ? '✓ 已认证' : null
                }]
            });
        }
        if (item.workbook_info) {
            upstreamItems.push({
                type: 'workbooks',
                icon: 'book-open',
                label: '所属工作簿',
                items: [{
                    id: item.workbook_info.id,
                    name: item.workbook_info.name,
                    subtitle: item.workbook_info.owner ? `Owner: ${item.workbook_info.owner}` : null
                }]
            });
        }
    }

    // 指标的上游: 依赖字段、数据源、上游表
    if (type === 'metrics') {
        // 上游数据表（通过数据源追溯）
        const upTables = item.upstream_tables || [];
        if (upTables.length) {
            upstreamItems.push({
                type: 'tables',
                icon: 'table-2',
                label: '上游数据表',
                items: upTables.map(t => ({
                    id: t.id,
                    name: t.name,
                    subtitle: t.database_name ? `DB: ${t.database_name}` : (t.schema || null)
                }))
            });
        }
        // 依赖字段（增强：显示来源表）
        const deps = item.dependencyFields || [];
        if (deps.length) {
            upstreamItems.push({
                type: 'fields',
                icon: 'columns',
                label: '依赖基础字段',
                items: deps.map(d => ({
                    id: d.id,
                    name: d.name,
                    subtitle: d.table_name ? `表: ${d.table_name}` : (d.upstream_tables ? `表: ${d.upstream_tables.join(', ')}` : null)
                }))
            });
        }
        // 数据源
        if (item.datasource_info) {
            upstreamItems.push({
                type: 'datasources',
                icon: 'layers',
                label: '定义于数据源',
                items: [{
                    id: item.datasource_info.id,
                    name: item.datasource_info.name,
                    subtitle: item.datasource_info.is_certified ? '✓ 已认证' : null
                }]
            });
        } else if (item.datasourceId || item.datasourceName) {
            upstreamItems.push({
                type: 'datasources',
                icon: 'layers',
                label: '定义于数据源',
                items: [{
                    id: item.datasourceId,
                    name: item.datasourceName || '-'
                }]
            });
        }
    }

    // 视图的上游: 工作簿
    if (type === 'views') {
        if (item.workbook_info) {
            upstreamItems.push({
                type: 'workbooks',
                icon: 'book-open',
                label: '所属工作簿',
                items: [{
                    id: item.workbook_info.id,
                    name: item.workbook_info.name,
                    subtitle: item.workbook_info.owner ? `Owner: ${item.workbook_info.owner}` : null
                }]
            });
        }
    }

    // 工作簿的上游: 数据源
    if (type === 'workbooks') {
        const datasources = item.datasources || [];
        if (datasources.length) {
            upstreamItems.push({
                type: 'datasources',
                icon: 'layers',
                label: '上游数据源',
                items: datasources.map(ds => ({
                    id: ds.id,
                    name: ds.name,
                    subtitle: ds.is_certified ? '✓ 已认证' : (ds.has_extract ? 'Extract' : 'Live')
                }))
            });
        }
    }

    // 数据源的上游: 表（增强版）
    if (type === 'datasources') {
        const tables = item.tables || item.connected_tables || [];
        if (tables.length) {
            upstreamItems.push({
                type: 'tables',
                icon: 'table-2',
                label: '连接的数据表',
                items: tables.map(t => typeof t === 'string' ? { name: t } : {
                    id: t.id,
                    name: t.name,
                    subtitle: t.database_name ? `DB: ${t.database_name}` : (t.schema || null)
                })
            });
        }
    }

    // 表的上游: 数据库（增强版）
    if (type === 'tables') {
        if (item.database_info) {
            upstreamItems.push({
                type: 'databases',
                icon: 'database',
                label: '所属数据库',
                items: [{
                    id: item.database_info.id,
                    name: item.database_info.name,
                    subtitle: item.database_info.connection_type || null
                }]
            });
        } else if (item.databaseId || item.databaseName) {
            upstreamItems.push({
                type: 'databases',
                icon: 'database',
                label: '所属数据库',
                items: [{
                    id: item.databaseId,
                    name: item.databaseName || '-'
                }]
            });
        }
    }

    if (upstreamItems.length === 0) return '';

    html += `
    <div class="bg-blue-50 rounded-lg border border-blue-100 p-4">
        <h3 class="text-[12px] font-bold text-blue-900 mb-3 flex items-center gap-2">
            <i data-lucide="arrow-up-circle" class="w-3.5 h-3.5 text-blue-600"></i> 上游资产 (数据来源)
        </h3>
        <div class="space-y-3">
            ${upstreamItems.map(group => `
                <div>
                    <div class="text-[10px] text-blue-600 font-medium mb-1.5 flex items-center gap-1">
                        <i data-lucide="${group.icon}" class="w-3 h-3"></i> ${group.label}
                    </div>
                    <div class="space-y-1">
                        ${group.items.slice(0, 5).map(asset => `
                            <div class="flex items-center justify-between bg-white p-2 rounded border border-blue-100 ${asset.id ? 'cursor-pointer hover:border-blue-300' : ''} transition-colors"
                                 ${asset.id ? `onclick="showDetail('${asset.id}', '${group.type}')"` : ''}>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[12px] text-gray-700 font-medium truncate">${asset.name}</span>
                                    ${asset.subtitle ? `<span class="text-[10px] text-gray-400">${asset.subtitle}</span>` : ''}
                                </div>
                                ${asset.id ? '<i data-lucide="chevron-right" class="w-3 h-3 text-gray-400 flex-shrink-0"></i>' : ''}
                            </div>
                        `).join('')}
                        ${group.items.length > 5 ? `<div class="text-[10px] text-blue-500 pl-2">+${group.items.length - 5} 更多...</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;

    return html;
}

// 渲染下游资产卡片
function renderDownstreamAssets(item, type) {
    let html = '';
    const downstreamItems = [];

    // 字段的下游: 指标、视图
    if (type === 'fields') {
        const metrics = item.used_by_metrics || [];
        if (metrics.length) {
            downstreamItems.push({
                type: 'metrics',
                icon: 'function-square',
                label: '使用此字段的指标',
                items: metrics.map(m => ({ id: m.id, name: m.name }))
            });
        }
        const views = item.used_in_views || [];
        if (views.length) {
            downstreamItems.push({
                type: 'views',
                icon: 'layout',
                label: '使用此字段的视图',
                items: views.map(v => ({
                    id: v.id,
                    name: v.name,
                    subtitle: v.workbook_name || v.workbookName
                }))
            });
        }
    }

    // 指标的下游: 视图、工作簿
    if (type === 'metrics') {
        const views = item.usedInViews || [];
        if (views.length) {
            downstreamItems.push({
                type: 'views',
                icon: 'layout',
                label: '使用此指标的视图',
                items: views.map(v => ({
                    id: v.id,
                    name: v.name,
                    subtitle: v.workbook_name || v.workbookName
                }))
            });
        }
        const workbooks = item.usedInWorkbooks || [];
        if (workbooks.length) {
            downstreamItems.push({
                type: 'workbooks',
                icon: 'book-open',
                label: '使用此指标的工作簿',
                items: workbooks.map(wb => ({
                    id: wb.id,
                    name: wb.name,
                    subtitle: wb.owner ? `Owner: ${wb.owner}` : null
                }))
            });
        }
    }

    // 数据源的下游: 工作簿（增强版）
    if (type === 'datasources') {
        const workbooks = item.workbooks || [];
        if (workbooks.length) {
            downstreamItems.push({
                type: 'workbooks',
                icon: 'book-open',
                label: '使用此数据源的工作簿',
                items: workbooks.map(wb => ({
                    id: wb.id,
                    name: wb.name,
                    subtitle: wb.owner ? `Owner: ${wb.owner}` : null
                }))
            });
        }
        // 数据源的字段
        const fields = item.full_fields || [];
        if (fields.length) {
            downstreamItems.push({
                type: 'fields',
                icon: 'columns',
                label: '包含的字段',
                items: fields.slice(0, 10).map(f => ({
                    id: f.id,
                    name: f.name,
                    subtitle: f.role === 'measure' ? '度量' : '维度'
                }))
            });
        }
        // 数据源的指标
        const metrics = item.metrics || [];
        if (metrics.length) {
            downstreamItems.push({
                type: 'metrics',
                icon: 'function-square',
                label: '包含的指标',
                items: metrics.slice(0, 10).map(m => ({
                    id: m.id,
                    name: m.name
                }))
            });
        }
    }

    // 表的下游: 数据源、原始列、字段（增强版）
    if (type === 'tables') {
        // 原始数据库列
        const columns = item.columns || [];
        if (columns.length) {
            downstreamItems.push({
                type: 'columns',
                icon: 'list',
                label: '原始数据库列 (未改写)',
                items: columns.slice(0, 10).map(c => ({
                    name: c.name,
                    subtitle: c.remote_type || null
                }))
            });
        }
        // Tableau字段
        const fields = item.full_fields || [];
        if (fields.length) {
            downstreamItems.push({
                type: 'fields',
                icon: 'columns',
                label: 'Tableau字段',
                items: fields.slice(0, 10).map(f => ({
                    id: f.id,
                    name: f.name,
                    subtitle: f.role === 'measure' ? '度量' : '维度'
                }))
            });
        }
        // 关联的数据源
        const datasources = item.datasources || [];
        if (datasources.length) {
            downstreamItems.push({
                type: 'datasources',
                icon: 'layers',
                label: '使用此表的数据源',
                items: datasources.map(ds => ({
                    id: ds.id,
                    name: ds.name,
                    subtitle: ds.is_certified ? '✓ 已认证' : null
                }))
            });
        }
    }

    // 数据库的下游: 表（增强版）
    if (type === 'databases') {
        const tables = item.tables || [];
        if (tables.length) {
            downstreamItems.push({
                type: 'tables',
                icon: 'table-2',
                label: '包含的数据表',
                items: tables.slice(0, 15).map(t => ({
                    id: t.id,
                    name: t.name,
                    subtitle: t.schema ? `Schema: ${t.schema}` : `${t.field_count || 0} 字段`
                }))
            });
        }
    }

    // 工作簿的下游: 视图
    if (type === 'workbooks') {
        const views = item.views || [];
        if (views.length) {
            downstreamItems.push({
                type: 'views',
                icon: 'layout',
                label: '包含的视图',
                items: views.map(v => ({
                    id: v.id,
                    name: v.name,
                    subtitle: v.view_type || 'sheet'
                }))
            });
        }
        const usedFields = item.used_fields || [];
        const usedMetrics = item.used_metrics || [];
        if (usedFields.length) {
            downstreamItems.push({
                type: 'fields',
                icon: 'columns',
                label: '使用的字段',
                items: usedFields.slice(0, 10).map(f => ({ id: f.id, name: f.name }))
            });
        }
        if (usedMetrics.length) {
            downstreamItems.push({
                type: 'metrics',
                icon: 'function-square',
                label: '使用的指标',
                items: usedMetrics.slice(0, 10).map(m => ({ id: m.id, name: m.name }))
            });
        }
    }

    // 视图的下游: 字段、指标
    if (type === 'views') {
        const usedFields = item.used_fields || [];
        const usedMetrics = item.used_metrics || [];
        if (usedFields.length) {
            downstreamItems.push({
                type: 'fields',
                icon: 'columns',
                label: '使用的字段',
                items: usedFields.slice(0, 10).map(f => ({ id: f.id, name: f.name }))
            });
        }
        if (usedMetrics.length) {
            downstreamItems.push({
                type: 'metrics',
                icon: 'function-square',
                label: '使用的指标',
                items: usedMetrics.slice(0, 10).map(m => ({ id: m.id, name: m.name }))
            });
        }
    }

    // 项目的下游: 数据源、工作簿
    if (type === 'projects') {
        const datasources = item.datasources || [];
        if (datasources.length) {
            downstreamItems.push({
                type: 'datasources',
                icon: 'layers',
                label: '项目内数据源',
                items: datasources.map(ds => ({
                    id: ds.id,
                    name: ds.name,
                    subtitle: ds.is_certified ? '✓ 已认证' : `${ds.field_count || 0} 字段`
                }))
            });
        }
        const workbooks = item.workbooks || [];
        if (workbooks.length) {
            downstreamItems.push({
                type: 'workbooks',
                icon: 'book-open',
                label: '项目内工作簿',
                items: workbooks.map(wb => ({
                    id: wb.id,
                    name: wb.name,
                    subtitle: `${wb.view_count || 0} 视图`
                }))
            });
        }
    }

    if (downstreamItems.length === 0) return '';

    html += `
    <div class="bg-green-50 rounded-lg border border-green-100 p-4">
        <h3 class="text-[12px] font-bold text-green-900 mb-3 flex items-center gap-2">
            <i data-lucide="arrow-down-circle" class="w-3.5 h-3.5 text-green-600"></i> 下游资产 (被谁使用)
        </h3>
        <div class="space-y-3">
            ${downstreamItems.map(group => `
                <div>
                    <div class="text-[10px] text-green-600 font-medium mb-1.5 flex items-center gap-1">
                        <i data-lucide="${group.icon}" class="w-3 h-3"></i> ${group.label} (${group.items.length})
                    </div>
                    <div class="space-y-1">
                        ${group.items.slice(0, 5).map(asset => `
                            <div class="flex items-center justify-between bg-white p-2 rounded border border-green-100 ${asset.id ? 'cursor-pointer hover:border-green-300' : ''} transition-colors"
                                 ${asset.id ? `onclick="showDetail('${asset.id}', '${group.type}')"` : ''}>
                                <div class="flex flex-col min-w-0">
                                    <span class="text-[12px] text-gray-700 font-medium truncate">${asset.name}</span>
                                    ${asset.subtitle ? `<span class="text-[10px] text-gray-400">${asset.subtitle}</span>` : ''}
                                </div>
                                ${asset.id ? '<i data-lucide="chevron-right" class="w-3 h-3 text-gray-400 flex-shrink-0"></i>' : ''}
                            </div>
                        `).join('')}
                        ${group.items.length > 5 ? `<div class="text-[10px] text-green-500 pl-2">+${group.items.length - 5} 更多...</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>`;

    return html;
}

// 渲染相似/重复资产卡片 (仅指标) - 增强版：显示使用情况
function renderSimilarAssets(item) {
    const dups = item.similarMetrics || [];
    if (dups.length === 0) return '';

    return `
    <div class="bg-red-50 rounded-lg border border-red-100 p-4">
        <div class="flex items-start gap-3">
            <i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"></i>
            <div class="flex-1">
                <h3 class="text-[13px] font-bold text-red-800 mb-1">发现重复定义的指标</h3>
                <p class="text-[11px] text-red-600 mb-3">以下 ${dups.length} 个指标使用了相同计算公式：</p>
                <div class="space-y-3">
                    ${dups.map(d => {
        const views = d.usedInViews || [];
        const workbooks = d.usedInWorkbooks || [];
        return `
                        <div class="bg-white/80 p-3 rounded border border-red-100 cursor-pointer hover:bg-white transition-colors"
                             onclick="showDetail('${d.id}', 'metrics')">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[12px] font-bold text-red-900">${d.name}</span>
                                <span class="text-[10px] text-red-400 bg-red-100 px-1.5 rounded">ID: ${d.id ? d.id.substring(0, 6) : '-'}</span>
                            </div>
                            <div class="text-[10px] text-gray-500 mb-2">数据源: ${d.datasourceName || '-'}</div>
                            ${workbooks.length ? `
                            <div class="mt-2 pt-2 border-t border-red-100">
                                <div class="text-[10px] text-red-700 font-medium mb-1">使用此重复指标的工作簿:</div>
                                <div class="flex flex-wrap gap-1">
                                    ${workbooks.slice(0, 3).map(wb => `
                                        <span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded"
                                              onclick="event.stopPropagation(); showDetail('${wb.id}', 'workbooks')">${wb.name}</span>
                                    `).join('')}
                                    ${workbooks.length > 3 ? `<span class="text-[10px] text-red-400">+${workbooks.length - 3} 更多</span>` : ''}
                                </div>
                            </div>
                            ` : ''}
                            ${views.length && !workbooks.length ? `
                            <div class="mt-2 pt-2 border-t border-red-100">
                                <div class="text-[10px] text-red-700 font-medium mb-1">使用此重复指标的视图:</div>
                                <div class="flex flex-wrap gap-1">
                                    ${views.slice(0, 3).map(v => `
                                        <span class="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">${v.name}</span>
                                    `).join('')}
                                    ${views.length > 3 ? `<span class="text-[10px] text-red-400">+${views.length - 3} 更多</span>` : ''}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    `}).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
    // 清空历史记录
    detailHistory = [];
    currentDetailItem = null;
    currentDetailType = null;
    updateBackButton();
}

// 返回上一个详情
function goBackDetail() {
    if (detailHistory.length === 0) return;
    const prev = detailHistory.pop();
    showDetail(prev.id, prev.type, false); // 不添加到历史
}

// 更新返回按钮和面包屑
function updateBackButton() {
    const backBtn = document.getElementById('drawer-back-btn');
    const breadcrumb = document.getElementById('drawer-breadcrumb');

    if (detailHistory.length > 0) {
        backBtn.style.display = 'flex';
        breadcrumb.style.display = 'block';
        // 渲染面包屑
        const crumbs = detailHistory.map((h, i) => `
            <span class="cursor-pointer hover:text-indigo-600" onclick="jumpToHistory(${i})">${getModuleName(h.type)}: ${h.name}</span>
        `).join(' <span class="mx-1">→</span> ');
        breadcrumb.innerHTML = crumbs + ` <span class="mx-1">→</span> <span class="text-gray-700 font-medium">${currentDetailItem?.name || ''}</span>`;
    } else {
        backBtn.style.display = 'none';
        breadcrumb.style.display = 'none';
    }
}

// 跳转到历史中的某一项
function jumpToHistory(index) {
    // 移除index之后的所有历史
    const target = detailHistory[index];
    detailHistory = detailHistory.slice(0, index);
    showDetail(target.id, target.type, false);
}

function getModuleName(type) {
    const titles = { databases: '数据库', tables: '数据表', fields: '字段', metrics: '指标', datasources: '数据源', workbooks: '工作簿', projects: '项目', views: '视图' };
    return titles[type] || type;
}

function renderPropRow(label, value, isCode = false) {
    if (!value) return '';
    return `
    <div class="col-span-1">
        <div class="text-[10px] text-gray-400 mb-0.5">${label}</div>
        <div class="text-[12px] text-gray-700 ${isCode ? 'font-mono text-[11px]' : ''} truncate" title="${value}">${value}</div>
    </div>`;
}

// 渲染统计信息卡片
function renderStatsCard(stats, type) {
    const statLabels = {
        table_count: '数据表',
        total_fields: '字段总数',
        total_columns: '原始列',
        connected_datasource_count: '关联数据源',
        column_count: '原始列',
        field_count: '字段数',
        datasource_count: '数据源',
        workbook_count: '工作簿',
        metric_count: '指标数',
        total_views: '视图总数',
        certified_datasources: '已认证',
        certification_rate: '认证率'
    };

    const statItems = Object.entries(stats)
        .filter(([k, v]) => v !== undefined && v !== null && statLabels[k])
        .map(([k, v]) => ({
            label: statLabels[k],
            value: k === 'certification_rate' ? `${v}%` : v
        }));

    if (statItems.length === 0) return '';

    return `
    <div class="bg-purple-50 rounded-lg border border-purple-100 p-4">
        <h3 class="text-[12px] font-bold text-purple-900 mb-3 flex items-center gap-2">
            <i data-lucide="bar-chart-2" class="w-3.5 h-3.5 text-purple-600"></i> 统计概览
        </h3>
        <div class="grid grid-cols-3 gap-3">
            ${statItems.map(s => `
                <div class="bg-white rounded p-2 border border-purple-100 text-center">
                    <div class="text-lg font-bold text-purple-700">${s.value}</div>
                    <div class="text-[10px] text-gray-500">${s.label}</div>
                </div>
            `).join('')}
        </div>
    </div>`;
}

// ===================== 全局搜索 =====================
let searchTimeout;
function handleSearch(e) {
    const query = e.target.value.trim();

    // 如果是简单的列表过滤（在数据列表页且字符少于3个）
    if (state.activeModule !== 'overview' && query.length < 3) {
        state.searchTerm = query;
        applyFilters();
        return;
    }

    // 全局搜索（Enter 键或字符超过 2 个）
    if (e.key === 'Enter' || query.length >= 3) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performGlobalSearch(query), 300);
    }
}

async function performGlobalSearch(query) {
    if (!query || query.length < 2) return;

    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `<div class="loading"><i data-lucide="loader-2" class="spin"></i> 搜索中...</div>`;
    lucide.createIcons();

    try {
        const data = await api.get(`/search?q=${encodeURIComponent(query)}`);
        renderSearchResults(data);
    } catch (e) {
        mainContent.innerHTML = `<div class="empty">搜索失败</div>`;
    }
}

function renderSearchResults(data) {
    const c = document.getElementById('main-content');
    const { query, total, results } = data;

    if (total === 0) {
        c.innerHTML = `
            <div class="page-header"><h1>搜索结果</h1><span class="count">无结果</span></div>
            <div class="empty">没有找到 "${query}" 相关内容</div>`;
        return;
    }

    const typeLabels = { field: '字段', table: '数据表', datasource: '数据源', workbook: '工作簿', metric: '指标' };
    const typeIcons = { field: 'columns', table: 'table-2', datasource: 'layers', workbook: 'book-open', metric: 'function-square' };

    let html = `
        <div class="page-header">
            <h1>搜索结果 <small style="color:#94a3b8;font-weight:normal;">"${query}"</small></h1>
            <span class="count">${total} 项</span>
        </div>`;

    // 按类型分组展示
    for (const [type, items] of Object.entries(results)) {
        if (!items.length) continue;

        html += `
        <div class="search-group" style="margin-bottom:24px;">
            <h3 style="font-size:14px;font-weight:600;color:#475569;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                <i data-lucide="${typeIcons[type.replace('s', '')]}" style="width:16px;height:16px;"></i>
                ${typeLabels[type.replace('s', '')] || type} (${items.length})
            </h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(350px, 1fr));gap:12px;">
                ${items.map(item => `
                    <div class="search-item" onclick="showDetail('${item.id}', '${type}')" 
                         style="padding:12px 16px;background:white;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;transition:all 0.2s;">
                        <div style="font-weight:500;color:#1e293b;margin-bottom:4px;">${item.name}</div>
                        <div style="font-size:12px;color:#94a3b8;">
                            ${item.source || item.schema || item.project || item.datasource || item.formula || '-'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    c.innerHTML = html;
    lucide.createIcons();

    // 添加 hover 效果
    document.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('mouseenter', () => el.style.borderColor = '#a5b4fc');
        el.addEventListener('mouseleave', () => el.style.borderColor = '#e2e8f0');
    });
}

// ===================== 血缘图可视化 =====================
async function showLineageGraph(type, id) {
    const drawer = document.getElementById('detail-drawer');
    const content = document.getElementById('drawer-content');
    const title = document.getElementById('drawer-title');

    title.textContent = '血缘关系图';
    content.innerHTML = `<div class="loading"><i data-lucide="loader-2" class="spin"></i></div>`;
    lucide.createIcons();

    try {
        const data = await api.get(`/lineage/graph/${type}/${id}`);

        content.innerHTML = `
            <div class="lineage-graph-container">
                <div class="section-title">数据血缘</div>
                <div id="mermaid-graph" class="mermaid" style="background:#f8fafc;padding:16px;border-radius:8px;border:1px solid #e2e8f0;overflow:auto;">
                    ${data.mermaid}
                </div>
                <div class="section-title" style="margin-top:24px;">节点列表</div>
                <div class="nodes-list">
                    ${data.nodes.map(n => `
                        <div class="node-item" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:white;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:6px;cursor:pointer;"
                             onclick="showDetail('${n.id}', '${n.type}s')">
                            <span class="dot ${n.type}" style="width:8px;height:8px;border-radius:50%;background:${getTypeColor(n.type)};"></span>
                            <span style="flex:1;font-size:13px;">${n.name}</span>
                            <span style="font-size:11px;color:#94a3b8;">${n.type}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;

        // 初始化 Mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
            mermaid.run({ nodes: [document.getElementById('mermaid-graph')] });
        }

        lucide.createIcons();
    } catch (e) {
        content.innerHTML = `<div class="empty">加载血缘关系失败</div>`;
        console.error(e);
    }
}

function getTypeColor(type) {
    const colors = {
        field: '#3b82f6',
        metric: '#f59e0b',
        table: '#7c3aed',
        datasource: '#10b981',
        workbook: '#e11d48',
        view: '#6366f1'
    };
    return colors[type] || '#64748b';
}

// 快捷键支持
document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + K 聚焦搜索框
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search')?.focus();
    }
    // Escape 关闭抽屉
    if (e.key === 'Escape') {
        closeDrawer();
    }
});

async function updateGlobalStats() {
    const s = await api.get('/stats');
    state.stats = s;
    for (const [k, v] of Object.entries(s)) {
        const el = document.getElementById(`count-${k}`);
        if (el) el.textContent = v > 1000 ? (v / 1000).toFixed(1) + 'k' : v;
    }
}

