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
        fields: ['role', 'data_type', 'hasDescription'],  // 新增 hasDescription
        datasources: ['is_certified'],
        metrics: ['role', 'hasDuplicate']  // 新增 hasDuplicate
    };
    const keys = cfg[state.activeModule] || [];
    state.facets = {};
    keys.forEach(k => {
        state.facets[k] = {};
        data.forEach(i => { if (i[k] != null) state.facets[k][String(i[k])] = (state.facets[k][String(i[k])] || 0) + 1; });
    });
}

// ===================== 核心渲染 =====================
function renderList() {
    const c = document.getElementById('main-content');
    const n = state.filteredData.length;
    const t = state.activeModule;
    const titles = { databases: '数据库', tables: '数据表', fields: '字段字典', metrics: '指标库', datasources: '数据源', workbooks: '工作簿' };

    // 排序按钮
    const sortCfg = { fields: ['usageCount:热度', 'name:名称'], metrics: ['complexity:复杂度', 'referenceCount:引用'], tables: ['field_count:字段数'] };
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
        hasDuplicate: '有重复'
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
        default: return '';
    }
}

// ===================== 数据库表格 =====================
function renderDBTable() {
    const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '-';
    return `<table class="data-table">
        <thead><tr><th>名称</th><th>类型</th><th>平台</th><th>表数量</th><th>主机</th><th>更新时间</th><th>状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => `
            <tr onclick="showDetail('${i.id}','databases')">
                <td><div class="cell-main"><i data-lucide="database" class="icon db"></i><span class="name">${i.name}</span></div></td>
                <td><span class="tag type">${i.type || '-'}</span></td>
                <td class="muted">${i.platform || '-'}</td>
                <td class="num">${i.table_count || i.tables || 0}</td>
                <td class="muted">${i.host || i.id?.substring(0, 8) || '-'}</td>
                <td class="muted text-[11px]">${formatDate(i.updatedAt)}</td>
                <td>${(i.table_count || i.tables) ? '<span class="status ok">●</span>' : '<span class="status warn">●</span>'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// ===================== 数据表表格 =====================
function renderTablesTable() {
    return `<table class="data-table">
        <thead><tr><th>表名</th><th>数据库</th><th>Schema</th><th>字段数</th><th>连接</th><th>预览字段</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const fc = i.field_count || i.fieldCount || 0;
        const pf = i.preview_fields || {};
        const preview = [...(pf.measures || []).slice(0, 2).map(f => `<span class="tag measure">#${f}</span>`), ...(pf.dimensions || []).slice(0, 2).map(f => `<span class="tag dim">Abc ${f}</span>`)].join('');
        return `
            <tr onclick="showDetail('${i.id}','tables')">
                <td><div class="cell-main"><i data-lucide="table-2" class="icon tbl"></i><span class="name">${i.name}</span>${i.isEmbedded ? '<span class="tag warn">嵌入</span>' : ''}</div></td>
                <td class="muted">${i.databaseName || '-'}</td>
                <td><span class="tag schema">${i.schema || 'public'}</span></td>
                <td class="num">${fc}</td>
                <td class="muted">${i.connectionType || '-'}</td>
                <td class="preview">${preview || '-'}</td>
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
        <thead><tr><th>数据源</th><th>项目</th><th>所有者</th><th>表数</th><th>类型</th><th>认证</th><th>最后刷新</th><th>状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const live = !i.hasExtract;
        let stale = 0;
        if (i.hasExtract && i.lastRefresh) stale = Math.floor((new Date() - new Date(i.lastRefresh)) / 86400000);
        return `
            <tr onclick="showDetail('${i.id}','datasources')">
                <td><div class="cell-main"><i data-lucide="layers" class="icon ds"></i><span class="name">${i.name}</span></div></td>
                <td class="muted">${i.projectName || '-'}</td>
                <td class="muted">${i.owner || '-'}</td>
                <td class="num">${i.tableCount || 0}</td>
                <td><span class="tag ${live ? 'live' : 'extract'}">${live ? 'Live' : 'Extract'}</span></td>
                <td>${i.isCertified ? '<span class="tag cert">✓</span>' : '-'}</td>
                <td class="muted text-[11px]">${formatDate(i.lastRefresh)}</td>
                <td>${stale > 30 ? `<span class="tag error">停更${stale}天</span>` : stale > 7 ? `<span class="tag warn">${stale}天前</span>` : '<span class="status ok">●</span>'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 工作簿表格 =====================
function renderWBTable() {
    return `<table class="data-table">
        <thead><tr><th>工作簿</th><th>项目</th><th>所有者</th><th>视图数</th></tr></thead>
        <tbody>${state.filteredData.map(i => `
            <tr onclick="showDetail('${i.id}','workbooks')">
                <td><div class="cell-main"><i data-lucide="book-open" class="icon wb"></i><span class="name">${i.name}</span></div></td>
                <td class="muted">${i.projectName || '-'}</td>
                <td class="muted">${i.owner || '-'}</td>
                <td class="num">${i.viewCount || 0}</td>
            </tr>`).join('')}
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

// ===================== 概览 (新版治理仪表盘) =====================
async function renderOverview() {
    const c = document.getElementById('main-content');
    try {
        const d = await api.get('/dashboard/analysis');

        // 确保 scores 存在 (兼容旧接口)
        const scores = d.governance_scores || { completeness: 0, timeliness: 0, consistency: 0, validity: 0 };
        const hc = d.health_score >= 80 ? 'good' : d.health_score >= 60 ? 'warn' : 'bad';

        // 构建资产统计
        const totalAssets = d.total_assets || {};

        // 辅助函数: 构建维度卡片
        const buildDimCard = (label, score, icon, color) => {
            const status = score >= 90 ? 'good' : score >= 70 ? 'warn' : 'bad';
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
async function showDetail(id, type) {
    const drawer = document.getElementById('detail-drawer');
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('drawer-title');
    const content = document.getElementById('drawer-content');

    drawer.classList.add('open');
    overlay.classList.add('active');

    // 如果是切换，先清理
    content.innerHTML = '<div class="loading py-10 flex justify-center"><i data-lucide="loader-2" class="spin w-6 h-6 text-indigo-500"></i></div>';
    lucide.createIcons();

    // 数据获取
    let item = state.data.find(i => i.id == id);
    // 如果数据不在当前列表（比如从字段跳转到指标），需要单独 fetch
    if (!item) {
        try {
            item = await api.get(`/${type}/${id}`);
            // 兼容 metrics 列表接口返回的是 list，这里模拟单个 fetch
            if (Array.isArray(item)) item = item.find(i => i.id == id);
            // 如果后端没有单查接口 (如 metrics)，可能要遍历全量，这里假设列表已加载或后端支持 id 查询
            // 现在的 API 在 metrics 上不支持单查，我们临时处理一下：
            if (type === 'metrics' && !item) {
                const allMetrics = await api.get('/metrics');
                item = allMetrics.find(m => m.id == id);
            }
        } catch (e) { console.error(e); }
    }

    if (!item) { content.innerHTML = '<div class="text-center text-gray-400 py-8">未找到数据</div>'; return; }

    title.innerHTML = `<div class="flex flex-col">
        <span>${item.name}</span>
        <span class="text-[10px] font-normal text-gray-400 uppercase tracking-wide mt-0.5">${getModuleName(type)} 详情</span>
    </div>`;

    let html = `<div class="space-y-6">`;

    // 1. 基本属性卡片
    html += `
    <div class="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
        <h3 class="text-[12px] font-bold text-gray-900 mb-3 flex items-center gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 text-indigo-500"></i> 基本信息
        </h3>
        <div class="grid grid-cols-2 gap-y-3 gap-x-4">
            ${renderPropRow('ID', item.id, true)}
            ${renderPropRow('类型', item.dataType || item.type)}
            ${renderPropRow('所有者', item.owner)}
            ${renderPropRow('数据源', item.datasourceName || item.datasource)}
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

    // 2. 关联分析 (针对字段)
    if (type === 'fields') {
        const metrics = item.used_by_metrics || [];
        const views = item.used_in_views || [];

        // 指标影响
        if (metrics.length) {
            html += `
            <div class="bg-indigo-50 rounded-lg border border-indigo-100 p-4">
                <h3 class="text-[12px] font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <i data-lucide="function-square" class="w-3.5 h-3.5 text-indigo-600"></i> 
                    影响的指标 (${metrics.length})
                </h3>
                <div class="space-y-2">
                    ${metrics.map(m => `
                        <div class="flex items-center justify-between bg-white p-2 rounded border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors"
                             onclick="showDetail('${m.id}', 'metrics')">
                            <span class="text-[12px] text-gray-700 font-medium">${m.name}</span>
                            <i data-lucide="chevron-right" class="w-3 h-3 text-gray-400"></i>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        // 视图影响
        if (views.length) {
            html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-[12px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <i data-lucide="layout" class="w-3.5 h-3.5 text-gray-500"></i> 
                    使用的视图 (${views.length})
                </h3>
                <div class="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                    ${views.map(v => `
                        <div class="flex items-center justify-between text-[12px] py-1 border-b border-gray-50 last:border-0">
                            <span class="text-gray-600 truncate">${v.workbookName} / ${v.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
    }

    // 3. 重复分析 (针对指标)
    if (type === 'metrics') {
        const dups = item.similarMetrics || [];
        const deps = item.dependencyFields || [];
        const views = item.usedInViews || [];

        // 依赖字段
        if (deps.length) {
            html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-[12px] font-bold text-gray-900 mb-3">依赖基础字段 (${deps.length})</h3>
                <div class="flex flex-wrap gap-2">
                    ${deps.map(d => `
                        <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] border border-blue-100 cursor-pointer hover:bg-blue-100"
                              onclick="${d.id ? `showDetail('${d.id}', 'fields')` : ''}">
                            <i data-lucide="columns" class="w-3 h-3 inline mr-1 align-text-top"></i>${d.name}
                        </span>
                    `).join('')}
                </div>
            </div>`;
        }

        // 重复指标提示（只读，去掉治理按钮）
        if (dups.length) {
            html += `
            <div class="bg-red-50 rounded-lg border border-red-100 p-4">
                <div class="flex items-start gap-3">
                    <i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"></i>
                    <div class="flex-1">
                        <h3 class="text-[13px] font-bold text-red-800 mb-1">发现重复定义的指标</h3>
                        <p class="text-[11px] text-red-600 mb-3">以下 ${dups.length} 个指标使用了相同计算公式（只读展示）：</p>
                        <div class="space-y-2">
                            ${dups.map(d => `
                                <div class="bg-white/60 p-2 rounded border border-red-100 flex flex-col gap-1 cursor-pointer hover:bg-white"
                                     onclick="showDetail('${d.id}', 'metrics')">
                                    <div class="flex justify-between items-center">
                                        <span class="text-[12px] font-bold text-red-900">${d.name}</span>
                                        <span class="text-[10px] text-red-400 bg-red-100 px-1.5 rounded">ID: ${d.id.substring(0, 6)}</span>
                                    </div>
                                    <div class="text-[10px] text-gray-500">数据源: ${d.datasourceName || '-'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>`;
        }

        // 所在报表 (Impact)
        if (views.length) {
            html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-[12px] font-bold text-gray-900 mb-3">应用报表 (${views.length})</h3>
                <ul class="list-disc pl-4 space-y-1">
                    ${views.map(v => `<li class="text-[12px] text-gray-600">${v.workbookName} / <span class="font-medium text-gray-800">${v.name}</span></li>`).join('')}
                </ul>
            </div>`;
        }
    }

    html += `</div>`;
    content.innerHTML = html;
    lucide.createIcons();
}

function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

function getModuleName(type) {
    const titles = { databases: '数据库', tables: '数据表', fields: '字段', metrics: '指标', datasources: '数据源', workbooks: '工作簿' };
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

